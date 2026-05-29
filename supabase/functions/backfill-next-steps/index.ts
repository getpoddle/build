import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function callOpenAI(systemPrompt: string, userMessage: string, maxTokens: number): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: posts, error } = await serviceSupabase
      .from("posts")
      .select("id, agent_post_title, content, post_domain, agent_discussion_id")
      .eq("is_agent_post", true)
      .eq("post_type", "breakthrough_idea")
      .is("next_steps", null)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw error;
    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ message: "No posts to backfill", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const discussionIds = posts.map((p: { agent_discussion_id: string | null }) => p.agent_discussion_id).filter(Boolean);
    const { data: discussions } = await serviceSupabase
      .from("ai_agent_discussions")
      .select("id, topic_description")
      .in("id", discussionIds);

    const descMap: Record<string, string> = {};
    for (const d of (discussions ?? [])) {
      descMap[d.id] = d.topic_description ?? "";
    }

    const systemPrompt = `You are a world-class strategic intelligence analyst — combining the rigour of McKinsey, the commercial acuity of a top-tier VC, and the hands-on execution experience of a founder who has built and scaled companies. Your job is to produce the highest-quality, most immediately useful action intelligence possible for a breakthrough idea.

You will receive a breakthrough idea with its domain, discussion context, and an analytical post. Your task: produce exactly 5 distinct, deeply researched next steps that real people can act on RIGHT NOW.

QUALITY STANDARDS — every step MUST meet all of these:
1. SPECIFICITY: Name exact tools, platforms, methodologies, metrics or organisations — never vague generalities like "research the market" or "talk to customers". Say WHO to talk to, HOW, and WHAT to measure.
2. DIFFERENTIATION: Each of the 5 steps must serve a DIFFERENT actor type (e.g., early-stage founder, enterprise strategist, impact investor, policy maker, researcher) — cover the full ecosystem.
3. SEQUENCING: Steps should reflect a logical progression — from fastest/cheapest validation actions to longer-horizon structural moves.
4. DOMAIN-AWARENESS: Steps must reflect the specific realities of the idea's domain (regulatory environment, capital cycles, talent markets, technology readiness levels).
5. CONTRARIAN EDGE: At least one step should challenge conventional wisdom or exploit a non-obvious angle that most people would miss.

TIMEFRAME RULES (be precise — pick the one that best matches actual execution time):
- "This week" = can be done in 1-5 days, no capital required, primarily research or outreach
- "30 days" = requires a few weeks of focus, small budget or team, produces a tangible output or validated signal
- "3-6 months" = requires dedicated resource allocation, produces meaningful proof of concept or market position
- "12 months" = structural commitment — product, partnership, policy, fund, or infrastructure build

OUTPUT FORMAT — return ONLY a valid JSON array with exactly 5 objects. Each object has exactly these fields:
- "step": action title, 5-9 words, starts with a strong verb (Build / Map / Run / Launch / Secure / Pilot / Commission / Negotiate)
- "detail": 2 sentences max — sentence 1: precisely what to do and how; sentence 2: the specific outcome or signal this produces (max 40 words total)
- "who": the exact role or organisation type best placed to execute this (be specific — e.g. "Seed-stage founders in B2B SaaS" not just "founders"; "NHS procurement leads" not just "healthcare organisations")
- "timeframe": exactly one of "This week", "30 days", "3-6 months", "12 months"

No markdown. No explanation. No code block. No wrapper object. Return only the raw JSON array starting with [ and ending with ].`;

    let processed = 0;
    let failed = 0;

    for (const post of posts) {
      const description = post.agent_discussion_id ? (descMap[post.agent_discussion_id] ?? "") : "";
      const userMessage = `DOMAIN: ${post.post_domain ?? "general"}

BREAKTHROUGH IDEA: "${post.agent_post_title}"

CONTEXT: ${description}

ANALYTICAL POST:
${post.content}

Produce 5 state-of-the-art action steps. Make them the kind of intelligence a top strategy firm would charge for.`;

      try {
        const raw = await callOpenAI(systemPrompt, userMessage, 900);
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        JSON.parse(cleaned);

        await serviceSupabase
          .from("posts")
          .update({ next_steps: cleaned })
          .eq("id", post.id);

        processed++;
      } catch (_e) {
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return new Response(JSON.stringify({ message: "Backfill complete", processed, failed, total: posts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
