import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildConfirmationEmail, APP_URL } from "../_shared/emailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getUserWithRetry(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  attempts = 3,
  delayMs = 1000
) {
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(delayMs);
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!error && data?.user?.email) return data.user;
    console.warn(`getUserById attempt ${i + 1} failed:`, error?.message);
  }
  return null;
}

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
    const { userId, email } = await req.json();

    if (!userId && !email) {
      return new Response(JSON.stringify({ error: "userId or email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, message: "Email service not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let user: Awaited<ReturnType<typeof getUserWithRetry>> = null;
    if (userId) {
      user = await getUserWithRetry(supabaseAdmin, userId);
    } else if (email) {
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });
      if (!listError && listData?.users) {
        user = listData.users.find((u: any) => u.email === email) || null;
      }
    }
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUserId = user.id;

    // If autoconfirm is on, Supabase already confirmed the user. Unconfirm them
    // so they must click our branded confirmation link before they can sign in.
    if (user.email_confirmed_at) {
      const { error: unconfirmError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUserId,
        { email_confirm: false }
      );
      if (unconfirmError) {
        console.error("Failed to unconfirm user:", unconfirmError.message);
      }
    }

    // Generate a confirmation token and store its hash
    const rawToken = generateToken();
    const tokenHash = await sha256(rawToken);

    const { error: insertError } = await supabaseAdmin
      .from("email_confirmation_tokens")
      .insert({
        user_id: targetUserId,
        token_hash: tokenHash,
      });

    if (insertError) {
      console.error("Failed to store confirmation token:", insertError.message);
      return new Response(JSON.stringify({ error: "Failed to create confirmation token" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstName = user.user_metadata?.first_name || user.email!.split("@")[0];
    const confirmUrl = `${APP_URL}/?confirm=${rawToken}`;
    const html = buildConfirmationEmail(firstName, confirmUrl);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poddle <notifications@poddleme.com>",
        to: user.email,
        subject: `Confirm your email to join Poddle`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error (confirmation):", err);
      return new Response(JSON.stringify({ error: "Failed to send email", detail: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await res.json();
    console.log(`Confirmation email sent: ${result.id} → ${user.email}`);

    return new Response(
      JSON.stringify({ success: true, recipient: user.email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-signup-confirmation error:", msg);
    return new Response(JSON.stringify({ error: "Unexpected error", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
