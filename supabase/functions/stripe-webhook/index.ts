import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyStripeSignature, planFromProductId, shouldDowngradeToFree } from "../_shared/stripeLogic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    return planFromProductId(productId);
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
        const periodEnd = invoice.lines?.data?.[0]?.period?.end;
        await supabase
          .from("workspaces")
          .update({
            subscription_status: "active",
            current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
          })
          .eq("stripe_subscription_id", subscriptionId);

        // Send invoice email — look up workspace owner
        const { data: wsForInvoice } = await supabase
          .from("workspaces")
          .select("owner_id, name, plan")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (wsForInvoice?.owner_id) {
          const amountCents = invoice.amount_paid ?? 0;
          const currency = (invoice.currency ?? "usd").toUpperCase();
          const amountFormatted = `${currency} ${(amountCents / 100).toFixed(2)}`;
          const planLabel = wsForInvoice.plan
            ? wsForInvoice.plan.charAt(0).toUpperCase() + wsForInvoice.plan.slice(1)
            : "Pro";
          const periodEndDate = periodEnd
            ? new Date(periodEnd * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
            : null;

          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
          fetch(`${supabaseUrl}/functions/v1/send-invoice-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}` },
            body: JSON.stringify({
              userId: wsForInvoice.owner_id,
              planLabel,
              amountFormatted,
              periodEnd: periodEndDate,
              invoiceUrl: invoice.hosted_invoice_url ?? null,
            }),
          }).catch((e) => console.error("Failed to send invoice email:", e));
        }
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;
      if (subscriptionId) {
        await supabase
          .from("workspaces")
          .update({ subscription_status: "past_due" })
          .eq("stripe_subscription_id", subscriptionId);

        const { data: wsForFailed } = await supabase
          .from("workspaces")
          .select("owner_id, plan")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (wsForFailed?.owner_id) {
          const amountCents = invoice.amount_due ?? 0;
          const currency = (invoice.currency ?? "usd").toUpperCase();
          const amountFormatted = `${currency} ${(amountCents / 100).toFixed(2)}`;
          const planLabel = wsForFailed.plan
            ? wsForFailed.plan.charAt(0).toUpperCase() + wsForFailed.plan.slice(1)
            : "Pro";

          // Create a billing portal session to give a direct update-payment link
          let billingPortalUrl = "https://poddleme.com/#pricing";
          try {
            const customerRes = await fetch(
              `https://api.stripe.com/v1/billing_portal/sessions`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${stripeSecretKey}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  customer: invoice.customer,
                  return_url: "https://poddleme.com/#workspaces",
                }).toString(),
              }
            );
            if (customerRes.ok) {
              const portalSession = await customerRes.json();
              billingPortalUrl = portalSession.url ?? billingPortalUrl;
            }
          } catch {
            // fall through — use default URL
          }

          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
          fetch(`${supabaseUrl}/functions/v1/send-payment-failed`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}` },
            body: JSON.stringify({
              userId: wsForFailed.owner_id,
              planLabel,
              amountFormatted,
              billingPortalUrl,
            }),
          }).catch((e) => console.error("Failed to send payment-failed email:", e));
        }
      }
    }

    if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.paused") {
      const subscription = event.data.object;
      const subscriptionId = subscription.id;

      const { data: ws } = await supabase
        .from("workspaces")
        .select("owner_id, name, plan, current_period_end")
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

        if (shouldDowngradeToFree(activeWs?.length ?? 0)) {
          await supabase
            .from("profiles")
            .update({ subscription_tier: "free" })
            .eq("id", ws.owner_id);
        }

        // Send cancellation email
        const planLabel = ws.plan
          ? ws.plan.charAt(0).toUpperCase() + ws.plan.slice(1)
          : "Pro";
        const accessUntil = ws.current_period_end
          ? new Date(ws.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
          : subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
            : null;

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        fetch(`${supabaseUrl}/functions/v1/send-subscription-cancelled`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}` },
          body: JSON.stringify({
            userId: ws.owner_id,
            planLabel,
            workspaceName: ws.name ?? "your workspace",
            accessUntil,
          }),
        }).catch((e) => console.error("Failed to send cancellation email:", e));
      }
    }

    if (event.type === "invoice.upcoming") {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;
      if (subscriptionId) {
        const { data: wsForUpcoming } = await supabase
          .from("workspaces")
          .select("owner_id, plan")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (wsForUpcoming?.owner_id) {
          const amountCents = invoice.amount_due ?? 0;
          const currency = (invoice.currency ?? "usd").toUpperCase();
          const amountFormatted = `${currency} ${(amountCents / 100).toFixed(2)}`;
          const planLabel = wsForUpcoming.plan
            ? wsForUpcoming.plan.charAt(0).toUpperCase() + wsForUpcoming.plan.slice(1)
            : "Pro";
          const periodEnd = invoice.lines?.data?.[0]?.period?.end;
          const renewalDate = periodEnd
            ? new Date(periodEnd * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
            : null;

          // Create a billing portal link so they can easily manage their plan
          let billingPortalUrl = "https://poddleme.com/#pricing";
          try {
            const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${stripeSecretKey}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                customer: invoice.customer,
                return_url: "https://poddleme.com/#workspaces",
              }).toString(),
            });
            if (portalRes.ok) {
              const portalSession = await portalRes.json();
              billingPortalUrl = portalSession.url ?? billingPortalUrl;
            }
          } catch {
            // fall through — use default URL
          }

          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
          fetch(`${supabaseUrl}/functions/v1/send-renewal-reminder`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}` },
            body: JSON.stringify({
              userId: wsForUpcoming.owner_id,
              planLabel,
              amountFormatted,
              renewalDate,
              billingPortalUrl,
            }),
          }).catch((e) => console.error("Failed to send renewal reminder email:", e));
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
