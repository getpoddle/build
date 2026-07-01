import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appUrl = Deno.env.get("APP_URL") ?? supabaseUrl.replace(".supabase.co", ".netlify.app");

  // Only callable internally with the service role key
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const service = createClient(supabaseUrl, serviceKey);

  let body: { workspace_id?: string; synthesis_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { workspace_id, synthesis_id } = body;
  if (!workspace_id) {
    return new Response(JSON.stringify({ error: "workspace_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find pending/processing Slack sessions for this workspace
  const { data: sessions } = await service
    .from("slack_sessions")
    .select("id, response_url, decision_question, slack_channel_id, slack_workspace_id")
    .in("status", ["pending", "processing"])
    .eq(
      "slack_workspace_id",
      service
        .from("slack_workspaces")
        .select("id")
        .eq("poddle_workspace_id", workspace_id)
        .limit(1),
    );

  // Re-query using a join since supabase client doesn't support subquery in .eq()
  const { data: slackWs } = await service
    .from("slack_workspaces")
    .select("id, bot_access_token")
    .eq("poddle_workspace_id", workspace_id)
    .maybeSingle();

  if (!slackWs) {
    return new Response(JSON.stringify({ ok: true, message: "No Slack workspace linked" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: pendingSessions } = await service
    .from("slack_sessions")
    .select("id, response_url, decision_question")
    .eq("slack_workspace_id", slackWs.id)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(5);

  if (!pendingSessions || pendingSessions.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: "No pending sessions" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch the synthesis data
  let synthesis: Record<string, unknown> = {};
  if (synthesis_id) {
    const { data: synthRow } = await service
      .from("workspace_synthesis")
      .select("*")
      .eq("id", synthesis_id)
      .maybeSingle();
    if (synthRow) synthesis = synthRow;
  } else {
    const { data: synthRow } = await service
      .from("workspace_synthesis")
      .select("*")
      .eq("workspace_id", workspace_id)
      .maybeSingle();
    if (synthRow) synthesis = synthRow;
  }

  const posted: string[] = [];

  for (const session of pendingSessions) {
    const question = session.decision_question ?? "your decision";
    const score = synthesis.decision_health_score as number | null;
    const scoreText = score != null ? ` · Health score: *${score}/100*` : "";
    const consensusPoints = (synthesis.consensus_points as Array<{ text: string }> | null) ?? [];
    const riskSignals = (synthesis.risk_signals as Array<{ signal: string }> | null) ?? [];
    const recommendation = synthesis.recommendation as string | null;

    const blocks: unknown[] = [
      {
        type: "header",
        text: { type: "plain_text", text: "⚡ War Room Session Complete", emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Decision:* ${question}${scoreText}` },
      },
    ];

    if (recommendation) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*Recommendation:*\n${recommendation}` },
      });
    }

    if (consensusPoints.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*✅ Consensus Points*\n` +
            consensusPoints.slice(0, 3).map((c) => `• ${c.text}`).join("\n"),
        },
      });
    }

    if (riskSignals.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*⚠️ Risk Signals*\n` +
            riskSignals.slice(0, 3).map((r) => `• ${r.signal}`).join("\n"),
        },
      });
    }

    blocks.push({ type: "divider" });
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View Full War Room", emoji: true },
          style: "primary",
          url: `${appUrl}/?workspace=${workspace_id}`,
        },
      ],
    });

    const postRes = await fetch(session.response_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response_type: "in_channel", blocks }),
    });

    if (postRes.ok) {
      await service
        .from("slack_sessions")
        .update({
          status: "completed",
          ...(synthesis_id ? { synthesis_id } : {}),
        })
        .eq("id", session.id);
      posted.push(session.id);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, posted }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
