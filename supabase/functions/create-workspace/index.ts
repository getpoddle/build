import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function currentYYYYMM(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function endOfCurrentMonthISO(): string {
  const now = new Date();
  // Day 0 of next month = last day of current month
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return last.toISOString();
}

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

    const { name, description, domain, plan } = await req.json();

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

    // Fetch profile, any Stripe-backed paid workspace, and beta access in parallel.
    const [profileRes, paidWsRes, betaRes] = await Promise.all([
      service
        .from("profiles")
        .select("subscription_tier, free_workspace_month")
        .eq("id", user.id)
        .maybeSingle(),
      // A "paid" workspace must have an active Stripe subscription.
      service
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .not("stripe_subscription_id", "is", null)
        .eq("subscription_status", "active")
        .limit(1),
      service
        .from("beta_access_grants")
        .select("expires_at, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle(),
    ]);

    const profileTier = profileRes.data?.subscription_tier;
    const freeWorkspaceMonth = profileRes.data?.free_workspace_month ?? null;

    const hasPaidProfile = profileTier === "pro" || profileTier === "enterprise";
    const hasPaidWorkspace = (paidWsRes.data?.length ?? 0) > 0;

    // Beta access grants unlimited workspace creation for the grant duration
    const betaGrant = betaRes.data;
    const hasBetaAccess = !!betaGrant && new Date(betaGrant.expires_at) > new Date();

    const isPaid = hasPaidProfile || hasPaidWorkspace || hasBetaAccess;

    // Monthly free workspace gate: 1 free workspace per calendar month.
    if (!isPaid) {
      const thisMonth = currentYYYYMM();
      if (freeWorkspaceMonth === thisMonth) {
        return new Response(
          JSON.stringify({
            error: "You've already created your free workspace this month. Upgrade to Pro for unlimited workspaces.",
            errorCode: "MONTHLY_LIMIT_REACHED",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Free workspaces expire at end of month; beta users get their grant expiry.
    const trialExpiresAt = hasBetaAccess
      ? betaGrant!.expires_at
      : !isPaid
        ? endOfCurrentMonthISO()
        : null;

    // Seats are determined by plan — never trust client-provided value
    const resolvedPlan = plan === "team" ? "team" : "pro";
    const resolvedSeats = resolvedPlan === "team" ? 10 : 3;

    const { data: ws, error: wsError } = await service
      .from("workspaces")
      .insert({
        name: name.trim(),
        description: (description || "").trim(),
        domain: domain || "general",
        owner_id: user.id,
        plan: resolvedPlan,
        seats: resolvedSeats,
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

    // Add creator as owner member.
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

    // Stamp free_workspace_month so the monthly limit is enforced next time.
    if (!isPaid) {
      await service
        .from("profiles")
        .update({ free_workspace_month: currentYYYYMM() })
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
