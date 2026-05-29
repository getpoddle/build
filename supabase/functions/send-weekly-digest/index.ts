import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

const APP_URL = Deno.env.get("APP_URL") || "https://poddleme.com";

const WEEK_START = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

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
        <tr>
          <td style="background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">
            ${content}
          </td>
        </tr>
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
}

interface AgentPostCounts {
  breakthrough_ideas: number;
  opinions: number;
  industry_problems: number;
  total: number;
}

function buildDigestHtml(
  recipientName: string,
  topAssumptions: TopAssumption[],
  aiHighlights: AIHighlight[],
  podChanges: PodChange[],
  agentPostCounts: AgentPostCounts
): string {
  const weekLabel = new Date(WEEK_START).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const topInsightsRows = topAssumptions
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
              <p style="color:#e2e8f0;font-size:13px;line-height:1.5;margin:0 0 4px 0;">${a.content.slice(0, 140)}${a.content.length > 140 ? "…" : ""}</p>
              <div>
                <span style="color:#64748b;font-size:11px;">${a.pod_name}</span>
                ${a.challenge_count > 0 ? `<span style="color:#f59e0b;font-size:11px;margin-left:12px;">${a.challenge_count} challenge${a.challenge_count !== 1 ? "s" : ""}</span>` : ""}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    )
    .join("");

  const aiHighlightsRows = aiHighlights
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
              <td style="width:18px;vertical-align:top;padding-top:4px;">
                <span style="display:inline-block;width:8px;height:8px;background:${dotColor};border-radius:50%;"></span>
              </td>
              <td style="padding-left:4px;">
                <p style="color:#94a3b8;font-size:11px;margin:0 0 4px 0;">${h.agent_name} · ${h.response_type} · ${h.confidence_score}% confidence</p>
                <p style="color:#cbd5e1;font-size:13px;line-height:1.5;margin:0 0 4px 0;font-style:italic;">"${h.snippet.slice(0, 180)}${h.snippet.length > 180 ? "…" : ""}"</p>
                <p style="color:#475569;font-size:11px;margin:0;">on: ${h.assumption_snippet.slice(0, 80)}${h.assumption_snippet.length > 80 ? "…" : ""} · ${h.pod_name}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join("");

  const podActivityRows = podChanges
    .slice(0, 5)
    .map(
      (pc) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #334155;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td><span style="color:#e2e8f0;font-size:13px;">${pc.pod_name}</span></td>
            <td align="right"><span style="color:#60a5fa;font-size:12px;font-weight:600;">+${pc.new_assumptions} insight${pc.new_assumptions !== 1 ? "s" : ""}</span></td>
          </tr>
        </table>
      </td>
    </tr>`
    )
    .join("");

  return emailBase(`
    <div style="padding:32px;">
      <p style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 16px 0;">Weekly Digest · ${weekLabel}</p>
      <h1 style="color:#f8fafc;font-size:24px;font-weight:700;margin:0 0 8px 0;line-height:1.3;">Your week on Poddle</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 28px 0;">Hi ${recipientName}, here's what happened in your decision rooms this week.</p>

      ${topInsightsRows ? `
      <h2 style="color:#f8fafc;font-size:15px;font-weight:700;margin:0 0 4px 0;">Top insights</h2>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        ${topInsightsRows}
      </table>` : ""}

      ${aiHighlightsRows ? `
      <h2 style="color:#f8fafc;font-size:15px;font-weight:700;margin:0 0 4px 0;">AI highlights</h2>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        ${aiHighlightsRows}
      </table>` : ""}

      ${podActivityRows ? `
      <h2 style="color:#f8fafc;font-size:15px;font-weight:700;margin:0 0 4px 0;">Decision activity</h2>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        ${podActivityRows}
      </table>` : ""}

      ${agentPostCounts.total > 0 ? `
      <h2 style="color:#f8fafc;font-size:15px;font-weight:700;margin:0 0 12px 0;">AI-generated content this week</h2>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        <tr>
          <td style="padding-bottom:12px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;border-radius:12px;border:1px solid #334155;">
              <tr>
                <td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" style="padding:0 8px;border-right:1px solid #334155;">
                        <div style="color:#f8fafc;font-size:22px;font-weight:800;line-height:1;">${agentPostCounts.breakthrough_ideas}</div>
                        <div style="color:#34d399;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin-top:4px;">Breakthrough Ideas</div>
                      </td>
                      <td align="center" style="padding:0 8px;border-right:1px solid #334155;">
                        <div style="color:#f8fafc;font-size:22px;font-weight:800;line-height:1;">${agentPostCounts.opinions}</div>
                        <div style="color:#60a5fa;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin-top:4px;">Opinions</div>
                      </td>
                      <td align="center" style="padding:0 8px;">
                        <div style="color:#f8fafc;font-size:22px;font-weight:800;line-height:1;">${agentPostCounts.industry_problems}</div>
                        <div style="color:#f59e0b;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin-top:4px;">Industry Problems</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 20px 16px 20px;">
                  <p style="color:#64748b;font-size:12px;margin:0;text-align:center;">
                    Our AI agents generated <strong style="color:#94a3b8;">${agentPostCounts.total} pieces of content</strong> this week to spark discussion across the platform.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>` : ""}

      <a href="${APP_URL}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px;">Open Poddle</a>
    </div>
  `);
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  resendKey: string
): Promise<void> {
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
    throw new Error(`Resend error ${res.status} for ${to}: ${err}`);
  }

  const result = await res.json();
  console.log(`Sent digest: ${result.id} → ${to}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch real platform-wide digest data for the past 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [assumptionsRes, aiHighlightsRes, podChangesRes, agentPostsRes] = await Promise.all([
      supabase
        .from("pod_assumptions")
        .select("id, content, challenge_count, pods(name)")
        .gte("created_at", weekAgo)
        .order("challenge_count", { ascending: false })
        .limit(3),

      supabase
        .from("agent_responses")
        .select("content, response_type, confidence_score, display_name, assumption_id, pod_assumptions(content, pods(name))")
        .gte("created_at", weekAgo)
        .gte("confidence_score", 75)
        .order("confidence_score", { ascending: false })
        .limit(3),

      supabase.rpc("get_weekly_pod_activity"),

      supabase
        .from("posts")
        .select("post_type")
        .eq("is_agent_post", true)
        .gte("created_at", weekAgo),
    ]);

    // Fallback for pod activity if RPC not available
    let podChanges: PodChange[] = [];
    if (podChangesRes.error || !podChangesRes.data) {
      const { data: rawPods } = await supabase
        .from("pod_assumptions")
        .select("pod_id, pods(name)")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const podMap: Record<string, { name: string; count: number }> = {};
      for (const row of rawPods || []) {
        const pod = row.pods as unknown as { name: string } | null;
        if (!pod || !row.pod_id) continue;
        if (!podMap[row.pod_id]) podMap[row.pod_id] = { name: pod.name, count: 0 };
        podMap[row.pod_id].count++;
      }
      podChanges = Object.entries(podMap)
        .map(([pod_id, v]) => ({ pod_id, pod_name: v.name, new_assumptions: v.count }))
        .sort((a, b) => b.new_assumptions - a.new_assumptions)
        .slice(0, 5);
    } else {
      podChanges = podChangesRes.data;
    }

    const topAssumptions: TopAssumption[] = (assumptionsRes.data || []).map((row) => ({
      id: row.id,
      content: row.content,
      challenge_count: row.challenge_count || 0,
      pod_name: (row.pods as unknown as { name: string } | null)?.name || "Unknown Pod",
    }));

    const aiHighlights: AIHighlight[] = (aiHighlightsRes.data || []).map((row) => {
      const assumption = row.pod_assumptions as unknown as {
        content: string;
        pods: { name: string } | null;
      } | null;
      return {
        agent_name: row.display_name || "AI Agent",
        response_type: row.response_type,
        snippet: row.content,
        confidence_score: row.confidence_score,
        assumption_snippet: assumption?.content || "",
        pod_name: assumption?.pods?.name || "Unknown Pod",
      };
    });

    const agentPosts = agentPostsRes.data || [];
    const agentPostCounts: AgentPostCounts = {
      breakthrough_ideas: agentPosts.filter((p) => p.post_type === "breakthrough_idea").length,
      opinions: agentPosts.filter((p) => p.post_type === "opinion").length,
      industry_problems: agentPosts.filter((p) => p.post_type === "industry_problem").length,
      total: agentPosts.length,
    };

    const subject = `Your Poddle weekly digest — week of ${new Date(WEEK_START).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

    // Fetch all real users with emails via DB function
    const { data: realUsers, error: recipientsError } = await supabase.rpc("get_digest_recipients");
    if (recipientsError) {
      throw new Error(`Failed to fetch recipients: ${recipientsError.message}`);
    }

    const results: { email: string; status: string; error?: string }[] = [];

    for (const user of realUsers) {
      try {
        const name =
          user.first_name ||
          user.full_name?.split(" ")[0] ||
          "there";

        const html = buildDigestHtml(name, topAssumptions, aiHighlights, podChanges, agentPostCounts);
        await sendEmail(user.email, subject, html, RESEND_API_KEY);
        results.push({ email: user.email, status: "sent" });
        phCaptureServer("weekly_digest_sent", user.id ?? user.email, { week_start: WEEK_START });

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 120));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Failed for ${user.email}:`, msg);
        results.push({ email: user.email, status: "failed", error: msg });
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const skipped = results.filter((r) => r.status.startsWith("skipped")).length;
    const failed = results.filter((r) => r.status === "failed").length;

    console.log(`Weekly digest complete: ${sent} sent, ${skipped} skipped, ${failed} failed`);
    phCaptureServer("weekly_digest_run_completed", "system", {
      sent,
      skipped,
      failed,
      week_start: WEEK_START,
    });

    return new Response(
      JSON.stringify({ success: true, sent, skipped, failed, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-weekly-digest error:", msg);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
