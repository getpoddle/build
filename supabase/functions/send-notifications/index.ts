import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const POSTHOG_KEY = Deno.env.get("POSTHOG_KEY");
const POSTHOG_HOST = Deno.env.get("POSTHOG_HOST") || "https://eu.i.posthog.com";

function phCaptureServer(event: string, distinctId: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  try {
    const promise = fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event,
        distinct_id: distinctId,
        properties: { ...(properties ?? {}), source: "edge_function" },
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as unknown as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil) {
      (EdgeRuntime as unknown as { waitUntil: (p: Promise<unknown>) => void }).waitUntil(promise);
    }
  } catch {
    /* no-op */
  }
}

interface NotificationPayload {
  type:
    | "insight_added"
    | "mention"
    | "follow"
    | "challenge"
    | "weekly_digest"
    | "message";
  recipientUserId: string;
  actorName?: string;
  actorId?: string;
  podName?: string;
  podId?: string;
  assumptionSnippet?: string;
  assumptionId?: string;
  messageSnippet?: string;
  conversationId?: string;
  digestData?: DigestData;
}

interface TopAssumption {
  id: string;
  content: string;
  challenge_count: number;
  pod_name: string;
}

interface AIHighlight {
  agent_name: string;
  response_type: string;
  snippet: string;
  confidence_score: number;
  assumption_snippet: string;
  pod_name: string;
}

interface PodChange {
  pod_name: string;
  pod_id: string;
  new_assumptions: number;
  question: string;
}

interface DigestData {
  top_assumptions: TopAssumption[];
  ai_highlights: AIHighlight[];
  pod_changes: PodChange[];
  summary_text: string;
  week_start: string;
}

