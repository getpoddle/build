import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey || !stripeSecretKey.startsWith("sk_")) {
      return new Response(JSON.stringify({ error: "Payment service unavailable." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productIds = ["prod_UXcbO4NuuJRE5A", "prod_UYgnADbpMs1fyz", "prod_UYhkfi8tsa4NJu"];
    const results: Record<string, unknown> = {};

    for (const productId of productIds) {
      const res = await fetch(`https://api.stripe.com/v1/prices?product=${productId}&active=true`, {
        headers: { "Authorization": `Bearer ${stripeSecretKey}` },
      });
      const json = await res.json();
      if (!res.ok) {
        // Never expose Stripe error details (they may contain key fragments)
        return new Response(JSON.stringify({ error: "Payment service unavailable." }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      results[productId] = json;
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Payment service unavailable." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
