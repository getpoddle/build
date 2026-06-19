import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const parts = signature.split(",");
  const timestamp = parts.find(p => p.startsWith("t="))?.slice(2);
  const v1 = parts.find(p => p.startsWith("v1="))?.slice(3);
  if (!timestamp || !v1) return false;

  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return computed === v1;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.text();
    const signature = req.headers.get("stripe-signature") || "";

    const valid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(body);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const meta = session.metadata || {};
      const userId = meta.user_id;
      const plan = meta.plan || "pro";
      const workspaceName = meta.workspace_name || "My Workspace";
      const workspaceId = meta.workspace_id || null;
      const defaultSeats = plan === "enterprise" ? 25 : plan === "team" ? 10 : 3;
      const seats = parseInt(meta.seats || String(defaultSeats), 10);
      const stripeCustomerId = session.customer;
      const stripeSubscriptionId = session.subscription;

      if (!userId) {
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upgrade profile tier
      await supabase
        .from("profiles")
        .update({ subscription_tier: plan })
        .eq("id", userId);

      if (workspaceId) {
        // Update existing workspace with Stripe details
        await supabase
          .from("workspaces")
          .update({
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
            subscription_status: "active",
            plan,
            seats,
          })
          .eq("id", workspaceId)
          .eq("owner_id", userId);
      } else {
        // Create new workspace
        const { data: ws } = await supabase
          .from("workspaces")
          .insert({
            name: workspaceName,
            owner_id: userId,
            plan,
            subscription_status: "active",
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
            seats,
            is_encrypted: true,
            workspace_type: "encrypted",
          })
          .select()
          .single();

        if (ws) {
          // Add owner as first member
          await supabase.from("workspace_members").insert({
            workspace_id: ws.id,
            user_id: userId,
            role: "owner",
          });
        }
      }

      // Send subscription confirmation email (fire-and-forget)
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      fetch(`${supabaseUrl}/functions/v1/send-subscription-confirmation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          userId,
          plan,
          workspaceName: workspaceId ? undefined : (meta.workspace_name || "My Workspace"),
        }),
      }).catch((e) => console.error("Failed to send subscription email:", e));
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;
      if (subscriptionId) {
        await supabase
          .from("workspaces")
          .update({
            subscription_status: "active",
            current_period_end: new Date(invoice.lines?.data?.[0]?.period?.end * 1000).toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);
      }
    }

    if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.paused") {
      const subscription = event.data.object;
      const subscriptionId = subscription.id;

      const { data: ws } = await supabase
        .from("workspaces")
        .select("owner_id")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();

      await supabase
        .from("workspaces")
        .update({ subscription_status: "cancelled" })
        .eq("stripe_subscription_id", subscriptionId);

      if (ws?.owner_id) {
        // Check if user has any other active workspaces before downgrading
        const { data: activeWs } = await supabase
          .from("workspaces")
          .select("id")
          .eq("owner_id", ws.owner_id)
          .eq("subscription_status", "active")
          .neq("stripe_subscription_id", subscriptionId);

        if (!activeWs || activeWs.length === 0) {
          await supabase
            .from("profiles")
            .update({ subscription_tier: "free" })
            .eq("id", ws.owner_id);
        }
      }
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object;
      const subscriptionId = subscription.id;
      const status = subscription.status;

      // Map Stripe status → our internal status.
      // Do NOT downgrade on transient statuses like 'incomplete' or 'trialing'
      // that Stripe emits before/during checkout completion.
      let mappedStatus: string;
      if (status === "active") mappedStatus = "active";
      else if (status === "trialing") mappedStatus = "trialing";
      else if (status === "past_due") mappedStatus = "past_due";
      else if (status === "incomplete") {
        // Stripe briefly emits 'incomplete' right after checkout — skip downgrading
        // so the status set by checkout.session.completed is preserved.
        mappedStatus = "active";
      } else {
        mappedStatus = "inactive";
      }

      await supabase
        .from("workspaces")
        .update({
          subscription_status: mappedStatus,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : undefined,
        })
        .eq("stripe_subscription_id", subscriptionId);

      // Keep profiles.subscription_tier in sync when a subscription goes active
      if (status === "active" || status === "trialing") {
        const plan = subscription.metadata?.plan;
        const userId = subscription.metadata?.user_id;
        if (userId && plan) {
          await supabase
            .from("profiles")
            .update({ subscription_tier: plan })
            .eq("id", userId);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
