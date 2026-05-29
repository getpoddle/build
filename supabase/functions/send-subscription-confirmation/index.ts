import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const APP_URL = Deno.env.get("APP_URL") || "https://poddleme.com";

function buildSubscriptionEmail(firstName: string, plan: string, workspaceName: string): string {
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Your ${planLabel} subscription is active</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
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
            <!-- Header band -->
            <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:32px 32px 28px;">
              <p style="color:rgba(255,255,255,0.65);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px 0;">Subscription Confirmed</p>
              <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0;line-height:1.2;">Welcome to ${planLabel}, ${firstName}!</h1>
            </div>
            <!-- Body -->
            <div style="padding:32px;">
              <p style="color:#94a3b8;font-size:15px;line-height:1.65;margin:0 0 24px 0;">
                Your <strong style="color:#e2e8f0;">${planLabel} subscription</strong> is now active. Your private workspace
                <strong style="color:#e2e8f0;">"${workspaceName}"</strong> has been created and is ready for your team.
              </p>

              <!-- What's unlocked -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;border-radius:12px;border:1px solid #1e293b;margin-bottom:28px;">
                <tr><td style="padding:20px 24px;">
                  <p style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px 0;">What you've unlocked</p>
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr><td style="padding:5px 0;color:#cbd5e1;font-size:14px;">&#10003;&nbsp;&nbsp;Encrypted private workspace</td></tr>
                    <tr><td style="padding:5px 0;color:#cbd5e1;font-size:14px;">&#10003;&nbsp;&nbsp;AI agents debate your proprietary ideas</td></tr>
                    <tr><td style="padding:5px 0;color:#cbd5e1;font-size:14px;">&#10003;&nbsp;&nbsp;Invite your team members</td></tr>
                    <tr><td style="padding:5px 0;color:#cbd5e1;font-size:14px;">&#10003;&nbsp;&nbsp;War Room intelligence synthesis</td></tr>
                  </table>
                </td></tr>
              </table>

              <a href="${APP_URL}/#workspaces"
                style="display:inline-block;background:linear-gradient(135deg,#1e3a5f,#2563eb);color:#ffffff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:-0.1px;">
                Open your workspace &rarr;
              </a>

              <p style="color:#475569;font-size:12px;margin:28px 0 0 0;line-height:1.6;">
                Questions? Reply to this email or visit <a href="${APP_URL}/#contact-us" style="color:#64748b;">our support page</a>.
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding-top:24px;text-align:center;">
            <p style="color:#475569;font-size:12px;margin:0;">
              &copy; 2026 Poddle, Inc. &mdash; <a href="${APP_URL}" style="color:#64748b;text-decoration:underline;">poddleme.com</a>
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { userId, plan, workspaceName } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured — skipping subscription confirmation email");
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

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!authUser?.user?.email) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = authUser.user.email;
    const firstName =
      authUser.user.user_metadata?.first_name ||
      email.split("@")[0];

    const resolvedPlan = plan || "pro";
    const resolvedWorkspaceName = workspaceName || "My Workspace";
    const planLabel = resolvedPlan.charAt(0).toUpperCase() + resolvedPlan.slice(1);

    const html = buildSubscriptionEmail(firstName, resolvedPlan, resolvedWorkspaceName);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poddle <notifications@poddleme.com>",
        to: email,
        subject: `Your ${planLabel} subscription is active — welcome to Poddle Pro!`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return new Response(JSON.stringify({ error: "Failed to send email", detail: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await res.json();
    console.log(`Subscription confirmation sent: ${result.id} → ${email}`);

    return new Response(
      JSON.stringify({ success: true, recipient: email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-subscription-confirmation error:", msg);
    return new Response(JSON.stringify({ error: "Unexpected error", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
