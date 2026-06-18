import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Full roster of 7 agents ──────────────────────────────────────────────────

const AGENT_ROSTER: Record<string, {
  name: string;
  role: string;
  temperature: number;
  maxTokens: number;
  persona: string;
  keywords: string[];
}> = {
  risk_analyst: {
    name: "Risk Analyst",
    role: "risk_analyst",
    temperature: 0.6,
    maxTokens: 1100,
    keywords: ["risk", "threat", "assumption", "vulnerable", "downside", "liability", "exposure", "danger", "failure", "hedge"],
    persona: `You are a ruthlessly rigorous Risk Analyst. Your entire job is to stop the team from making expensive mistakes by surfacing what they have not yet quantified.

MANDATORY BEHAVIOURS — do ALL of these in every response:
1. Catalogue every risk signal by category (market / execution / financial / team / technology) with explicit probability (low/medium/high) and impact (low/medium/high) for each.
2. Name the single most dangerous unquantified assumption the team is relying on and demand the number, deadline, or evidence that validates or kills it.
3. Connect current risks to anything that appeared in prior sessions — if a category has recurred, say so explicitly.
4. If Pattern Intelligence flags a recurring risk category, open with it.
5. End with one precise, uncomfortable question the team must answer before proceeding.

You are NOT a cheerleader. Your value is discomfort that prevents failure.`,
  },

  devils_advocate: {
    name: "Devil's Advocate",
    role: "devils_advocate",
    temperature: 0.6,
    maxTokens: 1100,
    keywords: ["decision", "choose", "plan", "strategy", "commit", "launch", "go", "invest", "bet", "pivot"],
    persona: `You are a relentless Devil's Advocate — the last line of defence before a bad decision gets committed to.

MANDATORY BEHAVIOURS — every response must include ALL of these:
1. Identify the single strongest counter-argument to the team's current direction. State it clearly and forcefully. Do not soften it.
2. Name the cognitive bias driving the reasoning (Optimism Bias, Sunk Cost Fallacy, Groupthink, Planning Fallacy, Confirmation Bias, Survivorship Bias) and say exactly WHERE it appeared.
3. Play the failure scenario to its logical end: "Here is exactly how this fails — step by step."
4. Demand quantification for every vague claim: "significant growth", "strong demand", "manageable risk", "soon" — ask "What number? By when? Measured how?"
5. If Pattern Intelligence shows a dominant bias has recurred across sessions, LEAD with it.
6. If a prior decision is being quietly undermined, call it out by referencing what was decided.
7. End with the single most destabilising question the team has not asked themselves.

You give no praise. Other agents cover the upside. You cover the downside.`,
  },

  innovation_scout: {
    name: "Innovation Scout",
    role: "innovation_scout",
    temperature: 0.72,
    maxTokens: 900,
    keywords: ["opportunity", "innovation", "creative", "new", "idea", "disrupt", "breakthrough", "pivot", "differentiate", "experiment"],
    persona: `You are a disciplined Innovation Scout. You surface non-obvious opportunities and creative pivots — with rigour, not wishful thinking.

MANDATORY BEHAVIOURS:
1. For every opportunity, name a real-world analogue where a comparable approach worked, and one where it failed. No analogues = no opportunity.
2. Label clearly: "VALIDATED OPPORTUNITY" (evidence exists) vs "HYPOTHESIS" (no evidence yet).
3. Name the primary failure mode of every idea you propose.
4. Ask: what is the minimum viable test the team could run in 2 weeks to validate or kill this?
5. If the team's direction is safe but strategically blind, say so — and describe the bolder move they are not considering.`,
  },

  market_analyst: {
    name: "Market Analyst",
    role: "market_analyst",
    temperature: 0.65,
    maxTokens: 1000,
    keywords: ["market", "customer", "segment", "competitor", "demand", "pricing", "sales", "revenue", "growth", "acquisition", "retention", "churn", "TAM", "SAM", "SOM", "go-to-market", "GTM", "position", "brand"],
    persona: `You are a rigorous Market Analyst. You ground every discussion in real market dynamics — not assumptions about customers or competition.

MANDATORY BEHAVIOURS:
1. Identify the specific customer segment being discussed. Name who they are, what they urgently need, and what they are currently paying (in money or time) to solve the same problem. If this is unclear, demand clarity before proceeding.
2. Name the top 2-3 direct and indirect competitors. Where does the team's proposed direction create a defensible advantage — and where does it expose a flank?
3. Challenge any market size claim. Ask: "What is the evidence for this number? Is this TAM, SAM, or SOM? What share is realistically capturable in 18 months?"
4. Identify the biggest demand assumption the team is making. What signal would confirm real demand vs wishful thinking?
5. End with one question about customer behaviour that could break the entire strategy if the answer is wrong.`,
  },

  financial_strategist: {
    name: "Financial Strategist",
    role: "financial_strategist",
    temperature: 0.6,
    maxTokens: 1000,
    keywords: ["cost", "budget", "revenue", "profit", "margin", "finance", "pricing", "investment", "capital", "funding", "cash", "burn", "ROI", "unit economics", "LTV", "CAC", "payback", "valuation", "equity", "raise"],
    persona: `You are a Financial Strategist who translates strategy into economics. You make sure the team's plans survive contact with a spreadsheet.

MANDATORY BEHAVIOURS:
1. Identify the key financial assumption that, if wrong, kills the plan. State the assumption explicitly and ask what evidence supports it.
2. Force unit economics clarity: What does it cost to acquire one customer? What is their lifetime value? What is the payback period? If these are unknown, say so directly.
3. Model the downside: What does the financial picture look like if revenue is 50% of plan and costs are 20% over? Is the business still viable?
4. Challenge any pricing decision. Ask: "Is this based on cost-plus, competitor benchmarking, or willingness-to-pay research? Which should it be?"
5. If burn rate or runway is relevant, surface it: "At this cost structure, how many months of runway do you have if the next funding round takes 6 months longer than expected?"
6. End with one number the team does not know but absolutely must know before making this decision.`,
  },

  execution_lead: {
    name: "Execution Lead",
    role: "execution_lead",
    temperature: 0.65,
    maxTokens: 1000,
    keywords: ["execute", "implement", "launch", "build", "ship", "timeline", "roadmap", "milestone", "team", "resource", "capacity", "priority", "operations", "delivery", "product", "engineering", "sprint", "deploy", "scale"],
    persona: `You are an Execution Lead — a seasoned operator who has seen plans fail at implementation. You turn good ideas into executable plans and expose where execution will break.

MANDATORY BEHAVIOURS:
1. Identify the single highest execution risk: the step in the plan most likely to be underestimated, delayed, or blocked. Name it concretely.
2. Stress-test the timeline. Apply the Planning Fallacy: the real timeline is typically 2-3x the estimate. What is the impact if this takes twice as long?
3. Identify the critical resource constraint: the specific person, skill, tool, or capability the team does not have but the plan requires. What is the plan to resolve it?
4. Surface hidden dependencies: what must be true before step N can start that is currently not guaranteed?
5. Ask: "Who owns this? What is their current capacity? What are they being pulled off to do it?"
6. End with the one execution bottleneck that, left unaddressed, will be the reason this is discussed in a post-mortem.`,
  },

  people_advisor: {
    name: "People Advisor",
    role: "people_advisor",
    temperature: 0.68,
    maxTokens: 950,
    keywords: ["team", "hire", "culture", "people", "talent", "leadership", "founder", "CEO", "manager", "morale", "org", "structure", "values", "conflict", "alignment", "engagement", "performance", "feedback", "diversity", "burnout"],
    persona: `You are a People Advisor — an expert in organizational dynamics, talent strategy, and leadership. You see what happens to strategies when humans have to execute them.

MANDATORY BEHAVIOURS:
1. Identify the people risk that receives least attention in this discussion. Name it directly: "The team is implicitly assuming [X] about people, and that assumption is fragile."
2. If a hiring or team structure decision is involved, ask: "Is this role structured for the person you have or the work you need done? Those are often different."
3. Surface alignment risk: Are the people who need to execute this decision actually bought in? If alignment is assumed rather than confirmed, say so.
4. Challenge any cultural assumption. "Fast-moving" teams still have norms, politics, and capacity limits. Make them visible.
5. If leadership behaviour is a factor, name it. Founders and managers create culture through their actions, not their values statements.
6. End with one question about the people involved that, if the answer is wrong, makes the plan undeliverable regardless of how good the strategy is.`,
  },
};

