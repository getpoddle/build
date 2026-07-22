import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openAiKey = Deno.env.get("OPENAI_API_KEY")!;

    const body = await req.json().catch(() => ({}));
    const { workspace_id } = body as { workspace_id: string };
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!workspace_id || !UUID_RE.test(workspace_id)) {
      return new Response(JSON.stringify({ error: "workspace_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(supabaseUrl, serviceKey);

    // Fetch workspace + messages in parallel
    const [wsRes, msgsRes] = await Promise.all([
      service.from("workspaces").select("name, topic, description").eq("id", workspace_id).maybeSingle(),
      service.from("workspace_messages").select("role, content, agent_name, agent_role, created_at").eq("workspace_id", workspace_id).order("created_at", { ascending: true }).limit(60),
    ]);

    const workspace = wsRes.data;
    const messages = msgsRes.data || [];
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages to synthesize" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a compact transcript
    const transcript = messages.map((m: { role: string; content: string; agent_role?: string | null }) => {
      const content = m.content.length > 1200 ? m.content.slice(0, 1200) + "…" : m.content;
      if (m.role === "user") return `[TEAM]: ${content}`;
      const label = m.agent_role ? `[${m.agent_role.toUpperCase().replace(/_/g, " ")}]` : "[AGENT]";
      return `${label}: ${content}`;
    }).join("\n\n");

    const workspaceContext = [
      workspace?.name ? `Topic: ${workspace.name}` : "",
      workspace?.description ? `Context: ${workspace.description}` : "",
    ].filter(Boolean).join("\n");

    // ── FAST SYNTHESIS PROMPT ──────────────────────────────────────
    // Single gpt-4o call that produces the full Board Brief in one shot.
    // No separate action-items call, no regeneration, no rationale call.
    const prompt = `You are a world-class Chief Strategy Officer producing a Board Brief for a War Room decision intelligence report.

${workspaceContext ? `WORKSPACE CONTEXT:\n${workspaceContext}\n` : ""}
THE CENTRAL DECISION: "${workspace?.name || "the workspace decision"}"

DEBATE TRANSCRIPT:
${transcript}

Produce a JSON object with EXACTLY this structure. Every section must have at least 2 items unless the topic was truly never discussed. Ground every item in the transcript.

{
  "action_items": [
    { "text": "specific executable task referencing the transcript", "source_area": "CEO|CFO|HR|Legal|Product|Engineering|Finance|Risk|Strategy|Marketing|Operations|People", "priority": "critical|high|medium" }
  ],
  "consensus_points": [
    { "text": "specific point of agreement from the debate", "confidence": 85, "source_count": 3 }
  ],
  "conflict_zones": [
    { "topic": "the fault line", "agent_a": "role name", "position_a": "what they said", "agent_b": "role name", "position_b": "what they said", "tension_level": 70 }
  ],
  "open_questions": [
    { "question": "unresolved question from the debate", "urgency": "critical|high|medium" }
  ],
  "risk_signals": [
    { "signal": "specific risk referencing the transcript", "severity": "critical|high|medium|low", "category": "market|execution|financial|team|technology" }
  ],
  "blind_spots": [
    { "area": "underweighted dimension", "description": "what was missed" }
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
    { "title": "string", "description": "string", "confidence": "high|medium|low" }
  ],
  "cognitive_bias_flags": [
    { "bias_name": "string", "explanation": "specific evidence from transcript", "counter_question": "string" }
  ],
  "key_decisions": [
    { "decision": "string", "status": "open|in-progress|resolved", "rationale": "string", "owner": "string" }
  ],
  "executive_summary": "3-4 sentence summary of the decision landscape",
  "recommendation": "5-8 sentences: recommended path, the tradeoff, and the 7-day critical action",
  "decision_velocity": "fast|moderate|stalling",
  "confidence_trajectory": "rising|flat|falling"
}

Return ONLY valid JSON. No markdown fences. No commentary.`;

    // ── Single fast OpenAI call ───────────────────────────────────
    const synthStartedAt = Date.now();
    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a strategic synthesis engine. You produce comprehensive JSON grounded in the transcript. Every section should have at least 2 items.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!openAiRes.ok) {
      const errText = await openAiRes.text();
      console.error("Fast synthesis OpenAI error:", openAiRes.status, errText);
      return new Response(JSON.stringify({ error: "AI synthesis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openAiJson = await openAiRes.json();
    const rawContent = openAiJson.choices?.[0]?.message?.content || "{}";
    let synthesis: Record<string, unknown>;
    try {
      synthesis = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse fast synthesis JSON:", rawContent.slice(0, 500));
      return new Response(JSON.stringify({ error: "Failed to parse synthesis" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Deterministic score computation (same algorithm as workspace-synthesize) ──
    const riskSignals = (Array.isArray(synthesis.risk_signals) ? synthesis.risk_signals : []) as Array<{ severity?: string; category?: string }>;
    const blindSpots = Array.isArray(synthesis.blind_spots) ? synthesis.blind_spots : [];
    const openQuestions = (Array.isArray(synthesis.open_questions) ? synthesis.open_questions : []) as Array<{ urgency?: string }>;
    const consensusPoints = (Array.isArray(synthesis.consensus_points) ? synthesis.consensus_points : []) as Array<{ confidence?: number; source_count?: number }>;
    const conflictZones = (Array.isArray(synthesis.conflict_zones) ? synthesis.conflict_zones : []) as Array<{ tension_level?: number }>;
    const actionItems = (Array.isArray(synthesis.action_items) ? synthesis.action_items : []) as Array<{ priority?: string }>;
    const financialMetrics = (Array.isArray(synthesis.financial_metrics) ? synthesis.financial_metrics : []) as Array<{ confidence?: string }>;
    const operationalMetrics = (Array.isArray(synthesis.operational_metrics) ? synthesis.operational_metrics : []) as Array<{ status?: string }>;
    const keyDecisions = (Array.isArray(synthesis.key_decisions) ? synthesis.key_decisions : []) as Array<{ status?: string }>;
    const velocity = typeof synthesis.decision_velocity === "string" ? synthesis.decision_velocity : "moderate";
    const trajectory = typeof synthesis.confidence_trajectory === "string" ? synthesis.confidence_trajectory : "flat";

    // Decision Health
    let decisionHealth = 55;
    let consensusBonus = 0;
    for (const c of consensusPoints) {
      const conf = typeof c.confidence === "number" ? c.confidence : 60;
      const src = typeof c.source_count === "number" ? c.source_count : 1;
      if (conf >= 80 && src >= 3) consensusBonus += 3;
      else if (conf >= 65) consensusBonus += 2;
      else consensusBonus += 1;
    }
    decisionHealth += Math.min(consensusBonus, 20);
    decisionHealth += Math.min(Math.round(actionItems.length * 0.6), 10);
    const resolvedDecisions = keyDecisions.filter(d => d.status === "resolved").length;
    decisionHealth += Math.min(resolvedDecisions * 4, 12);
    const highConfFinancial = financialMetrics.filter(m => m.confidence === "high").length;
    decisionHealth += Math.min(highConfFinancial * 2, 6);
    const onTrackOps = operationalMetrics.filter(m => m.status === "on-track").length;
    decisionHealth += Math.min(onTrackOps * 2, 6);

    const criticalRiskCount = riskSignals.filter(r => r.severity === "critical").length;
    const highRiskCount = riskSignals.filter(r => r.severity === "high").length;
    decisionHealth -= Math.min(criticalRiskCount * 3, 9);
    decisionHealth -= Math.min(highRiskCount * 1, 6);
    decisionHealth -= Math.min(blindSpots.length * 1.5, 8);
    const criticalQCount = openQuestions.filter(q => q.urgency === "critical").length;
    const highQCount = openQuestions.filter(q => q.urgency === "high").length;
    decisionHealth -= Math.min(criticalQCount * 2, 8);
    decisionHealth -= Math.min(highQCount * 0.5, 4);
    const highTensionCount = conflictZones.filter(z => (z.tension_level ?? 0) >= 80).length;
    const medTensionCount = conflictZones.filter(z => { const t = z.tension_level ?? 0; return t >= 60 && t < 80; }).length;
    decisionHealth -= Math.min(highTensionCount * 2.5, 8);
    decisionHealth -= Math.min(medTensionCount * 1, 4);
    const atRiskOps = operationalMetrics.filter(m => m.status === "at-risk").length;
    decisionHealth -= Math.min(atRiskOps * 3, 8);
    if (velocity === "fast") decisionHealth += 5;
    else if (velocity === "stalling") decisionHealth -= 5;
    if (trajectory === "rising") decisionHealth += 4;
    else if (trajectory === "falling") decisionHealth -= 3;
    decisionHealth = Math.max(10, Math.min(100, Math.round(decisionHealth)));

    // Financial Score
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

    // Operational Score
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

    // Alignment Score
    let alignment = 50;
    for (const c of consensusPoints) {
      const conf = typeof c.confidence === "number" ? c.confidence : 60;
      if (conf >= 75) alignment += 3;
      else alignment += 1;
    }
    for (const z of conflictZones) {
      const tension = typeof z.tension_level === "number" ? z.tension_level : 50;
      if (tension >= 80) alignment -= 10;
      else if (tension >= 60) alignment -= 5;
      else if (tension >= 40) alignment -= 2;
    }
    alignment = Math.max(10, Math.min(100, alignment));

    // Deterministic health rationale (no extra OpenAI call)
    const label = decisionHealth >= 75 ? "Sharp" : decisionHealth >= 55 ? "Developing" : decisionHealth >= 35 ? "Fragmented" : "Critical";
    const criticalRisks = riskSignals.filter(r => r.severity === "critical").map(r => r.signal).filter(Boolean);
    let healthRationale: string;
    if (decisionHealth < 35) {
      healthRationale = `Severe gaps in financial data, unresolved critical risks, and multiple open questions make a confident recommendation impossible. Resolve the highest-urgency questions and build financial projections before proceeding.`;
    } else if (decisionHealth < 55) {
      healthRationale = `${criticalRisks.length > 0 ? `Critical risks (${criticalRisks[0]}) remain unaddressed` : "Key strategic conflicts remain unresolved"} and the team lacks sufficient consensus to move forward confidently. Focus on resolving the highest-tension conflict and eliminating critical risk signals.`;
    } else if (decisionHealth < 75) {
      healthRationale = `The team has established a working foundation but key questions remain open. Resolve the outstanding decision blockers to push this score into the Sharp tier.`;
    } else {
      healthRationale = `Strong consensus and resolved decisions show a team that has done the hard work. Maintain momentum by converting action items into owner-assigned deliverables.`;
    }

    // ── Upsert to workspace_synthesis ────────────────────────────
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
        executive_summary: synthesis.executive_summary ?? null,
        recommendation: synthesis.recommendation ?? null,
        decision_velocity: synthesis.decision_velocity ?? "moderate",
        confidence_trajectory: synthesis.confidence_trajectory ?? "flat",
        health_rationale: healthRationale,
        decision_health_score: decisionHealth,
        financial_score: financial,
        operational_score: operational,
        alignment_score: alignment,
        generated_at: new Date().toISOString(),
        message_count_at_generation: messages.length,
      }, { onConflict: "workspace_id" });

    if (upsertError) {
      console.error("Fast synthesis upsert error:", upsertError);
      return new Response(JSON.stringify({ error: "Failed to save synthesis" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync action items to workspace_action_items table
    const newActionItems = (Array.isArray(synthesis.action_items) ? synthesis.action_items : [])
      .filter((a: Record<string, unknown>) => typeof a.text === "string" && (a.text as string).trim().length > 5);

    if (newActionItems.length > 0) {
      // Get owner user_id for created_by
      const { data: ownerRow } = await service
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspace_id)
        .eq("role", "owner")
        .maybeSingle();

      const ownerId = ownerRow?.user_id ?? null;

      await service
        .from("workspace_action_items")
        .delete()
        .eq("workspace_id", workspace_id)
        .eq("source", "ai")
        .eq("status", "todo");

      await service.from("workspace_action_items").insert(
        newActionItems.map((a: Record<string, unknown>) => ({
          workspace_id,
          text: String(a.text).trim(),
          source: "ai",
          priority: ["critical", "high", "medium"].includes(String(a.priority)) ? String(a.priority) : "medium",
          source_area: typeof a.source_area === "string" ? a.source_area : "Strategy",
          status: "todo",
          created_by: ownerId,
        }))
      );
    }

    // Mark synthesis queue as done
    await service
      .from("workspace_synthesis_queue")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("workspace_id", workspace_id)
      .in("status", ["pending", "running"]);

    return new Response(JSON.stringify({
      success: true,
      decisionHealthScore: decisionHealth,
      financialScore: financial,
      operationalScore: operational,
      alignmentScore: alignment,
      latencyMs: Date.now() - synthStartedAt,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("Fast synthesis error:", err);
    return new Response(JSON.stringify({ error: `Synthesis failed: ${msg}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
