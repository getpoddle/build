import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_QUESTION_CHARS = 400;
const MIN_QUESTION_CHARS = 8;

// Jailbreak / prompt-injection patterns
const JAILBREAK_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompt|rules?|system)/i,
  /you\s+are\s+now\s+(a\s+)?(?!the\s+skeptic|risk\s+analyst|the\s+optimist|data\s+detective|the\s+pragmatist)/i,
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
const RATE_LIMIT_PER_HOUR_PER_IP = 6;
const RATE_LIMIT_PER_HOUR_PER_SESSION = 4;
const RATE_LIMIT_PER_HOUR_AUTHENTICATED = 30;

interface Persona {
  agentName: string;
  displayName: string;
  systemPrompt: string;
  colorKey: string;
}

const DECISION_DISCIPLINE = `You are advising a real person who must make a real decision. You MUST:
- Pick a side. Say "do X" or "don't do X" in your first sentence.
- Ground it in the user's specific situation, not generic wisdom.
- Name one concrete thing they can do in the next 7 days.
- Never hedge with "it depends", "consider", "think about", or "weigh the pros and cons".
- Never list options back to them. They asked for guidance, not a menu.
- 2-3 short sentences. No bullet points. No preamble.`;

const PANEL: Persona[] = [
  {
    agentName: "The Skeptic",
    displayName: "The Skeptic",
    colorKey: "skeptic",
    systemPrompt:
      `You are The Skeptic. ${DECISION_DISCIPLINE} Start by naming the fatal flaw in the user's premise, then tell them exactly what to do differently. Be ruthless and specific.`,
  },
  {
    agentName: "Risk Analyst",
    displayName: "Risk Analyst",
    colorKey: "risk",
    systemPrompt:
      `You are Risk Analyst. ${DECISION_DISCIPLINE} Identify the single biggest downside risk of their leading option, quantify it with a concrete metric or example, then recommend the specific mitigation they should put in place this week.`,
  },
  {
    agentName: "The Optimist",
    displayName: "The Optimist",
    colorKey: "optimist",
    systemPrompt:
      `You are The Optimist. ${DECISION_DISCIPLINE} Name the highest-upside path they should commit to and the one real-world example or mechanism that proves it works. Tell them the first move to make.`,
  },
  {
    agentName: "Data Detective",
    displayName: "Data Detective",
    colorKey: "data",
    systemPrompt:
      `You are Data Detective. ${DECISION_DISCIPLINE} Anchor your recommendation in a specific number, benchmark, or base rate. Tell them what to do because the data says so, and name the one metric they should track starting this week.`,
  },
  {
    agentName: "The Pragmatist",
    displayName: "The Pragmatist",
    colorKey: "pragmatist",
    systemPrompt:
      `You are The Pragmatist. ${DECISION_DISCIPLINE} Skip theory. State the one action they should take in the next 7 days, who they should talk to, and how they will know if it worked.`,
  },
];

