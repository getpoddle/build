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

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is an admin
    const { data: adminRow } = await service
      .from("admins")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!adminRow) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);

    // GET — list all upgrade requests with user info
    if (req.method === "GET") {
      const status = url.searchParams.get("status") || "pending";

      const { data, error } = await service
        .from("upgrade_requests")
        .select(`
          id, requested_plan, status, notes, admin_notes, created_at, reviewed_at,
          profiles!upgrade_requests_user_id_fkey (id, full_name, email, username, avatar_url, subscription_tier)
        `)
        .eq("status", status === "all" ? undefined : status)
        .order("created_at", { ascending: false })
        .limit(100);

      // When status=all, re-query without filter
      if (status === "all") {
        const { data: allData, error: allErr } = await service
          .from("upgrade_requests")
          .select(`
            id, requested_plan, status, notes, admin_notes, created_at, reviewed_at,
            profiles!upgrade_requests_user_id_fkey (id, full_name, email, username, avatar_url, subscription_tier)
          `)
          .order("created_at", { ascending: false })
          .limit(200);

        if (allErr) {
          return new Response(JSON.stringify({ error: allErr.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ requests: allData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ requests: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST — approve or reject a request
    if (req.method === "POST") {
      const { request_id, action, admin_notes } = await req.json();

      if (!request_id || !["approve", "reject"].includes(action)) {
        return new Response(JSON.stringify({ error: "Missing request_id or invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newStatus = action === "approve" ? "approved" : "rejected";

      const { data: reqRow } = await service
        .from("upgrade_requests")
        .select("user_id, requested_plan")
        .eq("id", request_id)
        .maybeSingle();

      if (!reqRow) {
        return new Response(JSON.stringify({ error: "Request not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await service
        .from("upgrade_requests")
        .update({
          status: newStatus,
          admin_notes: admin_notes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", request_id);

      // If approved, upgrade the user's profile tier
      if (action === "approve") {
        await service
          .from("profiles")
          .update({ subscription_tier: reqRow.requested_plan })
          .eq("id", reqRow.user_id);
      }

      return new Response(JSON.stringify({ success: true, status: newStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
