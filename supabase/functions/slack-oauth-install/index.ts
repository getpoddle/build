import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // poddle_workspace_id:user_id
  const error = url.searchParams.get("error");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const appUrl = Deno.env.get("APP_URL") ?? supabaseUrl.replace(".supabase.co", ".netlify.app");

  if (error || !code || !state) {
    const reason = error ?? "missing_code";
    return Response.redirect(`${appUrl}/?slack_error=${encodeURIComponent(reason)}`, 302);
  }

  // state format: "<workspace_id>:<user_id>"
  const [workspaceId, userId] = state.split(":");
  if (!workspaceId || !userId) {
    return Response.redirect(`${appUrl}/?slack_error=invalid_state`, 302);
  }

  const clientId = Deno.env.get("SLACK_CLIENT_ID");
  const clientSecret = Deno.env.get("SLACK_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return Response.redirect(`${appUrl}/?slack_error=not_configured`, 302);
  }

  // Exchange code for access token
  const redirectUri = `${supabaseUrl}/functions/v1/slack-oauth-install`;
  const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.ok) {
    console.error("Slack OAuth error:", tokenData.error);
    return Response.redirect(`${appUrl}/?slack_error=${encodeURIComponent(tokenData.error ?? "oauth_failed")}`, 302);
  }

  const botToken: string = tokenData.access_token;
  const teamId: string = tokenData.team?.id;
  const teamName: string = tokenData.team?.name ?? "";

  if (!botToken || !teamId) {
    return Response.redirect(`${appUrl}/?slack_error=missing_token`, 302);
  }

  const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Upsert the slack workspace mapping
  const { error: upsertErr } = await service
    .from("slack_workspaces")
    .upsert(
      {
        poddle_workspace_id: workspaceId,
        slack_team_id: teamId,
        slack_team_name: teamName,
        bot_access_token: botToken,
        installed_by_user_id: userId,
      },
      { onConflict: "slack_team_id" }
    );

  if (upsertErr) {
    console.error("DB upsert error:", upsertErr.message);
    return Response.redirect(`${appUrl}/?slack_error=db_error`, 302);
  }

  // Redirect back to the workspace settings page
  return Response.redirect(
    `${appUrl}/?workspace=${workspaceId}&slack_connected=1`,
    302
  );
});