function isCareerDecision(question: string): boolean {
  const q = question.toLowerCase();
  const keywords = [
    "career", "job", "role", "promotion", "resign", "quit", "leave my", "new job",
    "offer letter", "job offer", "switch jobs", "change jobs", "change careers",
    "change career", "accept the offer", "take the offer", "take the job", "take this job",
    "counter offer", "counteroffer", "manager", "my boss", "my company",
    "stay at my", "leave my company", "get promoted", "salary negotiation",
    "negotiate salary", "interview", "laid off", "fired", "severance",
    "internship", "grad school vs", "go back to school", "mba or",
    "should i accept", "should i take", "should i quit", "should i leave",
    "join this startup", "join a startup", "go to faang", "big tech",
    "freelance", "go full-time", "consulting offer",
  ];
  return keywords.some(k => q.includes(k));
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const first = fwd.split(",")[0].trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

async function callOpenAI(systemPrompt: string, userMessage: string, maxTokens = 220): Promise<string> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("OpenAI API key not configured");

  const body = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: maxTokens,
    temperature: 0.8,
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${err}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const mode = typeof body.mode === "string" ? body.mode : "ask";

    if (mode === "poll") {
      const sessionId = typeof body.session_id === "string" ? body.session_id : "";
      if (!sessionId) {
        return new Response(JSON.stringify({ error: "Missing session_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: session } = await supabase
        .from("guest_ask_sessions")
        .select("id, status, discussion_id, question, completed_at, blocked")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!session || session.blocked) {
        return new Response(JSON.stringify({ status: "not_found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let turns: unknown[] = [];
      let discussion: Record<string, unknown> | null = null;
      if (session.discussion_id) {
        const [{ data: turnsData }, { data: discussionData }] = await Promise.all([
          supabase
            .from("ai_agent_discussion_turns")
            .select("agent_name, display_name, content, turn_number, created_at")
            .eq("discussion_id", session.discussion_id)
            .order("turn_number", { ascending: true }),
          supabase
            .from("ai_agent_discussions")
            .select("topic_title, tl_dr, key_quotes, discussion_status")
            .eq("id", session.discussion_id)
            .maybeSingle(),
        ]);
        turns = (turnsData ?? []).filter((t: { turn_number: number }) => t.turn_number > 0);
        discussion = discussionData;
      }

      return new Response(JSON.stringify({
        status: session.status,
        question: session.question,
        discussion_id: session.discussion_id,
        turns,
        discussion,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawQuestion = typeof body.question === "string" ? body.question.trim() : "";
    const clientSessionId = typeof body.session_id === "string" ? body.session_id.slice(0, 80) : "";

    if (!rawQuestion || rawQuestion.length < MIN_QUESTION_CHARS) {
      return new Response(JSON.stringify({ error: "Question too short (min 8 chars)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (rawQuestion.length > MAX_QUESTION_CHARS) {
      return new Response(JSON.stringify({ error: `Question too long (max ${MAX_QUESTION_CHARS} chars).` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (containsJailbreak(rawQuestion)) {
      return new Response(JSON.stringify({ error: "Message contains disallowed content." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!clientSessionId) {
      return new Response(JSON.stringify({ error: "Missing session_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = getClientIp(req);
    const ipHash = await sha256Hex(`${ip}|${new Date().toISOString().slice(0, 10)}`);

    // Sessions prefixed with "ext-{userId}-" are authenticated extension users.
    // Extract userId for a per-user limit instead of the stricter IP/guest limits.
    const extUserMatch = clientSessionId.match(/^ext-([0-9a-f-]{36})-/);
    const isAuthenticatedUser = !!extUserMatch;
    const authUserId = extUserMatch?.[1] ?? null;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    if (isAuthenticatedUser && authUserId) {
      const { count: userCount } = await supabase
        .from("guest_ask_sessions")
        .select("id", { count: "exact", head: true })
        .like("session_id", `ext-${authUserId}-%`)
        .gt("created_at", oneHourAgo);

      if ((userCount ?? 0) >= RATE_LIMIT_PER_HOUR_AUTHENTICATED) {
        return new Response(JSON.stringify({ error: "You've reached the hourly limit. Try again later.", rate_limited: true }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const [{ count: ipCount }, { count: sessionCount }] = await Promise.all([
        supabase
          .from("guest_ask_sessions")
          .select("id", { count: "exact", head: true })
          .eq("ip_hash", ipHash)
          .gt("created_at", oneHourAgo),
        supabase
          .from("guest_ask_sessions")
          .select("id", { count: "exact", head: true })
          .eq("session_id", clientSessionId)
          .gt("created_at", oneHourAgo),
      ]);

      if ((ipCount ?? 0) >= RATE_LIMIT_PER_HOUR_PER_IP) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Sign up to continue asking.", rate_limited: true }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if ((sessionCount ?? 0) >= RATE_LIMIT_PER_HOUR_PER_SESSION) {
        return new Response(JSON.stringify({ error: "You've asked enough questions for now. Sign up to continue.", rate_limited: true }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const activePanel = isCareerDecision(rawQuestion)
      ? PANEL.filter(p => p.agentName !== "Data Detective")
      : PANEL;

    const { data: discussion, error: discErr } = await supabase
      .from("ai_agent_discussions")
      .insert({
        topic_title: rawQuestion.slice(0, 160),
        topic_description: rawQuestion,
        discussion_status: "in_progress",
        agent_ids: [],
        agent_names: activePanel.map(p => p.agentName),
        agent_display_names: activePanel.map(p => p.displayName),
        turn_count: 0,
        is_guest_question: true,
      })
      .select("id")
      .single();

    if (discErr || !discussion) {
      return new Response(JSON.stringify({ error: "Failed to create discussion", details: discErr?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: askSession, error: sessErr } = await supabase
      .from("guest_ask_sessions")
      .insert({
        session_id: clientSessionId,
        ip_hash: ipHash,
        question: rawQuestion,
        discussion_id: discussion.id,
        status: "running",
      })
      .select("id")
      .single();

    if (sessErr || !askSession) {
      return new Response(JSON.stringify({ error: "Failed to create session", details: sessErr?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const work = (async () => {
      try {
        let turnNumber = 1;
        const quotes: { agent_name: string; display_name: string; quote: string }[] = [];

        for (const persona of activePanel) {
          let content = "";
          try {
            content = await callOpenAI(persona.systemPrompt, rawQuestion, 200);
          } catch (_e) {
            content = "";
          }
          if (!content) continue;

          await supabase.from("ai_agent_discussion_turns").insert({
            discussion_id: discussion.id,
            agent_id: null,
            agent_name: persona.agentName,
            display_name: persona.displayName,
            content,
            turn_number: turnNumber,
          });

          const firstSentence = content.split(/(?<=[.!?])\s+/)[0]?.trim() ?? content;
          quotes.push({
            agent_name: persona.agentName,
            display_name: persona.displayName,
            quote: firstSentence.slice(0, 200),
          });

          turnNumber++;
        }

        let tlDr = "";
        try {
          const turnsText = quotes.map(q => `${q.display_name}: ${q.quote}`).join("\n");
          const summarySystem = `You are synthesising a short panel of AI advisor responses into one punchy paragraph for a reader who just asked: "${rawQuestion}".
Rules: 2-4 sentences. No hedging. Name the concrete takeaway. Do not list the agents. Start with the answer, not a preamble.`;
          tlDr = await callOpenAI(summarySystem, turnsText, 180);
        } catch (_e) {
          tlDr = "";
        }

        const topQuotes = quotes.slice(0, 3);

        await supabase
          .from("ai_agent_discussions")
          .update({
            discussion_status: "completed",
            completed_at: new Date().toISOString(),
            turn_count: turnNumber - 1,
            tl_dr: tlDr || null,
            key_quotes: topQuotes,
            summary_generated_at: new Date().toISOString(),
          })
          .eq("id", discussion.id);

        await supabase
          .from("guest_ask_sessions")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", askSession.id);
      } catch (err) {
        await supabase
          .from("guest_ask_sessions")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", askSession.id);
        await supabase
          .from("ai_agent_discussions")
          .update({ discussion_status: "failed", completed_at: new Date().toISOString() })
          .eq("id", discussion.id);
        console.error("ask-agents worker failed:", err);
      }
    })();

    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as unknown as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil) {
      (EdgeRuntime as unknown as { waitUntil: (p: Promise<unknown>) => void }).waitUntil(work);
    } else {
      work.catch(() => {});
    }

    return new Response(JSON.stringify({
      ok: true,
      discussion_id: discussion.id,
      session_id: clientSessionId,
      panel: activePanel.map(p => ({ agent_name: p.agentName, display_name: p.displayName })),
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
