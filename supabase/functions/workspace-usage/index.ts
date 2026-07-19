import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveWarRoomLimit } from "../_shared/warRoomQuota.ts";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller's session and resolve the workspace_id from the query.
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspace_id");
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "Missing workspace_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Membership check via service-role client (bypasses RLS).
    const service = createClient(supabaseUrl, supabaseServiceKey);
    const { data: membership } = await service
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a workspace member" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: usage, error: usageErr } = await service.rpc(
      "get_workspace_war_room_usage",
      { p_workspace_id: workspaceId }
    );

    if (usageErr || !usage) {
      return new Response(JSON.stringify({ error: "Failed to load usage" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limit = resolveWarRoomLimit(usage.plan);
    const used = usage.session_count ?? 0;
    const included = usage.included ?? 0;
    const warningThreshold = Math.floor(included * 0.8);

    return new Response(JSON.stringify({
      sessions_used: used,
      sessions_limit: usage.session_limit,
      included,
      in_overage: usage.in_overage ?? false,
      overage_count: usage.overage_count ?? 0,
      overage_unit_price: limit.overageUnitPrice,
      hard_block: limit.hardBlock,
      plan: usage.plan,
      period_end: usage.period_end,
      warning_threshold_reached: included > 0 && used >= warningThreshold && used < included,
      limit_reached: limit.hardBlock && used >= (usage.session_limit ?? 0),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