const APP_URL = Deno.env.get("APP_URL") || "https://poddleme.com";

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailBase(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Poddle</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">
        <!-- Header -->
        <tr>
          <td style="padding-bottom:32px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#1e293b;border-radius:10px;padding:10px 16px;">
                  <span style="color:#f8fafc;font-size:16px;font-weight:700;letter-spacing:-0.3px;">Poddle</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Content card -->
        <tr>
          <td style="background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding-top:24px;text-align:center;">
            <p style="color:#475569;font-size:12px;margin:0 0 8px 0;">
              You're receiving this because you have email notifications enabled on Poddle.
            </p>
            <p style="color:#475569;font-size:12px;margin:0;">
              <a href="${APP_URL}/profile" style="color:#64748b;text-decoration:underline;">Manage notification preferences</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function ctaButton(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:24px;">${label}</a>`;
}

function buildInsightAddedEmail(
  recipientName: string,
  actorName: string,
  podName: string,
  assumptionSnippet: string,
  podId: string
): { subject: string; html: string } {
  const subject = `New insight added in "${escHtml(podName)}"`;
  const raw = assumptionSnippet.length > 120 ? assumptionSnippet.slice(0, 120) + "…" : assumptionSnippet;
  const snippet = escHtml(raw);
  const html = emailBase(`
    <div style="padding:32px;">
      <p style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 20px 0;">New Insight</p>
      <h1 style="color:#f8fafc;font-size:22px;font-weight:700;margin:0 0 8px 0;line-height:1.3;">A new insight was added in <span style="color:#60a5fa;">${escHtml(podName)}</span></h1>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 24px 0;">Hi ${escHtml(recipientName)}, ${escHtml(actorName)} just posted an insight you should see.</p>
      <div style="background:#0f172a;border-radius:10px;border-left:3px solid #2563eb;padding:16px 20px;margin-bottom:8px;">
        <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0;font-style:italic;">&ldquo;${snippet}&rdquo;</p>
      </div>
      ${ctaButton("View insight", `${APP_URL}/pods/${encodeURIComponent(podId)}`)}
    </div>
  `);
  return { subject, html };
}

function buildMentionEmail(
  recipientName: string,
  actorName: string,
  mentionType: string,
  podId?: string
): { subject: string; html: string } {
  const context =
    mentionType === "challenge"
      ? "a challenge"
      : mentionType === "challenge_response"
      ? "a challenge response"
      : mentionType === "assumption"
      ? "an insight"
      : "a comment";
  const subject = `${escHtml(actorName)} mentioned you on Poddle`;
  const html = emailBase(`
    <div style="padding:32px;">
      <p style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 20px 0;">You were mentioned</p>
      <h1 style="color:#f8fafc;font-size:22px;font-weight:700;margin:0 0 8px 0;line-height:1.3;">${escHtml(actorName)} mentioned you</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0;">Hi ${escHtml(recipientName)}, you were mentioned in ${context}. Jump in and respond.</p>
      ${ctaButton("See the mention", podId ? `${APP_URL}/pods/${encodeURIComponent(podId)}` : APP_URL)}
    </div>
  `);
  return { subject, html };
}

function buildFollowEmail(
  recipientName: string,
  actorName: string
): { subject: string; html: string } {
  const subject = `${escHtml(actorName)} started following you on Poddle`;
  const html = emailBase(`
    <div style="padding:32px;">
      <p style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 20px 0;">New follower</p>
      <h1 style="color:#f8fafc;font-size:22px;font-weight:700;margin:0 0 8px 0;line-height:1.3;">${escHtml(actorName)} is now following you</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0;">Hi ${escHtml(recipientName)}, your insights are getting noticed. ${escHtml(actorName)} started following your work on Poddle.</p>
      ${ctaButton("View your profile", `${APP_URL}/profile`)}
    </div>
  `);
  return { subject, html };
}

function buildChallengeEmail(
  recipientName: string,
  actorName: string,
  assumptionSnippet: string,
  podName: string,
  podId: string
): { subject: string; html: string } {
  const raw = assumptionSnippet.length > 100 ? assumptionSnippet.slice(0, 100) + "…" : assumptionSnippet;
  const snippet = escHtml(raw);
  const subject = `${escHtml(actorName)} challenged your insight`;
  const html = emailBase(`
    <div style="padding:32px;">
      <p style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 20px 0;">Your insight was challenged</p>
      <h1 style="color:#f8fafc;font-size:22px;font-weight:700;margin:0 0 8px 0;line-height:1.3;">${escHtml(actorName)} challenged your insight in <span style="color:#60a5fa;">${escHtml(podName)}</span></h1>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 24px 0;">Hi ${escHtml(recipientName)}, someone pushed back on your thinking.</p>
      <div style="background:#0f172a;border-radius:10px;border-left:3px solid #f59e0b;padding:16px 20px;margin-bottom:8px;">
        <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0;font-style:italic;">&ldquo;${snippet}&rdquo;</p>
      </div>
      ${ctaButton("Respond to challenge", `${APP_URL}/pods/${podId}`)}
    </div>
  `);
  return { subject, html };
}

function buildMessageEmail(
  recipientName: string,
  actorName: string,
  messageSnippet: string,
  conversationId: string
): { subject: string; html: string } {
  const raw = messageSnippet.length > 120 ? messageSnippet.slice(0, 120) + "…" : messageSnippet;
  const snippet = escHtml(raw);
  const subject = `${escHtml(actorName)} sent you a message on Poddle`;
  const _conversationId = conversationId; // reserved for future deep-link
  const html = emailBase(`
    <div style="padding:32px;">
      <p style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 20px 0;">New Message</p>
      <h1 style="color:#f8fafc;font-size:22px;font-weight:700;margin:0 0 8px 0;line-height:1.3;">${escHtml(actorName)} sent you a message</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 24px 0;">Hi ${escHtml(recipientName)}, you have a new message waiting for you.</p>
      <div style="background:#0f172a;border-radius:10px;border-left:3px solid #10b981;padding:16px 20px;margin-bottom:8px;">
        <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0;font-style:italic;">&ldquo;${snippet}&rdquo;</p>
      </div>
      ${ctaButton("Reply to message", `${APP_URL}/messages`)}
    </div>
  `);
  return { subject, html };
}

function buildWeeklyDigestEmail(
  recipientName: string,
  digest: DigestData
): { subject: string; html: string } {
  const subject = `Your Poddle weekly digest — week of ${new Date(digest.week_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const topInsightsRows = digest.top_assumptions
    .slice(0, 3)
    .map(
      (a, i) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #334155;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="width:28px;vertical-align:top;">
              <span style="color:#475569;font-size:12px;font-family:monospace;">#${i + 1}</span>
            </td>
            <td>
              <p style="color:#e2e8f0;font-size:13px;line-height:1.5;margin:0 0 4px 0;">${escHtml(a.content.slice(0, 140))}${a.content.length > 140 ? "…" : ""}</p>
              <div>
                <span style="color:#64748b;font-size:11px;">${escHtml(a.pod_name)}</span>
                ${a.challenge_count > 0 ? `<span style="color:#f59e0b;font-size:11px;margin-left:12px;">${a.challenge_count} challenge${a.challenge_count !== 1 ? "s" : ""}</span>` : ""}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `
    )
    .join("");

  const aiHighlightsRows = digest.ai_highlights
    .slice(0, 3)
    .map((h) => {
      const dotColor =
        h.response_type === "challenge"
          ? "#f87171"
          : h.response_type === "risk"
          ? "#fbbf24"
          : h.response_type === "alternative"
          ? "#34d399"
          : h.response_type === "question"
          ? "#60a5fa"
          : "#94a3b8";
      return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #334155;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="width:10px;vertical-align:top;padding-top:4px;">
                <span style="display:inline-block;width:8px;height:8px;background:${dotColor};border-radius:50%;"></span>
              </td>
              <td style="padding-left:10px;">
                <p style="color:#94a3b8;font-size:11px;margin:0 0 4px 0;">${escHtml(h.agent_name)} · ${escHtml(h.response_type)}</p>
                <p style="color:#cbd5e1;font-size:13px;line-height:1.5;margin:0;font-style:italic;">&ldquo;${escHtml(h.snippet.slice(0, 160))}${h.snippet.length > 160 ? "…" : ""}&rdquo;</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
    })
    .join("");

  const podActivityRows = digest.pod_changes
    .slice(0, 4)
    .map(
      (pc) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #334155;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td><span style="color:#e2e8f0;font-size:13px;">${escHtml(pc.pod_name)}</span></td>
            <td align="right"><span style="color:#60a5fa;font-size:12px;font-weight:600;">+${pc.new_assumptions} insight${pc.new_assumptions !== 1 ? "s" : ""}</span></td>
          </tr>
        </table>
      </td>
    </tr>
  `
    )
    .join("");

  const html = emailBase(`
    <div style="padding:32px;">
      <p style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 16px 0;">Weekly Digest</p>
      <h1 style="color:#f8fafc;font-size:24px;font-weight:700;margin:0 0 8px 0;line-height:1.3;">Your week on Poddle</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 28px 0;">Hi ${escHtml(recipientName)}, here's what happened in your decision rooms this week.</p>

      ${
        digest.summary_text
          ? `<div style="background:#0f172a;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
        <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0;">${escHtml(digest.summary_text)}</p>
      </div>`
          : ""
      }

      ${
        topInsightsRows
          ? `<h2 style="color:#f8fafc;font-size:15px;font-weight:700;margin:0 0 4px 0;">Top insights</h2>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        ${topInsightsRows}
      </table>`
          : ""
      }

      ${
        aiHighlightsRows
          ? `<h2 style="color:#f8fafc;font-size:15px;font-weight:700;margin:0 0 4px 0;">AI highlights</h2>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        ${aiHighlightsRows}
      </table>`
          : ""
      }

      ${
        podActivityRows
          ? `<h2 style="color:#f8fafc;font-size:15px;font-weight:700;margin:0 0 4px 0;">Decision activity</h2>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        ${podActivityRows}
      </table>`
          : ""
      }

      ${ctaButton("Open Poddle", APP_URL)}
    </div>
  `);

  return { subject, html };
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  resendKey: string
): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Poddle <notifications@poddleme.com>",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Email send failed [${res.status}]:`, err);
    throw new Error(`Resend error ${res.status}`);
  }

  const result = await res.json();
  console.log(`Email sent: ${result.id}`);
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();
    const {
      type,
      recipientUserId,
      actorName,
      podName,
      podId,
      assumptionSnippet,
      digestData,
    } = payload;

    if (!recipientUserId || !type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, recipientUserId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, message: "Email service not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email_notifications_enabled, full_name, first_name")
      .eq("id", recipientUserId)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Recipient profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.email_notifications_enabled) {
      return new Response(
        JSON.stringify({ message: "User has email notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(recipientUserId);
    if (!authUser?.user?.email) {
      return new Response(
        JSON.stringify({ error: "Could not retrieve user email" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipientEmail = authUser.user.email;
    const recipientName =
      profile.first_name || profile.full_name?.split(" ")[0] || "there";

    let subject = "";
    let html = "";

    switch (type) {
      case "insight_added": {
        const result = buildInsightAddedEmail(
          recipientName,
          actorName || "Someone",
          podName || "your decision room",
          assumptionSnippet || "",
          podId || ""
        );
        subject = result.subject;
        html = result.html;
        break;
      }

      case "mention": {
        const result = buildMentionEmail(
          recipientName,
          actorName || "Someone",
          payload.actorId || "mention",
          podId
        );
        subject = result.subject;
        html = result.html;
        break;
      }

      case "follow": {
        const result = buildFollowEmail(recipientName, actorName || "Someone");
        subject = result.subject;
        html = result.html;
        break;
      }

      case "challenge": {
        const result = buildChallengeEmail(
          recipientName,
          actorName || "Someone",
          assumptionSnippet || "",
          podName || "a decision room",
          podId || ""
        );
        subject = result.subject;
        html = result.html;
        break;
      }

      case "weekly_digest": {
        if (!digestData) {
          return new Response(
            JSON.stringify({ error: "digestData is required for weekly_digest type" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const result = buildWeeklyDigestEmail(recipientName, digestData);
        subject = result.subject;
        html = result.html;
        break;
      }

      case "message": {
        const result = buildMessageEmail(
          recipientName,
          actorName || "Someone",
          payload.messageSnippet || "",
          payload.conversationId || ""
        );
        subject = result.subject;
        html = result.html;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown notification type: ${type}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const sent = await sendEmail(recipientEmail, subject, html, RESEND_API_KEY);

    phCaptureServer("notification_email_sent", recipientUserId, {
      type,
      success: sent,
      pod_id: podId ?? null,
      assumption_id: assumptionId ?? null,
      conversation_id: conversationId ?? null,
    });

    return new Response(
      JSON.stringify({ success: sent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-notifications error:", msg);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
