import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FREE_TRIAL_LIMIT = 2;
const TRIAL_DAYS = 7;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, description, domain, plan, seats } = await req.json();

    if (!name || !name.trim()) {
      return new Response(JSON.stringify({ error: "Workspace name is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check user's subscription status and trial usage in parallel
    const [profileRes, existingPaidWsRes, ownedWsCountRes] = await Promise.all([
      service.from("profiles").select("subscription_tier, trial_workspace_count").eq("id", user.id).maybeSingle(),
      service
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .not("stripe_subscription_id", "is", null)
        .in("subscription_status", ["active", "trialing"])
        .limit(1),
      service
        .from("workspaces")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id),
    ]);

    const profileTier = profileRes.data?.subscription_tier;
    const trialWorkspaceCount = profileRes.data?.trial_workspace_count ?? 0;
    const hasPaidProfile = profileTier === "pro" || profileTier === "enterprise";
    const hasPaidWorkspace = (existingPaidWsRes.data?.length ?? 0) > 0;
    const isPaid = hasPaidProfile || hasPaidWorkspace;

    // Use the higher of the DB count and the stored counter to handle
    // pre-migration workspaces that were never counted in trial_workspace_count.
    const actualOwnedCount = ownedWsCountRes.count ?? 0;
    const effectiveTrialCount = Math.max(trialWorkspaceCount, actualOwnedCount);

    // Free trial path: user has no paid subscription
    if (!isPaid) {
      if (effectiveTrialCount >= FREE_TRIAL_LIMIT) {
        return new Response(
          JSON.stringify({
            error: "You've used both free trial workspaces. Upgrade to Pro to create more.",
            errorCode: "TRIAL_EXHAUSTED",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Determine workspace creation params based on paid vs trial
    const trialExpiresAt = !isPaid
      ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data: ws, error: wsError } = await service
      .from("workspaces")
      .insert({
        name: name.trim(),
        description: (description || "").trim(),
        domain: domain || "general",
        owner_id: user.id,
        plan: plan || "pro",
        seats: seats || 5,
        workspace_type: "encrypted",
        is_encrypted: true,
        subscription_status: isPaid ? "active" : "trialing",
        trial_workspace_expires_at: trialExpiresAt,
      })
      .select()
      .single();

    if (wsError || !ws) {
      return new Response(JSON.stringify({ error: "Failed to create workspace.", detail: wsError?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add creator as owner
    const { error: memberError } = await service
      .from("workspace_members")
      .insert({
        workspace_id: ws.id,
        user_id: user.id,
        role: "owner",
      });

    if (memberError) {
      await service.from("workspaces").delete().eq("id", ws.id);
      return new Response(JSON.stringify({ error: "Failed to set workspace owner.", detail: memberError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Increment trial_workspace_count for free tier users
    if (!isPaid) {
      await service
        .from("profiles")
        .update({ trial_workspace_count: effectiveTrialCount + 1 })
        .eq("id", user.id);
    }

    return new Response(JSON.stringify({ workspace: ws }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
