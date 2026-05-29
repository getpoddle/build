import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const AI_AGENTS = [
  {
    name: "Strategic Analyst",
    role: "strategic_analyst",
    persona: "You are a rigorous strategic analyst. You examine assumptions, identify market forces, and provide structured frameworks. Be concise, direct, and data-driven.",
  },
  {
    name: "Devil's Advocate",
    role: "devils_advocate",
    persona: "You are a devil's advocate. Your job is to challenge ideas, poke holes in reasoning, and surface risks and blind spots. Be constructive but intellectually honest.",
  },
  {
    name: "Innovation Scout",
    role: "innovation_scout",
    persona: "You are an innovation scout. You identify breakthrough opportunities, emerging trends, and creative pivots. Think laterally and surface non-obvious angles.",
  },
];

// Daily message cap per user (3 OpenAI calls per message = 3× cost multiplier)
const DAILY_MESSAGE_LIMIT = 100;

// Jailbreak / prompt-injection patterns
const JAILBREAK_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompt|rules?|system)/i,
  /you\s+are\s+now\s+(a\s+)?(?!the\s+skeptic|risk\s+analyst|the\s+optimist|data\s+detective|the\s+pragmatist|strategic|devil|innovation)/i,
  /act\s+as\s+if\s+you\s+(are|were)\s+/i,
  /act\s+as\s+(an?\s+)?(AI|assistant|bot|model|chatbot|language\s+model|unrestricted|uncensored|evil|human\s+without\s+limits)/i,
  /pretend\s+(you\s+are|to\s+be|that\s+you)/i,
  /forget\s+(your|all)\s+(instructions?|rules?|guidelines?|persona)/i,
  /do\s+not\s+follow\s+(your\s+)?(instructions?|rules?|guidelines?)/i,
  /override\s+(your\s+)?(instructions?|system\s+prompt|rules?)/i,
  /jailbreak/i,
  /prompt\s+injection/i,
  /\bdeveloper\s+mode\b/i,
  /\bdan\s+mode\b/i,
];

function containsJailbreak(text: string): boolean {
  return JAILBREAK_PATTERNS.some(re => re.test(text));
}

