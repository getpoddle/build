import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildAccountDeletionEmail } from "../_shared/emailTemplates.ts";

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

    const { error } = await anonClient.rpc("request_account_deletion", {
      p_user_id: user.id,
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to schedule account deletion" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert an in-app notification
    await anonClient.from("notifications").insert({
      user_id: user.id,
      type: "account_deletion_requested",
      title: "Account deletion scheduled",
      content: "Your account has been marked for deletion and will be permanently removed in 7 days. Sign in again to restore it.",
      related_type: "account",
      actor_id: user.id,
    });

    // Send confirmation email
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY && user.email) {
      const firstName = user.user_metadata?.first_name || user.email.split("@")[0];
      const html = buildAccountDeletionEmail(firstName);
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Poddle <notifications@poddleme.com>",
            to: user.email,
            subject: "Account deletion scheduled — Poddle",
            html,
          }),
        });
      } catch (emailErr) {
        console.error("Failed to send deletion email:", String(emailErr));
      }
    }

    return new Response(
      JSON.stringify({ success: true, deletion_requested: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
