import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { logAiOpenAICall } from "../_shared/posthogLogging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openAiKey = Deno.env.get("OPENAI_API_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const service = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { workspace_id } = body as { workspace_id: string };
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!workspace_id || !UUID_RE.test(workspace_id)) return new Response(JSON.stringify({ error: "workspace_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Internal cron calls carry the service role key as their Bearer token.
    // This cannot be spoofed by a regular user JWT.
    //
    // NOTE: synthesis does NOT call consume_war_room_session. The chat turn
    // that triggered this synthesis already counted as one War Room session
    // unit, and the cron path is server-side regeneration (not a user
    // session). Counting here would double-charge the same unit.
    const isInternalCall = authHeader === `Bearer ${serviceKey}`;

    let user: { id: string } | null = null;

    if (isInternalCall) {
      // Server-side call — look up the workspace owner to run synthesis on their behalf
      const { data: ownerRow } = await service
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspace_id)
        .eq("role", "owner")
        .maybeSingle();
      if (!ownerRow) return new Response(JSON.stringify({ error: "Workspace not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      user = { id: ownerRow.user_id };
    } else {
      const { data: { user: authUser } } = await userClient.auth.getUser();
      if (!authUser) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      user = authUser;

      // Verify membership for user-initiated calls
      const { data: member } = await service
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspace_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!member) return new Response(JSON.stringify({ error: "Not a member" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch workspace, messages, the previous synthesis, and the user's prior
    // workspace memory summaries in parallel
    const [wsRes, msgsRes, prevSynthRes, priorMemoryRes] = await Promise.all([
      service.from("workspaces").select("name, topic, description").eq("id", workspace_id).maybeSingle(),
      service.from("workspace_messages").select("role, content, agent_name, agent_role, created_at").eq("workspace_id", workspace_id).order("created_at", { ascending: true }).limit(200),
      service.from("workspace_synthesis")
        .select("open_questions, conflict_zones, blind_spots, action_items, generated_at")
        .eq("workspace_id", workspace_id)
        .maybeSingle(),
      service.from("user_memory_summaries")
        .select("summary_text, key_decisions, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const workspace = wsRes.data;
    const messages = msgsRes.data || [];
    const prevSynth = prevSynthRes.data;

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages to synthesize" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const workspaceContext = [
      workspace?.name ? `Topic: ${workspace.name}` : "",
      workspace?.topic ? `Focus: ${workspace.topic}` : "",
      workspace?.description ? `Context: ${workspace.description}` : "",
    ].filter(Boolean).join("\n");

    // Build a composite transcript that always includes:
    //   - The first 10 messages: where the decision framing and initial clarifications are set.
    //   - The last 50 messages: the most recent debate and any clarifications discussed.
    // This ensures that re-synthesis after a clarifying discussion captures BOTH the original
    // parameters AND any refined understanding of the decision that emerged in conversation.
    function formatMsg(m: { role: string; content: string; agent_role?: string | null }): string {
      const content = m.content.length > 1500 ? m.content.slice(0, 1500) + "…" : m.content;
      if (m.role === "user") return `[TEAM]: ${content}`;
      const label = m.agent_role ? `[${(m.agent_role as string).toUpperCase().replace(/_/g, " ")}]` : "[AGENT]";
      return `${label}: ${content}`;
    }

    // ── Bias flag validation ────────────────────────────────────────────────
    // Ensure each cognitive bias flag is grounded in the actual session
    // transcript. Flags whose explanation shares no meaningful word overlap
    // with the transcript are dropped entirely. If none survive, the section
    // is omitted (stored as []).
    function validateBiasFlags(
      flags: unknown,
      transcriptText: string,
      workspaceName: string,
    ): Array<{ bias_name: string; explanation: string; counter_question: string }> {
      if (!Array.isArray(flags)) return [];
      const transcriptLower = transcriptText.toLowerCase();
      const topicLower = (workspaceName || "").toLowerCase();
      const topicWords = topicLower
        .split(/[\s,.-]+/)
        .filter((w) => w.length > 3)
        .map((w) => w.replace(/[^a-z0-9]/g, ""));

      const result: Array<{ bias_name: string; explanation: string; counter_question: string }> = [];
      for (const f of flags) {
        if (!f || typeof f !== "object") continue;
        const r = f as Record<string, unknown>;
        const biasName = typeof r.bias_name === "string" ? r.bias_name.trim() : "";
        const explanation = typeof r.explanation === "string" ? r.explanation.trim() : "";
        const counterQuestion = typeof r.counter_question === "string" ? r.counter_question.trim() : "";
        if (!biasName || !explanation || !counterQuestion) continue;

        const explLower = explanation.toLowerCase();

        // Extract significant words from the explanation (length > 4, alphabetic)
        const explWords = explLower
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length > 4);

        if (explWords.length === 0) continue;

        // Check overlap with transcript content
        let matched = 0;
        for (const w of explWords) {
          if (transcriptLower.includes(w)) matched++;
        }
        const overlapRatio = matched / explWords.length;

        // Require at least 15% of significant explanation words to appear in
        // the transcript. This filters out fabricated/hallucinated bias
        // examples while allowing paraphrased analysis.
        if (overlapRatio < 0.15) continue;

        // If topic words are available, check that the explanation shares at
        // least some topical relevance. This catches cases where the bias is
        // about a completely unrelated subject (e.g., employee resignation in
        // an AI predictions session).
        if (topicWords.length > 0) {
          let topicMatch = 0;
          for (const w of topicWords) {
            if (explLower.includes(w)) topicMatch++;
          }
          // If zero topic words appear in the explanation AND the overlap
          // ratio is moderate (not a near-exact quote), skip the flag — it's
          // likely off-topic.
          if (topicMatch === 0 && overlapRatio < 0.4) continue;
        }

        result.push({ bias_name: biasName, explanation, counter_question: counterQuestion });
      }
      return result;
    }

    // ── Conflict zone validation ─────────────────────────────────────────────
    // Ensure each conflict zone references specific positions from the actual
    // transcript. Zones whose positions share no meaningful word overlap with
    // the transcript are dropped.
    function validateConflictZones(
      zones: unknown,
      transcriptText: string,
    ): Array<Record<string, unknown>> {
      if (!Array.isArray(zones)) return [];
      const transcriptLower = transcriptText.toLowerCase();
      const result: Array<Record<string, unknown>> = [];

      for (const z of zones) {
        if (!z || typeof z !== "object") continue;
        const r = z as Record<string, unknown>;
        const topic = typeof r.topic === "string" ? r.topic.trim() : "";
        const positionA = typeof r.position_a === "string" ? r.position_a.trim() : "";
        const positionB = typeof r.position_b === "string" ? r.position_b.trim() : "";
        if (!topic || !positionA || !positionB) continue;

        // Combine all text fields for overlap checking
        const combined = `${topic} ${positionA} ${positionB}`.toLowerCase();
        const words = combined.split(/[^a-z0-9]+/).filter((w) => w.length > 4);
        if (words.length === 0) continue;

        let matched = 0;
        for (const w of words) {
          if (transcriptLower.includes(w)) matched++;
        }
        const overlapRatio = matched / words.length;

        // Require at least 15% of significant words to appear in transcript
        if (overlapRatio < 0.15) continue;

        const positionAVal = typeof r.position_a === "string" ? r.position_a : "";
        const positionBVal = typeof r.position_b === "string" ? r.position_b : "";
        result.push({
          topic,
          agent_a: typeof r.agent_a === "string" ? r.agent_a : "",
          position_a: positionAVal,
          agent_b: typeof r.agent_b === "string" ? r.agent_b : "",
          position_b: positionBVal,
          tension_level: typeof r.tension_level === "number" ? r.tension_level : 50,
        });
      }
      return result;
    }

    // ── Risk signal validation ───────────────────────────────────────────────
    // Ensure each risk signal references a specific entity, term, or claim from
    // the transcript. Generic business platitudes are filtered out.
    function validateRiskSignals(
      signals: unknown,
      transcriptText: string,
    ): Array<Record<string, unknown>> {
      if (!Array.isArray(signals)) return [];
      const transcriptLower = transcriptText.toLowerCase();
      const result: Array<Record<string, unknown>> = [];

      // Common generic risk phrases that should not pass without transcript
      // grounding — if the signal is mostly these words, it's a platitude.
      const genericPhrases = [
        "lean development", "cost-cutting", "cost cutting", "market volatility",
        "competitive pressure", "resource constraint", "cash flow", "burn rate",
        "necessary but risky", "can be beneficial", "poses a threat",
        "operational efficiency", "market dynamics", "strategic alignment",
      ];

      for (const s of signals) {
        if (!s || typeof s !== "object") continue;
        const r = s as Record<string, unknown>;
        const signal = typeof r.signal === "string" ? r.signal.trim() : "";
        if (!signal) continue;

        const signalLower = signal.toLowerCase();
        const words = signalLower.split(/[^a-z0-9]+/).filter((w) => w.length > 4);
        if (words.length === 0) continue;

        // Check overlap with transcript
        let matched = 0;
        for (const w of words) {
          if (transcriptLower.includes(w)) matched++;
        }
        const overlapRatio = matched / words.length;

        // Require at least 15% of significant words to appear in transcript
        if (overlapRatio < 0.15) continue;

        // Penalize generic platitudes: if the signal contains multiple generic
        // phrases and has low overlap, it's likely a platitude
        let genericCount = 0;
        for (const phrase of genericPhrases) {
          if (signalLower.includes(phrase)) genericCount++;
        }
        if (genericCount > 0 && overlapRatio < 0.35) continue;

        result.push({
          signal,
          severity: typeof r.severity === "string" ? r.severity : "medium",
          category: typeof r.category === "string" ? r.category : "strategic",
          ...(Array.isArray(r.source_agents) ? { source_agents: r.source_agents } : {}),
        });
      }
      return result;
    }

    // ── Generic section item validation ──────────────────────────────────────
    // Validates array-of-object sections (consensus_points, open_questions,
    // blind_spots, action_items) by checking that the combined text of each
    // item has sufficient overlap with the session transcript AND, when topic
    // words are available, at least some topical relevance.
    function validateSectionItems(
      items: unknown,
      transcriptText: string,
      workspaceName: string,
      textFields: string[],
    ): Array<Record<string, unknown>> {
      if (!Array.isArray(items)) return [];
      const transcriptLower = transcriptText.toLowerCase();
      const topicWords = (workspaceName || "")
        .toLowerCase()
        .split(/[\s,.-]+/)
        .filter((w) => w.length > 3)
        .map((w) => w.replace(/[^a-z0-9]/g, ""));

      const result: Array<Record<string, unknown>> = [];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const r = item as Record<string, unknown>;
        const combined = textFields
          .map((f) => (typeof r[f] === "string" ? (r[f] as string) : ""))
          .join(" ")
          .toLowerCase();
        const words = combined.split(/[^a-z0-9]+/).filter((w) => w.length > 4);
        if (words.length === 0) continue;

        let matched = 0;
        for (const w of words) {
          if (transcriptLower.includes(w)) matched++;
        }
        const overlapRatio = matched / words.length;
        if (overlapRatio < 0.1) continue;

        if (topicWords.length > 0) {
          let topicMatch = 0;
          for (const w of topicWords) {
            if (combined.includes(w)) topicMatch++;
          }
          if (topicMatch === 0 && overlapRatio < 0.3) continue;
        }

        result.push(r);
      }
      return result;
    }

    // ── Recommendation validation ────────────────────────────────────────────
    // Checks that the recommendation text has sufficient overlap with the
    // transcript and at least some topical relevance. Returns null if it fails.
    function validateRecommendation(
      rec: unknown,
      transcriptText: string,
      workspaceName: string,
    ): string | null {
      if (typeof rec !== "string") return null;
      const text = rec.trim();
      if (text.length < 20) return null;

      const textLower = text.toLowerCase();
      const transcriptLower = transcriptText.toLowerCase();
      const words = textLower.split(/[^a-z0-9]+/).filter((w) => w.length > 4);
      if (words.length === 0) return null;

      let matched = 0;
      for (const w of words) {
        if (transcriptLower.includes(w)) matched++;
      }
      const overlapRatio = matched / words.length;
      if (overlapRatio < 0.1) return null;

      const topicWords = (workspaceName || "")
        .toLowerCase()
        .split(/[\s,.-]+/)
        .filter((w) => w.length > 3)
        .map((w) => w.replace(/[^a-z0-9]/g, ""));
      if (topicWords.length > 0) {
        let topicMatch = 0;
        for (const w of topicWords) {
          if (textLower.includes(w)) topicMatch++;
        }
        if (topicMatch === 0 && overlapRatio < 0.3) return null;
      }

      return text;
    }

    // ── Post-generation regeneration ──────────────────────────────────────────
    // If any sections failed validation (returned fewer items than the AI
    // produced, or the recommendation was rejected), make a targeted
    // regeneration call asking the AI to re-produce ONLY the failed sections
    // with stricter grounding. The result is merged back into the synthesis
    // object and re-validated.
    async function regenerateFailedSections(
      synthesisObj: Record<string, unknown>,
      failedSections: string[],
      transcriptText: string,
      workspaceName: string,
      openAiApiKey: string,
    ): Promise<void> {
      if (failedSections.length === 0) return;

      const sectionInstructions: Record<string, string> = {
        consensus_points: `Produce "consensus_points": [{ "text": "string", "confidence": number, "source_count": number }]. Each text MUST quote or paraphrase specific agent statements from the transcript that show genuine agreement.`,
        conflict_zones: `Produce "conflict_zones": [{ "topic": "string", "agent_a": "string (role name)", "position_a": "string (quote/paraphrase from transcript)", "agent_b": "string (role name)", "position_b": "string (quote/paraphrase from transcript)", "tension_level": number }]. Each position MUST quote or paraphrase what the agent actually said.`,
        open_questions: `Produce "open_questions": [{ "question": "string", "urgency": "critical|high|medium" }]. Each question MUST reference a specific unresolved point from the transcript.`,
        risk_signals: `Produce "risk_signals": [{ "signal": "string (MUST reference a specific entity, term, or claim from the transcript)", "severity": "critical|high|medium|low", "category": "market|execution|financial|team|technology" }]. No generic platitudes.`,
        blind_spots: `Produce "blind_spots": [{ "area": "string", "description": "string" }]. Each area MUST identify a dimension genuinely underweighted in THIS discussion, not a generic gap.`,
        cognitive_bias_flags: `Produce "cognitive_bias_flags": [{ "bias_name": "string", "explanation": "string (MUST quote the specific agent statement showing this bias)", "counter_question": "string" }]. Only include biases that visibly manifested in the transcript.`,
        action_items: `Produce "action_items": [{ "text": "string", "source_area": "string", "priority": "critical|high|medium" }]. Each text MUST be directly derivable from a specific agent recommendation or team statement in the transcript.`,
        recommendation: `Produce "recommendation": "string (5-8 sentences)". MUST reference specific points from the transcript and the central decision. Start with the recommended path, state the tradeoff, identify the 7-day critical action.`,
      };

      const instructionBlocks = failedSections
        .map((s) => sectionInstructions[s] || "")
        .filter(Boolean);
      if (instructionBlocks.length === 0) return;

      const regenPrompt = `You are a Chief Strategy Officer re-doing sections of a War Room synthesis that came back EMPTY. The transcript below is rich — multiple AI advisors debated the decision. There IS evidence; the previous attempt was too conservative.

THE CENTRAL DECISION: "${workspaceName}"

FULL DEBATE TRANSCRIPT:
${transcriptText}

The following sections came back empty. Re-generate ONLY these sections. You MUST produce at least 2 items per section — the transcript contains enough material. Quote or paraphrase specific agent statements. Ground every item in the transcript text above.

${instructionBlocks.join("\n\n")}

Return ONLY valid JSON with exactly these top-level keys. No markdown fences.`;

      const regenStartedAt = Date.now();
      try {
        const regenRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openAiApiKey}` },
          signal: AbortSignal.timeout(90_000),
          body: JSON.stringify({
            model: "gpt-4.1",
            messages: [
              {
                role: "system",
                content: "You are a strategic synthesis engine. You produce JSON only, grounded entirely in the transcript. The transcript contains a rich multi-agent debate — find the evidence that is there. Every section should have at least 2 items unless the topic was truly never discussed.",
              },
              { role: "user", content: regenPrompt },
            ],
            max_tokens: 3000,
            response_format: { type: "json_object" },
          }),
        });

        if (!regenRes.ok) {
          logAiOpenAICall({ distinctId: user!.id, workspaceId: workspace_id, functionName: "workspace-synthesize", callSite: "section_regeneration", model: "gpt-4.1", maxCompletionTokens: 3000, jsonMode: true, latencyMs: Date.now() - regenStartedAt, status: "errored", httpStatus: regenRes.status });
          return;
        }
        const regenJson = await regenRes.json();
        logAiOpenAICall({ distinctId: user!.id, workspaceId: workspace_id, functionName: "workspace-synthesize", callSite: "section_regeneration", model: "gpt-4.1", usage: regenJson.usage, maxCompletionTokens: 3000, jsonMode: true, latencyMs: Date.now() - regenStartedAt, status: "succeeded", httpStatus: regenRes.status });
        const regenRaw = regenJson.choices?.[0]?.message?.content || "{}";
        const regenParsed = JSON.parse(regenRaw);

        for (const section of failedSections) {
          if (section in regenParsed) {
            synthesisObj[section] = regenParsed[section];
          }
        }
      } catch (e) {
        const isTimeout = e instanceof DOMException && e.name === "TimeoutError";
        logAiOpenAICall({ distinctId: user!.id, workspaceId: workspace_id, functionName: "workspace-synthesize", callSite: "section_regeneration", model: "gpt-4.1", maxCompletionTokens: 3000, jsonMode: true, latencyMs: Date.now() - regenStartedAt, status: isTimeout ? "timeout" : "errored" });
        console.error("Regeneration call failed:", e);
      }
    }

    let transcript: string;
    if (messages.length <= 50) {
      // Short session: include everything
      transcript = messages.map(formatMsg).join("\n\n");
    } else {
      // Long session: anchor to early framing + recent discussion
      const framingMessages = messages.slice(0, 10);
      const recentMessages = messages.slice(-50);
      // Avoid duplicates if the session is short enough that slices overlap
      const framingPart = framingMessages.map(formatMsg).join("\n\n");
      const recentPart = recentMessages.map(formatMsg).join("\n\n");
      transcript = `=== SESSION OPENING (decision framing & initial clarifications) ===\n${framingPart}\n\n=== RECENT DISCUSSION (last 50 messages — re-synthesis input) ===\n${recentPart}`;
    }

    // ─── SYNTHESIS PROMPT ─────────────────────────────────────────────────────
    const synthesisPrompt = `You are a world-class Chief Strategy Officer and decision intelligence engine. You have just witnessed a full War Room debate between seven specialist AI advisors. Your mandate is to produce the most comprehensive, rigorous, and exhaustive strategic synthesis possible — the kind that a Board of Directors, Series B investor, or Fortune 500 C-suite would trust to make a multimillion-dollar decision.

Every field must be populated to the maximum. Thin, generic, or vague outputs are unacceptable. Every item must be grounded in the specific debate transcript provided.

WORKSPACE CONTEXT:
${workspaceContext}
${(() => {
  const priorSummaries = (priorMemoryRes.data || []) as { summary_text: string; key_decisions: string[]; created_at: string }[];
  if (priorSummaries.length === 0) return "";
  const pcLines: string[] = [
    "",
    "=== PRIOR WORKSPACE CONTEXT (from the user's previous sessions) ===",
    "The user has worked on prior decisions in other workspaces. Use this context to inform your synthesis — reference their decision style, prior conclusions, and recurring patterns where relevant. Do not force connections.",
    "",
  ];
  let tokenBudget = 800;
  for (const ps of priorSummaries) {
    const entry = `--- Prior workspace (${new Date(ps.created_at).toLocaleDateString()}) ---\n${ps.summary_text}${ps.key_decisions?.length > 0 ? `\nKey decisions: ${ps.key_decisions.join("; ")}` : ""}`;
    const approxTokens = Math.ceil(entry.length / 4);
    if (tokenBudget - approxTokens < 0) break;
    pcLines.push(entry);
    tokenBudget -= approxTokens;
  }
  pcLines.push("=== END PRIOR WORKSPACE CONTEXT ===");
  return "\n" + pcLines.join("\n");
})()}

=== TOPIC ANCHOR — READ THIS FIRST AND OBEY IT IN EVERY SECTION ===
THE CENTRAL DECISION BEING EVALUATED IS: "${workspace?.name || "the workspace decision"}"

This anchor is immovable. Long sessions often drift — agents discuss surveys, tooling, org design, competitor moves, and process details. Your synthesis must NOT follow that drift. Every section you write must answer: "What does this tell us about ${workspace?.name || "the central decision"}?"

Correct: "In the context of the RTO decision, employee survey data tells us that 67% of staff prefer 2 days/week — which shifts the cost-of-talent-attrition risk significantly."
Wrong: "Surveys should use a 5-point Likert scale and be sent on Tuesday mornings for maximum response rate."

For every consensus point, risk, action item, and recommendation: explicitly connect it back to the central decision. If a tangential topic cannot be connected to the central decision, exclude it.
=== END TOPIC ANCHOR ===

${(() => {
      if (!prevSynth || !prevSynth.generated_at) return "";
      const lines: string[] = [
        "",
        "=== RESOLUTION TRACKING — HIGHEST PRIORITY INSTRUCTION ===",
        "A previous synthesis was generated. The team then had FURTHER DISCUSSIONS to address those items.",
        "For each item below, check whether the transcript AFTER the previous synthesis date resolves, partially addresses, or leaves it open.",
        "",
      ];

      const prevQs = Array.isArray(prevSynth.open_questions) ? prevSynth.open_questions as Array<{ question: string; urgency: string }> : [];
      if (prevQs.length > 0) {
        lines.push("PREVIOUSLY FLAGGED OPEN QUESTIONS (were these answered in subsequent discussion?):");
        prevQs.forEach((q, i) => lines.push(`  ${i + 1}. [${q.urgency?.toUpperCase() ?? "?"}] ${q.question}`));
        lines.push("  → If the discussion provided a clear, concrete answer: REMOVE from open_questions or downgrade urgency.");
        lines.push("  → If still unresolved: keep at same or higher urgency.");
        lines.push("");
      }

      const prevConflicts = Array.isArray(prevSynth.conflict_zones) ? prevSynth.conflict_zones as Array<{ topic: string; tension_level: number }> : [];
      if (prevConflicts.length > 0) {
        lines.push("PREVIOUSLY FLAGGED CONFLICTS (did the discussion move toward resolution?):");
        prevConflicts.forEach((c, i) => lines.push(`  ${i + 1}. "${c.topic}" — tension: ${c.tension_level}/100`));
        lines.push("  → If the team reached a position or committed to one side: REDUCE tension_level by 20-40 points.");
        lines.push("  → If fully resolved: REMOVE from conflict_zones.");
        lines.push("  → If still unresolved or escalated: keep or increase tension.");
        lines.push("");
      }

      const prevBlinds = Array.isArray(prevSynth.blind_spots) ? prevSynth.blind_spots as Array<{ area: string }> : [];
      if (prevBlinds.length > 0) {
        lines.push("PREVIOUSLY FLAGGED BLIND SPOTS (did the team address these?):");
        prevBlinds.forEach((b, i) => lines.push(`  ${i + 1}. ${b.area}`));
        lines.push("  → If the team explicitly discussed and addressed: REMOVE from blind_spots.");
        lines.push("  → If still unaddressed: keep.");
        lines.push("");
      }

      lines.push("This resolution tracking is the MOST IMPORTANT signal in your synthesis. The score should improve when discussions resolve items. Do not mechanically reproduce the previous synthesis — assess actual progress.");
      lines.push("=== END RESOLUTION TRACKING ===");
      return lines.join("\n");
    })()}

FULL DEBATE TRANSCRIPT:
${transcript}

---

EVIDENCE RULE — THE MOST IMPORTANT INSTRUCTION:
Only include items in each section when the TRANSCRIPT PROVIDES DIRECT EVIDENCE. Do NOT invent, estimate, or infer data that was not discussed. However, this transcript contains a rich multi-agent debate — multiple advisors discussed the decision in detail. You SHOULD find evidence for most sections. A synthesis with 3 accurate items is better than one with 10 fabricated items, but an empty array means you failed to find evidence that IS there.

OUTPUT REQUIREMENTS — READ THESE BEFORE WRITING A SINGLE WORD:

■ CONSENSUS POINTS: Every point must reflect something agents genuinely agreed on in the transcript. Report what was found — do not pad with generic agreements.
  - The text field MUST quote or paraphrase specific agent statements from the transcript. Include which agents agreed and on what specific point.
  - Do NOT include generic agreements that could apply to any decision (e.g., "team agrees on the importance of execution"). Every consensus must reference a specific point of agreement from THIS debate.
  - The transcript contains multiple agents discussing the same decision — find at least 2-3 points of agreement. Only return [] if no agents agreed on anything specific.

■ CONFLICT ZONES: Only identify real fault lines where agents took opposing positions. The transcript shows agents debating and countering each other — find at least 2 conflicts.
  - The topic, position_a, and position_b fields MUST each quote or paraphrase specific statements agents made in the transcript. Include the agent's role and the substance of what they said.
  - Do NOT describe generic strategic tensions (e.g., "speed vs. quality", "cost vs. quality"). Only conflicts that arose in THIS debate, about THIS decision, belong here.
  - Only return [] if no two agents disagreed on anything specific.

■ OPEN QUESTIONS: Only list questions the debate genuinely left unresolved. Do not fabricate questions that were not raised or implied.
  - Each question MUST reference a specific topic, entity, or claim from the transcript that was discussed but left unresolved.
  - Do NOT include generic strategic questions (e.g., "How will we measure success?") unless that specific question was raised or directly implied in the transcript.

■ RISK SIGNALS: Include risks explicitly raised or directly implied by what was discussed. Span relevant categories; do not invent risks not grounded in the transcript.
  - The signal field MUST reference a concrete entity, term, or claim from the transcript — a specific competitor named, a metric quoted, a timeline mentioned, a technology discussed, or a claim an agent made.
  - Do NOT output generic business-risk platitudes (e.g., "lean development is necessary but risky", "cost-cutting can be beneficial", "market volatility poses a threat"). Every risk must be tied to something specific that was said in THIS session.
  - The transcript discusses a strategic decision — find at least 2-3 specific risks. Only return [] if no risks were discussed at all.

■ BLIND SPOTS: Identify dimensions genuinely underweighted in THIS discussion. Do not list generic strategic gaps that apply to any decision.
  - Each blind spot MUST reference a specific aspect of the central decision that was underweighted or ignored by agents in the transcript.
  - Do NOT list generic blind spots (e.g., "regulatory risks were not discussed") unless that specific gap is evident from what was and was not said in THIS debate.
  - Find at least 2 blind spots — strategic debates always have gaps.

■ ACTION ITEMS: Only generate tasks directly derivable from agent recommendations or team statements in the transcript.
  - Each action item text MUST reference a specific recommendation or statement from the transcript — the agent who proposed it and what they specifically recommended.
  - Do NOT generate generic actions (e.g., "conduct market research", "develop a plan") unless a specific version of that action was explicitly recommended in the transcript.

■ FINANCIAL METRICS: ⚠ EVIDENCE-ONLY. Include ONLY if the transcript contains specific numbers, percentages, costs, revenues, or financial figures that were explicitly stated. Do NOT derive or estimate. If financial data was not discussed, return [].

■ OPERATIONAL METRICS: ⚠ EVIDENCE-ONLY. Include ONLY if timelines, team sizes, launch sequences, or specific operational parameters were explicitly discussed. If not, return [].

■ NON-FINANCIAL METRICS: ⚠ EVIDENCE-ONLY. Include ONLY if brand perception, culture, talent sentiment, customer metrics, or qualitative KPIs were substantively discussed. If not, return [].

■ OPPORTUNITY SIGNALS: ⚠ EVIDENCE-ONLY. Include ONLY concrete opportunities explicitly surfaced by agents in the debate. If no opportunities were identified, return [].

■ COGNITIVE BIAS FLAGS: Include biases that visibly manifested in this specific discussion. The agents debated a real decision — look for biases in their reasoning.
  - Each bias must cite a SPECIFIC agent statement from the transcript (quote or paraphrase the exact words) in the explanation field.
  - The bias must relate to the CENTRAL DECISION ("${workspace?.name || "the workspace decision"}"), not to a tangential or unrelated topic.
  - Do NOT pull from a generic bias taxonomy. If you cannot point to concrete words in the transcript that demonstrate the bias, do NOT include it.
  - Find at least 1-2 biases — strategic reasoning almost always exhibits some bias.

■ KEY DECISIONS: Include the pivotal decisions that were explicitly named or debated. If no clear decisions were surfaced, return [].

■ RECOMMENDATION: 5-8 sentences. Start with the unambiguous recommended path. State what must be accepted (the tradeoff). Identify the one thing that, if not done in 7 days, will cause meaningful delay or damage. Be direct — no hedging.
  - The recommendation MUST reference specific points, arguments, or data from the transcript. It should be impossible to mistake this recommendation for one written about a different decision.
  - Do NOT produce a generic recommendation that could apply to any startup decision. Every sentence should be grounded in what was actually debated.

---

FIELD RULES:

CONFLICT ZONES:
- topic = the exact strategic fault line (e.g., "Full mandate vs permanent hybrid model")
- agent_a, agent_b = role names from transcript (e.g., "people_advisor", "risk_analyst", "devils_advocate", "financial_strategist", "execution_lead", "market_analyst", "innovation_scout")
- position_a, position_b = MUST quote or paraphrase the specific words the agent said in the transcript about this exact point of disagreement
- tension_level = 0-100 (80+ = critical, 50-79 = high, <50 = moderate)

ACTION ITEMS:
- text = specific, executable task with enough detail to assign to a person
- source_area = owning function (HR, Finance, CEO, Legal, Product, Engineering, Risk, Strategy, Marketing, Operations)
- priority = critical|high|medium

---

Produce a JSON object with EXACTLY this structure and field names.
CRITICAL: Generate "action_items" FIRST — it is the most important field and must not be omitted.

{
  "action_items": [
    { "text": "string (MUST reference a specific recommendation or statement from the transcript)", "source_area": "string", "priority": "critical|high|medium" }
  ],
  "consensus_points": [
    { "text": "string (MUST quote or paraphrase specific agent statements showing genuine agreement on a specific point)", "confidence": 85, "source_count": 5 }
  ],
  "conflict_zones": [
    {
      "topic": "string (the specific point of disagreement from this debate)",
      "agent_a": "string (role name)",
      "position_a": "string (quote or paraphrase of what this agent said in the transcript about this disagreement)",
      "agent_b": "string (role name)",
      "position_b": "string (quote or paraphrase of what this agent said in the transcript about this disagreement)",
      "tension_level": 80
    }
  ],
  "open_questions": [
    { "question": "string (MUST reference a specific topic, entity, or claim from the transcript that was discussed but left unresolved)", "urgency": "critical|high|medium" }
  ],
  "risk_signals": [
    { "signal": "string (MUST reference a specific entity, term, metric, or claim from the transcript — not a generic business platitude)", "severity": "critical|high|medium|low", "category": "market|execution|financial|team|technology" }
  ],
  "blind_spots": [
    { "area": "string (MUST reference a specific aspect of the central decision that was underweighted or ignored in the transcript)", "description": "string" }
  ],
  "financial_metrics": [
    { "metric": "string", "value": "string", "confidence": "high|medium|low", "note": "string" }
  ],
  "operational_metrics": [
    { "metric": "string", "status": "on-track|at-risk|unclear", "note": "string" }
  ],
  "non_financial_metrics": [
    { "metric": "string", "signal": "positive|neutral|negative", "note": "string" }
  ],
  "opportunity_signals": [
    { "title": "string", "description": "string", "confidence": "high|medium|low", "source": "string" }
  ],
  "cognitive_bias_flags": [
    { "bias_name": "string (the cognitive bias name)", "explanation": "string (MUST quote or paraphrase the specific agent statement(s) from the transcript that demonstrate this bias, and explain how it relates to the central decision)", "counter_question": "string (a question that challenges the biased reasoning, grounded in the same transcript evidence)" }
  ],
  "key_decisions": [
    { "decision": "string", "status": "open|in-progress|resolved", "rationale": "string", "owner": "string" }
  ],
  "decision_velocity": "fast|moderate|stalling",
  "confidence_trajectory": "rising|flat|falling",
  "recommendation": "string — 5-8 sentences of direct, opinionated strategic direction. Start with the recommended path. State the tradeoff. Identify the 7-day critical action."
}

Return ONLY valid JSON. No markdown fences. No commentary. Maximum depth and specificity in every field.`;

    // ─── ACTION ITEMS PROMPT (dedicated call) ────────────────────────────────
    // Action items are extracted in a SEPARATE focused call so they never compete
    // for token budget with the 12 other synthesis arrays. This guarantees we
    // always get 15-22 specific, executable, owner-assigned items.
    const actionItemsPrompt = `You are a Chief of Staff extracting a comprehensive, immediately executable action plan from a War Room debate.

THE CENTRAL DECISION: "${workspace?.name || "the workspace decision"}"
${workspace?.description ? `Context: ${workspace.description}` : ""}

DEBATE TRANSCRIPT (last 40 messages):
${transcript}

YOUR TASK:
Generate only action items that are directly derivable from specific things agents said or the team discussed. Do NOT pad with generic best-practices or organizational hygiene tasks. Quality over quantity — a focused list of 5 specific, owner-assigned items beats 20 generic ones.

RULES FOR EACH ACTION ITEM:
- text: One complete sentence. Include WHO should do it (owner role), WHAT specifically they must do, and WHY it matters for the central decision. Example: "CFO to model three financial scenarios (base/bull/bear) for the RTO decision with specific headcount cost assumptions for each office, to give the board a quantified basis for the final call." Never: "Clarify financial assumptions."
- source_area: The owning function. Use exactly one of: CEO, CFO, HR, Legal, Product, Engineering, Finance, Risk, Strategy, Marketing, Operations, People
- priority: critical (must happen in 7 days), high (must happen in 30 days), or medium (this quarter)

TOPIC: Every action item must directly address the central decision above — not generic organizational hygiene.

Return ONLY valid JSON in this exact shape, no markdown:
{
  "action_items": [
    { "text": "string — MUST reference a specific recommendation or statement from the transcript, not a generic task", "source_area": "string", "priority": "critical|high|medium" }
  ]
}`;

    // Run main synthesis and action items in PARALLEL — they are independent
    // calls. This cuts total latency from (synth + actions) to max(synth, actions).
    const synthStartedAt = Date.now();
    const actionStartedAt = Date.now();

    const synthPromise = fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openAiKey}` },
      signal: AbortSignal.timeout(300_000),
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: "You are a world-class strategic synthesis engine and Chief Strategy Officer. You produce comprehensive JSON exactly as instructed, grounded entirely in the transcript provided. The transcript contains a rich multi-agent debate — find the evidence that is there. Every section should have at least 2 items unless the topic was truly never discussed.",
          },
          { role: "user", content: synthesisPrompt },
        ],
        max_tokens: 8000,
        response_format: { type: "json_object" },
      }),
    }).catch((fetchErr) => {
      const isTimeout = fetchErr instanceof DOMException && fetchErr.name === "TimeoutError";
      logAiOpenAICall({ distinctId: user!.id, workspaceId: workspace_id, functionName: "workspace-synthesize", callSite: "main_synthesis", model: "gpt-4.1", maxCompletionTokens: 8000, jsonMode: true, latencyMs: Date.now() - synthStartedAt, status: isTimeout ? "timeout" : "errored" });
      throw fetchErr;
    });

    const actionItemsPromise = fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openAiKey}` },
      signal: AbortSignal.timeout(40_000),
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a Chief of Staff who generates specific, owner-assigned, immediately executable action plans. Every action item must name a responsible role, a concrete deliverable, and connect directly to the decision being evaluated. Generic or vague tasks are unacceptable. You produce JSON only.",
          },
          { role: "user", content: actionItemsPrompt },
        ],
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    }).catch((fetchErr) => {
      const isTimeout = fetchErr instanceof DOMException && fetchErr.name === "TimeoutError";
      logAiOpenAICall({ distinctId: user!.id, workspaceId: workspace_id, functionName: "workspace-synthesize", callSite: "action_items", model: "gpt-4o", maxCompletionTokens: 2000, jsonMode: true, latencyMs: Date.now() - actionStartedAt, status: isTimeout ? "timeout" : "errored" });
      console.error("Action items fetch failed:", fetchErr);
      return null;
    });

    let openAiRes: Response;
    let actionItemsRes: Response | null;
    try {
      [openAiRes, actionItemsRes] = await Promise.all([synthPromise, actionItemsPromise]);
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error("Synthesis fetch failed:", fetchErr);
      return new Response(JSON.stringify({ error: `Synthesis AI request failed: ${msg}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!openAiRes.ok) {
      const err = await openAiRes.text();
      logAiOpenAICall({ distinctId: user!.id, workspaceId: workspace_id, functionName: "workspace-synthesize", callSite: "main_synthesis", model: "gpt-4.1", maxCompletionTokens: 8000, jsonMode: true, latencyMs: Date.now() - synthStartedAt, status: "errored", httpStatus: openAiRes.status });
      console.error("OpenAI error:", openAiRes.status, err);
      let detail = "AI synthesis failed";
      try { const parsed = JSON.parse(err); detail = parsed?.error?.message || detail; } catch { /* use default */ }
      return new Response(JSON.stringify({ error: detail }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const openAiJson = await openAiRes.json();
    logAiOpenAICall({ distinctId: user!.id, workspaceId: workspace_id, functionName: "workspace-synthesize", callSite: "main_synthesis", model: "gpt-4.1", usage: openAiJson.usage, maxCompletionTokens: 8000, jsonMode: true, latencyMs: Date.now() - synthStartedAt, status: "succeeded", httpStatus: openAiRes.status });
    const rawContent = openAiJson.choices?.[0]?.message?.content || "{}";
    const finishReason = openAiJson.choices?.[0]?.finish_reason || "";

    let synthesis: Record<string, unknown>;
    try {
      synthesis = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse synthesis JSON (finish_reason:", finishReason + "):", rawContent.slice(0, 500));
      return new Response(JSON.stringify({ error: "Failed to parse synthesis" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Merge dedicated action items into synthesis (overrides whatever the main call produced)
    if (actionItemsRes && actionItemsRes.ok) {
      try {
        const aiJson = await actionItemsRes.json();
        logAiOpenAICall({ distinctId: user!.id, workspaceId: workspace_id, functionName: "workspace-synthesize", callSite: "action_items", model: "gpt-4o", usage: aiJson.usage, maxCompletionTokens: 2000, jsonMode: true, latencyMs: Date.now() - actionStartedAt, status: "succeeded", httpStatus: actionItemsRes.status });
        const aiRaw = aiJson.choices?.[0]?.message?.content || "{}";
        const aiParsed = JSON.parse(aiRaw);
        if (Array.isArray(aiParsed.action_items) && aiParsed.action_items.length > 0) {
          synthesis.action_items = aiParsed.action_items;
          console.log(`Action items from dedicated call: ${aiParsed.action_items.length}`);
        }
      } catch (e) {
        console.error("Failed to parse action items response:", e);
        // Keep whatever action_items the main synthesis produced (may be empty)
      }
    } else if (actionItemsRes) {
      const aiErr = await actionItemsRes.text();
      logAiOpenAICall({ distinctId: user!.id, workspaceId: workspace_id, functionName: "workspace-synthesize", callSite: "action_items", model: "gpt-4o", maxCompletionTokens: 2000, jsonMode: true, latencyMs: Date.now() - actionStartedAt, status: "errored", httpStatus: actionItemsRes.status });
      console.error("Action items call failed:", actionItemsRes.status, aiErr);
    }

    // ─── DETERMINISTIC SCORE COMPUTATION ─────────────────────────────────────
    // Uses the exact fields the AI prompt produces. Every deduction/bonus is
    // tied to a real structured value — no dead code from mismatched field names.
    function computeScores(): { decisionHealth: number; financial: number | null; operational: number | null; alignment: number } {
      // Use the actual field names the AI produces
      const riskSignals = validatedRiskSignals as Array<{ severity?: string; category?: string }>;
      const blindSpots = validatedBlindSpots;
      const openQuestions = validatedOpenQuestions as Array<{ urgency?: string }>;
      const consensusPoints = validatedConsensus as Array<{ confidence?: number; source_count?: number }>;
      const conflictZones = validatedConflictZones as Array<{ tension_level?: number }>;
      const actionItems = validatedActionItems as Array<{ priority?: string }>;
      const financialMetrics = Array.isArray(synthesis.financial_metrics)
        ? synthesis.financial_metrics as Array<{ confidence?: string }>
        : [];
      const operationalMetrics = Array.isArray(synthesis.operational_metrics)
        ? synthesis.operational_metrics as Array<{ status?: string }>
        : [];
      const keyDecisions = Array.isArray(synthesis.key_decisions)
        ? synthesis.key_decisions as Array<{ status?: string }>
        : [];
      const velocity = typeof synthesis.decision_velocity === "string" ? synthesis.decision_velocity : "moderate";
      const trajectory = typeof synthesis.confidence_trajectory === "string" ? synthesis.confidence_trajectory : "flat";

      // ── Decision Health ───────────────────────────────────────────────────────
      // Base: 55. Teams start there and move up by demonstrating progress, or
      // down by having unresolved critical blockers.
      //
      // IMPORTANT: The synthesis prompt mandates minimum counts of risks, blind
      // spots, and open questions on EVERY run. Per-signal penalties are therefore
      // kept small and strictly capped per category, so mandatory minimums don't
      // crater the score. What should separate a 34 from a 74 is the RESOLUTION
      // trajectory: resolved decisions, strong consensus, executable action items.
      let decisionHealth = 55;

      // ── EARN points (max ~45 total) ───────────────────────────────────────
      // Consensus: strong agreement = team is converging
      let consensusBonus = 0;
      for (const c of consensusPoints) {
        const conf = typeof c.confidence === "number" ? c.confidence : 60;
        const src = typeof c.source_count === "number" ? c.source_count : 1;
        if (conf >= 80 && src >= 3) consensusBonus += 3;
        else if (conf >= 65) consensusBonus += 2;
        else consensusBonus += 1;
      }
      decisionHealth += Math.min(consensusBonus, 20);

      // Action items: translating debate into executable tasks
      decisionHealth += Math.min(Math.round(actionItems.length * 0.6), 10);

      // Resolved decisions: concrete forward progress
      const resolvedDecisions = keyDecisions.filter(d => d.status === "resolved").length;
      decisionHealth += Math.min(resolvedDecisions * 4, 12);

      // Financial clarity: decisions can be pressure-tested with real numbers
      const highConfFinancial = financialMetrics.filter(m => m.confidence === "high").length;
      decisionHealth += Math.min(highConfFinancial * 2, 6);

      // Operational clarity
      const onTrackOps = operationalMetrics.filter(m => m.status === "on-track").length;
      decisionHealth += Math.min(onTrackOps * 2, 6);

      // ── LOSE points (each category strictly capped) ───────────────────────
      // Critical risks: the only severe penalty — these represent true blockers
      const criticalRiskCount = riskSignals.filter(r => r.severity === "critical").length;
      const highRiskCount = riskSignals.filter(r => r.severity === "high").length;
      decisionHealth -= Math.min(criticalRiskCount * 3, 9);
      decisionHealth -= Math.min(highRiskCount * 1, 6);

      // Blind spots: existence is structural (synthesis always produces them),
      // so penalty is mild — it's the quality of resolution that matters
      decisionHealth -= Math.min(blindSpots.length * 1.5, 8);

      // Open questions: only critical-urgency ones are decision blockers
      const criticalQCount = openQuestions.filter(q => q.urgency === "critical").length;
      const highQCount = openQuestions.filter(q => q.urgency === "high").length;
      decisionHealth -= Math.min(criticalQCount * 2, 8);
      decisionHealth -= Math.min(highQCount * 0.5, 4);

      // Conflict zones: high-tension unresolved conflicts signal the team is stuck
      const highTensionCount = conflictZones.filter(z => (z.tension_level ?? 0) >= 80).length;
      const medTensionCount = conflictZones.filter(z => {
        const t = z.tension_level ?? 0;
        return t >= 60 && t < 80;
      }).length;
      decisionHealth -= Math.min(highTensionCount * 2.5, 8);
      decisionHealth -= Math.min(medTensionCount * 1, 4);

      // At-risk operational metrics
      const atRiskOps = operationalMetrics.filter(m => m.status === "at-risk").length;
      decisionHealth -= Math.min(atRiskOps * 3, 8);

      // Velocity and trajectory modifiers
      if (velocity === "fast") decisionHealth += 5;
      else if (velocity === "stalling") decisionHealth -= 5;

      if (trajectory === "rising") decisionHealth += 4;
      else if (trajectory === "falling") decisionHealth -= 3;

      decisionHealth = Math.max(10, Math.min(100, Math.round(decisionHealth)));

      // ── Financial Score ───────────────────────────────────────────────────────
      // Only computed when financial data was actually discussed.
      // Returns null (not shown in UI) when no financial metrics were surfaced.
      let financial: number | null = null;
      if (financialMetrics.length > 0) {
        let f = 35;
        for (const m of financialMetrics) {
          if (m.confidence === "high") f += 10;
          else if (m.confidence === "medium") f += 5;
          else f += 2;
        }
        for (const z of conflictZones) {
          const tension = typeof z.tension_level === "number" ? z.tension_level : 50;
          if (tension >= 80) f -= 5;
          else if (tension >= 60) f -= 2;
        }
        financial = Math.max(10, Math.min(100, f));
      }

      // ── Operational Score ─────────────────────────────────────────────────────
      // Only computed when operational data was actually discussed.
      // Returns null (not shown in UI) when no operational metrics were surfaced.
      let operational: number | null = null;
      if (operationalMetrics.length > 0) {
        let o = 40;
        for (const m of operationalMetrics) {
          if (m.status === "on-track") o += 8;
          else if (m.status === "at-risk") o -= 10;
          else if (m.status === "unclear") o -= 4;
        }
        for (const r of riskSignals) {
          if (r.severity === "critical" && r.category === "execution") o -= 8;
          else if (r.severity === "high" && r.category === "execution") o -= 4;
        }
        operational = Math.max(10, Math.min(100, o));
      }

      // ── Alignment Score ───────────────────────────────────────────────────────
      let alignment = 50;
      // High consensus = team is aligned
      for (const c of consensusPoints) {
        const conf = typeof c.confidence === "number" ? c.confidence : 60;
        if (conf >= 75) alignment += 3;
        else alignment += 1;
      }
      // High-tension unresolved conflicts = team is NOT aligned
      for (const z of conflictZones) {
        const tension = typeof z.tension_level === "number" ? z.tension_level : 50;
        if (tension >= 80) alignment -= 10;
        else if (tension >= 60) alignment -= 5;
        else if (tension >= 40) alignment -= 2;
      }
      alignment = Math.max(10, Math.min(100, alignment));

      return { decisionHealth, financial, operational, alignment };
    }

    // ── POST-GENERATION VALIDATION (all 8 sections) ──────────────────────────
    // Every report section is validated against the session transcript and
    // the workspace's stated topic. Items that can't be tied to specific
    // transcript content are dropped. If any section loses items (or the
    // recommendation is rejected), a targeted regeneration call is made and
    // the re-generated items are re-validated. This prevents topic-mismatched
    // content (e.g., an employee-resignation bias flag in an AI-predictions
    // report) from reaching the exported report.

    // Pass 1: validate all sections
    const wsName = workspace?.name || "";

    let validatedConsensus = validateSectionItems(
      synthesis.consensus_points, transcript, wsName, ["text", "context"],
    );
    let validatedConflictZones = validateConflictZones(
      synthesis.conflict_zones, transcript,
    );
    let validatedOpenQuestions = validateSectionItems(
      synthesis.open_questions, transcript, wsName, ["question", "context"],
    );
    let validatedRiskSignals = validateRiskSignals(
      synthesis.risk_signals, transcript,
    );
    let validatedBlindSpots = validateSectionItems(
      synthesis.blind_spots, transcript, wsName, ["area", "description"],
    );
    let validatedBiasFlags = validateBiasFlags(
      synthesis.cognitive_bias_flags, transcript, wsName,
    );
    let validatedActionItems = validateSectionItems(
      synthesis.action_items, transcript, wsName, ["text", "source_area"],
    );
    let validatedRecommendation = validateRecommendation(
      synthesis.recommendation, transcript, wsName,
    );

    // Track which sections lost items and need regeneration.
    // Trigger regeneration when items were dropped OR when a section came
    // back empty — the transcript has content, so empty sections mean the
    // model was too conservative, not that there's no evidence.
    const failedSections: string[] = [];
    if (validatedConsensus.length === 0) {
      failedSections.push("consensus_points");
    }
    if (validatedConflictZones.length === 0) {
      failedSections.push("conflict_zones");
    }
    if (validatedOpenQuestions.length === 0) {
      failedSections.push("open_questions");
    }
    if (validatedRiskSignals.length === 0) {
      failedSections.push("risk_signals");
    }
    if (validatedBlindSpots.length === 0) {
      failedSections.push("blind_spots");
    }
    if (validatedBiasFlags.length === 0) {
      failedSections.push("cognitive_bias_flags");
    }
    if (Array.isArray(synthesis.action_items) && validatedActionItems.length < synthesis.action_items.length) {
      failedSections.push("action_items");
    }
    if (synthesis.recommendation && !validatedRecommendation) {
      failedSections.push("recommendation");
    }

    // Regenerate failed sections in the background — don't block the response.
    // The regeneration call can take up to 90s, which would push total latency
    // past client timeouts. We fire it off and let it update the DB row when
    // it completes. The user sees the initial synthesis immediately; the
    // regenerated sections appear on next page load.
    if (failedSections.length > 0 && openAiKey) {
      const synthesisMutable = synthesis as Record<string, unknown>;
      const regenPromise = regenerateFailedSections(
        synthesisMutable, failedSections, transcript, wsName, openAiKey,
      ).then(async () => {
        // Re-validate regenerated sections and update the DB row
        let updatedConsensus = validatedConsensus;
        let updatedConflictZones = validatedConflictZones;
        let updatedOpenQuestions = validatedOpenQuestions;
        let updatedRiskSignals = validatedRiskSignals;
        let updatedBlindSpots = validatedBlindSpots;
        let updatedBiasFlags = validatedBiasFlags;
        let updatedActionItems = validatedActionItems;
        let updatedRecommendation = validatedRecommendation;

        if (failedSections.includes("consensus_points")) {
          updatedConsensus = validateSectionItems(synthesisMutable.consensus_points, transcript, wsName, ["text", "context"]);
        }
        if (failedSections.includes("conflict_zones")) {
          updatedConflictZones = validateConflictZones(synthesisMutable.conflict_zones, transcript);
        }
        if (failedSections.includes("open_questions")) {
          updatedOpenQuestions = validateSectionItems(synthesisMutable.open_questions, transcript, wsName, ["question", "context"]);
        }
        if (failedSections.includes("risk_signals")) {
          updatedRiskSignals = validateRiskSignals(synthesisMutable.risk_signals, transcript);
        }
        if (failedSections.includes("blind_spots")) {
          updatedBlindSpots = validateSectionItems(synthesisMutable.blind_spots, transcript, wsName, ["area", "description"]);
        }
        if (failedSections.includes("cognitive_bias_flags")) {
          updatedBiasFlags = validateBiasFlags(synthesisMutable.cognitive_bias_flags, transcript, wsName);
        }
        if (failedSections.includes("action_items")) {
          updatedActionItems = validateSectionItems(synthesisMutable.action_items, transcript, wsName, ["text", "source_area"]);
        }
        if (failedSections.includes("recommendation")) {
          updatedRecommendation = validateRecommendation(synthesisMutable.recommendation, transcript, wsName);
        }

        await service.from("workspace_synthesis").update({
          consensus_points: updatedConsensus,
          conflict_zones: updatedConflictZones,
          open_questions: updatedOpenQuestions,
          risk_signals: updatedRiskSignals,
          blind_spots: updatedBlindSpots,
          cognitive_bias_flags: updatedBiasFlags,
          action_items: updatedActionItems,
          recommendation: updatedRecommendation,
          generated_at: new Date().toISOString(),
        }).eq("workspace_id", workspace_id);
      }).catch((e) => console.error("Background regeneration failed:", e));
      EdgeRuntime.waitUntil(regenPromise);
    }

    const scores = computeScores();

    // ─── SCORE-ANCHORED HEALTH RATIONALE ────────────────────────────────────────
    // The AI writes the rationale AFTER we compute the score, so it can never
    // contradict it. We inject the score, label, and specific evidence into the
    // prompt so the explanation is brutally calibrated to the number.
    function scoreLabel(s: number): string {
      if (s >= 75) return "Sharp";
      if (s >= 55) return "Developing";
      if (s >= 35) return "Fragmented";
      return "Critical";
    }

    const label = scoreLabel(scores.decisionHealth);

    // Build evidence summary to anchor the rationale
    const riskSignals = validatedRiskSignals as Array<{ severity?: string; signal?: string }>;
    const criticalRisks = riskSignals.filter(r => r.severity === "critical").map(r => r.signal).filter(Boolean);
    const openQs = (validatedOpenQuestions as Array<{ urgency?: string; question?: string }>)
      .filter(q => q.urgency === "critical" || q.urgency === "high");
    const blindSpotList = (validatedBlindSpots as Array<{ area?: string }>).map(b => b.area).filter(Boolean);
    const highTensionConflicts = (validatedConflictZones as Array<{ tension_level?: number; topic?: string }>)
        .filter(z => (z.tension_level ?? 0) >= 70).map(z => z.topic).filter(Boolean);
    const resolvedDecisionCount = Array.isArray(synthesis.key_decisions)
      ? (synthesis.key_decisions as Array<{ status?: string }>).filter(d => d.status === "resolved").length
      : 0;
    const consensusCount = validatedConsensus.length;

    const evidenceLines = [
      criticalRisks.length > 0 ? `Critical risks: ${criticalRisks.slice(0, 2).join("; ")}` : null,
      openQs.length > 0 ? `${openQs.length} critical/high-urgency open questions unresolved` : null,
      blindSpotList.length > 0 ? `Key blind spots: ${blindSpotList.slice(0, 2).join(", ")}` : null,
      highTensionConflicts.length > 0 ? `High-tension conflicts: ${highTensionConflicts.slice(0, 2).join("; ")}` : null,
      resolvedDecisionCount > 0 ? `${resolvedDecisionCount} key decision(s) resolved` : null,
      consensusCount > 0 ? `${consensusCount} consensus points established` : null,
    ].filter(Boolean).join(". ");

    const rationalePrompt = `You are a blunt strategic advisor writing a 2-sentence health rationale for a War Room decision intelligence report.

The Decision Health Score is ${scores.decisionHealth}/100. The label is "${label} Team."

Evidence from this session:
${evidenceLines || "Insufficient data to assess decision quality."}

RULES:
- Sentence 1: Explain in ONE brutally honest sentence WHY the score is ${scores.decisionHealth}. The tone must match the label. A score of ${scores.decisionHealth} with label "${label}" should NEVER imply competence or positive momentum unless the score is 75+. If the score is below 55, start with what's broken, not what's working.
- Sentence 2: Name the single most important thing the team must do to improve this score.
- Do NOT start with "The team", "This team", or "Overall".
- Do NOT use hedging language like "while there are some challenges" or "despite some gaps."
- Do NOT contradict the score. A score below 55 means real problems exist.
- Maximum 60 words total.
- Return ONLY the two sentences, no preamble.`;

    // Fire rationale call in the background — it's a nice-to-have that adds
    // 10-30s of latency if awaited. We use a deterministic fallback immediately
    // and update the DB row when the AI rationale comes back.
    let healthRationale: string | null = null;
    const rationaleStartedAt = Date.now();
    const rationaleFallback = (() => {
      if (scores.decisionHealth < 35) {
        return `Severe gaps in financial data, unresolved critical risks, and multiple unresolved open questions make a confident recommendation impossible at this stage. Resolve the highest-urgency open questions and build financial projections before proceeding.`;
      } else if (scores.decisionHealth < 55) {
        return `${criticalRisks.length > 0 ? `Critical risks (${criticalRisks[0]}) remain unaddressed` : "Key strategic conflicts remain unresolved"} and the team lacks sufficient consensus to move forward confidently. Focus on resolving the highest-tension conflict and eliminating at least one critical risk signal.`;
      } else if (scores.decisionHealth < 75) {
        return `The team has established a working foundation but ${openQs.length > 0 ? `${openQs.length} high-urgency question(s) remain open` : "strategic alignment is still fragile"}. Resolve the outstanding decision blockers to push this score into the Sharp tier.`;
      } else {
        return `Strong consensus across ${consensusCount} points and ${resolvedDecisionCount} resolved key decision(s) show a team that has done the hard work. Maintain momentum by converting action items into owner-assigned deliverables.`;
      }
    })();
    healthRationale = rationaleFallback;

    if (openAiKey) {
      const rationalePromise = fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openAiKey}` },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: rationalePrompt }],
          max_tokens: 80,
        }),
      }).then(async (rationaleRes) => {
        if (rationaleRes.ok) {
          const rationaleJson = await rationaleRes.json();
          logAiOpenAICall({ distinctId: user!.id, workspaceId: workspace_id, functionName: "workspace-synthesize", callSite: "health_rationale", model: "gpt-4o", usage: rationaleJson.usage, maxCompletionTokens: 80, jsonMode: false, latencyMs: Date.now() - rationaleStartedAt, status: "succeeded", httpStatus: rationaleRes.status });
          const rationaleText = rationaleJson.choices?.[0]?.message?.content?.trim() ?? "";
          if (rationaleText.length > 10) {
            await service.from("workspace_synthesis").update({ health_rationale: rationaleText }).eq("workspace_id", workspace_id);
          }
        } else {
          logAiOpenAICall({ distinctId: user!.id, workspaceId: workspace_id, functionName: "workspace-synthesize", callSite: "health_rationale", model: "gpt-4o", maxCompletionTokens: 80, jsonMode: false, latencyMs: Date.now() - rationaleStartedAt, status: "errored", httpStatus: rationaleRes.status });
        }
      }).catch(() => {
        logAiOpenAICall({ distinctId: user!.id, workspaceId: workspace_id, functionName: "workspace-synthesize", callSite: "health_rationale", model: "gpt-4o", maxCompletionTokens: 80, jsonMode: false, latencyMs: Date.now() - rationaleStartedAt, status: "errored" });
      });
      EdgeRuntime.waitUntil(rationalePromise);
    }


    // Use validated recommendation (already checked against transcript + topic)
    const recommendation = validatedRecommendation;

    // Upsert into workspace_synthesis
    const { error: upsertError } = await service
      .from("workspace_synthesis")
      .upsert({
        workspace_id,
        consensus_points: validatedConsensus,
        conflict_zones: validatedConflictZones,
        open_questions: validatedOpenQuestions,
        risk_signals: validatedRiskSignals,
        blind_spots: validatedBlindSpots,
        action_items: validatedActionItems,
        financial_metrics: synthesis.financial_metrics ?? [],
        operational_metrics: synthesis.operational_metrics ?? [],
        non_financial_metrics: synthesis.non_financial_metrics ?? [],
        opportunity_signals: synthesis.opportunity_signals ?? [],
        cognitive_bias_flags: validatedBiasFlags,
        key_decisions: synthesis.key_decisions ?? [],
        decision_velocity: synthesis.decision_velocity ?? "moderate",
        confidence_trajectory: synthesis.confidence_trajectory ?? "flat",
        health_rationale: healthRationale,
        recommendation: validatedRecommendation,
        decision_health_score: scores.decisionHealth,
        financial_score: scores.financial,
        operational_score: scores.operational,
        alignment_score: scores.alignment,
        generated_at: new Date().toISOString(),
        message_count_at_generation: messages.length,
      }, { onConflict: "workspace_id" });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(JSON.stringify({ error: "Failed to save synthesis" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Sync AI action items to workspace_action_items table ──────────────────
    // The action items tab reads from workspace_action_items, not the synthesis
    // JSON column. We replace 'todo' AI items (not yet acted on) with the new
    // set, preserving any items the team has already cycled to in-progress/done.
    const newActionItems = (validatedActionItems as Array<{ text?: string; source_area?: string; priority?: string }>)
        .filter(a => typeof a.text === "string" && a.text.trim().length > 5);

    if (newActionItems.length > 0) {
      // Delete untouched AI-generated items so we don't accumulate stale ones
      await service
        .from("workspace_action_items")
        .delete()
        .eq("workspace_id", workspace_id)
        .eq("source", "ai")
        .eq("status", "todo");

      // Re-insert fresh set from this synthesis
      await service.from("workspace_action_items").insert(
        newActionItems.map(a => ({
          workspace_id,
          text: String(a.text).trim(),
          source: "ai",
          priority: ["critical", "high", "medium"].includes(String(a.priority)) ? String(a.priority) : "medium",
          source_area: typeof a.source_area === "string" ? a.source_area : "Strategy",
          status: "todo",
          created_by: user.id,
        }))
      );
    }

    // Insert history snapshot
    await service.from("workspace_synthesis_history").insert({
      workspace_id,
      decision_health_score: scores.decisionHealth,
      financial_score: scores.financial,
      operational_score: scores.operational,
      alignment_score: scores.alignment,
      message_count_at_generation: messages.length,
      generated_at: new Date().toISOString(),
    }).then(({ error }) => { if (error) console.error("History insert error:", error); });

    // ── Decision Audit Trail: log this synthesis as an agent_analysis event ───
    // Reuses data already computed above (scores, healthRationale, recommendation)
    // rather than re-deriving or re-calling the model.
    await service.from("decision_events").insert({
      workspace_id,
      event_type: "agent_analysis",
      actor_type: "system",
      actor_id: "workspace-synthesize",
      payload: {
        recommendation,
        health_rationale: healthRationale,
        decision_health_score: scores.decisionHealth,
        financial_score: scores.financial,
        operational_score: scores.operational,
        alignment_score: scores.alignment,
        confidence_trajectory: synthesis.confidence_trajectory ?? "flat",
      },
    }).then(({ error }) => { if (error) console.error("Decision event insert error:", error); });

    // ── Cross-workspace Pattern Intelligence rollup ───────────────────────────
    // Fire-and-forget — runs as the response is already sent
    const patternPromise = (async () => {
      try {
        // Fetch all workspaces where this user is owner or member
        const { data: memberRows } = await service
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", user.id);

        if (!memberRows || memberRows.length === 0) return;

        const workspaceIds = memberRows.map(r => r.workspace_id as string);

        // Fetch synthesis data for all those workspaces
        const { data: synthRows } = await service
          .from("workspace_synthesis")
          .select("workspace_id, cognitive_bias_flags, risk_signals, decision_health_score, conflict_zones, consensus_points, alignment_score")
          .in("workspace_id", workspaceIds);

        // Fetch workspace names
        const { data: wsRows } = await service
          .from("workspaces")
          .select("id, name, description")
          .in("id", workspaceIds);

        if (!synthRows || synthRows.length === 0) return;

        const wsMap: Record<string, { name: string; description: string }> = {};
        for (const ws of wsRows ?? []) {
          wsMap[ws.id] = { name: ws.name ?? "Workspace", description: ws.description ?? "" };
        }

        // ── Bias fingerprint ────────────────────────────────────────────────
        const biasFingerprint: Record<string, number> = {};
        for (const row of synthRows) {
          const flags = Array.isArray(row.cognitive_bias_flags)
            ? row.cognitive_bias_flags as Array<{ bias_name?: string }>
            : [];
          for (const f of flags) {
            if (typeof f.bias_name === "string" && f.bias_name.length > 0) {
              biasFingerprint[f.bias_name] = (biasFingerprint[f.bias_name] ?? 0) + 1;
            }
          }
        }

        let dominantBiasXw: string | null = null;
        let maxBiasXw = 0;
        for (const [bias, cnt] of Object.entries(biasFingerprint)) {
          if (cnt > maxBiasXw) { maxBiasXw = cnt; dominantBiasXw = bias; }
        }

        // ── Risk tolerance map ──────────────────────────────────────────────
        // Classify each workspace's risk level from its dominant risk_signals severity
        function riskLevel(row: { risk_signals?: unknown }): "high" | "medium" | "low" {
          const signals = Array.isArray(row.risk_signals)
            ? row.risk_signals as Array<{ severity?: string }>
            : [];
          const critCount = signals.filter(s => s.severity === "critical").length;
          const highCount = signals.filter(s => s.severity === "high").length;
          if (critCount >= 2 || (critCount >= 1 && highCount >= 2)) return "high";
          if (critCount >= 1 || highCount >= 2) return "medium";
          return "low";
        }

        // ── Workspace snapshots ─────────────────────────────────────────────
        const workspaceSnapshots = synthRows.map(row => {
          const wsInfo = wsMap[row.workspace_id] ?? { name: "Workspace", description: "" };
          const flags = Array.isArray(row.cognitive_bias_flags)
            ? (row.cognitive_bias_flags as Array<{ bias_name?: string }>).map(f => f.bias_name).filter(Boolean)
            : [];
          // Dominant risk category for this workspace
          const riskBreakdown: Record<string, number> = {};
          const riskSignals = Array.isArray(row.risk_signals)
            ? row.risk_signals as Array<{ category?: string }>
            : [];
          for (const r of riskSignals) {
            const cat = typeof r.category === "string" ? r.category : "other";
            riskBreakdown[cat] = (riskBreakdown[cat] ?? 0) + 1;
          }
          let domRisk = "execution";
          let domRiskCount = 0;
          for (const [cat, cnt] of Object.entries(riskBreakdown)) {
            if (cnt > domRiskCount) { domRiskCount = cnt; domRisk = cat; }
          }

          return {
            workspace_id: row.workspace_id,
            workspace_name: wsInfo.name,
            decision_health_score: row.decision_health_score ?? 0,
            dominant_risk_category: domRisk,
            bias_flags: flags,
            risk_level: riskLevel(row),
          };
        });

        const riskToleranceMap = workspaceSnapshots.map(s => ({
          workspace_name: s.workspace_name,
          health_score: s.decision_health_score,
          risk_level: s.risk_level,
        }));

        // ── Decision style summary (deterministic label) ─────────────────────
        const avgHealth = workspaceSnapshots.length > 0
          ? workspaceSnapshots.reduce((s, r) => s + r.decision_health_score, 0) / workspaceSnapshots.length
          : 0;
        const highRiskCount = workspaceSnapshots.filter(s => s.risk_level === "high").length;
        const lowRiskCount = workspaceSnapshots.filter(s => s.risk_level === "low").length;
        let styleLabel: string;
        if (avgHealth >= 70 && lowRiskCount >= Math.ceil(workspaceSnapshots.length / 2)) {
          styleLabel = "Systematic and risk-aware";
        } else if (avgHealth >= 70 && highRiskCount >= Math.ceil(workspaceSnapshots.length / 2)) {
          styleLabel = "High-conviction, high-stakes";
        } else if (avgHealth < 50 && highRiskCount >= Math.ceil(workspaceSnapshots.length / 2)) {
          styleLabel = "Risk-tolerant, process-light";
        } else if (avgHealth < 50) {
          styleLabel = "Exploratory, low structure";
        } else {
          styleLabel = "Balanced — strategic with managed risk";
        }

        // ── Agent alignment map ──────────────────────────────────────────────
        // Build per-agent conflict stats from conflict_zones across all workspaces
        const agentStats: Record<string, { conflicts: number; totalTension: number }> = {};
        for (const row of synthRows) {
          const zones = Array.isArray(row.conflict_zones)
            ? row.conflict_zones as Array<{ agent_a?: string; agent_b?: string; tension_level?: number }>
            : [];
          for (const zone of zones) {
            const tension = typeof zone.tension_level === "number" ? zone.tension_level : 50;
            for (const agent of [zone.agent_a, zone.agent_b]) {
              if (!agent || typeof agent !== "string") continue;
              if (!agentStats[agent]) agentStats[agent] = { conflicts: 0, totalTension: 0 };
              agentStats[agent].conflicts += 1;
              agentStats[agent].totalTension += tension;
            }
          }
        }

        const wsCount = workspaceSnapshots.length || 1;
        const agentAlignmentMap: Record<string, { conflict_count: number; avg_tension: number; alignment_score: number }> = {};
        for (const [agent, stats] of Object.entries(agentStats)) {
          const avgTension = stats.conflicts > 0 ? stats.totalTension / stats.conflicts : 0;
          // Higher conflict frequency + higher tension = lower alignment
          const conflictRatio = Math.min(1, stats.conflicts / wsCount);
          const raw = 100 - (conflictRatio * 50) - (avgTension * 0.5);
          agentAlignmentMap[agent] = {
            conflict_count: stats.conflicts,
            avg_tension: Math.round(avgTension),
            alignment_score: Math.max(0, Math.min(100, Math.round(raw))),
          };
        }

        // Average alignment score across workspaces (from stored alignment_score column)
        const alignmentScores = synthRows
          .map(r => (typeof r.alignment_score === "number" ? r.alignment_score : null))
          .filter((s): s is number => s !== null);
        const avgAlignmentScore = alignmentScores.length > 0
          ? Math.round(alignmentScores.reduce((a, b) => a + b, 0) / alignmentScores.length)
          : null;

        // ── Upsert user_pattern_intelligence ────────────────────────────────
        const payload = {
          user_id: user.id,
          workspace_count: workspaceSnapshots.length,
          workspace_snapshots: workspaceSnapshots,
          bias_fingerprint: biasFingerprint,
          dominant_bias: dominantBiasXw,
          risk_tolerance_map: riskToleranceMap,
          decision_style_summary: styleLabel,
          agent_alignment_map: agentAlignmentMap,
          avg_alignment_score: avgAlignmentScore,
          updated_at: new Date().toISOString(),
        };

        const { data: existingXw } = await service
          .from("user_pattern_intelligence")
          .select("user_id, benchmark_opt_in")
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingXw) {
          await service.from("user_pattern_intelligence").update(payload).eq("user_id", user.id);
        } else {
          await service.from("user_pattern_intelligence").insert(payload);
        }

        // ── Training pair upsert (Direction 4) ──────────────────────────────────
        // Always write a row regardless of benchmark opt-in. The pair captures
        // synthesis depth signals (counts only, no content) so we can score
        // the quality of each workspace's decision data for future fine-tuning.
        {
          const riskSignals = validatedRiskSignals;
          const blindSpots = validatedBlindSpots;
          const consensusPoints = validatedConsensus;
          const conflictZones = validatedConflictZones;
          const openQuestions = validatedOpenQuestions;
          const actionItems = validatedActionItems;
          const biasFlagsArr = validatedBiasFlags;

          // Dominant category for this specific workspace (not cross-workspace avg)
          const wsRiskBreakdown: Record<string, number> = {};
          for (const r of riskSignals as Array<{ category?: string }>) {
            const cat = typeof r.category === "string" ? r.category : "execution";
            wsRiskBreakdown[cat] = (wsRiskBreakdown[cat] ?? 0) + 1;
          }
          let wsCategory = "execution";
          let wsMaxFreq = 0;
          for (const [cat, freq] of Object.entries(wsRiskBreakdown)) {
            if (freq > wsMaxFreq) { wsMaxFreq = freq; wsCategory = cat; }
          }

          // Quality score: higher synthesis depth + outcomes = more useful for training
          const depthScore = Math.min(50,
            Math.min(riskSignals.length, 5) * 3 +
            Math.min(consensusPoints.length, 5) * 3 +
            Math.min(actionItems.length, 8) * 2 +
            Math.min(blindSpots.length, 4) * 2 +
            Math.min(conflictZones.length, 4) * 2
          );
          const healthBonusScore = scores.decisionHealth >= 70 ? 10 : scores.decisionHealth >= 50 ? 5 : 0;
          const baseQuality = Math.min(50, depthScore) + healthBonusScore;

          // Fetch existing outcome counts for this workspace (preserved across re-synthesis)
          const { data: existingPair } = await service
            .from("synthesis_training_pairs")
            .select("outcomes_recorded, outcomes_succeeded, outcomes_failed, outcomes_reversed, outcomes_abandoned")
            .eq("workspace_id", workspace_id)
            .maybeSingle();

          const outcomesRecorded = existingPair?.outcomes_recorded ?? 0;
          const outcomesBonus = Math.min(20, outcomesRecorded * 4);
          const finalQuality = Math.min(100, baseQuality + outcomesBonus);

          const successRate = outcomesRecorded > 0 && existingPair
            ? Math.round(((existingPair.outcomes_succeeded ?? 0) / outcomesRecorded) * 100 * 100) / 100
            : null;

          await service.from("synthesis_training_pairs").upsert({
            workspace_id,
            decision_category: wsCategory,
            decision_health_score: scores.decisionHealth,
            decision_style: styleLabel,
            risk_signal_count: riskSignals.length,
            blind_spot_count: blindSpots.length,
            consensus_point_count: consensusPoints.length,
            conflict_zone_count: conflictZones.length,
            open_question_count: openQuestions.length,
            action_item_count: actionItems.length,
            cognitive_bias_count: biasFlagsArr.length,
            dominant_bias: dominantBiasXw,
            outcomes_recorded: existingPair?.outcomes_recorded ?? 0,
            outcomes_succeeded: existingPair?.outcomes_succeeded ?? 0,
            outcomes_failed: existingPair?.outcomes_failed ?? 0,
            outcomes_reversed: existingPair?.outcomes_reversed ?? 0,
            outcomes_abandoned: existingPair?.outcomes_abandoned ?? 0,
            success_rate: successRate,
            quality_score: finalQuality,
            synthesis_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "workspace_id" });
        }

        // ── Benchmark contribution ─────────────────────────────────────────────
        // Only contribute when the user has explicitly opted in.
        // We upsert one row per (user_hash, dominant_category) so re-synthesis
        // updates the score rather than accumulating duplicate entries.
        const optedIn = existingXw?.benchmark_opt_in === true;
        if (optedIn && workspaceSnapshots.length > 0) {
          // Determine dominant risk category across all workspaces for this user
          const categoryFreq: Record<string, number> = {};
          for (const snap of workspaceSnapshots) {
            const cat = snap.dominant_risk_category ?? "execution";
            categoryFreq[cat] = (categoryFreq[cat] ?? 0) + 1;
          }
          let dominantCategory = "execution";
          let maxFreq = 0;
          for (const [cat, freq] of Object.entries(categoryFreq)) {
            if (freq > maxFreq) { maxFreq = freq; dominantCategory = cat; }
          }

          // md5 of the user id — stored only for dedup, never exposed
          const encoder = new TextEncoder();
          const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(user.id));
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const contributorHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);

          await service.from("decision_benchmarks").upsert({
            contributor_hash: contributorHash,
            category: dominantCategory,
            health_score: Math.round(avgHealth),
            decision_style: styleLabel,
            contributed_at: new Date().toISOString(),
          }, { onConflict: "contributor_hash,category" });
        }
      } catch (e) {
        console.error("Cross-workspace pattern rollup error:", e);
      }
    })();
    EdgeRuntime.waitUntil(patternPromise);

    // ── Cross-workspace memory summary generation ────────────────────────────────
    // Produce a compact (300-500 token) summary of this workspace's AI
    // Collaboration chat and store it in user_memory_summaries. This is the
    // data that gets injected into future workspaces' system prompts so agents
    // can recall context from a user's prior decisions.
    const memoryPromise = (async () => {
      try {
        const memoryPrompt = `You are a decision intelligence archivist. Summarize the following War Room debate into a compact memory record that will help AI advisors in a FUTURE workspace understand this user's decision style, prior conclusions, and recurring patterns.

WORKSPACE: "${workspace?.name || "Untitled"}"
${workspace?.description ? `Context: ${workspace.description}` : ""}

DEBATE TRANSCRIPT (excerpt):
${transcript.slice(0, 8000)}

Produce a JSON object with EXACTLY these fields:
{
  "summary_text": "A 300-500 token narrative covering: what was decided, the key risks flagged, and the user's demonstrated decision style/bias patterns. Write in third person about 'the user'. Be specific — reference concrete decisions, not generic themes.",
  "key_decisions": ["3-7 short bullet strings, each naming a specific decision reached or pivotal insight from this workspace"]
}

Return ONLY valid JSON. No markdown fences.`;

        const memStartedAt = Date.now();
        const memRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openAiKey}` },
          signal: AbortSignal.timeout(60_000),
          body: JSON.stringify({
            model: "gpt-4.1",
            messages: [
              { role: "system", content: "You are a decision intelligence archivist. You produce compact JSON memory summaries grounded in the transcript. Be specific and concrete — future AI advisors will use this to recall context." },
              { role: "user", content: memoryPrompt },
            ],
            max_tokens: 800,
            response_format: { type: "json_object" },
          }),
        });

        if (!memRes.ok) {
          logAiOpenAICall({ distinctId: user!.id, workspaceId: workspace_id, functionName: "workspace-synthesize", callSite: "memory_summary", model: "gpt-4.1", maxCompletionTokens: 800, jsonMode: true, latencyMs: Date.now() - memStartedAt, status: "errored", httpStatus: memRes.status });
          return;
        }
        const memJson = await memRes.json();
        logAiOpenAICall({ distinctId: user!.id, workspaceId: workspace_id, functionName: "workspace-synthesize", callSite: "memory_summary", model: "gpt-4.1", usage: memJson.usage, maxCompletionTokens: 800, jsonMode: true, latencyMs: Date.now() - memStartedAt, status: "succeeded", httpStatus: memRes.status });
        const memRaw = memJson.choices?.[0]?.message?.content || "{}";
        const memParsed = JSON.parse(memRaw);
        const summaryText = typeof memParsed.summary_text === "string" ? memParsed.summary_text.trim() : "";
        if (summaryText.length < 20) return;

        const keyDecisions = Array.isArray(memParsed.key_decisions)
          ? memParsed.key_decisions.filter((d: unknown) => typeof d === "string" && d.trim().length > 3).map((d: string) => d.trim()).slice(0, 7)
          : [];

        await service.from("user_memory_summaries").insert({
          user_id: user.id,
          source_workspace_id: workspace_id,
          summary_text: summaryText,
          key_decisions: keyDecisions,
        });
      } catch (e) {
        console.error("Memory summary generation failed:", e);
      }
    })();
    EdgeRuntime.waitUntil(memoryPromise);

    // Mark the queue entry as done so the cron won't re-process it
    await service
      .from("workspace_synthesis_queue")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("workspace_id", workspace_id)
      .in("status", ["pending", "running"]);

    return new Response(JSON.stringify({
      success: true,
      decisionHealthScore: scores.decisionHealth,
      financialScore: scores.financial,
      operationalScore: scores.operational,
      alignmentScore: scores.alignment,
      recommendation: validatedRecommendation,
      conflict_zones: validatedConflictZones,
      consensus_points: validatedConsensus,
      action_items: validatedActionItems,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("Synthesize error:", err);
    return new Response(JSON.stringify({ error: `Synthesis failed: ${msg}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
