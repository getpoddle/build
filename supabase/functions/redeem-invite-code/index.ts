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
    // Authenticate the caller
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

    // Parse body
    const body = await req.json().catch(() => ({}));
    const rawCode = (body.code ?? "").toString().trim().toUpperCase();
    if (!rawCode) {
      return new Response(
        JSON.stringify({ error: "Invite code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Use service role for all DB operations
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Check if user already has a beta grant
    const { data: existingGrant } = await admin
      .from("beta_access_grants")
      .select("id, status, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingGrant) {
      if (existingGrant.status === "active" && new Date(existingGrant.expires_at) > new Date()) {
        return new Response(
          JSON.stringify({ error: "You already have active beta access.", alreadyActive: true }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // Expired or converted — allow re-evaluation but still block a second redemption
      return new Response(
        JSON.stringify({ error: "You have already redeemed an invite code.", alreadyRedeemed: true }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Look up the invite code (case-insensitive, already uppercased)
    const { data: inviteCode, error: codeErr } = await admin
      .from("invite_codes")
      .select("id, code, max_uses, use_count, expires_at")
      .eq("code", rawCode)
      .maybeSingle();

    if (codeErr || !inviteCode) {
      return new Response(
        JSON.stringify({ error: "Invalid invite code. Please check and try again." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check code-level expiry
    if (inviteCode.expires_at && new Date(inviteCode.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This invite code has expired." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check use count
    if (inviteCode.use_count >= inviteCode.max_uses) {
      return new Response(
        JSON.stringify({ error: "This invite code has reached its maximum number of uses." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Grant beta access: expires_at = now + 60 days
    const grantedAt = new Date();
    const expiresAt = new Date(grantedAt.getTime() + 60 * 24 * 60 * 60 * 1000);

    const { error: insertErr } = await admin
      .from("beta_access_grants")
      .insert({
        user_id: user.id,
        invite_code_id: inviteCode.id,
        granted_at: grantedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: "active",
      });

    if (insertErr) {
      console.error("Failed to insert beta grant:", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to redeem code. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Increment use_count
    await admin
      .from("invite_codes")
      .update({ use_count: inviteCode.use_count + 1 })
      .eq("id", inviteCode.id);

    return new Response(
      JSON.stringify({
        success: true,
        expiresAt: expiresAt.toISOString(),
        daysGranted: 60,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("redeem-invite-code error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
