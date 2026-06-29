import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
    if (!workspace_id) return new Response(JSON.stringify({ error: "workspace_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Internal cron calls carry the service role key as their Bearer token.
    // This cannot be spoofed by a regular user JWT.
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

    // Fetch workspace, messages, and the previous synthesis in parallel
    const [wsRes, msgsRes, prevSynthRes] = await Promise.all([
      service.from("workspaces").select("name, topic, description").eq("id", workspace_id).maybeSingle(),
      service.from("workspace_messages").select("role, content, agent_name, agent_role, created_at").eq("workspace_id", workspace_id).order("created_at", { ascending: true }).limit(200),
      service.from("workspace_synthesis")
        .select("open_questions, conflict_zones, blind_spots, action_items, generated_at")
        .eq("workspace_id", workspace_id)
        .maybeSingle(),
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
      const content = m.content.length > 800 ? m.content.slice(0, 800) + "…" : m.content;
      if (m.role === "user") return `[TEAM]: ${content}`;
      const label = m.agent_role ? `[${(m.agent_role as string).toUpperCase().replace(/_/g, " ")}]` : "[AGENT]";
      return `${label}: ${content}`;
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
Only include items in each section when the TRANSCRIPT PROVIDES DIRECT EVIDENCE. Do NOT invent, estimate, or infer data that was not discussed. Empty arrays [] are correct and expected when a topic was not addressed. A synthesis with 3 accurate items is better than one with 10 fabricated items.

OUTPUT REQUIREMENTS — READ THESE BEFORE WRITING A SINGLE WORD:

■ CONSENSUS POINTS: Every point must reflect something agents genuinely agreed on in the transcript. Report what was found — do not pad with generic agreements.

■ CONFLICT ZONES: Only identify real fault lines where agents took opposing positions. If no genuine disagreement occurred, return [].

■ OPEN QUESTIONS: Only list questions the debate genuinely left unresolved. Do not fabricate questions that were not raised or implied.

■ RISK SIGNALS: Only include risks explicitly raised or directly implied by what was discussed. Span relevant categories; do not invent risks not grounded in the transcript.

■ BLIND SPOTS: Only identify dimensions genuinely underweighted in THIS discussion. Do not list generic strategic gaps that apply to any decision.

■ ACTION ITEMS: Only generate tasks directly derivable from agent recommendations or team statements in the transcript.

■ FINANCIAL METRICS: ⚠ EVIDENCE-ONLY. Include ONLY if the transcript contains specific numbers, percentages, costs, revenues, or financial figures that were explicitly stated. Do NOT derive or estimate. If financial data was not discussed, return [].

■ OPERATIONAL METRICS: ⚠ EVIDENCE-ONLY. Include ONLY if timelines, team sizes, launch sequences, or specific operational parameters were explicitly discussed. If not, return [].

■ NON-FINANCIAL METRICS: ⚠ EVIDENCE-ONLY. Include ONLY if brand perception, culture, talent sentiment, customer metrics, or qualitative KPIs were substantively discussed. If not, return [].

■ OPPORTUNITY SIGNALS: ⚠ EVIDENCE-ONLY. Include ONLY concrete opportunities explicitly surfaced by agents in the debate. If no opportunities were identified, return [].

■ COGNITIVE BIAS FLAGS: ⚠ EVIDENCE-ONLY. Include ONLY biases that visibly manifested in this specific discussion. If reasoning was balanced and no clear pattern of bias appeared, return [].

■ KEY DECISIONS: Include the pivotal decisions that were explicitly named or debated. If no clear decisions were surfaced, return [].

■ RECOMMENDATION: 5-8 sentences. Start with the unambiguous recommended path. State what must be accepted (the tradeoff). Identify the one thing that, if not done in 7 days, will cause meaningful delay or damage. Be direct — no hedging.

---

FIELD RULES:

CONFLICT ZONES:
- topic = the exact strategic fault line (e.g., "Full mandate vs permanent hybrid model")
- agent_a, agent_b = role names from transcript (e.g., "people_advisor", "risk_analyst", "devils_advocate", "financial_strategist", "execution_lead", "market_analyst", "innovation_scout")
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
    { "text": "string", "source_area": "string", "priority": "critical|high|medium" }
  ],
  "consensus_points": [
    { "text": "string", "confidence": 85, "source_count": 5 }
  ],
  "conflict_zones": [
    {
      "topic": "string",
      "agent_a": "string",
      "position_a": "string",
      "agent_b": "string",
      "position_b": "string",
      "tension_level": 80
    }
  ],
  "open_questions": [
    { "question": "string", "urgency": "critical|high|medium" }
  ],
  "risk_signals": [
    { "signal": "string", "severity": "critical|high|medium|low", "category": "market|execution|financial|team|technology" }
  ],
  "blind_spots": [
    { "area": "string", "description": "string" }
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
    { "bias_name": "string", "explanation": "string", "counter_question": "string" }
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
    { "text": "string — specific, owner-assigned, decision-connected task", "source_area": "string", "priority": "critical|high|medium" }
  ]
}`;

    // Run main synthesis first, then action items sequentially to avoid TPM rate limits.
    // Both calls together can exceed 30k tokens/min when parallelised.
    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a world-class strategic synthesis engine and Chief Strategy Officer. You produce comprehensive JSON exactly as instructed, grounded entirely in the transcript provided. Only include items with direct evidence — empty arrays are correct when a topic was not discussed.",
          },
          { role: "user", content: synthesisPrompt },
        ],
        max_tokens: 6000,
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    const actionItemsRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openAiKey}` },
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
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!openAiRes.ok) {
      const err = await openAiRes.text();
      console.error("OpenAI error:", openAiRes.status, err);
      let detail = "AI synthesis failed";
      try { const parsed = JSON.parse(err); detail = parsed?.error?.message || detail; } catch { /* use default */ }
      return new Response(JSON.stringify({ error: detail }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const openAiJson = await openAiRes.json();
    const rawContent = openAiJson.choices?.[0]?.message?.content || "{}";

    let synthesis: Record<string, unknown>;
    try {
      synthesis = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse synthesis JSON:", rawContent.slice(0, 500));
      return new Response(JSON.stringify({ error: "Failed to parse synthesis" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Merge dedicated action items into synthesis (overrides whatever the main call produced)
    if (actionItemsRes.ok) {
      try {
        const aiJson = await actionItemsRes.json();
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
    } else {
      const aiErr = await actionItemsRes.text();
      console.error("Action items call failed:", actionItemsRes.status, aiErr);
    }

    // ─── DETERMINISTIC SCORE COMPUTATION ─────────────────────────────────────
    // Uses the exact fields the AI prompt produces. Every deduction/bonus is
    // tied to a real structured value — no dead code from mismatched field names.
    function computeScores(): { decisionHealth: number; financial: number | null; operational: number | null; alignment: number } {
      // Use the actual field names the AI produces
      const riskSignals = Array.isArray(synthesis.risk_signals)
        ? synthesis.risk_signals as Array<{ severity?: string; category?: string }>
        : [];
      const blindSpots = Array.isArray(synthesis.blind_spots) ? synthesis.blind_spots : [];
      const openQuestions = Array.isArray(synthesis.open_questions)
        ? synthesis.open_questions as Array<{ urgency?: string }>
        : [];
      const consensusPoints = Array.isArray(synthesis.consensus_points)
        ? synthesis.consensus_points as Array<{ confidence?: number; source_count?: number }>
        : [];
      const conflictZones = Array.isArray(synthesis.conflict_zones)
        ? synthesis.conflict_zones as Array<{ tension_level?: number }>
        : [];
      const actionItems = Array.isArray(synthesis.action_items)
        ? synthesis.action_items as Array<{ priority?: string }>
        : [];
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
    const riskSignals = Array.isArray(synthesis.risk_signals)
      ? synthesis.risk_signals as Array<{ severity?: string; signal?: string }>
      : [];
    const criticalRisks = riskSignals.filter(r => r.severity === "critical").map(r => r.signal).filter(Boolean);
    const openQs = Array.isArray(synthesis.open_questions)
      ? (synthesis.open_questions as Array<{ urgency?: string; question?: string }>).filter(q => q.urgency === "critical" || q.urgency === "high")
      : [];
    const blindSpotList = Array.isArray(synthesis.blind_spots)
      ? (synthesis.blind_spots as Array<{ area?: string }>).map(b => b.area).filter(Boolean)
      : [];
    const highTensionConflicts = Array.isArray(synthesis.conflict_zones)
      ? (synthesis.conflict_zones as Array<{ tension_level?: number; topic?: string }>)
          .filter(z => (z.tension_level ?? 0) >= 70).map(z => z.topic).filter(Boolean)
      : [];
    const resolvedDecisionCount = Array.isArray(synthesis.key_decisions)
      ? (synthesis.key_decisions as Array<{ status?: string }>).filter(d => d.status === "resolved").length
      : 0;
    const consensusCount = Array.isArray(synthesis.consensus_points) ? synthesis.consensus_points.length : 0;

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

    const rationaleRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: rationalePrompt }],
        max_tokens: 80,
        temperature: 0.2,
      }),
    });

    let healthRationale: string | null = null;
    if (rationaleRes.ok) {
      const rationaleJson = await rationaleRes.json();
      const rationaleText = rationaleJson.choices?.[0]?.message?.content?.trim() ?? "";
      if (rationaleText.length > 10) healthRationale = rationaleText;
    }
    // Fallback: deterministic rationale if the second call fails
    if (!healthRationale) {
      if (scores.decisionHealth < 35) {
        healthRationale = `Severe gaps in financial data, unresolved critical risks, and multiple unresolved open questions make a confident recommendation impossible at this stage. Resolve the highest-urgency open questions and build financial projections before proceeding.`;
      } else if (scores.decisionHealth < 55) {
        healthRationale = `${criticalRisks.length > 0 ? `Critical risks (${criticalRisks[0]}) remain unaddressed` : "Key strategic conflicts remain unresolved"} and the team lacks sufficient consensus to move forward confidently. Focus on resolving the highest-tension conflict and eliminating at least one critical risk signal.`;
      } else if (scores.decisionHealth < 75) {
        healthRationale = `The team has established a working foundation but ${openQs.length > 0 ? `${openQs.length} high-urgency question(s) remain open` : "strategic alignment is still fragile"}. Resolve the outstanding decision blockers to push this score into the Sharp tier.`;
      } else {
        healthRationale = `Strong consensus across ${consensusCount} points and ${resolvedDecisionCount} resolved key decision(s) show a team that has done the hard work. Maintain momentum by converting action items into owner-assigned deliverables.`;
      }
    }

    // Extract recommendation
    const recommendation = typeof synthesis.recommendation === "string" && synthesis.recommendation.trim().length > 20
      ? synthesis.recommendation.trim()
      : null;

    // Upsert into workspace_synthesis
    const { error: upsertError } = await service
      .from("workspace_synthesis")
      .upsert({
        workspace_id,
        consensus_points: synthesis.consensus_points ?? [],
        conflict_zones: synthesis.conflict_zones ?? [],
        open_questions: synthesis.open_questions ?? [],
        risk_signals: synthesis.risk_signals ?? [],
        blind_spots: synthesis.blind_spots ?? [],
        action_items: synthesis.action_items ?? [],
        financial_metrics: synthesis.financial_metrics ?? [],
        operational_metrics: synthesis.operational_metrics ?? [],
        non_financial_metrics: synthesis.non_financial_metrics ?? [],
        opportunity_signals: synthesis.opportunity_signals ?? [],
        cognitive_bias_flags: synthesis.cognitive_bias_flags ?? [],
        key_decisions: synthesis.key_decisions ?? [],
        decision_velocity: synthesis.decision_velocity ?? "moderate",
        confidence_trajectory: synthesis.confidence_trajectory ?? "flat",
        health_rationale: healthRationale,
        recommendation,
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
    const newActionItems = Array.isArray(synthesis.action_items)
      ? (synthesis.action_items as Array<{ text?: string; source_area?: string; priority?: string }>)
          .filter(a => typeof a.text === "string" && a.text.trim().length > 5)
      : [];

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

    // ── Cross-workspace Pattern Intelligence rollup ───────────────────────────
    // Fire-and-forget — runs as the response is already sent
    (async () => {
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
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingXw) {
          await service.from("user_pattern_intelligence").update(payload).eq("user_id", user.id);
        } else {
          await service.from("user_pattern_intelligence").insert(payload);
        }
      } catch (e) {
        console.error("Cross-workspace pattern rollup error:", e);
      }
    })();

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
      recommendation,
      conflict_zones: synthesis.conflict_zones,
      consensus_points: synthesis.consensus_points,
      action_items: synthesis.action_items,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Synthesize error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
