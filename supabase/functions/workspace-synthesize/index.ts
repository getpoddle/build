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

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { workspace_id } = await req.json();
    if (!workspace_id) return new Response(JSON.stringify({ error: "workspace_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Verify membership
    const { data: member } = await service
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return new Response(JSON.stringify({ error: "Not a member" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Fetch workspace + messages
    const [wsRes, msgsRes] = await Promise.all([
      service.from("workspaces").select("name, topic, description").eq("id", workspace_id).maybeSingle(),
      service.from("workspace_messages").select("role, content, agent_name, agent_role, created_at").eq("workspace_id", workspace_id).order("created_at", { ascending: true }).limit(200),
    ]);

    const workspace = wsRes.data;
    const messages = msgsRes.data || [];

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages to synthesize" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const workspaceContext = [
      workspace?.name ? `Topic: ${workspace.name}` : "",
      workspace?.topic ? `Focus: ${workspace.topic}` : "",
      workspace?.description ? `Context: ${workspace.description}` : "",
    ].filter(Boolean).join("\n");

    // Use last 40 messages, truncating long individual messages to control token usage.
    // Synthesis quality depends on breadth of debate coverage, not raw verbosity.
    const recentMessages = messages.slice(-40);
    const transcript = recentMessages.map(m => {
      const content = m.content.length > 800 ? m.content.slice(0, 800) + "…" : m.content;
      if (m.role === "user") return `[TEAM]: ${content}`;
      const label = m.agent_role ? `[${(m.agent_role as string).toUpperCase().replace(/_/g, " ")}]` : "[AGENT]";
      return `${label}: ${content}`;
    }).join("\n\n");

    // ─── SYNTHESIS PROMPT ─────────────────────────────────────────────────────
    const synthesisPrompt = `You are a world-class Chief Strategy Officer and decision intelligence engine. You have just witnessed a full War Room debate between seven specialist AI advisors. Your mandate is to produce the most comprehensive, rigorous, and exhaustive strategic synthesis possible — the kind that a Board of Directors, Series B investor, or Fortune 500 C-suite would trust to make a multimillion-dollar decision.

Every field must be populated to the maximum. Thin, generic, or vague outputs are unacceptable. Every item must be grounded in the specific debate transcript provided.

WORKSPACE CONTEXT:
${workspaceContext}

FULL DEBATE TRANSCRIPT:
${transcript}

---

OUTPUT REQUIREMENTS — READ THESE BEFORE WRITING A SINGLE WORD:

■ CONSENSUS POINTS: MINIMUM 8, target 10-12. Each must be a substantive, specific statement of what agents actually agreed on — not platitudes. Include the confidence score (0-100) and how many agents endorsed it.

■ CONFLICT ZONES: MINIMUM 4, target 5-7. Identify every real fault line in the debate. The topic must name the exact strategic tension (e.g., "Staged rollout vs simultaneous multi-market launch"). DO NOT default to generic financial conflicts unless cost was the core axis. Each zone must have both positions quoted with precision.

■ OPEN QUESTIONS: MINIMUM 8, target 10-14. These are the specific, answerable questions the team MUST resolve before they can move forward. They should be decision-forcing, not vague. Include urgency for each.

■ RISK SIGNALS: MINIMUM 8, target 10-15. Span all categories: market, execution, financial, team, technology, regulatory, competitive. Each signal must be a specific, named risk — not generic. Include severity and category.

■ BLIND SPOTS: MINIMUM 5, target 6-8. These are important dimensions the debate UNDERWEIGHTED or missed entirely. Each must explain specifically what could go wrong if this gap remains unaddressed.

■ ACTION ITEMS: MINIMUM 15, target 18-22. Each must be specific and executable (owner + task + enough detail to assign), prioritized (critical/high/medium), and derived from actual agent recommendations.

■ FINANCIAL METRICS: MINIMUM 5, target 6-8. Include specific numbers, percentages, or ranges mentioned or implied in the debate. If no specific figures were stated, derive reasonable estimates from context and flag as low confidence.

■ OPERATIONAL METRICS: MINIMUM 4, target 5-7. Specific operational parameters: timelines, team sizes, launch sequencing, capacity, etc.

■ NON-FINANCIAL METRICS: MINIMUM 4, target 5-6. Brand, culture, regulatory posture, talent sentiment, customer NPS, etc.

■ OPPORTUNITY SIGNALS: MINIMUM 4, target 5-7. Concrete opportunities surfaced by the debate — not just the main thesis, but adjacent or second-order opportunities agents identified.

■ COGNITIVE BIAS FLAGS: MINIMUM 3, target 4-6. Name the bias, explain exactly how it appeared in THIS debate, and provide a sharp counter-question the team should ask themselves.

■ KEY DECISIONS: MINIMUM 5, target 6-8. The pivotal decisions the team must make — not vague questions but named binary or multi-choice decisions with clear ownership.

■ RECOMMENDATION: 5-8 sentences minimum. Start with the unambiguous recommended path. State what must be accepted (the tradeoff). Identify the one thing that, if not done in 7 days, will cause meaningful delay or damage. Be direct — no hedging.

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

Produce a JSON object with EXACTLY this structure and field names:

{
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
  "action_items": [
    { "text": "string", "source_area": "string", "priority": "critical|high|medium" }
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

    // Call OpenAI
    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a world-class strategic synthesis engine and Chief Strategy Officer. You produce exhaustive, comprehensive JSON exactly as instructed. You never default to generic outputs — every field is maximally populated and grounded in the specific debate transcript. Thin or vague outputs are a failure. Minimum counts for every array field are non-negotiable.",
          },
          { role: "user", content: synthesisPrompt },
        ],
        max_tokens: 5000,
        temperature: 0.4,
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

    // ─── DETERMINISTIC SCORE COMPUTATION ─────────────────────────────────────
    // Uses the exact fields the AI prompt produces. Every deduction/bonus is
    // tied to a real structured value — no dead code from mismatched field names.
    function computeScores(): { decisionHealth: number; financial: number; operational: number; alignment: number } {
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
      // Starts at 35 — low until financial data is actually present
      let financial = 35;
      for (const m of financialMetrics) {
        if (m.confidence === "high") financial += 10;
        else if (m.confidence === "medium") financial += 5;
        else financial += 2;
      }
      // Unresolved high-tension conflicts drain financial confidence
      for (const z of conflictZones) {
        const tension = typeof z.tension_level === "number" ? z.tension_level : 50;
        if (tension >= 80) financial -= 5;
        else if (tension >= 60) financial -= 2;
      }
      financial = Math.max(10, Math.min(100, financial));

      // ── Operational Score ─────────────────────────────────────────────────────
      let operational = 40;
      for (const m of operationalMetrics) {
        if (m.status === "on-track") operational += 8;
        else if (m.status === "at-risk") operational -= 10;
        else if (m.status === "unclear") operational -= 4;
      }
      for (const r of riskSignals) {
        if (r.severity === "critical" && r.category === "execution") operational -= 8;
        else if (r.severity === "high" && r.category === "execution") operational -= 4;
      }
      operational = Math.max(10, Math.min(100, operational));

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
