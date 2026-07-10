import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nonce = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const appUrl = Deno.env.get("APP_URL") ?? "https://poddleme.netlify.app";

  if (error || !code || !nonce) {
    const reason = error ?? "missing_code";
    return Response.redirect(`${appUrl}/?slack_error=${encodeURIComponent(reason)}`, 302);
  }

  const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ── 1. Look up and validate the nonce ────────────────────────────────────
  const { data: stateRow, error: lookupErr } = await service
    .from("slack_oauth_states")
    .select("nonce, workspace_id, user_id, created_at, used_at")
    .eq("nonce", nonce)
    .maybeSingle();

  if (lookupErr || !stateRow) {
    console.error("OAuth state not found:", lookupErr?.message);
    return Response.redirect(`${appUrl}/?slack_error=invalid_state`, 302);
  }

  // Reject if already consumed
  if (stateRow.used_at) {
    return Response.redirect(`${appUrl}/?slack_error=state_already_used`, 302);
  }

  // Reject if older than 10 minutes
  const ageMs = Date.now() - new Date(stateRow.created_at).getTime();
  if (ageMs > 10 * 60 * 1000) {
    return Response.redirect(`${appUrl}/?slack_error=state_expired`, 302);
  }

  const workspaceId: string = stateRow.workspace_id;
  const userId: string = stateRow.user_id;

  // ── 2. Mark nonce as consumed immediately (before any external calls) ─────
  const { error: consumeErr } = await service
    .from("slack_oauth_states")
    .update({ used_at: new Date().toISOString() })
    .eq("nonce", nonce)
    .is("used_at", null); // atomic: only update if still unconsumed

  if (consumeErr) {
    console.error("Failed to consume OAuth state:", consumeErr.message);
    return Response.redirect(`${appUrl}/?slack_error=state_already_used`, 302);
  }

  // ── 3. Exchange code for Slack access token ───────────────────────────────
  const clientId = Deno.env.get("SLACK_CLIENT_ID");
  const clientSecret = Deno.env.get("SLACK_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return Response.redirect(`${appUrl}/?slack_error=not_configured`, 302);
  }

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

  // ── 4. Upsert the Slack workspace mapping ─────────────────────────────────
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

  return Response.redirect(
    `${appUrl}/?workspace=${workspaceId}&slack_connected=1`,
    302
  );
});
