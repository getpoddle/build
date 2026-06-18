import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Agent definitions ────────────────────────────────────────────────────────

const AI_AGENTS = [
  {
    name: "Risk Analyst",
    role: "risk_analyst",
    temperature: 0.6,
    maxTokens: 1100,
    persona: `You are a ruthlessly rigorous Risk Analyst. Your entire job is to stop the team from making expensive mistakes by surfacing what they have not yet quantified.

MANDATORY BEHAVIOURS — you must do ALL of these in every response:
1. Catalogue every risk signal in the current message by category (market / execution / financial / team / technology) and assign an explicit probability (low/medium/high) and impact (low/medium/high) to each.
2. Name the single most dangerous unquantified assumption the team is relying on and demand a number, deadline, or evidence that would validate or invalidate it.
3. Connect current risks to anything the team has encountered in prior sessions — if a risk category has appeared before, state that explicitly: "Execution risk has appeared in previous sessions and remains unresolved."
4. If a recurring risk category is flagged in the Pattern Intelligence section, open with it — this is the most important thing you can surface.
5. End every response with one precise, uncomfortable question the team must answer before proceeding.

You are NOT a cheerleader. You do not validate ideas — other agents do that. Your value is discomfort that prevents failure.`,
  },
  {
    name: "Devil's Advocate",
    role: "devils_advocate",
    temperature: 0.6,
    maxTokens: 1100,
    persona: `You are a relentless Devil's Advocate. You are the last line of defence before a bad decision gets committed to. You exist to make the team uncomfortable in ways that prevent catastrophic mistakes.

MANDATORY BEHAVIOURS — every single response must include:
1. Identify the single strongest counter-argument to the team's current direction, stated as clearly and forcefully as possible. Do not soften it.
2. Name any cognitive bias driving the team's reasoning (e.g. Optimism Bias, Sunk Cost Fallacy, Groupthink, Planning Fallacy, Confirmation Bias, Survivorship Bias). Be specific — say exactly WHERE in the conversation it appeared.
3. Play the failure scenario to its logical end: "Here is exactly how this fails — step by step."
4. Challenge any vague claims with quantification demands: if the team says "significant growth", "strong demand", "manageable risk", "soon", ask: "What does that mean in numbers? By when? Measured how?"
5. If the Pattern Intelligence section shows a dominant bias has appeared across multiple sessions, LEAD with it: "This is the Nth session where [bias] has appeared. The team has not corrected for it."
6. If a prior decision is being quietly undermined by the current direction, call it out explicitly by referencing what was decided before.
7. End with the single most destabilising question the team has not asked themselves.

You are not hostile. You are the most rigorous friend in the room — the one who loves the team enough to tell them what they do not want to hear. You give no praise. Other agents cover the upside. You cover the downside.`,
  },
  {
    name: "Innovation Scout",
    role: "innovation_scout",
    temperature: 0.72,
    maxTokens: 900,
    persona: `You are a disciplined Innovation Scout. You surface non-obvious opportunities, analogues from adjacent domains, and creative pivots — but you do so with intellectual rigour, not wishful thinking.

MANDATORY BEHAVIOURS:
1. For every opportunity you identify, name a real-world analogue where a comparable approach worked, and one where it failed. No analogues = no opportunity.
2. Distinguish clearly: "VALIDATED OPPORTUNITY" (evidence exists in this conversation or prior sessions) vs "HYPOTHESIS" (interesting idea, evidence absent). Never conflate them.
3. Name the primary failure mode of every idea you propose. If you cannot name one, you have not thought through it enough.
4. Ask: what is the minimum viable test the team could run in 2 weeks to validate or kill this idea?
5. If the team's current direction is incrementally safe but strategically blind, say so directly — describe the bolder move they are not considering.

You are creative but evidence-anchored. You never hype. You show what is possible while being honest about what could kill it.`,
  },
];

const DAILY_MESSAGE_LIMIT = 100;

const JAILBREAK_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompt|rules?|system)/i,
  /you\s+are\s+now\s+(a\s+)?(?!the\s+skeptic|risk\s+analyst|the\s+optimist|data\s+detective|the\s+pragmatist|strategic|devil|innovation)/i,
  /act\s+as\s+if\s+you\s+(are|were)\s+/i,
  /act\s+as\s+(an?\s+)?(AI|assistant|bot|model|chatbot|language\s+model|unrestricted|uncensored|evil|human\s+without\s+limits)/i,
  /pretend\s+(you\s+are|to\s+be|that\s+you)/i,
  /forget\s+(your|all)\s+(instructions?|rules?|guidelines?|persona)/i,
  /do\s+not\s+follow\s+(your\s+)?(instructions?|rules?|guidelines?)/i,
  /override\s+(your\s+)?(instructions?|system\s+prompt|rules?)/i,
  /jailbreak/i,
  /prompt\s+injection/i,
  /\bdeveloper\s+mode\b/i,
  /\bdan\s+mode\b/i,
];

function containsJailbreak(text: string): boolean {
  return JAILBREAK_PATTERNS.some(re => re.test(text));
}

