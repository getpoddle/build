import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { isInviteUsable, emailMatchesInvite, hasSeatAvailable } from "../_shared/inviteLogic.ts";
import { buildInviteAcceptedEmail } from "../_shared/emailTemplates.ts";

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

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user JWT using service role (avoids a second round-trip to auth server)
    const { data: { user }, error: authError } = await service.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
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

    // Fetch invite + workspace in one query via join
    const { data: invite, error: inviteErr } = await service
      .from("workspace_invites")
      .select("id, workspace_id, invited_email, invited_by, expires_at, accepted_at, workspaces(seats, subscription_status, stripe_subscription_id)")
      .eq("token", token)
      .maybeSingle();

    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: "Invalid invite token" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const usable = isInviteUsable({ acceptedAt: invite.accepted_at, expiresAt: invite.expires_at });
    if (!usable.ok && usable.reason === "already_accepted") {
      return new Response(JSON.stringify({ error: "Invite already accepted", workspace_id: invite.workspace_id }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!usable.ok && usable.reason === "expired") {
      return new Response(JSON.stringify({ error: "Invite has expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the authenticated user's email matches the invited email.
    // This prevents anyone who obtains the invite URL from joining with a
    // different account.
    if (!emailMatchesInvite(user.email ?? "", invite.invited_email ?? "")) {
      return new Response(
        JSON.stringify({ error: "This invite was sent to a different email address. Please sign in with the account that received the invitation." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check already a member + current member count in parallel
    const [existingRes, memberCountRes] = await Promise.all([
      service
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", invite.workspace_id)
        .eq("user_id", user.id)
        .maybeSingle(),
      service
        .from("workspace_members")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", invite.workspace_id),
    ]);

    if (existingRes.data) {
      return new Response(JSON.stringify({ already_member: true, workspace_id: invite.workspace_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce seat limit
    const workspace = Array.isArray(invite.workspaces) ? invite.workspaces[0] : invite.workspaces as { seats: number; subscription_status: string; stripe_subscription_id: string | null } | null;
    const seats = workspace?.seats ?? 3;
    const currentMembers = memberCountRes.count ?? 0;

    if (!hasSeatAvailable(currentMembers, seats)) {
      return new Response(JSON.stringify({ error: "This workspace has reached its member limit." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add member + mark invite accepted in parallel
    const [memberRes] = await Promise.all([
      service
        .from("workspace_members")
        .insert({ workspace_id: invite.workspace_id, user_id: user.id, role: "member" }),
      service
        .from("workspace_invites")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invite.id),
    ]);

    if (memberRes.error) {
      return new Response(JSON.stringify({ error: "Failed to add member", detail: memberRes.error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Notify the inviter that their invite was accepted ──
    try {
      const { data: workspaceRow } = await service
        .from("workspaces")
        .select("name")
        .eq("id", invite.workspace_id)
        .maybeSingle();

      const { data: accepterProfile } = await service
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      const { data: inviterProfile } = await service
        .from("profiles")
        .select("full_name, email")
        .eq("id", invite.invited_by)
        .maybeSingle();

      if (inviterProfile) {
        const accepterName = accepterProfile?.full_name || accepterProfile?.email || "A team member";
        const wsName = workspaceRow?.name || "your workspace";

        // In-app notification
        await service.from("notifications").insert({
          user_id: invite.invited_by,
          type: "workspace_invite_accepted",
          title: `${accepterName} accepted your invitation`,
          content: `${accepterName} joined ${wsName}.`,
          related_id: invite.workspace_id,
          related_type: "workspace",
          actor_id: user.id,
          is_read: false,
        });

        // Email notification via Resend
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey && inviterProfile.email) {
          const html = buildInviteAcceptedEmail(
            inviterProfile.full_name || inviterProfile.email,
            accepterName,
            wsName,
          );
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Poddle <hello@poddleme.com>",
              to: [inviterProfile.email],
              subject: `${accepterName} accepted your workspace invitation`,
              html,
            }),
          });
        }
      }
    } catch (notifErr) {
      console.error("Failed to send invite-accepted notification:", notifErr);
    }

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
