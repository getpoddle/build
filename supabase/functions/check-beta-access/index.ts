import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the user's JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: grant, error: grantErr } = await admin
      .from("beta_access_grants")
      .select("id, expires_at, status, granted_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (grantErr) {
      console.error("check-beta-access db error:", grantErr);
      return new Response(
        JSON.stringify({ hasBetaAccess: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!grant) {
      return new Response(
        JSON.stringify({ hasBetaAccess: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = new Date();
    const expiresAt = new Date(grant.expires_at);
    const isExpired = expiresAt <= now;

    // Auto-flip expired grants
    if (isExpired && grant.status === "active") {
      await admin
        .from("beta_access_grants")
        .update({ status: "expired" })
        .eq("id", grant.id);

      return new Response(
        JSON.stringify({ hasBetaAccess: false, expired: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (grant.status !== "active" || isExpired) {
      return new Response(
        JSON.stringify({ hasBetaAccess: false, expired: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const msRemaining = expiresAt.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

    return new Response(
      JSON.stringify({
        hasBetaAccess: true,
        expiresAt: grant.expires_at,
        daysRemaining,
        grantedAt: grant.granted_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("check-beta-access error:", err);
    return new Response(
      JSON.stringify({ hasBetaAccess: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
