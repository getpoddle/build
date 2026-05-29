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
    const { email, message, userId } = await req.json();

    if (!email || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Email and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    // Basic input validation
    if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (typeof message !== "string" || message.trim().length === 0 || message.length > 10000) {
      return new Response(
        JSON.stringify({ success: false, error: "Message must be between 1 and 10000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert and capture the generated id so status updates are IDOR-safe
    const { data: inserted } = await supabase
      .from("contact_messages")
      .insert({ email, message, user_id: userId || null, status: "pending" })
      .select("id")
      .single();

    const contactId: string | null = inserted?.id ?? null;

    if (!resendKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Escape user content rendered into admin email
    const safeEmail = email.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeMessage = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1e293b; margin-bottom: 4px;">New Contact Message</h2>
        <p style="color: #64748b; font-size: 14px; margin-bottom: 24px;">via Poddle Contact Form</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; width: 100px;">From</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${safeEmail}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-weight: 600; color: #475569; vertical-align: top;">Message</td>
            <td style="padding: 12px 0; color: #1e293b; white-space: pre-wrap;">${safeMessage}</td>
          </tr>
        </table>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">Sent from Poddle · <a href="https://poddleme.com" style="color: #3b82f6;">poddleme.com</a></p>
      </div>
    `;

    const adminEmail = Deno.env.get("ADMIN_EMAIL")!;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poddle Contact <onboarding@resend.dev>",
        to: [adminEmail],
        reply_to: email,
        subject: `Contact form submission`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      // Update by id — not by email — to prevent IDOR
      if (contactId) {
        await supabase.from("contact_messages").update({ status: "failed" }).eq("id", contactId);
      }
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update by id — not by email — to prevent IDOR
    if (contactId) {
      await supabase.from("contact_messages").update({ status: "sent" }).eq("id", contactId);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Contact email error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
