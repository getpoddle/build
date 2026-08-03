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

// Scenario C — user has never created a workspace
function buildNoWorkspaceEmail(recipientName: string): string {
  const agents = [
    { name: "The Skeptic", color: "#f87171", description: "finds the fatal flaw in your thinking" },
    { name: "Risk Analyst", color: "#fbbf24", description: "puts numbers on what could go wrong" },
    { name: "The Optimist", color: "#34d399", description: "finds the upside you might be undervaluing" },
    { name: "Data Detective", color: "#60a5fa", description: "challenges assumptions that lack evidence" },
    { name: "Market Analyst", color: "#a78bfa", description: "maps competitive timing and market fit" },
    { name: "Systems Thinker", color: "#fb923c", description: "traces second and third-order consequences" },
    { name: "The Pragmatist", color: "#94a3b8", description: "tells you what can realistically ship" },
  ];

  const agentRows = agents.map((a) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #334155;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="width:14px;vertical-align:middle;">
              <span style="display:inline-block;width:8px;height:8px;background:${a.color};border-radius:50%;"></span>
            </td>
            <td style="padding-left:10px;">
              <span style="color:#f8fafc;font-size:13px;font-weight:600;">${a.name}</span>
              <span style="color:#64748b;font-size:13px;"> — ${a.description}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join("");

  return emailBase(`
    <div style="padding:32px;">
      <p style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 16px 0;">From the Poddle Team</p>
      <h1 style="color:#f8fafc;font-size:24px;font-weight:700;margin:0 0 16px 0;line-height:1.3;">Hi ${recipientName}, you haven't tried the best part of Poddle yet.</h1>
      <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 24px 0;">Most people sign up, look around, and miss the feature that makes it actually useful.</p>

      <div style="background:#0f172a;border-radius:12px;border:1px solid #334155;padding:20px 24px;margin-bottom:28px;">
        <p style="color:#f8fafc;font-size:15px;font-weight:700;margin:0 0 6px 0;">Private workspaces</p>
        <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0;">You bring a decision — a hire, a pricing call, a product pivot — and seven AI agents debate it from completely different angles. Then AI synthesizes the debate into a clear recommendation, with dissenting views kept in so you see the full picture, not just a conclusion.</p>
      </div>

      <h2 style="color:#f8fafc;font-size:15px;font-weight:700;margin:0 0 4px 0;">Your panel of seven agents</h2>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        ${agentRows}
      </table>

      <div style="background:#0f172a;border-radius:12px;border:1px solid #334155;padding:20px 24px;margin-bottom:28px;">
        <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 12px 0;">Two minutes to set up. Fully private and encrypted. Nothing inside your workspace is visible outside your team.</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:0 12px 0 0;">
              <div style="text-align:center;padding:14px 0;border-radius:8px;border:1px solid #334155;">
                <div style="color:#f8fafc;font-size:16px;font-weight:800;line-height:1;">$39</div>
                <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin-top:4px;">Pro Individual / mo</div>
              </div>
            </td>
            <td>
              <div style="text-align:center;padding:14px 0;border-radius:8px;border:1px solid #334155;">
                <div style="color:#f8fafc;font-size:16px;font-weight:800;line-height:1;">$249</div>
                <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin-top:4px;">Team Workspace / mo</div>
              </div>
            </td>
          </tr>
        </table>
      </div>

      <p style="color:#64748b;font-size:13px;margin:0 0 20px 0;">Free trial available — no card required.</p>

      <a href="${APP_URL}/workspaces" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">Create my workspace</a>
    </div>
  `);
}

// Scenario A — user has an active workspace
function buildActiveWorkspaceEmail(recipientName: string, workspaceName: string, workspaceId: string): string {
  return emailBase(`
    <div style="padding:32px;">
      <p style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 16px 0;">Weekly recap</p>
      <h1 style="color:#f8fafc;font-size:24px;font-weight:700;margin:0 0 8px 0;line-height:1.3;">Hi ${recipientName}, your workspace is ready.</h1>
      <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 28px 0;">Your AI panel in <strong style="color:#e2e8f0;">${workspaceName}</strong> is ready to take on your next decision. Bring a problem, a pivot, or a question you haven't been able to resolve — and let seven agents debate it from every angle.</p>

      <div style="background:#0f172a;border-radius:12px;border:1px solid #334155;padding:20px 24px;margin-bottom:28px;">
        <p style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 12px 0;">Try this week</p>
        <p style="color:#e2e8f0;font-size:15px;font-style:italic;line-height:1.6;margin:0;">"What is the single assumption in our current plan that would hurt most if it turned out to be wrong?"</p>
      </div>

      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 24px 0;">Put that question to your War Room. The Skeptic, Risk Analyst, and the rest of your panel will each attack it from a different direction. You'll have a synthesis in minutes.</p>

      <a href="${APP_URL}/workspaces/${workspaceId}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">Open my workspace</a>
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

    // Fetch all real users with email notifications enabled
    const { data: realUsers, error: recipientsError } = await supabase.rpc("get_digest_recipients");
    if (recipientsError) {
      throw new Error(`Failed to fetch recipients: ${recipientsError.message}`);
    }

    // Fetch all workspaces (owner_id + workspace id + name) in one query
    const { data: allWorkspaces } = await supabase
      .from("workspaces")
      .select("id, name, owner_id")
      .order("created_at", { ascending: true });

    // Build a map: user_id → first workspace they own
    const workspaceByOwner: Record<string, { id: string; name: string }> = {};
    for (const ws of allWorkspaces || []) {
      if (!workspaceByOwner[ws.owner_id]) {
        workspaceByOwner[ws.owner_id] = { id: ws.id, name: ws.name };
      }
    }

    const results: { email: string; status: string; template?: string; error?: string }[] = [];

    for (const user of realUsers) {
      try {
        const name = user.first_name || user.full_name?.split(" ")[0] || "there";
        const workspace = workspaceByOwner[user.user_id];

        let subject: string;
        let html: string;
        let template: string;

        if (!workspace) {
          // Scenario C: no workspace — activation email
          subject = "You haven't tried the best part of Poddle yet";
          html = buildNoWorkspaceEmail(name);
          template = "no_workspace";
        } else {
          // Scenario A: has a workspace — weekly prompt
          subject = `Your Poddle workspace is ready, ${name}`;
          html = buildActiveWorkspaceEmail(name, workspace.name, workspace.id);
          template = "active_workspace";
        }

        await sendEmail(user.email, subject, html, RESEND_API_KEY);
        results.push({ email: user.email, status: "sent", template });
        phCaptureServer("weekly_digest_sent", user.user_id ?? user.email, {
          template,
          has_workspace: !!workspace,
        });

        // Small delay to avoid Resend rate limits
        await new Promise((r) => setTimeout(r, 120));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Failed for ${user.email}:`, msg);
        results.push({ email: user.email, status: "failed", error: msg });
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const noWorkspace = results.filter((r) => r.template === "no_workspace").length;
    const activeWorkspace = results.filter((r) => r.template === "active_workspace").length;

    console.log(`Weekly digest complete: ${sent} sent (${noWorkspace} activation, ${activeWorkspace} workspace recap), ${failed} failed`);
    phCaptureServer("weekly_digest_run_completed", "system", {
      sent,
      failed,
      no_workspace: noWorkspace,
      active_workspace: activeWorkspace,
    });

    return new Response(
      JSON.stringify({ success: true, sent, failed, no_workspace: noWorkspace, active_workspace: activeWorkspace, results }),
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
