import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildConfirmationEmail, APP_URL } from "../_shared/emailTemplates.ts";

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

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
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
    const { email, password, firstName, lastName, username } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create the auth user via admin API — this does NOT trigger
    // Supabase's built-in confirmation email, so it bypasses the
    // GoTrue email rate limit entirely.
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        first_name: firstName || "",
        last_name: lastName || "",
        username: username || "",
        full_name: `${firstName || ""} ${lastName || ""}`.trim() || email,
      },
    });

    if (createError) {
      const msg = createError.message.toLowerCase();
      if (msg.includes("already") || msg.includes("exists") || msg.includes("registered")) {
        return new Response(JSON.stringify({ error: "An account with this email already exists. Try signing in instead." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = createData.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Failed to create user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send branded confirmation email via Resend (replaces Supabase's built-in)
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      const rawToken = generateToken();
      const tokenHash = await sha256(rawToken);

      const { error: insertError } = await supabaseAdmin
        .from("email_confirmation_tokens")
        .insert({
          user_id: user.id,
          token_hash: tokenHash,
        });

      if (insertError) {
        console.error("Failed to store confirmation token:", insertError.message);
      } else {
        const displayName = firstName || email.split("@")[0];
        const confirmUrl = `${APP_URL}/?confirm=${rawToken}`;
        const html = buildConfirmationEmail(displayName, confirmUrl);

        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Poddle <notifications@poddleme.com>",
              to: email,
              subject: "Confirm your email to join Poddle",
              html,
            }),
          });

          if (!res.ok) {
            const err = await res.text();
            console.error("Resend error (signup confirmation):", err);
          } else {
            const result = await res.json();
            console.log(`Confirmation email sent: ${result.id} → ${email}`);
          }
        } catch (err) {
          console.error("Failed to send confirmation email:", err);
        }
      }
    } else {
      console.warn("RESEND_API_KEY not configured — skipping confirmation email");
    }

    return new Response(
      JSON.stringify({ success: true, userId: user.id, email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("signup-user error:", msg);
    return new Response(JSON.stringify({ error: "Unexpected error", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
