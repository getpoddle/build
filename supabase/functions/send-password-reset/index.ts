import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildPasswordResetEmail, APP_URL } from "../_shared/emailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
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
    const MIN_RESPONSE_MS = 800;
    const reqStart = Date.now();
    const minDelay = () => {
      const elapsed = Date.now() - reqStart;
      const remaining = MIN_RESPONSE_MS - elapsed;
      return remaining > 0 ? new Promise(r => setTimeout(r, remaining)) : Promise.resolve();
    };

    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const ip = getClientIp(req);
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

    const { count, error: countError } = await supabaseAdmin
      .from("password_reset_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ip)
      .gte("attempted_at", windowStart);

    if (countError) {
      return new Response(JSON.stringify({ error: "Server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": "3600",
          },
        }
      );
    }

    await supabaseAdmin.from("password_reset_attempts").insert({ ip_address: ip });

    await supabaseAdmin
      .from("password_reset_attempts")
      .delete()
      .lt("attempted_at", new Date(Date.now() - RATE_LIMIT_WINDOW_MS * 24).toISOString());

    const emailLower = email.toLowerCase().trim();

    // Generate a password recovery link via the admin API.
    // This produces a one-time link that Supabase exchanges for a session
    // when the user clicks it, landing them on the reset password page.
    const { data, error: generateError } = await supabaseAdmin.auth.admin
      .generateLink({
        type: "recovery",
        email: emailLower,
        options: {
          redirectTo: `${APP_URL}/reset-password`,
        },
      });

    if (generateError || !data?.user?.email) {
      // User doesn't exist or link generation failed — return success to
      // prevent email enumeration (same as the original behavior).
      await minDelay();
      return new Response(
        JSON.stringify({ sent: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // data.properties.action_link is the recovery URL Supabase generated.
    const resetUrl = data.properties?.action_link;
    if (!resetUrl) {
      console.error("generateLink returned no action_link");
      await minDelay();
      return new Response(
        JSON.stringify({ sent: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firstName = data.user.user_metadata?.first_name || emailLower.split("@")[0] || "there";
    const html = buildPasswordResetEmail(firstName, resetUrl);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poddle <notifications@poddleme.com>",
        to: emailLower,
        subject: "Reset your password — Poddle",
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error (password reset):", err);
      await minDelay();
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Password reset email sent to ${emailLower}`);
    await minDelay();
    return new Response(
      JSON.stringify({ sent: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
