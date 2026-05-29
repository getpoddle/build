import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MentionEmailPayload {
  notificationId: string;
  mentionedUserId: string;
  mentionerName: string;
  mentionType: string;
  relatedId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: MentionEmailPayload = await req.json();
    const { mentionedUserId, mentionerName, mentionType, relatedId } = payload;

    if (!mentionedUserId || !mentionerName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email_notifications_enabled, full_name")
      .eq("id", mentionedUserId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!profile.email_notifications_enabled) {
      return new Response(
        JSON.stringify({ message: "User has email notifications disabled" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(
      mentionedUserId
    );

    if (authError || !authUser || !authUser.user?.email) {
      return new Response(
        JSON.stringify({ error: "Could not retrieve user email" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userEmail = authUser.user.email;

    let subject = "";
    let htmlContent = "";
    let linkUrl = "";

    const appUrl = Deno.env.get("APP_URL") || "https://poddleme.com";

    switch (mentionType) {
      case "assumption":
        subject = `${mentionerName} mentioned you in an assumption`;
        linkUrl = `${appUrl}/pods`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">You've been mentioned!</h2>
            <p>Hi ${profile.full_name},</p>
            <p><strong>${mentionerName}</strong> mentioned you in an assumption on Poddle.</p>
            <p style="margin: 30px 0;">
              <a href="${linkUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Assumption</a>
            </p>
            <p style="color: #64748b; font-size: 14px;">If you don't want to receive these notifications, you can disable them in your profile settings.</p>
          </div>
        `;
        break;

      case "challenge":
      case "challenge_response":
        subject = `${mentionerName} mentioned you in a challenge`;
        linkUrl = `${appUrl}/games`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">You've been mentioned!</h2>
            <p>Hi ${profile.full_name},</p>
            <p><strong>${mentionerName}</strong> mentioned you in a challenge on Poddle.</p>
            <p style="margin: 30px 0;">
              <a href="${linkUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Challenge</a>
            </p>
            <p style="color: #64748b; font-size: 14px;">If you don't want to receive these notifications, you can disable them in your profile settings.</p>
          </div>
        `;
        break;

      case "comment":
        subject = `${mentionerName} mentioned you in a comment`;
        linkUrl = `${appUrl}/pods`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">You've been mentioned!</h2>
            <p>Hi ${profile.full_name},</p>
            <p><strong>${mentionerName}</strong> mentioned you in a comment on Poddle.</p>
            <p style="margin: 30px 0;">
              <a href="${linkUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Comment</a>
            </p>
            <p style="color: #64748b; font-size: 14px;">If you don't want to receive these notifications, you can disable them in your profile settings.</p>
          </div>
        `;
        break;

      default:
        subject = `${mentionerName} mentioned you on Poddle`;
        linkUrl = appUrl;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">You've been mentioned!</h2>
            <p>Hi ${profile.full_name},</p>
            <p><strong>${mentionerName}</strong> mentioned you on Poddle.</p>
            <p style="margin: 30px 0;">
              <a href="${linkUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View on Poddle</a>
            </p>
            <p style="color: #64748b; font-size: 14px;">If you don't want to receive these notifications, you can disable them in your profile settings.</p>
          </div>
        `;
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured. Email will not be sent.");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Email service not configured. Please add RESEND_API_KEY secret.",
          recipient: userEmail,
          subject: subject,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poddle <notifications@poddleme.com>",
        to: userEmail,
        subject: subject,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      console.error("Email send error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to send email",
          details: error,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailResult = await emailResponse.json();
    console.log(`Email sent: ${emailResult.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email notification sent successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error sending mention email:", err);
    return new Response(
      JSON.stringify({ error: "Failed to send email notification" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
