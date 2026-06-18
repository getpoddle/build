import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const APP_URL = Deno.env.get("APP_URL") || "https://poddleme.com";

function buildWelcomeEmail(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Welcome to Poddle</title>
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
            <div style="padding:40px 32px;">
              <p style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 20px 0;">Welcome to Poddle</p>
              <h1 style="color:#f8fafc;font-size:24px;font-weight:700;margin:0 0 12px 0;line-height:1.3;">You're in, ${firstName}!</h1>
              <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 28px 0;">
                Poddle is where assumptions get challenged, ideas get sharper, and decisions get better. Dive in.
              </p>
              <a href="${APP_URL}"
                style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:-0.1px;">
                Go to Poddle
              </a>
              <p style="color:#475569;font-size:12px;margin:28px 0 0 0;line-height:1.6;">
                If you didn't create a Poddle account, you can safely ignore this email.
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding-top:24px;text-align:center;">
            <p style="color:#475569;font-size:12px;margin:0;">
              &copy; 2026 Poddle &mdash; <a href="${APP_URL}" style="color:#64748b;text-decoration:underline;">poddleme.com</a>
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getUserWithRetry(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  attempts = 3,
  delayMs = 1000
) {
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(delayMs);
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!error && data?.user?.email) return data.user;
    console.warn(`getUserById attempt ${i + 1} failed:`, error?.message);
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
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

    const user = await getUserWithRetry(supabaseAdmin, userId);
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found after retries" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstName =
      user.user_metadata?.first_name ||
      user.email!.split("@")[0];

    const html = buildWelcomeEmail(firstName);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poddle <notifications@poddleme.com>",
        to: user.email,
        subject: `Welcome to Poddle, ${firstName}!`,
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
    console.log(`Welcome email sent: ${result.id} → ${user.email}`);

    return new Response(
      JSON.stringify({ success: true, recipient: user.email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-signup-confirmation error:", msg);
    return new Response(JSON.stringify({ error: "Unexpected error", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
