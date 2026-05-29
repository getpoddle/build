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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user JWT
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

    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing invite token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch invite
    const { data: invite, error: inviteErr } = await service
      .from("workspace_invites")
      .select("id, workspace_id, invited_email, expires_at, accepted_at")
      .eq("token", token)
      .maybeSingle();

    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: "Invalid invite token" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.accepted_at) {
      return new Response(JSON.stringify({ error: "Invite already accepted", workspace_id: invite.workspace_id }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Invite has expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check already a member
    const { data: existing } = await service
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", invite.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ already_member: true, workspace_id: invite.workspace_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add member
    const { error: memberErr } = await service
      .from("workspace_members")
      .insert({ workspace_id: invite.workspace_id, user_id: user.id, role: "member" });

    if (memberErr) {
      return new Response(JSON.stringify({ error: "Failed to add member", detail: memberErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If the workspace is a trial workspace, consume one trial slot for the invitee
    // BEFORE marking the invite as accepted, so a failure here is fully recoverable.
    const { data: workspace, error: wsErr } = await service
      .from("workspaces")
      .select("subscription_status, stripe_subscription_id")
      .eq("id", invite.workspace_id)
      .maybeSingle();

    if (!wsErr && workspace) {
      const isTrialWorkspace =
        workspace.subscription_status === "trialing" &&
        !workspace.stripe_subscription_id;

      if (isTrialWorkspace) {
        const { data: profile } = await service
          .from("profiles")
          .select("trial_workspace_count, subscription_tier")
          .eq("id", user.id)
          .maybeSingle();

        const inviteeTier = profile?.subscription_tier;
        const isPaid = inviteeTier === "pro" || inviteeTier === "enterprise";

        if (!isPaid) {
          const currentCount = profile?.trial_workspace_count ?? 0;
          await service
            .from("profiles")
            .update({ trial_workspace_count: currentCount + 1 })
            .eq("id", user.id);
        }
      }
    }

    // Mark invite accepted
    await service
      .from("workspace_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    return new Response(JSON.stringify({ success: true, workspace_id: invite.workspace_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
