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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { workspace_id, organization_id, emails } = body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required field: emails" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!workspace_id && !organization_id) {
      return new Response(JSON.stringify({ error: "Missing required field: workspace_id or organization_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap batch size to prevent abuse
    if (emails.length > 500) {
      return new Response(JSON.stringify({ error: "Cannot invite more than 500 people at once." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate every email: must be a string, valid format, max 254 chars (RFC 5321)
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const invalidEmails = emails.filter(
      (e: unknown) => typeof e !== "string" || e.length > 254 || !EMAIL_RE.test(e)
    );
    if (invalidEmails.length > 0) {
      return new Response(JSON.stringify({ error: `Invalid email address(es): ${invalidEmails.slice(0, 5).join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUrl = Deno.env.get("APP_URL") || "https://poddleme.com";
    const resendKey = Deno.env.get("RESEND_API_KEY");

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Organization invite path ──────────────────────────────────────────
    if (organization_id) {
      const { data: orgRole } = await supabase.rpc("get_organization_role", {
        org_id: organization_id,
        uid: user.id,
      });

      if (!orgRole || !["owner", "admin"].includes(orgRole)) {
        return new Response(JSON.stringify({ error: "Only organization owners and admins can invite members" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [{ data: organization }, { data: inviterProfile }] = await Promise.all([
        serviceSupabase.from("organizations").select("name").eq("id", organization_id).maybeSingle(),
        serviceSupabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
      ]);

      if (!organization) {
        return new Response(JSON.stringify({ error: "Organization not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const inviterName = inviterProfile?.full_name || inviterProfile?.email || "A team member";
      const results: { email: string; success: boolean; error?: string }[] = [];

      for (const email of emails) {
        try {
          const { data: inviteRows, error: inviteError } = await serviceSupabase
            .rpc("create_organization_invite", {
              p_organization_id: organization_id,
              p_email: email,
              p_role: "member",
            });

          const inviteRow = Array.isArray(inviteRows) ? inviteRows[0] : inviteRows;

          if (inviteError || !inviteRow) {
            results.push({ email, success: false, error: inviteError?.message || "Failed to create invite" });
            continue;
          }

          const inviteUrl = `${appUrl}/#join-org/${inviteRow.token}`;

          if (resendKey) {
            const emailBody = {
              from: "Poddle <hello@poddleme.com>",
              to: [email],
              subject: `${inviterName} invited you to join ${organization.name} on Poddle`,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; background: #f8fafc;">
                  <div style="background: #fff; border-radius: 16px; padding: 40px; border: 1px solid rgba(15,23,42,0.08); box-shadow: 0 2px 8px rgba(15,23,42,0.04);">
                    <div style="width: 48px; height: 48px; background: linear-gradient(135deg,#1e3a5f,#0f2040); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
                      <span style="color: white; font-size: 20px; font-weight: 900;">P</span>
                    </div>
                    <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 8px;">You're invited to join an organization</h1>
                    <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                      <strong style="color: #0f172a;">${inviterName}</strong> has invited you to join
                      <strong style="color: #0f172a;">${organization.name}</strong> on Poddle — an AI-powered
                      decision governance platform where teams pressure-test decisions before they commit.
                    </p>
                    <a href="${inviteUrl}" style="display: inline-block; background-color: #1e3a5f; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; margin-bottom: 24px; border: 2px solid #1e3a5f; line-height: 1.2; letter-spacing: 0.2px;">
                      Accept invitation
                    </a>
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                      This invite expires in 7 days. If you didn't expect this email, you can safely ignore it.
                    </p>
                  </div>
                </div>
              `,
            };

            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(emailBody),
            });
          }

          results.push({ email, success: true });
        } catch (e) {
          results.push({ email, success: false, error: String(e) });
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Workspace invite path (unchanged) ─────────────────────────────────

    if (emails.length > 50) {
      return new Response(JSON.stringify({ error: "Cannot invite more than 50 people at once." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is owner/admin
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Only workspace owners and admins can invite members" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch workspace name and inviter profile
    const [{ data: workspace }, { data: inviterProfile }] = await Promise.all([
      supabase.from("workspaces").select("name, seats").eq("id", workspace_id).maybeSingle(),
      supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    ]);

    if (!workspace) {
      return new Response(JSON.stringify({ error: "Workspace not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-flight seat check (informational — the atomic DB function enforces the real limit)
    const { count: memberCount } = await supabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace_id);

    const { count: pendingCount } = await supabase
      .from("workspace_invites")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace_id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString());

    const usedSeats = (memberCount || 0) + (pendingCount || 0);
    if (usedSeats + emails.length > workspace.seats) {
      return new Response(JSON.stringify({
        error: `Not enough seats. You have ${workspace.seats - usedSeats} seat(s) available.`,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const email of emails) {
      try {
        // Check if already a member
        const { data: existingMember } = await serviceSupabase
          .from("workspace_members")
          .select("id")
          .eq("workspace_id", workspace_id)
          .eq("user_id", (
            await serviceSupabase.from("profiles").select("id").eq("email", email).maybeSingle()
          ).data?.id || "00000000-0000-0000-0000-000000000000")
          .maybeSingle();

        if (existingMember) {
          results.push({ email, success: false, error: "Already a member" });
          continue;
        }

        // Atomically check seat limit and insert the invite in a single
        // serialized DB transaction — prevents race conditions.
        const { data: inviteRow, error: inviteError } = await serviceSupabase
          .rpc("create_workspace_invite", {
            p_workspace_id: workspace_id,
            p_invited_email: email,
            p_invited_by: user.id,
          })
          .maybeSingle();

        if (inviteError || !inviteRow || inviteRow.error) {
          const msg = inviteRow?.error === "No seats available"
            ? "No seats available"
            : "Failed to create invite";
          results.push({ email, success: false, error: msg });
          continue;
        }

        const invite = { token: inviteRow.token };

        const inviteUrl = `${appUrl}/#join/${invite.token}`;
        const inviterName = inviterProfile?.full_name || inviterProfile?.email || "A team member";

        // Send email via Resend if configured
        if (resendKey) {
          const emailBody = {
            from: "Poddle <hello@poddleme.com>",
            to: [email],
            subject: `${inviterName} invited you to a private workspace on Poddle`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; background: #f8fafc;">
                <div style="background: #fff; border-radius: 16px; padding: 40px; border: 1px solid rgba(15,23,42,0.08); box-shadow: 0 2px 8px rgba(15,23,42,0.04);">
                  <div style="width: 48px; height: 48px; background: linear-gradient(135deg,#1e3a5f,#0f2040); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
                    <span style="color: white; font-size: 20px; font-weight: 900;">P</span>
                  </div>
                  <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 8px;">You're invited to a private workspace</h1>
                  <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                    <strong style="color: #0f172a;">${inviterName}</strong> has invited you to join
                    <strong style="color: #0f172a;">${workspace.name}</strong> — a private, encrypted workspace on Poddle
                    where teams debate ideas with AI agents.
                  </p>
                  <a href="${inviteUrl}" style="display: inline-block; background-color: #1e3a5f; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; margin-bottom: 24px; border: 2px solid #1e3a5f; line-height: 1.2; letter-spacing: 0.2px;">
                    Accept invitation
                  </a>
                  <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    This invite expires in 7 days. If you didn't expect this email, you can safely ignore it.
                  </p>
                </div>
              </div>
            `,
          };

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(emailBody),
          });
        }

        results.push({ email, success: true });
      } catch (e) {
        results.push({ email, success: false, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-workspace-invite error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
