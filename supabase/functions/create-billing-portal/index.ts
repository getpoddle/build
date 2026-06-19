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

    const { workspace_id, return_url } = await req.json();

    if (!return_url) {
      return new Response(JSON.stringify({ error: "Missing required field: return_url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let stripeCustomerId: string | null = null;

    // 1. Try workspace-linked customer ID
    if (workspace_id) {
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("stripe_customer_id, owner_id")
        .eq("id", workspace_id)
        .maybeSingle();

      if (workspace && workspace.owner_id === user.id && workspace.stripe_customer_id) {
        stripeCustomerId = workspace.stripe_customer_id;
      }
    }

    // 2. Fallback: search all user-owned workspaces for any stripe_customer_id
    if (!stripeCustomerId) {
      const adminSupabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: workspaces } = await adminSupabase
        .from("workspaces")
        .select("stripe_customer_id")
        .eq("owner_id", user.id)
        .not("stripe_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (workspaces && workspaces.length > 0 && workspaces[0].stripe_customer_id) {
        stripeCustomerId = workspaces[0].stripe_customer_id;
      }
    }

    // 3. Fallback: look up Stripe customer by user email
    if (!stripeCustomerId && user.email) {
      const searchRes = await fetch(
        `https://api.stripe.com/v1/customers/search?query=email:"${encodeURIComponent(user.email)}"&limit=1`,
        { headers: { "Authorization": `Bearer ${stripeSecretKey}` } }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.data && searchData.data.length > 0) {
          stripeCustomerId = searchData.data[0].id;
        }
      }
    }

    if (!stripeCustomerId) {
      return new Response(JSON.stringify({ error: "No Stripe billing account found. Please contact support." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const portalBody = new URLSearchParams({
      customer: stripeCustomerId,
      return_url,
    });

    const stripeRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: portalBody.toString(),
    });

    const portal = await stripeRes.json();

    if (!stripeRes.ok) {
      return new Response(JSON.stringify({ error: portal.error?.message || "Payment service unavailable. Please try again later." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: portal.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
