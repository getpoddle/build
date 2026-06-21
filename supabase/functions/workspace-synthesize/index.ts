import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const body = await req.json();
    const { workspace_id, documents } = body as {
      workspace_id: string;
      documents?: Array<{ filename: string; extractedText: string }>;
    };
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "Missing workspace_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validDocs = Array.isArray(documents)
      ? documents.filter(d => d?.filename && typeof d.extractedText === "string" && d.extractedText.length > 0).slice(0, 3)
      : [];

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify membership
    const { data: membership } = await service
      .from("workspace_members").select("role")
      .eq("workspace_id", workspace_id).eq("user_id", user.id).maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a workspace member" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch data in parallel — limit to 40 most recent messages for speed
    const [messagesRes, workspaceRes, membersRes, prevMemoryRes] = await Promise.all([
      service.from("workspace_messages")
        .select("role, content, agent_name, agent_role, user_id, created_at")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(40),
      service.from("workspaces").select("name, description, domain").eq("id", workspace_id).maybeSingle(),
      service.from("workspace_members")
        .select("user_id, role, profiles(first_name, last_name, full_name, username)")
        .eq("workspace_id", workspace_id),
      service.from("workspace_memory").select("decisions, agreements, open_threads, key_entities, summary, synthesis_count, recurring_risks, dominant_bias, decision_category_history").eq("workspace_id", workspace_id).maybeSingle(),
    ]);

    const messages = (messagesRes.data || []).reverse(); // back to chronological

    if (!messages || messages.length < 3) {
      return new Response(JSON.stringify({ error: "Not enough conversation data yet. Keep chatting!" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workspace = workspaceRes.data;
    const prevMemory = prevMemoryRes.data;

    // Build member label map
    type MemberLabel = { label: string; firstName: string };
    const memberLabelMap = new Map<string, MemberLabel>();
    for (const m of (membersRes.data || [])) {
      const p = (m.profiles as { first_name?: string | null; last_name?: string | null; full_name?: string | null; username?: string | null } | null);
      const firstName = p?.first_name?.trim() || p?.full_name?.split(" ")[0]?.trim() || p?.username?.trim() || "Member";
      const label = `${firstName} (${m.role})`;
      memberLabelMap.set(m.user_id, { label, firstName });
    }

    // Build document context block — prepended to prompt when documents are present
    let documentBlock = "";
    if (validDocs.length > 0) {
      const docLines: string[] = [
        "=== UPLOADED DOCUMENTS ===",
        "The user has provided the following document(s) as primary context for this decision.",
        "You MUST ground your analysis in this content where relevant.",
        'Reference it explicitly (e.g. "According to the uploaded business plan...", "Based on the financial projections in the uploaded report...").',
        "",
      ];
      for (const doc of validDocs) {
        docLines.push(`[${doc.filename}]`);
        docLines.push(doc.extractedText.slice(0, 12000));
        docLines.push("");
      }
      docLines.push("=== END DOCUMENTS ===");
      documentBlock = docLines.join("\n") + "\n\n";
    }

    // Build compact transcript — cap each message at 300 chars
    // Reduce transcript cap when documents present to protect total prompt size
    let transcriptChars = 0;
    const TRANSCRIPT_CAP = validDocs.length > 0 ? 3000 : 5000;
    const transcriptLines: string[] = [];
    for (const m of messages) {
      const raw = m.role === "user"
        ? `${m.user_id ? (memberLabelMap.get(m.user_id)?.label ?? "Member") : "Member"}: ${m.content}`
        : `[${m.agent_name?.toUpperCase() || "AI"}]: ${m.content}`;
      const line = raw.slice(0, 300);
      if (transcriptChars + line.length > TRANSCRIPT_CAP) break;
      transcriptLines.push(line);
      transcriptChars += line.length;
    }
    const transcript = transcriptLines.join("\n\n");

    const humanNames = Array.from(memberLabelMap.values()).map(v => v.label);
    const humanNamesNote = humanNames.length > 0
      ? `\nHuman participants: ${humanNames.join(", ")}. Use real names in conflict_zones when two humans explicitly disagree.`
      : "";

    // Prior memory context so synthesis builds on what is already known
    const priorMemoryNote = prevMemory?.summary
      ? `\nPRIOR WORKSPACE MEMORY (from previous sessions):\nSummary: ${prevMemory.summary}\nEstablished decisions: ${(prevMemory.decisions || []).join("; ")}\nOpen threads carried over: ${(prevMemory.open_threads || []).join("; ")}\n`
      : "";

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const synthesisPrompt = `${documentBlock}You are a strategic intelligence analyst for workspace "${workspace?.name || "Workspace"}"${workspace?.description ? ` (focus: ${workspace.description})` : ""}.${humanNamesNote}${priorMemoryNote}

Return a JSON object with this exact structure (no markdown, no extra text):

{
  "decision_health_score": <integer 0-100, derived strictly from scoring rubric below>,
  "health_rationale": "one sentence explaining the specific score",
  "financial_score": <integer 0-100>,
  "operational_score": <integer 0-100>,
  "alignment_score": <integer 0-100>,
  "decision_velocity": "Moderate",
  "confidence_trajectory": "rising",
  "consensus_points": [{"text":"belief","confidence":85,"source_count":3}],
  "conflict_zones": [{"topic":"short label","agent_a":"name","position_a":"stance","agent_b":"name","position_b":"stance","tension_level":72,"participant_type":"agent"}],
  "open_questions": [{"question":"unresolved question","urgency":"high"}],
  "risk_signals": [{"signal":"specific risk","severity":"critical","category":"market"}],
  "blind_spots": [{"area":"topic","description":"what team is missing"}],
  "session_decision_category": "strategic",
  "action_items": [{"text":"Verb + concrete action","source_area":"risk","priority":"high"}],
  "financial_metrics": [{"metric":"Budget Assumptions","value":"implied","confidence":"low","note":"brief note"}],
  "operational_metrics": [{"metric":"Timeline Clarity","status":"unclear","note":"brief note"}],
  "non_financial_metrics": [{"metric":"Team Morale","signal":"positive","note":"evidence"}],
  "opportunity_signals": [{"title":"label","description":"specific upside","confidence":"medium","source":"who mentioned it"}],
  "cognitive_bias_flags": [{"bias_name":"Confirmation Bias","explanation":"where it appeared","counter_question":"probing question"}],
  "executive_summary": "REQUIRED. 3-4 flowing prose sentences that synthesize: (1) the core decision context and where the team stands, (2) a specific callout from financial or operational metrics (e.g. budget confidence, timeline clarity), (3) the single most critical risk or blind spot identified, and (4) the most urgent action or unresolved question. Must reference specific findings — never generic.",
  "key_decisions": [{"decision":"a clear decision statement","status":"made|pending|deferred","rationale":"one sentence on the reasoning","owner":"person or role if known"}],
  "memory_update": {
    "decisions": ["key decision 1","key decision 2"],
    "agreements": ["shared belief 1","shared belief 2"],
    "open_threads": ["still-open question 1","still-open question 2"],
    "key_entities": ["product name","market name","milestone"],
    "summary": "2-3 sentence plain-English summary of what has been discussed and decided so far across all sessions"
  }
}

RULES:
- consensus_points: max 5. conflict_zones: max 4 (tension_level 0-100). open_questions: max 5 (urgency: low/medium/high/critical). Only include questions with NO concrete answer in the transcript.
- risk_signals: max 5, severity: low/medium/high/critical, category: market/execution/financial/team/technology.
- blind_spots: max 3 — topics NO ONE raised but strategically important.
- action_items: max 6, start with a verb, priority: critical/high/medium/low, source_area: risk/blind_spot/open_question/conflict.
- decision_velocity: "Fast"/"Moderate"/"Stalling". confidence_trajectory: "rising"/"flat"/"falling".
- financial_metrics: always return 5 rows (Budget Assumptions, Revenue Projections, Burn Rate/Runway, ROI/Return Signals, Financial Risk Exposure). If not discussed, value = "Not discussed".
- operational_metrics: always return 4 rows (Timeline Clarity, Resource Constraints, Key Dependencies, Bottlenecks). status: clear/unclear/at-risk.
- non_financial_metrics: always return 5 rows (Team Morale, Stakeholder Buy-in, Customer Impact, Strategic Alignment, Innovation Potential). signal: positive/neutral/negative.
- opportunity_signals: max 3. cognitive_bias_flags: max 3.
- executive_summary: MANDATORY — always return a non-empty string. Write this LAST after you have determined all other sections. It must be 3-4 flowing prose sentences that directly reference specific findings you generated: name the top risk from risk_signals by name, cite whether financial confidence is high/medium/low based on financial_metrics, reference whether operational clarity is clear/at-risk based on operational_metrics, mention the most important blind_spot if any, and state the single most urgent action_item. This is a synthesis of the entire report — not a restatement of the transcript. A board member reading only this paragraph should understand the health, the risks, and the next step.
- key_decisions: max 6 entries. status must be exactly "made", "pending", or "deferred". owner is optional — use "TBD" if not clear.
- memory_update.decisions: list of concrete decisions REACHED in this or any prior session (max 8, short phrases).
- memory_update.agreements: list of shared beliefs all/most members hold (max 6).
- memory_update.open_threads: questions or debates still unresolved after this session (max 6).
- memory_update.key_entities: important nouns (products, competitors, markets, people, milestones) mentioned (max 10).
- memory_update.summary: must incorporate prior context if provided — write as a continuous record, not just this session.
- session_decision_category: one word from: strategic, operational, resource, people, technical, market — pick the dominant theme of decisions made in THIS session.

SCORING RUBRIC — compute all four scores from the actual conversation content, not from defaults:

decision_health_score (0-100): Start at 100, then deduct:
  - Each critical risk_signal: -12 pts
  - Each high risk_signal: -7 pts
  - Each medium risk_signal: -3 pts
  - Each blind_spot identified: -5 pts
  - Each open_question with urgency=critical: -8 pts
  - Each open_question with urgency=high: -4 pts
  - Each conflict_zone with tension_level >= 70: -6 pts
  - decision_velocity = "Stalling": -10 pts; "Moderate": -3 pts; "Fast": +0 pts
  - confidence_trajectory = "falling": -8 pts; "flat": -3 pts; "rising": +5 pts
  - No financial data discussed at all: -10 pts
  - No operational plan or timeline discussed: -7 pts
  Then cap to [0, 100]. A well-structured conversation with clear decisions, few risks, and strong consensus should score 75-90. A vague or conflicted conversation with many open risks should score 30-55.

financial_score (0-100): Assess how well financial aspects are understood. Start at 100, deduct:
  - Each financial_metric with confidence="low": -12 pts
  - Each financial_metric with value="Not discussed": -15 pts
  - financial risk_signal present: -10 pts per financial risk
  - No revenue or budget discussed at all: -25 pts
  - Cap to [0, 100]. Strong financial clarity = 75-95; minimal discussion = 20-45.

operational_score (0-100): Assess operational clarity. Start at 100, deduct:
  - Each operational_metric with status="unclear": -12 pts
  - Each operational_metric with status="at-risk": -18 pts
  - execution risk_signal present: -10 pts each
  - No timeline or resource plan discussed: -20 pts
  - Cap to [0, 100]. Clear plan with milestones = 70-90; vague execution = 25-55.

alignment_score (0-100): Assess team consensus and direction. Start at 100, deduct:
  - Each conflict_zone: -8 pts (additional -5 if tension_level >= 70)
  - Each cognitive_bias_flag: -5 pts
  - confidence_trajectory = "falling": -12 pts
  - No consensus_points found: -20 pts
  - Each consensus_point with confidence >= 70 adds back: +4 pts (max +16)
  - Cap to [0, 100]. Strong alignment with few conflicts = 75-95; fragmented team = 30-55.

TRANSCRIPT:
${transcript}`;

    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), 30000);

    let aiRes: Response;
    try {
      aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a strategic intelligence analyst. Return only valid JSON, nothing else." },
            { role: "user", content: synthesisPrompt },
          ],
          max_tokens: 3500,
          temperature: 0.25,
          response_format: { type: "json_object" },
        }),
        signal: aiController.signal,
      });
    } finally {
      clearTimeout(aiTimeout);
    }

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "unknown");
      return new Response(JSON.stringify({ error: `AI service returned ${aiRes.status}. Please try again.`, detail: errText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const rawJson = aiData.choices?.[0]?.message?.content || "{}";

    let synthesis: Record<string, unknown>;
    try {
      synthesis = JSON.parse(rawJson);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI synthesis. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract and validate fields
    const generatedAt = new Date().toISOString();
    const actionItems = Array.isArray(synthesis.action_items) ? synthesis.action_items : [];
    const consensusPoints = Array.isArray(synthesis.consensus_points) ? synthesis.consensus_points : [];
    const conflictZones = Array.isArray(synthesis.conflict_zones) ? synthesis.conflict_zones : [];
    const openQuestions = Array.isArray(synthesis.open_questions) ? synthesis.open_questions : [];
    const riskSignals = Array.isArray(synthesis.risk_signals) ? synthesis.risk_signals : [];
    const blindSpots = Array.isArray(synthesis.blind_spots) ? synthesis.blind_spots : [];
    const financialMetrics = Array.isArray(synthesis.financial_metrics) ? synthesis.financial_metrics : [];
    const operationalMetrics = Array.isArray(synthesis.operational_metrics) ? synthesis.operational_metrics : [];
    const nonFinancialMetrics = Array.isArray(synthesis.non_financial_metrics) ? synthesis.non_financial_metrics : [];
    const opportunitySignals = Array.isArray(synthesis.opportunity_signals) ? synthesis.opportunity_signals : [];
    const cognitiveBiasFlags = Array.isArray(synthesis.cognitive_bias_flags) ? synthesis.cognitive_bias_flags : [];
    const financialScore = synthesis.financial_score != null ? Math.max(0, Math.min(100, Number(synthesis.financial_score))) : null;
    const operationalScore = synthesis.operational_score != null ? Math.max(0, Math.min(100, Number(synthesis.operational_score))) : null;
    const alignmentScore = synthesis.alignment_score != null ? Math.max(0, Math.min(100, Number(synthesis.alignment_score))) : null;
    const validVelocities = ['fast', 'moderate', 'stalling'];
    const validTrajectories = ['rising', 'flat', 'falling'];
    const decisionVelocity = synthesis.decision_velocity
      ? (validVelocities.includes(String(synthesis.decision_velocity).toLowerCase()) ? String(synthesis.decision_velocity).toLowerCase() : null)
      : null;
    const confidenceTrajectory = synthesis.confidence_trajectory
      ? (validTrajectories.includes(String(synthesis.confidence_trajectory).toLowerCase()) ? String(synthesis.confidence_trajectory).toLowerCase() : null)
      : null;

    const executiveSummary = typeof synthesis.executive_summary === 'string' ? synthesis.executive_summary.slice(0, 1000) : null;
    const keyDecisions = Array.isArray(synthesis.key_decisions) ? synthesis.key_decisions : [];

    const validCategories = ['strategic', 'operational', 'resource', 'people', 'technical', 'market'];
    const sessionDecisionCategory = synthesis.session_decision_category
      ? (validCategories.includes(String(synthesis.session_decision_category).toLowerCase()) ? String(synthesis.session_decision_category).toLowerCase() : null)
      : null;

    // Build risk category breakdown: { market: 2, execution: 1, ... }
    const riskCategoryBreakdown: Record<string, number> = {};
    for (const r of (riskSignals as Array<{ category?: string }>) ) {
      const cat = r.category?.toLowerCase();
      if (cat) riskCategoryBreakdown[cat] = (riskCategoryBreakdown[cat] || 0) + 1;
    }

    const memoryUpdate = (synthesis.memory_update && typeof synthesis.memory_update === 'object')
      ? synthesis.memory_update as { decisions?: string[]; agreements?: string[]; open_threads?: string[]; key_entities?: string[]; summary?: string }
      : null;

    // Build the response payload immediately
    const responsePayload = {
      synthesis: {
        ...synthesis,
        action_items: actionItems,
        financial_metrics: financialMetrics,
        operational_metrics: operationalMetrics,
        non_financial_metrics: nonFinancialMetrics,
        opportunity_signals: opportunitySignals,
        cognitive_bias_flags: cognitiveBiasFlags,
        financial_score: financialScore,
        operational_score: operationalScore,
        alignment_score: alignmentScore,
        decision_velocity: decisionVelocity,
        confidence_trajectory: confidenceTrajectory,
        generated_at: generatedAt,
        message_count: messages.length,
        executive_summary: executiveSummary,
        key_decisions: keyDecisions,
      },
    };

    // Defer all DB writes so response goes back immediately
    const dbWritePromise = (async () => {
      try {
        // Upsert main synthesis
        await service.from("workspace_synthesis").upsert({
          workspace_id,
          consensus_points: consensusPoints,
          conflict_zones: conflictZones,
          open_questions: openQuestions,
          risk_signals: riskSignals,
          blind_spots: blindSpots,
          action_items: actionItems,
          decision_health_score: synthesis.decision_health_score != null ? Number(synthesis.decision_health_score) : 0,
          health_rationale: synthesis.health_rationale || null,
          financial_metrics: financialMetrics,
          operational_metrics: operationalMetrics,
          non_financial_metrics: nonFinancialMetrics,
          opportunity_signals: opportunitySignals,
          cognitive_bias_flags: cognitiveBiasFlags,
          financial_score: financialScore,
          operational_score: operationalScore,
          alignment_score: alignmentScore,
          decision_velocity: decisionVelocity,
          confidence_trajectory: confidenceTrajectory,
          generated_at: generatedAt,
          message_count_at_generation: messages.length,
          executive_summary: executiveSummary,
          key_decisions: keyDecisions,
        }, { onConflict: "workspace_id" });

        // Synthesis history — insert first so pattern computation can include this session
        const { data: historyRow } = await service.from("workspace_synthesis_history").insert({
          workspace_id,
          decision_health_score: synthesis.decision_health_score != null ? Number(synthesis.decision_health_score) : 0,
          consensus_count: consensusPoints.length,
          conflict_count: conflictZones.length,
          open_question_count: openQuestions.length,
          risk_count: riskSignals.length,
          blind_spot_count: blindSpots.length,
          message_count: messages.length,
          financial_score: financialScore,
          operational_score: operationalScore,
          alignment_score: alignmentScore,
          generated_at: generatedAt,
          session_decision_category: sessionDecisionCategory,
          bias_flags_snapshot: cognitiveBiasFlags,
          risk_category_breakdown: riskCategoryBreakdown,
        }).select("id").maybeSingle();

        // Compute cross-session patterns from history (last 10 rows)
        const { data: recentHistory } = await service.from("workspace_synthesis_history")
          .select("bias_flags_snapshot, risk_category_breakdown, session_decision_category")
          .eq("workspace_id", workspace_id)
          .order("generated_at", { ascending: false })
          .limit(10);

        let dominantBias: string | null = prevMemory?.dominant_bias ?? null;
        let recurringRisks: string[] = (prevMemory?.recurring_risks as string[]) ?? [];
        let decisionCategoryHistory: string[] = (prevMemory?.decision_category_history as string[]) ?? [];

        if (recentHistory && recentHistory.length >= 2) {
          // Count bias name occurrences across sessions
          const biasCounts: Record<string, number> = {};
          for (const row of recentHistory) {
            const flags = (row.bias_flags_snapshot as Array<{ bias_name?: string }>) || [];
            for (const f of flags) {
              const name = (f.bias_name || "").toLowerCase().trim();
              if (name) biasCounts[name] = (biasCounts[name] || 0) + 1;
            }
          }
          const topBias = Object.entries(biasCounts).sort((a, b) => b[1] - a[1])[0];
          if (topBias && topBias[1] >= 2) dominantBias = topBias[0];

          // Count risk category occurrences across sessions (appeared in N+ sessions)
          const riskCatCounts: Record<string, number> = {};
          for (const row of recentHistory) {
            const breakdown = (row.risk_category_breakdown as Record<string, number>) || {};
            for (const [cat, count] of Object.entries(breakdown)) {
              if (Number(count) > 0) riskCatCounts[cat] = (riskCatCounts[cat] || 0) + 1;
            }
          }
          recurringRisks = Object.entries(riskCatCounts)
            .filter(([, n]) => n >= 3)
            .map(([cat]) => cat);
        }

        // Append current session category to history (keep last 15)
        if (sessionDecisionCategory) {
          decisionCategoryHistory = [...decisionCategoryHistory.slice(-14), sessionDecisionCategory];
        }

        // Update workspace memory — single upsert with regular + pattern fields
        const currentCount = prevMemory?.synthesis_count ?? 0;
        await service.from("workspace_memory").upsert({
          workspace_id,
          decisions: memoryUpdate && Array.isArray(memoryUpdate.decisions) ? memoryUpdate.decisions.slice(0, 8) : (prevMemory?.decisions ?? []),
          agreements: memoryUpdate && Array.isArray(memoryUpdate.agreements) ? memoryUpdate.agreements.slice(0, 6) : (prevMemory?.agreements ?? []),
          open_threads: memoryUpdate && Array.isArray(memoryUpdate.open_threads) ? memoryUpdate.open_threads.slice(0, 6) : (prevMemory?.open_threads ?? []),
          key_entities: memoryUpdate && Array.isArray(memoryUpdate.key_entities) ? memoryUpdate.key_entities.slice(0, 10) : (prevMemory?.key_entities ?? []),
          summary: memoryUpdate && typeof memoryUpdate.summary === 'string' ? memoryUpdate.summary.slice(0, 800) : (prevMemory?.summary ?? null),
          updated_at: generatedAt,
          synthesis_count: currentCount + 1,
          dominant_bias: dominantBias,
          recurring_risks: recurringRisks,
          decision_category_history: decisionCategoryHistory,
        }, { onConflict: "workspace_id" });

        // AI action items
        if (actionItems.length > 0) {
          const rows = actionItems.map((item: { text: string; source_area: string; priority: string }) => ({
            workspace_id,
            text: String(item.text || "").slice(0, 300),
            source: "ai",
            priority: ["critical", "high", "medium", "low"].includes(item.priority) ? item.priority : "medium",
            source_area: ["risk", "blind_spot", "open_question", "conflict", "manual"].includes(item.source_area) ? item.source_area : "open_question",
            status: "todo",
            synthesis_run_id: historyRow?.id || null,
            created_by: user.id,
          }));
          await service.from("workspace_action_items")
            .delete().eq("workspace_id", workspace_id).eq("source", "ai");
          await service.from("workspace_action_items").insert(rows);
        }

        // Divergence events (best-effort)
        const userMessages = messages.filter(m => m.role === "user");
        const topConflict = [...(conflictZones as Array<{ topic: string; tension_level: number }>)]
          .sort((a, b) => b.tension_level - a.tension_level)[0];
        if (topConflict && topConflict.tension_level > 50) {
          const divergenceEvents = [];
          for (let i = 0; i < Math.min(userMessages.length, 3); i++) {
            const userMsg = userMessages[i];
            const userIdx = messages.findIndex(m => m === userMsg);
            const agentResponses: typeof messages = [];
            for (let j = userIdx + 1; j < messages.length; j++) {
              if (messages[j].role === "assistant") agentResponses.push(messages[j]);
              else break;
            }
            if (agentResponses.length >= 2) {
              divergenceEvents.push({
                workspace_id,
                user_message: userMsg.content.slice(0, 200),
                topic: topConflict.topic,
                positions: agentResponses.map(r => ({
                  agent_name: r.agent_name || "AI",
                  agent_role: r.agent_role || "assistant",
                  stance: "analyzed",
                  summary: r.content.slice(0, 120) + (r.content.length > 120 ? "…" : ""),
                })),
                divergence_score: topConflict.tension_level,
              });
            }
          }
          if (divergenceEvents.length > 0) {
            await service.from("workspace_divergence_events").insert(divergenceEvents.slice(0, 2));
          }
        }
      } catch {
        // Non-critical background write failure — synthesis already returned
      }
    })();

    // Fire DB writes in background — don't await before responding
    EdgeRuntime.waitUntil(dbWritePromise);

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
