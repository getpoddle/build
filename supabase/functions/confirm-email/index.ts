import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const tokenHash = await sha256(token);

    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("email_confirmation_tokens")
      .select("id, user_id, expires_at, confirmed_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired confirmation link" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tokenRow.confirmed_at) {
      return new Response(
        JSON.stringify({ success: true, alreadyConfirmed: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This confirmation link has expired. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      tokenRow.user_id,
      { email_confirm: true }
    );

    if (updateError) {
      console.error("Failed to confirm user:", updateError.message);
      return new Response(JSON.stringify({ error: "Failed to confirm email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin
      .from("email_confirmation_tokens")
      .update({ confirmed_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    // Fetch the user to get their email for magic link generation
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      tokenRow.user_id
    );

    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    let workspaceId: string | null = null;

    if (!userError && userData?.user?.email) {
      // Generate a one-time magic link, then exchange it server-side for a
      // real session. We return the access/refresh tokens to the frontend
      // so it can call supabase.auth.setSession() directly — no redirects,
      // no URL params to lose, no race conditions.
      try {
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: userData.user.email,
        });

        if (!linkError && linkData?.properties?.action_link) {
          // The action_link contains the raw token as a query param.
          // Extract it and send it to the verify endpoint to get a session.
          const actionUrl = new URL(linkData.properties.action_link);
          const rawToken = actionUrl.searchParams.get("token")
            || actionUrl.hash.match(/token=([^&]+)/)?.[1];

          if (rawToken) {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
            const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${anonKey}`,
                "apikey": anonKey,
              },
              body: JSON.stringify({
                type: "magiclink",
                token: rawToken,
              }),
            });

            if (verifyRes.ok) {
              const session = await verifyRes.json();
              accessToken = session.access_token || null;
              refreshToken = session.refresh_token || null;
            } else {
              const errBody = await verifyRes.text().catch(() => "");
              console.error("Token exchange failed:", verifyRes.status, errBody);
            }
          } else {
            console.error("Could not extract raw token from action_link");
          }
        } else if (linkError) {
          console.error("Magic link generation failed:", linkError.message);
        }
      } catch (err) {
        console.error("Magic link generation error:", err);
      }

      // Look up the user's workspace so we can redirect them straight there
      try {
        const { data: wsData } = await supabaseAdmin
          .from("workspaces")
          .select("id")
          .eq("owner_id", tokenRow.user_id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (wsData?.id) {
          workspaceId = wsData.id;
        }
      } catch (err) {
        console.error("Workspace lookup error:", err);
      }

      // Send welcome email
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        try {
          const { buildWelcomeEmail } = await import("../_shared/emailTemplates.ts");
          const firstName = userData.user.user_metadata?.first_name || userData.user.email.split("@")[0];
          const html = buildWelcomeEmail(firstName);

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Poddle <notifications@poddleme.com>",
              to: userData.user.email,
              subject: `Welcome to Poddle, ${firstName} — here's how to get started`,
              html,
            }),
          }).catch((err) => console.error("Welcome email send error:", err));
        } catch (err) {
          console.error("Welcome email error:", err);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        email: userData?.user?.email || null,
        accessToken,
        refreshToken,
        workspaceId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("confirm-email error:", msg);
    return new Response(JSON.stringify({ error: "Unexpected error", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
