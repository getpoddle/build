import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NEVER_ACTIVATED_DAYS = 3;
const STALLED_DAYS = 3;
const COOLDOWN_DAYS = 7; // don't re-flag the same user within this window
const RECENT_THRESHOLD_DAYS = 30; // above this, use the "it's been a while" copy instead

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // Internal/cron only — same pattern as workspace-synthesize and
  // orchestrate-agent-run.
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const service = createClient(supabaseUrl, serviceKey);

  try {
    const now = new Date();
    const neverActivatedCutoff = new Date(now.getTime() - NEVER_ACTIVATED_DAYS * 86_400_000).toISOString();
    const stalledCutoff = new Date(now.getTime() - STALLED_DAYS * 86_400_000).toISOString();
    const cooldownCutoff = new Date(now.getTime() - COOLDOWN_DAYS * 86_400_000).toISOString();

    // Users already flagged within the cooldown window — skip these regardless of segment
    const { data: recentlyFlagged } = await service
      .from("reengagement_candidates")
      .select("user_id")
      .gte("created_at", cooldownCutoff);
    const cooldownUserIds = new Set((recentlyFlagged || []).map((r: { user_id: string }) => r.user_id));

    let inserted = 0;

    // ── Segment 1: never activated ──────────────────────────────────────────
    // Signed up more than NEVER_ACTIVATED_DAYS ago, has never owned a workspace.
    const { data: allProfiles, error: profilesErr } = await service
      .from("profiles")
      .select("id, first_name, created_at")
      .lte("created_at", neverActivatedCutoff);

    if (profilesErr) throw new Error(`profiles query failed: ${profilesErr.message}`);

    const { data: ownedWorkspaceRows } = await service
      .from("workspace_members")
      .select("user_id")
      .eq("role", "owner");
    const usersWithWorkspace = new Set((ownedWorkspaceRows || []).map((r: { user_id: string }) => r.user_id));

    for (const profile of allProfiles || []) {
      if (usersWithWorkspace.has(profile.id)) continue;
      if (cooldownUserIds.has(profile.id)) continue;

      const daysSinceSignup = Math.floor((now.getTime() - new Date(profile.created_at).getTime()) / 86_400_000);
      const firstName = profile.first_name || "there";
      const isOld = daysSinceSignup > RECENT_THRESHOLD_DAYS;

      const subject = "Your first decision is waiting";
      const body = isOld
        ? `Hi ${firstName},\n\nIt's been a while since you signed up for Poddle, and you haven't started your first decision workspace yet.\n\nHere's the fastest way in: pick one decision you're actually sitting on right now (a hire, a pricing change, a pivot you're weighing) and drop it into a new workspace. Poddle's War Room will pressure-test it from seven angles — risk, execution, people, finance, market, innovation, and a dedicated devil's advocate — before you commit.\n\nMost founders get real signal in under 10 minutes.\n\n[Start your first decision →]\n\nIf something's blocking you from getting started, just reply — I read these myself.\n\n— Olu`
        : `Hi ${firstName},\n\nYou signed up for Poddle a little while back, but haven't started your first decision workspace yet.\n\nHere's the fastest way in: pick one decision you're actually sitting on right now (a hire, a pricing change, a pivot you're weighing) and drop it into a new workspace. Poddle's War Room will pressure-test it from seven angles — risk, execution, people, finance, market, innovation, and a dedicated devil's advocate — before you commit.\n\nMost founders get real signal in under 10 minutes.\n\n[Start your first decision →]\n\nIf something's blocking you from getting started, just reply — I read these myself.\n\n— Olu`;

      const { error: insertErr } = await service.from("reengagement_candidates").insert({
        user_id: profile.id,
        workspace_id: null,
        segment: "never_activated",
        subject,
        body,
        status: "proposed",
      });
      if (!insertErr) inserted++;
      else console.error("Insert failed (never_activated):", insertErr);
    }

    // ── Segment 2: started, went quiet ───────────────────────────────────────
    // Owns a workspace, 1-2 messages ever sent, no synthesis generated, last
    // message older than STALLED_DAYS.
    const { data: ownedWorkspaces } = await service
      .from("workspace_members")
      .select("workspace_id, user_id")
      .eq("role", "owner");

    for (const ow of ownedWorkspaces || []) {
      if (cooldownUserIds.has(ow.user_id)) continue;

      const [synthRes, msgsRes, wsRes, profileRes] = await Promise.all([
        service.from("workspace_synthesis").select("workspace_id").eq("workspace_id", ow.workspace_id).maybeSingle(),
        service
          .from("workspace_messages")
          .select("created_at")
          .eq("workspace_id", ow.workspace_id)
          .order("created_at", { ascending: false }),
        service.from("workspaces").select("name, created_at").eq("id", ow.workspace_id).maybeSingle(),
        service.from("profiles").select("first_name").eq("id", ow.user_id).maybeSingle(),
      ]);

      if (synthRes.data) continue; // already synthesized — not stalled, it activated

      const messages = msgsRes.data || [];
      if (messages.length > 2) continue; // actively engaged, not stalled

      // Zero messages: workspace was created but nothing was ever sent — use
      // the workspace's creation date as the reference point, since there's
      // no message to anchor to. 1-2 messages: use the last message date.
      const isEmpty = messages.length === 0;
      const referenceAt = isEmpty ? wsRes.data?.created_at : messages[0]?.created_at;
      if (!referenceAt || referenceAt > stalledCutoff) continue; // not stalled long enough yet

      const daysSinceReference = Math.floor((now.getTime() - new Date(referenceAt).getTime()) / 86_400_000);
      const isOld = daysSinceReference > RECENT_THRESHOLD_DAYS;
      const firstName = profileRes.data?.first_name || "there";
      const workspaceName = wsRes.data?.name || "your decision";

      const subject = `Picking back up on ${workspaceName}?`;
      let body: string;
      if (isEmpty) {
        body = isOld
          ? `Hi ${firstName},\n\nIt's been a while since you created a workspace for "${workspaceName}" — but the discussion never actually started.\n\nDrop in what you're weighing and Poddle's War Room will pressure-test it from seven angles — risk, execution, people, finance, market, innovation, and a dedicated devil's advocate — before you commit.\n\n[Start the discussion →]\n\nIf this decision isn't relevant anymore, no worries — just curious what got in the way, if you have a second to reply.\n\n— Olu`
          : `Hi ${firstName},\n\nYou created a workspace for "${workspaceName}" but the discussion never actually started.\n\nDrop in what you're weighing and Poddle's War Room will pressure-test it from seven angles — risk, execution, people, finance, market, innovation, and a dedicated devil's advocate — before you commit.\n\n[Start the discussion →]\n\nIf this decision isn't relevant anymore, no worries — just curious what got in the way, if you have a second to reply.\n\n— Olu`;
      } else {
        body = isOld
          ? `Hi ${firstName},\n\nIt's been a while since you started a workspace for "${workspaceName}" — the discussion never got far enough to generate a War Room synthesis.\n\nA few messages is usually enough to get real output — the more context the agents have, the sharper the Decision Health Score and risk signals come back.\n\n[Pick up where you left off →]\n\nIf this decision isn't relevant anymore, no worries — just curious what got in the way, if you have a second to reply.\n\n— Olu`
          : `Hi ${firstName},\n\nYou started a workspace for "${workspaceName}" but it looks like the discussion never got far enough to generate a War Room synthesis.\n\nA few messages is usually enough to get real output — the more context the agents have, the sharper the Decision Health Score and risk signals come back.\n\n[Pick up where you left off →]\n\nIf this decision isn't relevant anymore, no worries — just curious what got in the way, if you have a second to reply.\n\n— Olu`;
      }

      const { error: insertErr } = await service.from("reengagement_candidates").insert({
        user_id: ow.user_id,
        workspace_id: ow.workspace_id,
        segment: "stalled",
        subject,
        body,
        status: "proposed",
      });
      if (!insertErr) inserted++;
      else console.error("Insert failed (stalled):", insertErr);
    }

    return new Response(JSON.stringify({ success: true, inserted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Detection error:", err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
