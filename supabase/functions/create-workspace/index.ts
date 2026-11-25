import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TRIAL_DURATION_DAYS = 7;
const TRIAL_WORKSPACE_LIMIT = 3;

function trialExpiryISO(): string {
  return new Date(Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
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

    const { name, description, domain, plan, organization_id, decision_origin, decision_origin_model, decision_source_system, decision_external_reference, decision_model_version, decision_original_at } = await req.json();
    const origins = ['openai', 'anthropic', 'google', 'microsoft', 'internal_ai', 'human', 'other'];
    const external = decision_origin !== undefined && decision_origin !== null;
    if (organization_id != null && (!external || typeof organization_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organization_id))) {
      return new Response(JSON.stringify({ error: 'Invalid organization selection.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if ((external && (!origins.includes(decision_origin) || typeof description !== 'string' || !description.trim() || description.length > 20000)) ||
        (decision_origin_model != null && (!external || decision_origin === 'human' || typeof decision_origin_model !== 'string' || !decision_origin_model.trim() || decision_origin_model.length > 200))) {
      return new Response(JSON.stringify({ error: 'Invalid external decision details.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (typeof name !== "string" || !name.trim() || (external && name.length > 200)) {
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
    const [profileRes, paidWsRes, betaRes, complimentaryRes] = await Promise.all([
      service
        .from("profiles")
        .select("subscription_tier, trial_workspace_count")
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
      service.from("complimentary_access_grants")
        .select("plan")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .maybeSingle(),
    ]);

    if (complimentaryRes.error) {
      console.error("complimentary access lookup failed", complimentaryRes.error.message);
      return new Response(JSON.stringify({ error: "Unable to verify account access." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profileTier = profileRes.data?.subscription_tier;
    const trialCount = profileRes.data?.trial_workspace_count ?? 0;

    const hasPaidProfile = profileTier === "team" || profileTier === "business" || profileTier === "enterprise";
    const hasPaidWorkspace = (paidWsRes.data?.length ?? 0) > 0;

    // Beta access grants unlimited workspace creation for the grant duration
    const betaGrant = betaRes.data;
    const hasBetaAccess = !!betaGrant && new Date(betaGrant.expires_at) > new Date();

    const isPaid = hasPaidProfile || hasPaidWorkspace || hasBetaAccess || !!complimentaryRes.data?.plan;

    // Trial workspace gate: up to 3 trial workspaces per user.
    if (!isPaid && trialCount >= TRIAL_WORKSPACE_LIMIT) {
      return new Response(
        JSON.stringify({
          error: `You've reached the ${TRIAL_WORKSPACE_LIMIT}-workspace trial limit. Upgrade to Pro for unlimited workspaces.`,
          errorCode: "TRIAL_LIMIT_REACHED",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Trial workspaces expire in 7 days; beta users get their grant expiry.
    const trialExpiresAt = hasBetaAccess
      ? betaGrant!.expires_at
      : !isPaid
        ? trialExpiryISO()
        : null;

    // Seats are determined by plan — never trust client-provided value
    const resolvedPlan = plan === "business" ? "business" : "team";
    const resolvedSeats = resolvedPlan === "business" ? 100 : 10;

    if (external) {
      const optional = [[decision_source_system,200],[decision_external_reference,500],[decision_model_version,200]] as const;
      if (optional.some(([value,max]) => value != null && (typeof value !== 'string' || value.length > max)) ||
          (decision_origin === 'human' && decision_model_version) ||
          (decision_original_at != null && (typeof decision_original_at !== 'string' || !Number.isFinite(Date.parse(decision_original_at)) || Date.parse(decision_original_at) > Date.now()))) {
        return new Response(JSON.stringify({error:'Invalid provenance details.'}), {status:400,headers:{...corsHeaders,'Content-Type':'application/json'}});
      }
      if (profileRes.error || paidWsRes.error || betaRes.error) return new Response(JSON.stringify({error:'Unable to verify account access.'}),{status:503,headers:{...corsHeaders,'Content-Type':'application/json'}});
      const {data: workspace,error} = await service.rpc('create_external_decision_atomic', {
        p_actor:user.id,p_paid:isPaid,p_expiry:trialExpiresAt,p_plan:resolvedPlan,
        p_details:{name,description,domain:'general',organization_id:organization_id ?? null,decision_origin,decision_origin_model,decision_source_system,decision_external_reference,decision_model_version,decision_original_at}
      });
      if (error || !workspace?.id) {
        console.error('Atomic external registration failed',error?.message);
        if (error?.code === '42501') return new Response(JSON.stringify({error:'You are not authorized to register this decision in the selected organization.'}),{status:403,headers:{...corsHeaders,'Content-Type':'application/json'}});
        return new Response(JSON.stringify({error:'Decision registration failed. Refresh the ledger before retrying.'}),{status:500,headers:{...corsHeaders,'Content-Type':'application/json'}});
      }
      return new Response(JSON.stringify({workspace}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
    }

    const { data: ws, error: wsError } = await service
      .from("workspaces")
      .insert({
        name: name.trim(),
        ...(external ? { decision_origin, decision_origin_model: decision_origin_model?.trim() || null } : {}),
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
      console.error("create-workspace: workspace insert error", wsError?.message);
      return new Response(JSON.stringify({ error: "Failed to create workspace." }), {
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
      console.error("create-workspace: member insert error", memberError.message);
      return new Response(JSON.stringify({ error: "Failed to set workspace owner." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Decision Audit Trail: log this workspace's creation as decision_created ──
    // Fire-and-forget: never blocks or fails workspace creation itself.
    await service.from("decision_events").insert({
      workspace_id: ws.id,
      event_type: "decision_created",
      actor_type: "user",
      actor_id: user.id,
      payload: {
        question: ws.name,
        description: ws.description,
        domain: ws.domain,
        created_by: user.id,
        ...(external ? { decision_origin, decision_origin_model: decision_origin_model?.trim() || null, attribution: 'self_reported' } : {}),
      },
    }).then(({ error }) => { if (error) console.error("Decision event insert error:", error); });

    // Increment trial_workspace_count so the 3-workspace limit is enforced.
    if (!isPaid) {
      await service
        .from("profiles")
        .update({ trial_workspace_count: trialCount + 1 })
        .eq("id", user.id);
    }

    return new Response(JSON.stringify({ workspace: ws }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-workspace: unhandled error", String(err));
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
