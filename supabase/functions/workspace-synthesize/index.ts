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
    // The conflict zone detection is the critical section. It must read the
    // ACTUAL disagreements from the transcript, not infer a generic financial one.
    const synthesisPrompt = `You are a Managing Partner-level strategic synthesis analyst. You have just observed a full War Room debate between seven specialist AI advisors on the topic below. Your job is to produce a rigorous, topic-specific synthesis — grounded entirely in what was actually argued in this transcript.

WORKSPACE CONTEXT:
${workspaceContext}

FULL DEBATE TRANSCRIPT:
${transcript}

---

Produce a JSON object with EXACTLY this structure. Use EXACTLY these field names — do not rename any field.

CRITICAL RULES FOR CONFLICT ZONES:
- Read the transcript carefully. Identify the REAL strategic fault lines — where agents disagreed about the SUBSTANCE of the decision.
- The conflict topic must reflect what the decision is actually about (e.g., for RTO: "Full mandate vs permanent hybrid"; for hiring: "Specialists vs generalists"; for pricing: "Premium positioning vs competitive pricing").
- DO NOT default to "budget" or "financial" conflicts unless budget/cost was the explicitly central disputed axis.
- DO NOT manufacture a financial conflict when the real tension is cultural, strategic, operational, or organizational.
- agent_a and agent_b must be agent role names (e.g., "people_advisor", "risk_analyst") from the transcript.
- tension_level is a number 0-100 reflecting how unresolved this conflict is (80+ = critical, 50-79 = high, below 50 = moderate).

CRITICAL RULES FOR ACTION ITEMS:
- MINIMUM 6, maximum 10 items. Each must be a specific, concrete, executable task — not vague.
- source_area is the responsible role or team area (e.g., "HR", "Finance", "Execution Lead").
- Pull directly from consensus recommendations and concrete next steps mentioned by agents.

CRITICAL RULES FOR RECOMMENDATION:
- Write 3-5 sentences of direct, opinionated strategic guidance.
- Start with the actual recommended direction — not a hedge.
- Acknowledge the key tradeoff the team must accept.
- End with the one action needed in the next 7 days.

{
  "consensus_points": [
    { "text": "string — specific point of agent agreement, not abstract", "confidence": 85, "source_count": 4 }
  ],

  "conflict_zones": [
    {
      "topic": "string — exact strategic question at issue (e.g., 'Full mandate vs permanent hybrid model')",
      "agent_a": "string — role name of agent holding position A (e.g., 'people_advisor')",
      "position_a": "string — exact position, in the agent's words",
      "agent_b": "string — role name of agent holding position B (e.g., 'risk_analyst')",
      "position_b": "string — exact opposing position",
      "tension_level": 80
    }
  ],

  "open_questions": [
    { "question": "string — specific, answerable question the team must resolve", "urgency": "critical|high|medium" }
  ],

  "risk_signals": [
    { "signal": "string — specific risk", "severity": "critical|high|medium|low", "category": "market|execution|financial|team|technology" }
  ],

  "blind_spots": [
    { "area": "string — the gap the team has underweighted", "description": "string — why it matters and what could go wrong" }
  ],

  "action_items": [
    { "text": "string — specific executable task", "source_area": "string — owner role or team", "priority": "critical|high|medium" }
  ],

  "financial_metrics": [
    { "metric": "string", "value": "string", "confidence": "high|medium|low", "note": "string — context or implication" }
  ],

  "operational_metrics": [
    { "metric": "string", "status": "on-track|at-risk|unclear", "note": "string — detail" }
  ],

  "non_financial_metrics": [
    { "metric": "string", "signal": "positive|neutral|negative", "note": "string — detail" }
  ],

  "opportunity_signals": [
    { "title": "string — opportunity name", "description": "string — what it is and why it matters", "confidence": "high|medium|low", "source": "string — where this came from in the debate" }
  ],

  "cognitive_bias_flags": [
    { "bias_name": "string — named bias (e.g., Sunk Cost Fallacy, Groupthink)", "explanation": "string — how it manifested in this specific debate", "counter_question": "string — reframing question to counteract it" }
  ],

  "key_decisions": [
    { "decision": "string", "status": "open|in-progress|resolved", "rationale": "string — why this decision matters now", "owner": "string — who should own it" }
  ],

  "decision_velocity": "fast|moderate|stalling",
  "confidence_trajectory": "rising|flat|falling",
  "health_rationale": "string — 2-3 sentences explaining the decision health score based on what was debated",
  "recommendation": "string — 3-5 sentences of direct strategic guidance. Start with the recommended direction. Acknowledge the tradeoff. End with the one action needed in the next 7 days."
}

Return ONLY valid JSON. No markdown fences, no commentary outside the JSON object.`;

    // Call OpenAI
    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a world-class strategic synthesis engine. You produce JSON exactly as instructed. You never default to generic outputs — every field is grounded in the specific debate transcript provided.",
          },
          { role: "user", content: synthesisPrompt },
        ],
        max_tokens: 4000,
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
