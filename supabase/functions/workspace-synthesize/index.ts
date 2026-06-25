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

    // Use last 80 messages to stay well within token limits
    const recentMessages = messages.slice(-80);
    const transcript = recentMessages.map(m => {
      if (m.role === "user") return `[TEAM]: ${m.content}`;
      const label = m.agent_role ? `[${(m.agent_role as string).toUpperCase().replace(/_/g, " ")}]` : "[AGENT]";
      return `${label}: ${m.content}`;
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

■ ACTION ITEMS: MINIMUM 15, target 18-22. This is the most critical section. Every action item must be:
  - Specific and executable (a real task, not a direction)
  - Assigned to an owner (source_area: HR, Finance, CEO, Product, Legal, Engineering, Risk, Strategy, etc.)
  - Prioritized (critical/high/medium)
  - Derived from actual agent recommendations or logical next steps
  Examples of GOOD action items:
  - "Conduct 20 customer discovery interviews in the German market to validate pricing assumptions before Q3 launch"
  - "Commission a legal opinion from EU-specialist counsel on AI Act Article 10 compliance requirements by [date]"
  - "Build a 3-scenario financial model (bear/base/bull) covering the first 24 months post-launch"
  Examples of BAD action items (do NOT write these):
  - "Review the situation" (too vague)
  - "Consider the financial implications" (not executable)

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
  "health_rationale": "string — 3-4 sentences assessing decision quality, coverage, and readiness based on the debate",
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
        max_tokens: 8000,
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
    // All scores are computed from structured fields, never from AI text
    function computeScores(): { decisionHealth: number; financial: number; operational: number; alignment: number } {
      const riskSignals = Array.isArray(synthesis.risk_signals) ? synthesis.risk_signals as Array<{ likelihood?: string; impact?: string }> : [];
      const blindSpots = Array.isArray(synthesis.blind_spots) ? synthesis.blind_spots : [];
      const openQuestions = Array.isArray(synthesis.open_questions) ? synthesis.open_questions as Array<{ blocker_level?: string }> : [];
      const consensusPoints = Array.isArray(synthesis.consensus_points) ? synthesis.consensus_points as Array<{ strength?: string }> : [];
      const actionItems = Array.isArray(synthesis.action_items) ? synthesis.action_items : [];
      const velocity = typeof synthesis.decision_velocity === "string" ? synthesis.decision_velocity : "steady";

      // Decision Health
      let decisionHealth = 70;
      for (const r of riskSignals) {
        if (r.impact === "critical") decisionHealth -= 15;
        else if (r.impact === "high") decisionHealth -= 8;
        else if (r.impact === "medium") decisionHealth -= 3;
        else decisionHealth -= 1;
      }
      decisionHealth -= blindSpots.length * 6;
      for (const q of openQuestions) {
        if (q.blocker_level === "critical") decisionHealth -= 8;
        else if (q.blocker_level === "high") decisionHealth -= 4;
      }
      for (const c of consensusPoints.slice(0, 4)) {
        if (c.strength === "strong") decisionHealth += 3;
      }
      if (velocity === "accelerating") decisionHealth += 4;
      else if (velocity === "stalling") decisionHealth -= 4;
      else if (velocity === "blocked") decisionHealth -= 6;
      if (actionItems.length >= 6) decisionHealth += 4;
      decisionHealth = Math.max(10, Math.min(100, decisionHealth));

      // Financial Score
      const financialMetrics = Array.isArray(synthesis.financial_metrics) ? synthesis.financial_metrics as Array<{ confidence?: string; trend?: string }> : [];
      const conflictZones = Array.isArray(synthesis.conflict_zones) ? synthesis.conflict_zones as Array<{ severity?: string }> : [];
      let financial = 50;
      for (const m of financialMetrics) {
        if (m.confidence === "high" && m.trend === "positive") financial += 8;
        else if (m.confidence === "high" && m.trend === "negative") financial -= 8;
        else if (m.confidence === "medium" && m.trend === "positive") financial += 4;
        else if (m.confidence === "medium" && m.trend === "negative") financial -= 4;
        else financial += 1;
      }
      for (const z of conflictZones) {
        if (z.severity === "critical") financial -= 6;
        else if (z.severity === "high") financial -= 3;
      }
      financial = Math.max(10, Math.min(100, financial));

      // Operational Score
      const operationalMetrics = Array.isArray(synthesis.operational_metrics) ? synthesis.operational_metrics as Array<{ status?: string }> : [];
      let operational = 60;
      for (const m of operationalMetrics) {
        if (m.status === "on-track") operational += 5;
        else if (m.status === "at-risk") operational -= 10;
        else if (m.status === "unclear") operational -= 5;
      }
      for (const r of riskSignals) {
        if (r.likelihood === "high" && r.impact === "critical") operational -= 5;
      }
      operational = Math.max(10, Math.min(100, operational));

      // Alignment Score
      const conflictZonesForAlign = Array.isArray(synthesis.conflict_zones) ? synthesis.conflict_zones as Array<{ severity?: string }> : [];
      let alignment = 65;
      for (const z of conflictZonesForAlign) {
        if (z.severity === "critical") alignment -= 12;
        else if (z.severity === "high") alignment -= 7;
        else if (z.severity === "moderate") alignment -= 3;
      }
      for (const c of consensusPoints) {
        if (c.strength === "strong") alignment += 4;
        else if (c.strength === "moderate") alignment += 2;
      }
      alignment = Math.max(10, Math.min(100, alignment));

      return { decisionHealth, financial, operational, alignment };
    }

    const scores = computeScores();

    // Extract recommendation — use AI output or build fallback
    let recommendation: string | null = null;
    if (typeof synthesis.recommendation === "string" && synthesis.recommendation.trim().length > 20) {
      recommendation = synthesis.recommendation.trim();
    } else {
      // Fallback: build from key_decisions and consensus
      const topDecision = Array.isArray(synthesis.key_decisions) && synthesis.key_decisions.length > 0
        ? (synthesis.key_decisions[0] as Record<string, unknown>)
        : null;
      const topConsensus = Array.isArray(synthesis.consensus_points) && synthesis.consensus_points.length > 0
        ? (synthesis.consensus_points[0] as Record<string, unknown>)
        : null;
      if (topDecision?.recommended) {
        recommendation = String(topDecision.recommended);
      } else if (topConsensus?.point) {
        recommendation = `Based on agent consensus: ${String(topConsensus.point)}`;
      }
    }

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
        decision_velocity: synthesis.decision_velocity ?? "steady",
        confidence_trajectory: synthesis.confidence_trajectory ?? "stable",
        health_rationale: synthesis.health_rationale ?? null,
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
