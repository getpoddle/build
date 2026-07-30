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
function severityEmoji(severity: string): string {
  if (severity === "critical") return "🔴";
  if (severity === "high") return "🟠";
  if (severity === "medium") return "🟡";
  return "🟢";
}

function priorityEmoji(priority: string): string {
  if (priority === "critical") return "🔴";
  if (priority === "high") return "🟠";
  return "🟡";
}

function statusEmoji(status: string): string {
  if (status === "on-track") return "✅";
  if (status === "at-risk") return "⚠️";
  return "❓";
}

function buildSlackBlocks(
  question: string,
  synthesis: Record<string, unknown>,
  appUrl: string,
  workspaceId: string,
): unknown[] {
  const score = synthesis.decision_health_score as number | null;
  const financialScore = synthesis.financial_score as number | null;
  const operationalScore = synthesis.operational_score as number | null;
  const alignmentScore = synthesis.alignment_score as number | null;
  const velocity = synthesis.decision_velocity as string | null;
  const confidenceTraj = synthesis.confidence_trajectory as string | null;
  const velocityEmoji = velocity === "fast" ? "🚀" : velocity === "stalling" ? "🐢" : "⚡";
  const trajEmoji = confidenceTraj === "rising" ? "📈" : confidenceTraj === "falling" ? "📉" : "➡️";

  const recommendation = synthesis.recommendation as string | null;
  const executiveSummary = synthesis.executive_summary as string | null;
  const healthRationale = synthesis.health_rationale as string | null;

  const consensusPoints = (synthesis.consensus_points as Array<{ text: string; confidence?: number }> | null) ?? [];
  const riskSignals = (synthesis.risk_signals as Array<{ signal: string; severity: string; category?: string }> | null) ?? [];
  const openQuestions = (synthesis.open_questions as Array<{ question: string; urgency?: string }> | null) ?? [];
  const actionItems = (synthesis.action_items as Array<{ text: string; priority: string; source_area?: string }> | null) ?? [];
  const financialMetrics = (synthesis.financial_metrics as Array<{ metric: string; value: string; confidence?: string; note?: string }> | null) ?? [];
  const operationalMetrics = (synthesis.operational_metrics as Array<{ metric: string; status: string; note?: string }> | null) ?? [];
  const nonFinancialMetrics = (synthesis.non_financial_metrics as Array<{ metric: string; signal: string; note?: string }> | null) ?? [];
  const opportunitySignals = (synthesis.opportunity_signals as Array<{ title: string; description: string; confidence?: string }> | null) ?? [];
  const blindSpots = (synthesis.blind_spots as Array<{ area: string; description: string }> | null) ?? [];
  const conflictZones = (synthesis.conflict_zones as Array<{ topic: string; agent_a?: string; position_a?: string; agent_b?: string; position_b?: string }> | null) ?? [];
  const keyDecisions = (synthesis.key_decisions as Array<{ decision: string; status: string; rationale?: string; owner?: string }> | null) ?? [];
  const cognitiveBiasFlags = (synthesis.cognitive_bias_flags as Array<{ bias_name: string; explanation: string; counter_question?: string }> | null) ?? [];

  const blocks: unknown[] = [];

  // Header
  blocks.push({
    type: "header",
    text: { type: "plain_text", text: "⚡ War Room Board Brief", emoji: true },
  });

  // Decision + health score
  const scoreBar = score != null ? ` · Health: *${score}/100*` : "";
  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: `*Decision:* ${question}${scoreBar}` },
  });

  // Score breakdown (inline)
  const scoreFields: Array<{ type: string; text: string }> = [];
  if (financialScore != null) scoreFields.push({ type: "mrkdwn", text: `*Financial*\n${financialScore}/100` });
  if (operationalScore != null) scoreFields.push({ type: "mrkdwn", text: `*Operational*\n${operationalScore}/100` });
  if (alignmentScore != null) scoreFields.push({ type: "mrkdwn", text: `*Alignment*\n${alignmentScore}/100` });
  if (velocity) scoreFields.push({ type: "mrkdwn", text: `*Velocity*\n${velocityEmoji} ${velocity}` });
  if (confidenceTraj) scoreFields.push({ type: "mrkdwn", text: `*Confidence*\n${trajEmoji} ${confidenceTraj}` });
  if (scoreFields.length > 0) {
    blocks.push({ type: "section", fields: scoreFields.slice(0, 5) });
  }

  if (healthRationale) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `_${healthRationale}_` }],
    });
  }

  blocks.push({ type: "divider" });

  // Executive summary
  if (executiveSummary) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Executive Summary*\n${executiveSummary}` },
    });
  }

  // Recommendation
  if (recommendation) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Recommendation*\n${recommendation}` },
    });
    blocks.push({ type: "divider" });
  }

  // Action Items
  if (actionItems.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*Action Items*\n` +
          actionItems
            .slice(0, 5)
            .map((a) => `${priorityEmoji(a.priority)} *[${a.source_area ?? a.priority}]* ${a.text}`)
            .join("\n"),
      },
    });
  }

  // Consensus Points
  if (consensusPoints.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*✅ Consensus Points*\n` +
          consensusPoints
            .slice(0, 4)
            .map((c) => `• ${c.text}${c.confidence != null ? ` _(${c.confidence}% confidence)_` : ""}`)
            .join("\n"),
      },
    });
  }

  // Risk Signals
  if (riskSignals.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*Risk Signals*\n` +
          riskSignals
            .slice(0, 5)
            .map((r) => `${severityEmoji(r.severity)} *[${r.category ?? r.severity}]* ${r.signal}`)
            .join("\n"),
      },
    });
  }

  // Blind Spots — elevated to top-tier visibility
  if (blindSpots.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*🕳️ Blind Spots*\n_What your team may not be seeing:_\n` +
          blindSpots
            .map((b) => `• *${b.area}* — ${b.description}`)
            .join("\n"),
      },
    });
  }

  // Financial Metrics
  if (financialMetrics.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*💰 Financial Metrics*\n` +
          financialMetrics
            .slice(0, 5)
            .map((f) => `• *${f.metric}:* ${f.value}${f.note ? ` — ${f.note}` : ""}`)
            .join("\n"),
      },
    });
  }

  // Operational Metrics
  if (operationalMetrics.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*⚙️ Operational Metrics*\n` +
          operationalMetrics
            .slice(0, 5)
            .map((o) => `${statusEmoji(o.status)} *${o.metric}:* ${o.status}${o.note ? ` — ${o.note}` : ""}`)
            .join("\n"),
      },
    });
  }

  // Non-Financial Metrics
  if (nonFinancialMetrics.length > 0) {
    const signalEmoji = (s: string) => s === "positive" ? "🟢" : s === "negative" ? "🔴" : "🔵";
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*📊 Strategic Metrics*\n` +
          nonFinancialMetrics
            .slice(0, 4)
            .map((n) => `${signalEmoji(n.signal)} *${n.metric}*${n.note ? ` — ${n.note}` : ""}`)
            .join("\n"),
      },
    });
  }

  // Open Questions
  if (openQuestions.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*❓ Open Questions*\n` +
          openQuestions
            .slice(0, 4)
            .map((q) => `• ${q.question}${q.urgency === "critical" ? " 🔴" : q.urgency === "high" ? " 🟠" : ""}`)
            .join("\n"),
      },
    });
  }

  // Opportunity Signals
  if (opportunitySignals.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*💡 Opportunities*\n` +
          opportunitySignals
            .slice(0, 3)
            .map((o) => `• *${o.title}* — ${o.description}`)
            .join("\n"),
      },
    });
  }

  // Key Decisions
  if (keyDecisions.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*🎯 Key Decisions*\n` +
          keyDecisions
            .slice(0, 4)
            .map((d) => {
              const st = d.status === "resolved" ? "✅" : d.status === "in-progress" ? "🔄" : "⏳";
              return `${st} *${d.decision}*${d.owner ? ` _(${d.owner})_` : ""}`;
            })
            .join("\n"),
      },
    });
  }

  // Conflict Zones
  if (conflictZones.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*⚡ Conflict Zones*\n` +
          conflictZones
            .slice(0, 3)
            .map((c) => `• *${c.topic}*${c.position_a && c.position_b ? `: "${c.position_a}" vs "${c.position_b}"` : ""}`)
            .join("\n"),
      },
    });
  }

  // Cognitive Bias Flags
  if (cognitiveBiasFlags.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*🧠 Cognitive Bias Flags*\n` +
          cognitiveBiasFlags
            .slice(0, 2)
            .map((b) => `• *${b.bias_name}* — ${b.explanation}`)
            .join("\n"),
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
  installedByUserId: string,
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

    // Create a fresh, isolated workspace for this specific Slack question.
    // Each /poddle command gets its own War Room so prior conversations never contaminate results.
    const workspaceName = question.length > 100 ? question.slice(0, 97) + "…" : question;
    const { data: newWorkspace, error: wsErr } = await service
      .from("workspaces")
      .insert({
        name: workspaceName,
        description: "Created from Slack slash command",
        owner_id: installedByUserId,
        source: "slack",
        plan: "pro",
        subscription_status: "trialing",
        trial_workspace_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        is_public: true,
      })
      .select("id")
      .single();

    if (wsErr || !newWorkspace) throw new Error(`Failed to create workspace: ${wsErr?.message}`);

    const workspaceId = newWorkspace.id;

    // Insert the Slack user as workspace owner — required for message attribution and access checks
    await service.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: installedByUserId,
      role: "owner",
    });

    // Record the new workspace on the session for deep-link routing
    await service
      .from("slack_sessions")
      .update({ poddle_workspace_id: workspaceId })
      .eq("id", slackSessionId);

    // Insert the decision question as the opening workspace message
    await service.from("workspace_messages").insert({
      workspace_id: workspaceId,
      user_id: installedByUserId,
      role: "user",
      content: question,
      metadata: { source: "slack_slash_command", slack_session_id: slackSessionId },
    });

    // Trigger fast synthesis without awaiting — lens-synthesize uses a single
    // gpt-4o call (no regeneration/rationale/pattern rollup) so the Board
    // Brief is ready in ~30-60s instead of 2-5 minutes.
    fetch(`${supabaseUrl}/functions/v1/lens-synthesize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ workspace_id: workspaceId }),
    }).catch((err) => console.error("Synthesis trigger failed:", err));

    // Poll the workspace_synthesis table for the result. The synthesis
    // function upserts a row once the main OpenAI calls complete.
    const synthSelect =
      "decision_health_score, financial_score, operational_score, alignment_score, " +
      "decision_velocity, confidence_trajectory, health_rationale, executive_summary, recommendation, " +
      "consensus_points, conflict_zones, open_questions, risk_signals, blind_spots, " +
      "action_items, financial_metrics, operational_metrics, non_financial_metrics, " +
      "opportunity_signals, key_decisions, cognitive_bias_flags";

    const pollIntervalMs = 3000;
    const maxPollMs = 150_000; // 2.5 minutes — stays within edge function wall clock
    const deadline = Date.now() + maxPollMs;

    let fullSynthesis: Record<string, unknown> | null = null;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      const { data: synthRow } = await service
        .from("workspace_synthesis")
        .select(synthSelect)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (synthRow) {
        fullSynthesis = synthRow as Record<string, unknown>;
        break;
      }
    }

    if (fullSynthesis) {
      await service
        .from("slack_sessions")
        .update({ status: "completed" })
        .eq("id", slackSessionId);

      const blocks = buildSlackBlocks(question, fullSynthesis, appUrl, workspaceId);
      await fetch(responseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response_type: "in_channel",
          blocks,
        }),
      });
    } else {
      // Synthesis is still running — give the user a link to check later
      await service
        .from("slack_sessions")
        .update({ status: "processing" })
        .eq("id", slackSessionId);

      await fetch(responseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response_type: "in_channel",
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: `⚡ *War Room still in progress…*\n> ${question}\n\nThe AI advisors are still debating. Your Board Brief will be ready shortly — view it here:` },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Open War Room", emoji: true },
                  style: "primary",
                  url: `${appUrl}/?workspace=${workspaceId}`,
                },
              ],
            },
          ],
        }),
      });
    }
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
  const appUrl = Deno.env.get("APP_URL") ?? "https://poddleme.com";
  const service = createClient(supabaseUrl, serviceKey);

  // Look up the Slack team → Poddle user mapping
  const { data: slackWs } = await service
    .from("slack_workspaces")
    .select("id, poddle_workspace_id, installed_by_user_id")
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
      slackWs.installed_by_user_id,
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
