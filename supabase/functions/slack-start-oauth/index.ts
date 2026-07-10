import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 1. Require and verify the caller's JWT ────────────────────────────────
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

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let workspaceId: string | null = null;
  try {
    const body = await req.json();
    workspaceId = body.workspace_id ?? null;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!workspaceId) {
    return new Response(JSON.stringify({ error: "workspace_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 3. Verify the caller is a member of this workspace ───────────────────
  const { data: membership, error: memberErr } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberErr || !membership) {
    return new Response(JSON.stringify({ error: "Forbidden: you are not a member of this workspace" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Only owners and admins may install Slack integrations
  if (membership.role !== "owner" && membership.role !== "admin") {
    return new Response(JSON.stringify({ error: "Forbidden: only workspace owners and admins can connect Slack" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 4. Check Slack is configured ─────────────────────────────────────────
  const clientId = Deno.env.get("SLACK_CLIENT_ID");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  if (!clientId) {
    return new Response(JSON.stringify({ error: "Slack not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 5. Generate a one-time nonce and persist it ───────────────────────────
  const serviceClient = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: stateRow, error: insertErr } = await serviceClient
    .from("slack_oauth_states")
    .insert({ workspace_id: workspaceId, user_id: user.id })
    .select("nonce")
    .single();

  if (insertErr || !stateRow?.nonce) {
    console.error("Failed to create OAuth state:", insertErr?.message);
    return new Response(JSON.stringify({ error: "Failed to initiate OAuth flow" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 6. Build and return the Slack OAuth URL ───────────────────────────────
  const redirectUri = `${supabaseUrl}/functions/v1/slack-oauth-install`;
  const scopes = "commands,chat:write,chat:write.public";

  const slackUrl =
    `https://slack.com/oauth/v2/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(stateRow.nonce)}`;

  return new Response(JSON.stringify({ url: slackUrl }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
