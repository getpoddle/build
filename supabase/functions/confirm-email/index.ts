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

    let actionLink: string | null = null;
    let workspaceId: string | null = null;

    if (!userError && userData?.user?.email) {
      // Generate a one-time magic link. We return the full action_link URL
      // so the frontend can do a full browser redirect to it — Supabase
      // verifies the token server-side, establishes the session, and
      // redirects back to the app. This avoids the client-side verifyOtp
      // hang that occurs when using the hashed_token directly.
      try {
        const redirectTo = new URL(Deno.env.get("SUPABASE_URL")!).origin;
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: userData.user.email,
          options: { redirectTo },
        });

        if (!linkError && linkData?.properties?.action_link) {
          actionLink = linkData.properties.action_link;
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
        actionLink,
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
