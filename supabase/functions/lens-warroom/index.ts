import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_QUESTION_CHARS = 400;
const MIN_QUESTION_CHARS = 8;

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.slice(7);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const question = typeof body.question === "string" ? body.question.trim() : "";

    if (!question || question.length < MIN_QUESTION_CHARS) {
      return new Response(JSON.stringify({ error: `Question too short (min ${MIN_QUESTION_CHARS} chars).` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (question.length > MAX_QUESTION_CHARS) {
      return new Response(JSON.stringify({ error: `Question too long (max ${MAX_QUESTION_CHARS} chars).` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(supabaseUrl, serviceKey);

    // Create a fresh, isolated workspace for this Lens question — same pattern
    // as the Slack slash command. Each analysis gets its own War Room.
    const workspaceName = question.length > 100 ? question.slice(0, 97) + "…" : question;
    const { data: newWorkspace, error: wsErr } = await service
      .from("workspaces")
      .insert({
        name: workspaceName,
        description: "Created from Poddle Lens",
        owner_id: user.id,
        source: "lens",
        plan: "pro",
        subscription_status: "trialing",
        trial_workspace_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        is_public: true,
      })
      .select("id")
      .single();

    if (wsErr || !newWorkspace) {
      return new Response(JSON.stringify({ error: "Failed to create workspace", detail: wsErr?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workspaceId = newWorkspace.id;

    await service.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role: "owner",
    });

    await service.from("workspace_messages").insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role: "user",
      content: question,
      metadata: { source: "poddle_lens" },
    });

    // Fire fast synthesis without awaiting — lens-synthesize uses a single
    // gpt-4o call (no regeneration/rationale/pattern rollup) for speed.
    fetch(`${supabaseUrl}/functions/v1/lens-synthesize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ workspace_id: workspaceId }),
    }).catch((err) => console.error("Lens synthesis trigger failed:", err));

    return new Response(JSON.stringify({
      ok: true,
      workspace_id: workspaceId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
