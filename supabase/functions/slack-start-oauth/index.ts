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

  let workspaceId: string | null = null;
  let userId: string | null = null;

  if (req.method === "POST") {
    try {
      const body = await req.json();
      workspaceId = body.workspace_id ?? null;
      userId = body.user_id ?? null;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    const url = new URL(req.url);
    workspaceId = url.searchParams.get("workspace_id");
    userId = url.searchParams.get("user_id");
  }

  if (!workspaceId || !userId) {
    return new Response(JSON.stringify({ error: "workspace_id and user_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clientId = Deno.env.get("SLACK_CLIENT_ID");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  if (!clientId) {
    return new Response(JSON.stringify({ error: "Slack not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const redirectUri = `${supabaseUrl}/functions/v1/slack-oauth-install`;
  const state = `${workspaceId}:${userId}`;
  const scopes = "commands,chat:write,chat:write.public";

  const slackUrl =
    `https://slack.com/oauth/v2/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  return new Response(JSON.stringify({ url: slackUrl }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
