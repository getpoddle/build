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

    // Check if user already has a workspace (as owner or member).
    const { data: existingMembership } = await service
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1);

    if (existingMembership && existingMembership.length > 0) {
      // Returning user — no first-sign-in onboarding needed.
      return new Response(
        JSON.stringify({ firstSignIn: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First sign-in: create a workspace.
    const firstName = (user.user_metadata?.first_name as string | undefined)?.trim();
    const workspaceName = firstName ? `${firstName}'s Workspace` : "My Workspace";

    const trialExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: ws, error: wsError } = await service
      .from("workspaces")
      .insert({
        name: workspaceName,
        description: "",
        domain: "general",
        owner_id: user.id,
        plan: "pro",
        seats: 3,
        workspace_type: "encrypted",
        is_encrypted: true,
        subscription_status: "trialing",
        trial_workspace_expires_at: trialExpiresAt,
        source: "app",
      })
      .select()
      .single();

    if (wsError || !ws) {
      console.error("first-sign-in: workspace creation failed:", wsError?.message);
      return new Response(JSON.stringify({ error: "Failed to create workspace" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add user as owner in workspace_members.
    const { error: memberError } = await service
      .from("workspace_members")
      .insert({
        workspace_id: ws.id,
        user_id: user.id,
        role: "owner",
      });

    if (memberError) {
      console.error("first-sign-in: member insert failed:", memberError.message);
      // Roll back the workspace
      await service.from("workspaces").delete().eq("id", ws.id);
      return new Response(JSON.stringify({ error: "Failed to set workspace owner" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pick a random seed thread and insert it.
    const { data: seedThread } = await service
      .from("workspace_seed_threads")
      .select("prompt, responses")
      .order("random()")
      .limit(1)
      .maybeSingle();

    if (seedThread) {
      // Insert the prompt as a user message authored by the new user.
      await service.from("workspace_messages").insert({
        workspace_id: ws.id,
        user_id: user.id,
        role: "user",
        content: seedThread.prompt,
      });

      // Insert each canned agent response as an assistant message.
      const responses = seedThread.responses as Array<{
        agent_name: string;
        agent_role: string;
        content: string;
      }>;

      if (Array.isArray(responses)) {
        const inserts = responses.map((r) => ({
          workspace_id: ws.id,
          user_id: null,
          role: "assistant",
          content: r.content,
          agent_name: r.agent_name,
          agent_role: r.agent_role,
        }));
        await service.from("workspace_messages").insert(inserts);
      }
    }

    // Mark profile as onboarded.
    await service.from("profiles").update({ onboarded: true }).eq("id", user.id);

    return new Response(
      JSON.stringify({ firstSignIn: true, workspaceId: ws.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("first-sign-in error:", msg);
    return new Response(JSON.stringify({ error: "Internal server error", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
