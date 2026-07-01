import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Verify Slack request signature (HMAC-SHA256)
async function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
  signature: string,
): Promise<boolean> {
  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const baseString = `v0:${timestamp}:${rawBody}`;
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(baseString));
  const computed = "v0=" +
    Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  // Constant-time compare
  if (computed.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

// Parse URL-encoded Slack body into a plain object
function parseFormBody(body: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(body));
}

// Format synthesis result as Slack Block Kit message
function buildSlackBlocks(
  question: string,
  synthesis: Record<string, unknown>,
  appUrl: string,
  workspaceId: string,
): unknown[] {
  const score = synthesis.decision_health_score as number | null;
  const scoreText = score != null ? ` · Health score: *${score}/100*` : "";
  const velocity = synthesis.decision_velocity as string | null;
  const velocityEmoji = velocity === "fast" ? "🚀" : velocity === "stalling" ? "🐢" : "⚡";

  const consensusPoints = (synthesis.consensus_points as Array<{ text: string }> | null) ?? [];
  const riskSignals = (synthesis.risk_signals as Array<{ signal: string; severity: string }> | null) ?? [];
  const openQuestions = (synthesis.open_questions as Array<{ question: string }> | null) ?? [];
  const recommendation = synthesis.recommendation as string | null;

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "⚡ War Room Session Complete", emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Decision:* ${question}${scoreText}`,
      },
    },
  ];

  if (recommendation) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Recommendation:*\n${recommendation}`,
      },
    });
  }

  if (consensusPoints.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*✅ Consensus Points*\n` +
          consensusPoints
            .slice(0, 3)
            .map((c) => `• ${c.text}`)
            .join("\n"),
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
          riskSignals
            .slice(0, 3)
            .map((r) => `• ${r.signal}`)
            .join("\n"),
      },
    });
  }

  if (openQuestions.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*❓ Open Questions*\n` +
          openQuestions
            .slice(0, 2)
            .map((q) => `• ${q.question}`)
            .join("\n"),
      },
    });
  }

  if (velocity) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `${velocityEmoji} Decision velocity: *${velocity}*`,
        },
      ],
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
        url: `${appUrl}/?workspace=${workspaceId}`,
      },
    ],
  });

  return blocks;
}

async function runWarRoom(
  service: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  slackSessionId: string,
  workspaceId: string,
  question: string,
  responseUrl: string,
  appUrl: string,
): Promise<void> {
  try {
    // Mark session as processing
    await service
      .from("slack_sessions")
      .update({ status: "processing" })
      .eq("id", slackSessionId);

    // Find workspace owner to attribute the message
    const { data: ownerRow } = await service
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("role", "owner")
      .maybeSingle();

    if (!ownerRow) throw new Error("Workspace owner not found");

    // Insert the decision question as a workspace message
    await service.from("workspace_messages").insert({
      workspace_id: workspaceId,
      user_id: ownerRow.user_id,
      role: "user",
      content: question,
      metadata: { source: "slack_slash_command", slack_session_id: slackSessionId },
    });

    // Trigger synthesis (internal call using service role key)
    const synthRes = await fetch(`${supabaseUrl}/functions/v1/workspace-synthesize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ workspace_id: workspaceId }),
    });

    if (!synthRes.ok) {
      const errText = await synthRes.text();
      throw new Error(`Synthesis failed: ${errText}`);
    }

    const synthData = await synthRes.json();
    const synthesis = synthData.synthesis ?? synthData;

    // Record the synthesis_id on the session
    if (synthesis?.id) {
      await service
        .from("slack_sessions")
        .update({ synthesis_id: synthesis.id, status: "completed" })
        .eq("id", slackSessionId);
    } else {
      await service
        .from("slack_sessions")
        .update({ status: "completed" })
        .eq("id", slackSessionId);
    }

    // Post the Board Brief summary back to Slack
    const blocks = buildSlackBlocks(question, synthesis, appUrl, workspaceId);
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response_type: "in_channel",
        blocks,
      }),
    });
  } catch (err) {
    console.error("War room processing error:", err);
    await service
      .from("slack_sessions")
      .update({ status: "failed" })
      .eq("id", slackSessionId);

    // Notify the user that something went wrong
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response_type: "ephemeral",
        text: "⚠️ Something went wrong running the War Room session. Please try again or open Poddle directly.",
      }),
    });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signingSecret = Deno.env.get("SLACK_SIGNING_SECRET");
  if (!signingSecret) {
    return new Response(
      JSON.stringify({ error: "Slack signing secret not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Read raw body for signature verification before any parsing
  const rawBody = await req.text();
  const timestamp = req.headers.get("X-Slack-Request-Timestamp") ?? "";
  const signature = req.headers.get("X-Slack-Signature") ?? "";

  const valid = await verifySlackSignature(signingSecret, timestamp, rawBody, signature);
  if (!valid) {
    return new Response(
      JSON.stringify({ error: "Invalid signature" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const params = parseFormBody(rawBody);
  const teamId = params.team_id;
  const channelId = params.channel_id;
  const slackUserId = params.user_id;
  const question = (params.text ?? "").trim();
  const responseUrl = params.response_url;

  if (!teamId || !channelId || !slackUserId || !responseUrl) {
    return new Response(
      JSON.stringify({ error: "Missing required Slack fields" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appUrl = Deno.env.get("APP_URL") ?? supabaseUrl.replace(".supabase.co", ".netlify.app");
  const service = createClient(supabaseUrl, serviceKey);

  // Look up the Slack team → Poddle workspace mapping
  const { data: slackWs } = await service
    .from("slack_workspaces")
    .select("id, poddle_workspace_id")
    .eq("slack_team_id", teamId)
    .maybeSingle();

  if (!slackWs) {
    // No linked workspace — tell user to connect first
    return new Response(
      JSON.stringify({
        response_type: "ephemeral",
        text: `👋 Your Slack workspace isn't connected to Poddle yet. Connect it in your workspace settings: ${appUrl}`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!question) {
    return new Response(
      JSON.stringify({
        response_type: "ephemeral",
        text: "Please provide a decision question. Example: `/poddle Should we raise the enterprise price by 15%?`",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Insert the session row
  const { data: sessionRow } = await service
    .from("slack_sessions")
    .insert({
      slack_workspace_id: slackWs.id,
      slack_user_id: slackUserId,
      slack_channel_id: channelId,
      response_url: responseUrl,
      decision_question: question,
      status: "pending",
    })
    .select("id")
    .single();

  const sessionId = sessionRow?.id;

  // Fire-and-forget background processing — responds within Slack's 3-second window
  EdgeRuntime.waitUntil(
    runWarRoom(
      service,
      supabaseUrl,
      serviceKey,
      sessionId,
      slackWs.poddle_workspace_id,
      question,
      responseUrl,
      appUrl,
    ),
  );

  // Immediate ack to Slack (must arrive within 3 seconds)
  return new Response(
    JSON.stringify({
      response_type: "ephemeral",
      text: `⚡ *Starting your War Room session…*\n> ${question}\n\nI'll post the Board Brief here when it's ready.`,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
