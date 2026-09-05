import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STRIPE_PRODUCTS: Record<string, { monthlyPriceId: string; annualPriceId: string; seats: number }> = {
  team: { monthlyPriceId: "price_1U0R9RFKEEYiEgTrWR6cUt3g", annualPriceId: "price_1UCHrlFKEEYiEgTrzQaengEV", seats: 10 },
  business: { monthlyPriceId: "price_1U0RAeFKEEYiEgTrMMbnoLA8", annualPriceId: "price_1UCHpKFKEEYiEgTr0tR2rp29", seats: 100 },
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

    const body = await req.json();
    const { plan, interval, success_url, cancel_url } = body;

    const planKey = String(plan || "").toLowerCase();
    const product = STRIPE_PRODUCTS[planKey];

    if (!product) {
      return new Response(JSON.stringify({ error: "Unknown plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const billingInterval = interval === "annual" ? "annual" : "monthly";
    const priceId = billingInterval === "annual" ? product.annualPriceId : product.monthlyPriceId;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-11-20.acacia",
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: profile?.email || user.email,
      success_url,
      cancel_url,
      metadata: {
        user_id: user.id,
        plan: planKey,
        interval: billingInterval,
        seats: String(product.seats),
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan: planKey,
          interval: billingInterval,
          seats: String(product.seats),
        },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
