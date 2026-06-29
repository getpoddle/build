import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isSafeRedirect(redirectTo: string | undefined): boolean {
  if (!redirectTo) return true;
  const allowed = [
    Deno.env.get("SITE_URL") || "",
    Deno.env.get("SUPABASE_URL") || "",
  ].filter(Boolean);
  try {
    const target = new URL(redirectTo);
    return allowed.some((a) => {
      try { return new URL(a).host === target.host; } catch { return false; }
    });
  } catch {
    return false;
  }
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
    // Enforce a minimum response time to prevent timing-based email enumeration.
    // Both the "user exists" and "user not found" paths complete in ≥ MIN_RESPONSE_MS.
    const MIN_RESPONSE_MS = 800;
    const reqStart = Date.now();
    const minDelay = () => {
      const elapsed = Date.now() - reqStart;
      const remaining = MIN_RESPONSE_MS - elapsed;
      return remaining > 0 ? new Promise(r => setTimeout(r, remaining)) : Promise.resolve();
    };

    const { email, redirectTo } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (redirectTo && !isSafeRedirect(redirectTo)) {
      return new Response(JSON.stringify({ error: "Invalid redirect URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();

    if (users) {
      const userExists = users.users.some((u) => u.email?.toLowerCase() === emailLower);
      if (userExists) {
        const safeRedirect = redirectTo || Deno.env.get("SITE_URL") || Deno.env.get("SUPABASE_URL");
        const supabasePublic = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!
        );
        await supabasePublic.auth.resetPasswordForEmail(emailLower, {
          redirectTo: safeRedirect,
        });
      }
    }

    await minDelay();
    return new Response(
      JSON.stringify({ sent: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch {
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