const DAILY_MESSAGE_LIMIT = 100;

const JAILBREAK_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompt|rules?|system)/i,
  /you\s+are\s+now\s+(a\s+)?(?!the\s+skeptic|risk\s+analyst|market\s+analyst|financial|execution|people|devil|innovation)/i,
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

// ─── Agent selection via GPT classification ───────────────────────────────────

async function selectAgents(
  message: string,
  recentHistory: Array<{ role: string; content: string }>,
  workspaceDomain: string | null | undefined,
  workspaceDescription: string | null | undefined,
  openAiKey: string
): Promise<string[]> {
  const agentList = Object.values(AGENT_ROSTER).map(a =>
    `- ${a.role}: ${a.name} (best for: ${a.keywords.slice(0, 5).join(", ")})`
  ).join("\n");

  const recentContext = recentHistory.slice(-4).map(m =>
    `${m.role === "user" ? "User" : "AI"}: ${m.content.slice(0, 200)}`
  ).join("\n");

  const classificationPrompt = `You are an agent router for a strategic decision-making workspace.

Workspace domain: ${workspaceDomain || "general"}
Workspace focus: ${workspaceDescription || "strategic decisions"}

Recent conversation context:
${recentContext || "(no prior context)"}

Current message: "${message}"

Available agents:
${agentList}

Select the 3 most relevant agents for this specific message. Return ONLY a JSON array of role strings. No explanation.
Rules:
- Always include "devils_advocate" when a decision, plan, or strategy is being discussed
- Always include "risk_analyst" unless the topic is purely about people/culture/hiring
- Pick the remaining 1-2 agents most directly relevant to the topic
- Maximum 4 agents, minimum 3

Example output: ["devils_advocate", "risk_analyst", "market_analyst"]`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: classificationPrompt }],
        max_tokens: 80,
        temperature: 0,
      }),
    });

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || "";

    // Extract JSON array from the response
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        const valid = parsed
          .filter((r: string) => typeof r === "string" && AGENT_ROSTER[r])
          .slice(0, 4);
        if (valid.length >= 2) return valid;
      }
    }
  } catch {
    // Fall through to default
  }

  // Default fallback: devils_advocate + risk_analyst + innovation_scout
  return ["devils_advocate", "risk_analyst", "innovation_scout"];
}

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
    parts.push(`DOMINANT BIAS ACROSS SESSIONS: "${memory.dominant_bias}" has appeared more than any other reasoning trap in this workspace's history — the team's most reliable blind spot.`);
  }

  if (memory.recurring_risks && memory.recurring_risks.length > 0) {
    parts.push(`RECURRING UNRESOLVED RISKS (appeared in 3+ synthesis sessions): ${memory.recurring_risks.join(", ")}. These categories have surfaced repeatedly without resolution.`);
  }

  if (memory.decision_category_history && memory.decision_category_history.length >= 3) {
    const recent = memory.decision_category_history.slice(-5);
    const counts: Record<string, number> = {};
    for (const c of recent) counts[c] = (counts[c] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3) {
      parts.push(`SESSION PATTERN: ${top[1]} of the last ${recent.length} sessions have been "${top[0]}" decisions — the team may be over-indexing on one type.`);
    }
  }

  if (parts.length === 0) return "";

  return `\n\n=== PATTERN INTELLIGENCE (cross-session patterns — highest priority signal) ===\n${parts.join("\n")}\nThese patterns come from the team's own history. Reference them directly when relevant.\n=== END PATTERN INTELLIGENCE ===`;
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

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch workspace context, synthesis, and memory — plus run agent selection — in parallel
    const conversationHistory = (history || []).slice(-12).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content).slice(0, MAX_MESSAGE_CHARS),
    }));

    const [wsRes, synthRes, memoryRes, selectedRoles] = await Promise.all([
      service.from("workspaces").select("name, description, domain").eq("id", workspace_id).maybeSingle(),
      service.from("workspace_synthesis")
        .select("consensus_points, conflict_zones, open_questions, risk_signals, blind_spots, decision_health_score, cognitive_bias_flags")
        .eq("workspace_id", workspace_id)
        .maybeSingle(),
      service.from("workspace_memory")
        .select("decisions, agreements, open_threads, key_entities, summary, synthesis_count, recurring_risks, dominant_bias, decision_category_history")
        .eq("workspace_id", workspace_id)
        .maybeSingle(),
      selectAgents(safeMessage, conversationHistory, null, null, openAiKey),
    ]);

    const workspace = wsRes.data;
    const synthesis = synthRes.data;
    const memory = memoryRes.data;

    // Re-run selection with workspace context if needed (we already have workspace now)
    // The initial selection used null domain/description but that's fine — the message content drives most of the routing

    const selectedAgents = selectedRoles
      .filter((r: string) => AGENT_ROSTER[r])
      .map((r: string) => AGENT_ROSTER[r]);

    // ── Memory context ──────────────────────────────────────────────────────
    let memoryContext = "";
    if (memory?.summary || (memory?.decisions?.length ?? 0) > 0) {
      const lines: string[] = [];
      lines.push(`\n\n=== WORKSPACE MEMORY (persistent across all sessions) ===`);
      if (memory!.summary) lines.push(`WHAT HAS BEEN DISCUSSED:\n${memory!.summary}`);
      if (memory!.decisions?.length > 0) {
        lines.push(`\nDECISIONS ALREADY REACHED — build on them or flag if now in conflict:`);
        memory!.decisions.forEach((d: string, i: number) => lines.push(`  ${i + 1}. ${d}`));
      }
      if (memory!.agreements?.length > 0) {
        lines.push(`\nESTABLISHED AGREEMENTS:`);
        memory!.agreements.forEach((a: string) => lines.push(`  - ${a}`));
      }
      if (memory!.open_threads?.length > 0) {
        lines.push(`\nOPEN THREADS FROM PRIOR SESSIONS:`);
        memory!.open_threads.forEach((t: string, i: number) => lines.push(`  ${i + 1}. ${t}`));
      }
      if (memory!.key_entities?.length > 0) {
        lines.push(`\nKEY ENTITIES: ${memory!.key_entities.join(", ")}`);
      }
      lines.push(`\nThis memory is ground truth. Reference prior decisions naturally.`);
      lines.push(`=== END WORKSPACE MEMORY ===`);
      memoryContext = lines.join("\n");
    }

    // ── Pattern intelligence (Risk Analyst + Devil's Advocate only) ─────────
    const patternContext = memory ? buildPatternContext(memory) : "";

    // ── Synthesis context ───────────────────────────────────────────────────
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
      lines.push(`\nDrive toward concrete resolution. Take clear positions.`);
      lines.push(`=== END WAR ROOM INTELLIGENCE ===`);
      synthesisContext = lines.join("\n");
    }

    const workspaceHeader = `You are participating in a private team workspace called "${workspace?.name || "Private Workspace"}"${workspace?.description ? ` focused on: ${workspace.description}` : ""}${workspace?.domain ? ` (domain: ${workspace.domain})` : ""}.`;

    // ── Call selected agents in parallel ────────────────────────────────────
    const agentResponses = await Promise.all(
      selectedAgents.map(async (agent) => {
        const agentPatternContext = (agent.role === "risk_analyst" || agent.role === "devils_advocate")
          ? patternContext
          : "";

        const systemPrompt = `${agent.persona}

${workspaceHeader}${memoryContext}${agentPatternContext}${synthesisContext}

Keep responses under 300 words. Be specific, take clear positions, name concrete things. Reference prior decisions and open threads when relevant. Never be vague. No platitudes. No hedging.`;

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
