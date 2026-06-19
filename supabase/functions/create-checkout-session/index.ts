import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PRODUCT_IDS: Record<string, string> = {
  enterprise: "prod_UXcclPSycEN5dN",
  team:       "prod_UYhkfi8tsa4NJu",
  pro:        "prod_UXcbO4NuuJRE5A",
};

async function fetchPriceForProduct(productId: string, stripeKey: string): Promise<string | null> {
  const res = await fetch(
    `https://api.stripe.com/v1/prices?product=${productId}&active=true&limit=1`,
    { headers: { "Authorization": `Bearer ${stripeKey}` } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.[0]?.id ?? null;
}

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plan, workspace_name, workspace_id, seats, success_url, cancel_url } = await req.json();

    if (!plan || !success_url || !cancel_url) {
      return new Response(JSON.stringify({ error: "Missing required fields: plan, success_url, cancel_url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey || !stripeSecretKey.startsWith("sk_")) {
      return new Response(JSON.stringify({ error: "Payment service unavailable." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve price ID: env var → dynamic product lookup → error
    let priceId: string | null = null;

    if (plan === "enterprise") {
      priceId = Deno.env.get("STRIPE_ENTERPRISE_PRICE_ID") || null;
      if (!priceId) priceId = await fetchPriceForProduct(PRODUCT_IDS.enterprise, stripeSecretKey);
    } else if (plan === "team") {
      priceId = Deno.env.get("STRIPE_TEAM_PRICE_ID") || null;
      if (!priceId) priceId = await fetchPriceForProduct(PRODUCT_IDS.team, stripeSecretKey);
    } else {
      // pro individual
      priceId = Deno.env.get("STRIPE_PRO_PRICE_ID") || null;
      if (!priceId) priceId = await fetchPriceForProduct(PRODUCT_IDS.pro, stripeSecretKey);
    }

    if (!priceId) {
      console.error(`No active price found for plan: ${plan}`);
      return new Response(JSON.stringify({ error: "No active price found for this plan. Please contact support." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const defaultSeats = plan === "enterprise" ? 25 : plan === "team" ? 10 : 3;

    const checkoutBody = new URLSearchParams({
      "mode": "subscription",
      "customer_email": profile?.email || user.email || "",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "success_url": success_url,
      "cancel_url": cancel_url,
      "metadata[user_id]": user.id,
      "metadata[plan]": plan,
      "metadata[workspace_name]": workspace_name || "",
      "metadata[workspace_id]": workspace_id || "",
      "metadata[seats]": String(seats || defaultSeats),
      "subscription_data[metadata][user_id]": user.id,
      "subscription_data[metadata][plan]": plan,
      "allow_promotion_codes": "true",
    });

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: checkoutBody.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error("Stripe checkout error:", JSON.stringify(session));
      const stripeMessage = session?.error?.message;
      return new Response(
        JSON.stringify({ error: stripeMessage || "Payment service unavailable. Please try again later." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
