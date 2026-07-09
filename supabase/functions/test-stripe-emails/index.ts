import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { buildInvoiceEmail, buildPaymentFailedEmail, buildCancellationEmail } from "../_shared/emailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function sendEmail(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
): Promise<{ id?: string; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Poddle <notifications@poddleme.com>",
      to,
      subject,
      html,
    }),
  });
  const body = await res.json();
  if (!res.ok) return { error: JSON.stringify(body) };
  return { id: body.id };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const targetEmail = "oludotunakinbobola@gmail.com";
  const firstName = "Tuna";
  const planLabel = "Pro";
  const workspaceName = "Acme Strategy Room";
  const periodEnd = "9 August 2026";
  const amount = "USD 49.00";
  const billingPortalUrl = "https://poddleme.com/#pricing";

  const results: Record<string, unknown> = {};

  // 1. Invoice / payment confirmation
  results["invoice"] = await sendEmail(
    RESEND_API_KEY,
    targetEmail,
    `[TEST] Payment confirmed — your Poddle ${planLabel} invoice`,
    buildInvoiceEmail(firstName, planLabel, amount, periodEnd, null),
  );

  // 2. Payment failed
  results["payment-failed"] = await sendEmail(
    RESEND_API_KEY,
    targetEmail,
    `[TEST] Action required — payment failed for your Poddle ${planLabel} subscription`,
    buildPaymentFailedEmail(firstName, planLabel, amount, billingPortalUrl),
  );

  // 3. Subscription cancelled
  results["cancellation"] = await sendEmail(
    RESEND_API_KEY,
    targetEmail,
    `[TEST] Your Poddle ${planLabel} subscription has been cancelled`,
    buildCancellationEmail(firstName, planLabel, workspaceName, periodEnd, "https://poddleme.com/#pricing"),
  );

  return new Response(JSON.stringify({ success: true, recipient: targetEmail, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
