import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Server-side authoritative product → plan mapping.
// Plan/seats are NEVER trusted from user-controlled metadata.
const PRODUCT_TO_PLAN: Record<string, { plan: string; seats: number }> = {
  "prod_UXcclPSycEN5dN": { plan: "enterprise", seats: 25 },
  "prod_UYhkfi8tsa4NJu": { plan: "team", seats: 10 },
  "prod_UXcbO4NuuJRE5A": { plan: "pro", seats: 3 },
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

async function resolvePlanFromLineItems(
  subscriptionId: string | null,
  stripeKey: string
): Promise<{ plan: string; seats: number } | null> {
  if (!subscriptionId) return null;
  try {
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}?expand[]=items.data.price.product`, {
      headers: { "Authorization": `Bearer ${stripeKey}` },
    });
    if (!res.ok) return null;
    const sub = await res.json();
    const productId = sub.items?.data?.[0]?.price?.product?.id ?? sub.items?.data?.[0]?.price?.product;
    return PRODUCT_TO_PLAN[productId] ?? null;
  } catch {
    return null;
  }
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

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const meta = session.metadata || {};
      const userIdFromMeta = meta.user_id;
      const workspaceName = meta.workspace_name || "My Workspace";
      const workspaceId = meta.workspace_id || null;
      const stripeCustomerId = session.customer;
      const stripeSubscriptionId = session.subscription;

      if (!userIdFromMeta) {
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify user_id from metadata is legitimate:
      // If this Stripe customer ID already exists in our database, the user_id
      // must match — otherwise an attacker injected a victim's user_id into metadata.
      const { data: existingCustomer } = await supabase
        .from("stripe_customers")
        .select("user_id")
        .eq("customer_id", stripeCustomerId)
        .maybeSingle();

      if (existingCustomer && existingCustomer.user_id !== userIdFromMeta) {
        // Customer record belongs to a different user — metadata was spoofed.
        console.error(`Stripe metadata spoofing detected: customer ${stripeCustomerId} belongs to ${existingCustomer.user_id}, not ${userIdFromMeta}`);
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // For new customers, verify the profile exists for the claimed user_id.
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userIdFromMeta)
        .maybeSingle();

      if (!profile) {
        console.error(`Stripe webhook: no profile found for user_id ${userIdFromMeta}`);
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = userIdFromMeta;

      // Derive plan and seats from the actual Stripe subscription line items,
      // never from user-controllable metadata.
      const resolved = await resolvePlanFromLineItems(stripeSubscriptionId, stripeSecretKey);
      const plan = resolved?.plan ?? "pro";
      const seats = resolved?.seats ?? 3;

      // Upgrade profile tier
      await supabase
        .from("profiles")
        .update({ subscription_tier: plan })
        .eq("id", userId);

      if (workspaceId) {
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
          await supabase.from("workspace_members").insert({
            workspace_id: ws.id,
            user_id: userId,
            role: "owner",
          });
        }
      }

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

      let mappedStatus: string;
      if (status === "active") mappedStatus = "active";
      else if (status === "trialing") mappedStatus = "trialing";
      else if (status === "past_due") mappedStatus = "past_due";
      else if (status === "incomplete") {
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

      // Sync plan from authoritative product mapping when subscription goes active.
      // Derive user_id from the workspace record — never trust metadata.
      if (status === "active" || status === "trialing") {
        const { data: wsForSub } = await supabase
          .from("workspaces")
          .select("owner_id")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();
        if (wsForSub?.owner_id) {
          const resolved = await resolvePlanFromLineItems(subscriptionId, stripeSecretKey);
          if (resolved) {
            await supabase
              .from("profiles")
              .update({ subscription_tier: resolved.plan })
              .eq("id", wsForSub.owner_id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