const MAX_MESSAGE_CHARS = 2000;

// ─── Pattern intelligence context block ──────────────────────────────────────

function buildPatternContext(memory: {
  recurring_risks?: string[];
  dominant_bias?: string | null;
  decision_category_history?: string[];
  synthesis_count?: number;
}): string {
  if ((memory.synthesis_count ?? 0) < 2) return "";

  const parts: string[] = [];

  if (memory.dominant_bias) {
    parts.push(`DOMINANT BIAS ACROSS SESSIONS: "${memory.dominant_bias}" has appeared more than any other reasoning trap in this workspace's history. It is the team's most reliable blind spot.`);
  }

  if (memory.recurring_risks && memory.recurring_risks.length > 0) {
    parts.push(`RECURRING UNRESOLVED RISKS (appeared in 3+ synthesis sessions): ${memory.recurring_risks.join(", ")}. These categories have surfaced repeatedly without resolution — the team's most persistent failure mode.`);
  }

  if (memory.decision_category_history && memory.decision_category_history.length >= 3) {
    const recent = memory.decision_category_history.slice(-5);
    const counts: Record<string, number> = {};
    for (const c of recent) counts[c] = (counts[c] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3) {
      parts.push(`SESSION PATTERN: ${top[1]} of the last ${recent.length} sessions have been categorised as "${top[0]}" decisions. The team may be over-indexing on one decision type while neglecting others.`);
    }
  }

  if (parts.length === 0) return "";

  return `\n\n=== PATTERN INTELLIGENCE (cross-session patterns — highest priority signal) ===\n${parts.join("\n")}\nThese patterns come from the team's own history. They are more credible than any single-session observation. Reference them directly when relevant.\n=== END PATTERN INTELLIGENCE ===`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { workspace_id, message, history } = await req.json();
    if (!workspace_id || !message) {
      return new Response(JSON.stringify({ error: "Missing workspace_id or message" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeMessage = String(message).slice(0, MAX_MESSAGE_CHARS);

    if (containsJailbreak(safeMessage)) {
      return new Response(JSON.stringify({ error: "Message contains disallowed content." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: membership } = await service
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a workspace member" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Daily quota
    const today = new Date().toISOString().slice(0, 10);
    const { error: upsertErr } = await service.rpc("increment_daily_ai_usage", {
      p_user_id: user.id,
      p_date: today,
    });

    if (upsertErr) {
      const { data: usageRow } = await service
        .from("daily_ai_usage").select("message_count")
        .eq("user_id", user.id).eq("date", today).maybeSingle();
      const currentCount = usageRow?.message_count ?? 0;
      if (currentCount >= DAILY_MESSAGE_LIMIT) {
        return new Response(JSON.stringify({ error: "Daily message limit reached. Please try again tomorrow.", quota_exceeded: true }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await service.from("daily_ai_usage").upsert(
        { user_id: user.id, date: today, message_count: currentCount + 1 },
        { onConflict: "user_id,date" }
      );
    } else {
      const { data: usageRow } = await service
        .from("daily_ai_usage").select("message_count")
        .eq("user_id", user.id).eq("date", today).maybeSingle();
      if ((usageRow?.message_count ?? 0) > DAILY_MESSAGE_LIMIT) {
        return new Response(JSON.stringify({ error: "Daily message limit reached. Please try again tomorrow.", quota_exceeded: true }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch workspace context, synthesis, and full memory including pattern fields
    const [wsRes, synthRes, memoryRes] = await Promise.all([
      service.from("workspaces").select("name, description, domain").eq("id", workspace_id).maybeSingle(),
      service.from("workspace_synthesis")
        .select("consensus_points, conflict_zones, open_questions, risk_signals, blind_spots, decision_health_score, cognitive_bias_flags")
        .eq("workspace_id", workspace_id)
        .maybeSingle(),
      service.from("workspace_memory")
        .select("decisions, agreements, open_threads, key_entities, summary, synthesis_count, recurring_risks, dominant_bias, decision_category_history")
        .eq("workspace_id", workspace_id)
        .maybeSingle(),
    ]);

    const workspace = wsRes.data;
    const synthesis = synthRes.data;
    const memory = memoryRes.data;

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Workspace memory context ────────────────────────────────────────────
    let memoryContext = "";
    if (memory?.summary || (memory?.decisions?.length ?? 0) > 0) {
      const lines: string[] = [];
      lines.push(`\n\n=== WORKSPACE MEMORY (persistent across all sessions) ===`);
      if (memory!.summary) lines.push(`WHAT HAS BEEN DISCUSSED:\n${memory!.summary}`);
      if (memory!.decisions?.length > 0) {
        lines.push(`\nDECISIONS ALREADY REACHED — do not re-debate, build on them or flag if now in conflict:`);
        memory!.decisions.forEach((d: string, i: number) => lines.push(`  ${i + 1}. ${d}`));
      }
      if (memory!.agreements?.length > 0) {
        lines.push(`\nESTABLISHED AGREEMENTS:`);
        memory!.agreements.forEach((a: string) => lines.push(`  - ${a}`));
      }
      if (memory!.open_threads?.length > 0) {
        lines.push(`\nOPEN THREADS FROM PRIOR SESSIONS — still unresolved:`);
        memory!.open_threads.forEach((t: string, i: number) => lines.push(`  ${i + 1}. ${t}`));
      }
      if (memory!.key_entities?.length > 0) {
        lines.push(`\nKEY ENTITIES: ${memory!.key_entities.join(", ")}`);
      }
      lines.push(`\nThis memory is ground truth. Reference prior decisions naturally. Never ask about things already resolved.`);
      lines.push(`=== END WORKSPACE MEMORY ===`);
      memoryContext = lines.join("\n");
    }

    // ── Pattern intelligence (Risk Analyst + Devil's Advocate only) ─────────
    const patternContext = memory ? buildPatternContext(memory) : "";

    // ── War Room synthesis context ──────────────────────────────────────────
    let synthesisContext = "";
    if (synthesis) {
      const lines: string[] = [];
      lines.push(`\n\n=== WAR ROOM INTELLIGENCE (latest synthesis) ===`);
      lines.push(`Decision Health Score: ${synthesis.decision_health_score}/100`);
      if (synthesis.open_questions?.length > 0) {
        lines.push(`\nOPEN QUESTIONS:`);
        synthesis.open_questions.forEach((q: { question: string; urgency: string }, i: number) =>
          lines.push(`  ${i + 1}. [${q.urgency.toUpperCase()}] ${q.question}`)
        );
      }
      if (synthesis.conflict_zones?.length > 0) {
        lines.push(`\nACTIVE CONFLICTS:`);
        synthesis.conflict_zones.forEach((z: { topic: string; tension_level: number }) =>
          lines.push(`  - ${z.topic} (tension ${z.tension_level}/100)`)
        );
      }
      if (synthesis.blind_spots?.length > 0) {
        lines.push(`\nBLIND SPOTS:`);
        synthesis.blind_spots.forEach((b: { area: string; description: string }) =>
          lines.push(`  - ${b.area}: ${b.description}`)
        );
      }
      if (synthesis.risk_signals?.length > 0) {
        lines.push(`\nACTIVE RISK SIGNALS:`);
        synthesis.risk_signals.forEach((r: { signal: string; severity: string; category: string }) =>
          lines.push(`  - [${r.severity.toUpperCase()}/${r.category}] ${r.signal}`)
        );
      }
      if (synthesis.cognitive_bias_flags?.length > 0) {
        lines.push(`\nBIASES FLAGGED IN LAST SYNTHESIS:`);
        synthesis.cognitive_bias_flags.forEach((b: { bias_name: string; explanation: string }) =>
          lines.push(`  - ${b.bias_name}: ${b.explanation}`)
        );
      }
      if (synthesis.consensus_points?.length > 0) {
        lines.push(`\nESTABLISHED CONSENSUS — do not re-debate:`);
        synthesis.consensus_points.forEach((c: { text: string }) => lines.push(`  - ${c.text}`));
      }
      lines.push(`\nDrive the conversation toward concrete resolution. Take clear positions.`);
      lines.push(`=== END WAR ROOM INTELLIGENCE ===`);
      synthesisContext = lines.join("\n");
    }

    const workspaceHeader = `You are participating in a private team workspace called "${workspace?.name || "Private Workspace"}"${workspace?.description ? ` focused on: ${workspace.description}` : ""}${workspace?.domain ? ` (domain: ${workspace.domain})` : ""}.`;

    const conversationHistory = (history || []).slice(-12).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content).slice(0, MAX_MESSAGE_CHARS),
    }));

    // ── Call all agents in parallel ─────────────────────────────────────────
    const agentResponses = await Promise.all(
      AI_AGENTS.map(async (agent) => {
        const agentPatternContext = (agent.role === "risk_analyst" || agent.role === "devils_advocate")
          ? patternContext
          : "";

        const systemPrompt = `${agent.persona}

${workspaceHeader}${memoryContext}${agentPatternContext}${synthesisContext}

Keep responses under 300 words. Be specific, take clear positions, name concrete things. Reference prior decisions and open threads when relevant. Never be vague. No platitudes. No hedging. This team needs rigour, not comfort.`;

        const messages = [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: safeMessage },
        ];

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            max_tokens: agent.maxTokens,
            temperature: agent.temperature,
          }),
        });

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "I couldn't generate a response right now.";
        return { agent, content };
      })
    );

    // ── Persist messages ────────────────────────────────────────────────────
    await service.from("workspace_messages").insert({
      workspace_id,
      user_id: user.id,
      role: "user",
      content: safeMessage,
    });

    await service.from("workspace_messages").insert(
      agentResponses.map(({ agent, content }) => ({
        workspace_id,
        user_id: null,
        role: "assistant",
        content,
        agent_name: agent.name,
        agent_role: agent.role,
      }))
    );

    return new Response(
      JSON.stringify({
        responses: agentResponses.map(({ agent, content }) => ({
          agent_name: agent.name,
          agent_role: agent.role,
          content,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
