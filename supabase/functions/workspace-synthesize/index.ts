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

    const { workspace_id } = await req.json();
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "Missing workspace_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Fetch recent messages with user_id so we can resolve real names
    const { data: messages } = await service
      .from("workspace_messages")
      .select("role, content, agent_name, agent_role, user_id, created_at")
      .eq("workspace_id", workspace_id)
      .order("created_at", { ascending: true })
      .limit(80);

    if (!messages || messages.length < 3) {
      return new Response(JSON.stringify({ error: "Not enough conversation data yet. Keep chatting!" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch workspace context
    const { data: workspace } = await service
      .from("workspaces").select("name, description, domain")
      .eq("id", workspace_id).maybeSingle();

    // Fetch all workspace members with their profiles so we can map user_id → display name + role
    const { data: members } = await service
      .from("workspace_members")
      .select("user_id, role, profiles(first_name, last_name, full_name, username)")
      .eq("workspace_id", workspace_id);

    // Build a user_id → "FirstName (workspace_role)" label map
    type MemberLabel = { label: string; firstName: string };
    const memberLabelMap = new Map<string, MemberLabel>();
    for (const m of (members || [])) {
      const p = (m.profiles as { first_name?: string | null; last_name?: string | null; full_name?: string | null; username?: string | null } | null);
      const firstName = p?.first_name?.trim() || p?.full_name?.split(" ")[0]?.trim() || p?.username?.trim() || "Member";
      const label = `${firstName} (${m.role})`;
      memberLabelMap.set(m.user_id, { label, firstName });
    }

    // Build a readable transcript with real names for humans
    const transcript = messages.map(m => {
      if (m.role === "user") {
        const member = m.user_id ? memberLabelMap.get(m.user_id) : null;
        const speaker = member ? member.label : "Team Member";
        return `${speaker}: ${m.content}`;
      } else {
        const speaker = `[${m.agent_name?.toUpperCase() || "AI"}]`;
        return `${speaker}: ${m.content}`;
      }
    }).join("\n\n");

    // Build the list of human participant names for the prompt
    const humanNames = Array.from(memberLabelMap.values()).map(v => v.label);
    const humanNamesNote = humanNames.length > 0
      ? `\n\nHuman participants in this conversation: ${humanNames.join(", ")}. When two humans explicitly disagree, use their actual names (e.g. "John (owner)") as agent_a and agent_b, and set participant_type to "human". When a human and an AI agent disagree, set participant_type to "mixed". When only AI agents disagree, set participant_type to "agent".`
      : "";

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const synthesisPrompt = `You are a strategic intelligence analyst. You have just read a full conversation transcript from a private team workspace called "${workspace?.name || "Workspace"}"${workspace?.description ? ` (focus: ${workspace.description})` : ""}.${humanNamesNote}

Your task: perform a War Room synthesis of this conversation and return a JSON object with this exact structure:

{
  "decision_health_score": 72,
  "health_rationale": "one sentence explaining the score",
  "consensus_points": [
    { "text": "clear shared belief", "confidence": 85, "source_count": 3 }
  ],
  "conflict_zones": [
    { "topic": "short topic", "agent_a": "Strategic Analyst", "position_a": "their stance", "agent_b": "Devil's Advocate", "position_b": "their stance", "tension_level": 72, "participant_type": "agent" }
  ],
  "open_questions": [
    { "question": "unresolved question", "urgency": "high" }
  ],
  "risk_signals": [
    { "signal": "specific risk identified", "severity": "critical", "category": "market/execution/financial/team/technology" }
  ],
  "blind_spots": [
    { "area": "topic area", "description": "what the team seems to be missing entirely" }
  ],
  "action_items": [
    { "text": "Conduct user interviews to validate the pricing assumption before Q2", "source_area": "blind_spot", "priority": "high" }
  ]
}

Rules:
- consensus_points: beliefs all/most agents agreed on (max 5)
- conflict_zones: topics where participants explicitly disagreed (max 4, tension_level 0-100). IMPORTANT: if two named humans disagreed (e.g. "John (owner)" argued X while "Sarah (member)" argued Y), use their real names as agent_a and agent_b and set participant_type to "human". If a human and an AI agent disagreed, set participant_type to "mixed". If only AI agents disagreed, set participant_type to "agent". The topic should be a short label, e.g. "Timeline".
- open_questions: ONLY include questions that were raised AND genuinely not answered with a concrete recommendation anywhere in the transcript. If agents provided a clear position, recommendation, or decision path for a question — even if imperfect — it is RESOLVED and must NOT appear here. A question is only open if the transcript ended without any agent taking a position on it. (max 5, urgency: low/medium/high/critical)
- risk_signals: concrete risks flagged (max 5, severity: low/medium/high/critical, category must be exactly one of: market/execution/financial/team/technology)
- blind_spots: topics NO agent raised but that are strategically important given the context. Do NOT include topics that were already discussed — only truly unaddressed areas. (max 3 — this is the most valuable output)
- action_items: Generate up to 6 concrete, specific, one-sentence action items the team should take immediately, derived from the open questions, risks, and blind spots. Each MUST start with a verb (e.g. "Validate", "Schedule", "Research", "Define", "Test", "Map"). Tag each with the source_area it came from (risk/blind_spot/open_question/conflict). Priority must be critical/high/medium/low.
- decision_health_score: 0-100. Low means fragmented/confused team, high means sharp/aligned. As more questions get resolved and consensus grows, this score should INCREASE. Base on clarity, coverage of risks, consensus quality, and how many prior open questions have now been addressed.
- Return ONLY valid JSON. No markdown, no explanation.

CRITICAL: Read the ENTIRE transcript carefully before populating open_questions and blind_spots. If a question was explicitly discussed and agents gave recommendations — it is RESOLVED. Only flag something as open if it truly has no answer anywhere in the conversation.

TRANSCRIPT:
${transcript}`;

    // AbortController so we don't hang past 45s waiting on OpenAI
    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), 45000);

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
          max_tokens: 3000,
          temperature: 0.3,
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

    const generatedAt = new Date().toISOString();
    const actionItems = Array.isArray(synthesis.action_items) ? synthesis.action_items : [];
    const consensusPoints = Array.isArray(synthesis.consensus_points) ? synthesis.consensus_points : [];
    const conflictZones = Array.isArray(synthesis.conflict_zones) ? synthesis.conflict_zones : [];
    const openQuestions = Array.isArray(synthesis.open_questions) ? synthesis.open_questions : [];
    const riskSignals = Array.isArray(synthesis.risk_signals) ? synthesis.risk_signals : [];
    const blindSpots = Array.isArray(synthesis.blind_spots) ? synthesis.blind_spots : [];

    // Upsert synthesis — include action_items
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
      generated_at: generatedAt,
      message_count_at_generation: messages.length,
    }, { onConflict: "workspace_id" });

    // Insert synthesis history row — permanent record for trend tracking
    const { data: historyRow } = await service.from("workspace_synthesis_history").insert({
      workspace_id,
      decision_health_score: synthesis.decision_health_score != null ? Number(synthesis.decision_health_score) : 0,
      consensus_count: consensusPoints.length,
      conflict_count: conflictZones.length,
      open_question_count: openQuestions.length,
      risk_count: riskSignals.length,
      blind_spot_count: blindSpots.length,
      message_count: messages.length,
      generated_at: generatedAt,
    }).select("id").maybeSingle();

    // Insert AI-generated action items — best-effort, do not fail synthesis on error
    try {
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
        // Delete old AI action items for this workspace before inserting new ones
        await service.from("workspace_action_items")
          .delete()
          .eq("workspace_id", workspace_id)
          .eq("source", "ai");
        await service.from("workspace_action_items").insert(rows);
      }
    } catch {
      // Non-critical — action item insertion failure must not affect synthesis response
    }

    // Insert divergence events best-effort
    try {
      const userMessages = messages.filter(m => m.role === "user");
      const topConflict = [...(conflictZones as Array<{ topic: string; tension_level: number }>)]
        .sort((a, b) => b.tension_level - a.tension_level)[0];

      if (topConflict && topConflict.tension_level > 50) {
        const divergenceEvents = [];
        for (let i = 0; i < Math.min(userMessages.length, 5); i++) {
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
          await service.from("workspace_divergence_events").insert(divergenceEvents.slice(0, 3));
        }
      }
    } catch {
      // Non-critical
    }

    return new Response(JSON.stringify({
      synthesis: {
        ...synthesis,
        action_items: actionItems,
        generated_at: generatedAt,
        message_count: messages.length,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