// Truncate message to a safe token budget (~2000 chars ≈ ~500 tokens)
const MAX_MESSAGE_CHARS = 2000;

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

    const { workspace_id, message, history } = await req.json();
    if (!workspace_id || !message) {
      return new Response(JSON.stringify({ error: "Missing workspace_id or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Truncate and validate message
    const safeMessage = String(message).slice(0, MAX_MESSAGE_CHARS);

    // Jailbreak check
    if (containsJailbreak(safeMessage)) {
      return new Response(JSON.stringify({ error: "Message contains disallowed content." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify membership
    const { data: membership } = await service
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a workspace member" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Daily quota check — atomic upsert then read
    const today = new Date().toISOString().slice(0, 10);
    const { error: upsertErr } = await service.rpc("increment_daily_ai_usage", {
      p_user_id: user.id,
      p_date: today,
    });

    // Fall back to manual upsert if RPC not yet available
    if (upsertErr) {
      const { data: usageRow } = await service
        .from("daily_ai_usage")
        .select("message_count")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      const currentCount = usageRow?.message_count ?? 0;
      if (currentCount >= DAILY_MESSAGE_LIMIT) {
        return new Response(JSON.stringify({ error: "Daily message limit reached. Please try again tomorrow.", quota_exceeded: true }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await service
        .from("daily_ai_usage")
        .upsert({ user_id: user.id, date: today, message_count: currentCount + 1 }, { onConflict: "user_id,date" });
    } else {
      // Verify count after increment
      const { data: usageRow } = await service
        .from("daily_ai_usage")
        .select("message_count")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if ((usageRow?.message_count ?? 0) > DAILY_MESSAGE_LIMIT) {
        return new Response(JSON.stringify({ error: "Daily message limit reached. Please try again tomorrow.", quota_exceeded: true }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch workspace context + latest synthesis in parallel
    const [wsRes, synthRes] = await Promise.all([
      service.from("workspaces").select("name, description, domain").eq("id", workspace_id).maybeSingle(),
      service.from("workspace_synthesis").select("consensus_points, conflict_zones, open_questions, risk_signals, blind_spots, decision_health_score").eq("workspace_id", workspace_id).maybeSingle(),
    ]);
    const workspace = wsRes.data;
    const synthesis = synthRes.data;

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build synthesis context block if available
    let synthesisContext = "";
    if (synthesis) {
      const lines: string[] = [];
      lines.push(`\n\n=== WAR ROOM INTELLIGENCE CONTEXT ===`);
      lines.push(`Decision Health Score: ${synthesis.decision_health_score}/100`);

      if (synthesis.open_questions?.length > 0) {
        lines.push(`\nOPEN QUESTIONS (still unresolved — prioritize addressing these):`);
        synthesis.open_questions.forEach((q: { question: string; urgency: string }, i: number) => {
          lines.push(`  ${i + 1}. [${q.urgency.toUpperCase()}] ${q.question}`);
        });
      }
      if (synthesis.conflict_zones?.length > 0) {
        lines.push(`\nCONFLICT ZONES (agents disagree here — help resolve):`);
        synthesis.conflict_zones.forEach((z: { topic: string; position_a: string; position_b: string; tension_level: number }) => {
          lines.push(`  - ${z.topic} (tension ${z.tension_level}/100)`);
        });
      }
      if (synthesis.blind_spots?.length > 0) {
        lines.push(`\nBLIND SPOTS (topics the team hasn't addressed):`);
        synthesis.blind_spots.forEach((b: { area: string; description: string }) => {
          lines.push(`  - ${b.area}: ${b.description}`);
        });
      }
      if (synthesis.consensus_points?.length > 0) {
        lines.push(`\nESTABLISHED CONSENSUS (already agreed — build on these, don't re-debate):`);
        synthesis.consensus_points.forEach((c: { text: string }) => {
          lines.push(`  - ${c.text}`);
        });
      }
      lines.push(`\nYour responses should directly advance resolution of the unresolved items above. Be concrete, take clear positions, and push the team toward decisions.`);
      lines.push(`=== END WAR ROOM CONTEXT ===`);
      synthesisContext = lines.join("\n");
    }

    // Build responses from all 3 agents in parallel
    const agentResponses = await Promise.all(
      AI_AGENTS.map(async (agent) => {
        const systemPrompt = `${agent.persona}

You are participating in a private team workspace called "${workspace?.name || "Private Workspace"}"${workspace?.description ? ` focused on: ${workspace.description}` : ""}${workspace?.domain ? ` (domain: ${workspace.domain})` : ""}.${synthesisContext}

Keep responses under 250 words. Be specific, take clear positions, and push toward concrete decisions. Reference the unresolved questions and conflicts above when relevant. Do not use generic platitudes.`;

        const messages = [
          { role: "system", content: systemPrompt },
          ...(history || []).slice(-8).map((m: { role: string; content: string }) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: String(m.content).slice(0, MAX_MESSAGE_CHARS),
          })),
          { role: "user", content: safeMessage },
        ];

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            max_tokens: 800,
            temperature: 0.75,
          }),
        });

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "I couldn't generate a response right now.";
        return { agent, content };
      })
    );

    // Persist user message
    await service.from("workspace_messages").insert({
      workspace_id,
      user_id: user.id,
      role: "user",
      content: safeMessage,
    });

    // Persist all agent responses
    const agentInserts = agentResponses.map(({ agent, content }) => ({
      workspace_id,
      user_id: null,
      role: "assistant",
      content,
      agent_name: agent.name,
      agent_role: agent.role,
    }));
    await service.from("workspace_messages").insert(agentInserts);

    return new Response(
      JSON.stringify({ responses: agentResponses.map(({ agent, content }) => ({ agent_name: agent.name, agent_role: agent.role, content })) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
