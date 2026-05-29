import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type EntityType = "problem" | "idea" | "prediction";

const AGENT_ROLES = [
  "The Skeptic",
  "Risk Analyst",
  "The Optimist",
  "Data Detective",
  "Devil's Advocate",
  "Systems Thinker",
  "Market Analyst",
  "Tech Futurist",
  "The Pragmatist",
  "The Historian",
];

const RESPONSE_TYPES_BY_ROLE: Record<string, string> = {
  "The Skeptic": "challenge",
  "Risk Analyst": "risk",
  "The Optimist": "support",
  "Data Detective": "question",
  "Devil's Advocate": "alternative",
  "Systems Thinker": "analysis",
  "Market Analyst": "analysis",
  "Tech Futurist": "support",
  "The Pragmatist": "analysis",
  "The Historian": "analysis",
};

async function callOpenAI(systemPrompt: string, userMessage: string, maxTokens = 500): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature: 0.8,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

async function handleAnalyzeEntity(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
) {
  const { entityId, entityType } = body as { entityId: string; entityType: EntityType };
  if (!entityId || !entityType) {
    return new Response(JSON.stringify({ error: "Missing entityId or entityType" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const table = entityType === "problem" ? "problems" : entityType === "idea" ? "ideas" : "predictions";
  const { data: entity, error } = await supabase.from(table).select("*").eq("id", entityId).maybeSingle();
  if (error || !entity) {
    return new Response(JSON.stringify({ error: "Entity not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const selectedAgents = AGENT_ROLES.sort(() => Math.random() - 0.5).slice(0, 3);
  const responses: { agent_role: string; response_type: string; content: string; confidence_score: number }[] = [];

  for (const agentRole of selectedAgents) {
    const responseType = RESPONSE_TYPES_BY_ROLE[agentRole] || "analysis";
    const systemPrompt = `You are "${agentRole}", an AI analyst. You are reviewing a ${entityType}. Provide a concise, insightful ${responseType} in 2-3 sentences. Be specific and actionable. Do not use generic statements.`;
    const userMessage = `${entityType.toUpperCase()}: "${entity.content}"${entity.domain ? `\nDomain: ${entity.domain}` : ""}`;

    try {
      const content = await callOpenAI(systemPrompt, userMessage, 200);
      const confidence = Math.floor(Math.random() * 30) + 55;
      responses.push({ agent_role: agentRole, response_type: responseType, content, confidence_score: confidence });
    } catch {
      responses.push({
        agent_role: agentRole,
        response_type: responseType,
        content: `Unable to generate ${responseType} at this time.`,
        confidence_score: 40,
      });
    }
  }

  const inserts = responses.map(r => ({
    entity_type: entityType,
    entity_id: entityId,
    agent_role: r.agent_role,
    response_type: r.response_type,
    content: r.content,
    confidence_score: r.confidence_score,
  }));

  await supabase.from("entity_agent_responses").insert(inserts);

  // Generate consensus
  const verdicts = responses.map(r => r.confidence_score > 65 ? "likely_valid" : r.confidence_score < 45 ? "likely_invalid" : "mixed");
  const avgConfidence = Math.round(responses.reduce((s, r) => s + r.confidence_score, 0) / responses.length);
  const majorityVerdict = verdicts.filter(v => v === "likely_valid").length >= 2 ? "likely_valid" :
    verdicts.filter(v => v === "likely_invalid").length >= 2 ? "likely_invalid" : "mixed";

  const consensusPrompt = `You are synthesizing multiple AI agent opinions about a ${entityType}. Provide a 1-2 sentence summary of the consensus. Be direct.`;
  const consensusInput = responses.map(r => `${r.agent_role} (${r.response_type}): ${r.content}`).join("\n");
  let summary = "Multiple agents have analyzed this entity with varying perspectives.";
  try {
    summary = await callOpenAI(consensusPrompt, consensusInput, 100);
  } catch {}

  await supabase.from("entity_consensus").insert({
    entity_type: entityType,
    entity_id: entityId,
    verdict: majorityVerdict,
    confidence_score: avgConfidence,
    summary,
    key_points: responses.map(r => `${r.agent_role}: ${r.content.slice(0, 80)}`),
    positions: responses.map(r => ({ role: r.agent_role, position: r.response_type, confidence: r.confidence_score })),
    agent_count: responses.length,
  });

  return new Response(JSON.stringify({ responses, consensus: { verdict: majorityVerdict, confidence: avgConfidence, summary } }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleLinkEntities(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  const { sourceType, sourceId, targetType, targetId, linkType } = body as {
    sourceType: EntityType; sourceId: string; targetType: EntityType; targetId: string; linkType: string;
  };

  if (!sourceType || !sourceId || !targetType || !targetId || !linkType) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase.from("entity_links").insert({
    source_type: sourceType,
    source_id: sourceId,
    target_type: targetType,
    target_id: targetId,
    link_type: linkType,
    created_by: userId,
    created_by_agent: false,
  }).select().maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ link: data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleUpdateStatus(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  const { entityId, entityType, newStatus, reason } = body as {
    entityId: string; entityType: EntityType; newStatus: string; reason: string;
  };

  if (!entityId || !entityType || !newStatus) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const table = entityType === "problem" ? "problems" : entityType === "idea" ? "ideas" : "predictions";
  const { data: entity } = await supabase.from(table).select("status").eq("id", entityId).maybeSingle();
  if (!entity) {
    return new Response(JSON.stringify({ error: "Entity not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const oldStatus = entity.status;
  await supabase.from(table).update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", entityId);

  await supabase.from("entity_state_transitions").insert({
    entity_type: entityType,
    entity_id: entityId,
    from_status: oldStatus,
    to_status: newStatus,
    reason: reason || "",
    triggered_by: userId,
    triggered_by_agent: false,
  });

  return new Response(JSON.stringify({ success: true, from: oldStatus, to: newStatus }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Deep persona definitions — each has a distinct analytical lens and speaking style
const AGENT_PERSONAS: Record<string, { systemCore: string; voiceRules: string }> = {
  "The Skeptic": {
    systemCore: `You are The Skeptic — a sharp, evidence-demanding analyst who finds the fatal flaw in every argument. You've seen countless ideas fail because of unexamined assumptions and you name them precisely. You do not hedge. You do not soften. You state the specific weakness and what it would take to overcome it.`,
    voiceRules: `- Lead with the single most damaging assumption or gap — name it explicitly.
- If numbers were cited, challenge whether they actually support the conclusion.
- End with what concrete evidence would change your mind.
- Never use: "interesting", "great point", "it depends", "consider", "you might want to".`,
  },
  "The Pragmatist": {
    systemCore: `You are The Pragmatist — a results-obsessed operator who has built things that actually shipped. You cut through theory to what works in the real world right now. You know exactly what gets done in week one versus what stays on a whiteboard forever. Your advice is always the next physical action, not a framework.`,
    voiceRules: `- Open with the single most important action to take in the next 7 days — be specific (who does what, where, how).
- If the discussion raised a question, answer it directly with a concrete path.
- Name the one bottleneck that will kill execution if not addressed.
- Never list options. Never say "you could". Say "do X because Y".`,
  },
  "Data Detective": {
    systemCore: `You are Data Detective — an analyst who anchors every opinion in quantifiable reality. You live in base rates, benchmarks, and empirical patterns. You distrust narratives without numbers. When you see a claim, your instinct is to find the statistic that either validates or destroys it.`,
    voiceRules: `- Cite a specific number, benchmark, case study, or industry statistic — make it directly relevant.
- If the claim contradicts known data, say so with the actual figure.
- Name the one metric that should be tracked to know if this is working or failing.
- Never make claims without grounding them in something measurable.`,
  },
  "Systems Thinker": {
    systemCore: `You are Systems Thinker — a strategist who sees feedback loops, second-order effects, and unintended consequences that everyone else misses. You've watched well-intentioned actions produce the opposite of their intended effect. You map cause-and-effect chains three steps deep and find the leverage point others walk past.`,
    voiceRules: `- Identify the second or third-order consequence that changes the picture entirely.
- Name the feedback loop or systemic dynamic at play.
- Point to the actual leverage point — the one change that shifts multiple outcomes.
- Never stop at surface-level cause and effect.`,
  },
  "Devil's Advocate": {
    systemCore: `You are Devil's Advocate — the strongest critic in the room. Your job is to steelman the opposition so completely that if the original argument can't survive your attack, it deserves to fail. You build the most rigorous case against the prevailing view, using logic and evidence, not cynicism.`,
    voiceRules: `- State the strongest counter-thesis in your opening sentence — not a question, a claim.
- Build the case with at least one concrete mechanism or example that supports the opposing view.
- Show what the proponents are misinterpreting or discounting.
- Never attack from cynicism. Attack from evidence and logic.`,
  },
  "Risk Analyst": {
    systemCore: `You are Risk Analyst — a professional who quantifies downside before upside. You've seen optimism destroy companies. Your job is to find the single biggest risk vector, put numbers on the probability and impact, and prescribe the exact mitigation that needs to happen before anything else.`,
    voiceRules: `- Name the single biggest risk with a specific probability and impact estimate.
- Describe the failure mode concretely — not "things could go wrong" but how they go wrong.
- Give the one mitigation that should happen this week to reduce that risk.
- Never be vague about what breaks and when.`,
  },
};

type CommentRow = {
  content: string;
  is_ai_correction: boolean;
  agent_role: string | null;
  profiles: { full_name: string } | null;
};

type IdeaRow = {
  content: string;
  domain: string;
  feasibility_score?: number;
  impact_score?: number;
  execution_steps?: unknown;
};

type ProblemRow = {
  content: string;
  domain: string;
  relevance_score?: number;
  signal_strength?: string;
  evidence_count?: number;
  solution_steps?: unknown;
};

type PredictionRow = {
  content: string;
  domain: string;
  confidence?: number;
  horizon_years?: number;
  evidence?: unknown;
  implications?: unknown;
  agent_role?: string;
  contrarian?: boolean;
};

function buildEntityContext(entityType: EntityType, entity: IdeaRow | ProblemRow | PredictionRow): string {
  const lines: string[] = [];

  if (entityType === "idea") {
    const e = entity as IdeaRow;
    lines.push(`IDEA (${e.domain?.replace(/_/g, " ") ?? "unknown domain"})`);
    if (e.feasibility_score) lines.push(`Feasibility: ${e.feasibility_score}/100`);
    if (e.impact_score) lines.push(`Impact: ${e.impact_score}/100`);
    lines.push(`\n${e.content}`);
    if (e.execution_steps && Array.isArray(e.execution_steps) && (e.execution_steps as unknown[]).length > 0) {
      const steps = (e.execution_steps as { step: string; timeframe: string; who: string }[]);
      lines.push(`\nProposed execution steps:`);
      steps.forEach((s, i) => lines.push(`  ${i + 1}. [${s.timeframe}] ${s.step} (for: ${s.who})`));
    }
  } else if (entityType === "problem") {
    const e = entity as ProblemRow;
    lines.push(`PROBLEM (${e.domain?.replace(/_/g, " ") ?? "unknown domain"})`);
    if (e.relevance_score) lines.push(`Relevance score: ${e.relevance_score}/100`);
    if (e.signal_strength) lines.push(`Signal strength: ${e.signal_strength}`);
    if (e.evidence_count) lines.push(`Evidence data points: ${e.evidence_count}`);
    lines.push(`\n${e.content}`);
    if (e.solution_steps && Array.isArray(e.solution_steps) && (e.solution_steps as unknown[]).length > 0) {
      const steps = (e.solution_steps as { step: string; timeframe: string }[]);
      lines.push(`\nSuggested solution steps:`);
      steps.forEach((s, i) => lines.push(`  ${i + 1}. [${s.timeframe}] ${s.step}`));
    }
  } else {
    const e = entity as PredictionRow;
    lines.push(`PREDICTION (${e.domain?.replace(/_/g, " ") ?? "unknown domain"})`);
    if (e.confidence) lines.push(`Confidence: ${e.confidence}%`);
    if (e.horizon_years) lines.push(`Time horizon: ${e.horizon_years} year${e.horizon_years > 1 ? "s" : ""}`);
    if (e.contrarian) lines.push(`Note: This is a contrarian prediction`);
    if (e.agent_role) lines.push(`Originating analyst: ${e.agent_role}`);
    lines.push(`\n${e.content}`);
    if (e.evidence && Array.isArray(e.evidence) && (e.evidence as unknown[]).length > 0) {
      lines.push(`\nEvidence:`);
      (e.evidence as string[]).forEach((ev, i) => lines.push(`  ${i + 1}. ${ev}`));
    }
    if (e.implications && Array.isArray(e.implications) && (e.implications as unknown[]).length > 0) {
      lines.push(`\nImplications if true:`);
      (e.implications as string[]).forEach((imp, i) => lines.push(`  ${i + 1}. ${imp}`));
    }
  }

  return lines.join("\n");
}

async function handleReplyToDiscussion(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
) {
  const { entityId, entityType } = body as { entityId: string; entityType: EntityType };
  if (!entityId || !entityType) {
    return new Response(JSON.stringify({ error: "Missing entityId or entityType" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const table = entityType === "problem" ? "problems" : entityType === "idea" ? "ideas" : "predictions";

  // Fetch full entity row — all fields for maximum context
  const [{ data: entity }, { data: allComments }] = await Promise.all([
    supabase.from(table).select("*").eq("id", entityId).maybeSingle(),
    supabase.from("entity_comments")
      .select("content, is_ai_correction, agent_role, profiles(full_name)")
      .eq("entity_id", entityId)
      .eq("entity_type", entityType)
      .order("created_at", { ascending: true })
      .limit(30),
  ]);

  if (!entity) {
    return new Response(JSON.stringify({ error: "Entity not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const comments = (allComments || []) as CommentRow[];
  const hasDiscussion = comments.some(c => !c.is_ai_correction && c.agent_role === null);

  // Pick agent — avoid repeating the last AI agent in the thread
  const lastAiAgent = [...comments].reverse().find(c => c.agent_role)?.agent_role;
  const agentKeys = Object.keys(AGENT_PERSONAS).filter(k => k !== lastAiAgent);
  const agentRole = agentKeys[Math.floor(Math.random() * agentKeys.length)];
  const persona = AGENT_PERSONAS[agentRole];

  // Build rich entity context with all metadata
  const entityContext = buildEntityContext(entityType, entity as IdeaRow | ProblemRow | PredictionRow);

  // Build conversation history as proper message turns for memory
  const conversationHistory: { role: "user" | "assistant"; content: string }[] = [];

  if (hasDiscussion || comments.length > 0) {
    for (const c of comments) {
      const isAiTurn = c.agent_role !== null || c.is_ai_correction;
      const speaker = isAiTurn
        ? (c.agent_role || "AI Critic")
        : ((c.profiles as { full_name?: string } | null)?.full_name || "User");

      if (isAiTurn) {
        conversationHistory.push({ role: "assistant", content: `[${speaker}]: ${c.content}` });
      } else {
        conversationHistory.push({ role: "user", content: `[${speaker}]: ${c.content}` });
      }
    }
  }

  const systemPrompt = `${persona.systemCore}

You have been given the full details of a ${entityType} — including its content, domain, scores, and structured metadata. Read it carefully before responding.

Your response rules:
${persona.voiceRules}
- Maximum 4 sentences. Every sentence must earn its place.
- Write in first person as ${agentRole}. Do not label your response with your name.
- Today's date context: ${new Date().toISOString().slice(0, 10)}.`;

  // Use OpenAI chat completions with full conversation history
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: hasDiscussion || comments.length > 0
        ? `Here is the ${entityType} in full:\n\n${entityContext}\n\n---\nThe conversation so far is threaded below. Read all of it. Your response should specifically address what has been raised.`
        : `Here is the ${entityType} in full:\n\n${entityContext}\n\n---\nNo one has commented yet. Deliver your opening analysis as ${agentRole}. Be sharp and specific.`,
    },
    ...conversationHistory,
    ...(hasDiscussion || comments.length > 0
      ? [{ role: "user" as const, content: `Now respond as ${agentRole}. Address the discussion directly. Be precise.` }]
      : []
    ),
  ];

  let responseText = "";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        max_tokens: 350,
        temperature: 0.75,
        presence_penalty: 0.3,  // discourage repeating what's already been said
        frequency_penalty: 0.2,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${err}`);
    }
    const data = await res.json();
    responseText = data.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!responseText) {
    return new Response(JSON.stringify({ error: "Empty AI response" }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: comment, error: insertError } = await supabase
    .from("entity_comments")
    .insert({
      entity_id: entityId,
      entity_type: entityType,
      user_id: null,
      content: responseText,
      is_ai_correction: false,
      agent_role: agentRole,
      parent_id: null,
    })
    .select()
    .single();

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ comment, agent_role: agentRole }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleDiscoverLinks(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
) {
  const { entityId, entityType } = body as { entityId: string; entityType: EntityType };
  if (!entityId || !entityType) {
    return new Response(JSON.stringify({ error: "Missing entityId or entityType" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const table = entityType === "problem" ? "problems" : entityType === "idea" ? "ideas" : "predictions";
  const { data: entity } = await supabase.from(table).select("content, pod_id").eq("id", entityId).maybeSingle();
  if (!entity) {
    return new Response(JSON.stringify({ error: "Entity not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find other entities in the same pod that might be related
  const otherTables = ["problems", "ideas", "predictions"].filter(t => t !== table + "s" && t !== table);
  const allOthers: { id: string; content: string; type: EntityType }[] = [];

  for (const otherTable of ["problems", "ideas", "predictions"]) {
    let query = supabase.from(otherTable).select("id, content").neq("id", entityId).limit(20);
    if (entity.pod_id) query = query.eq("pod_id", entity.pod_id);
    const { data } = await query;
    const type: EntityType = otherTable === "problems" ? "problem" : otherTable === "ideas" ? "idea" : "prediction";
    (data || []).forEach(item => allOthers.push({ id: item.id, content: item.content, type }));
  }

  if (allOthers.length === 0) {
    return new Response(JSON.stringify({ links: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const othersSummary = allOthers.slice(0, 10).map((o, i) => `${i + 1}. [${o.type}] ${o.content.slice(0, 100)}`).join("\n");

  const systemPrompt = `You identify relationships between reasoning objects (problems, ideas, predictions). Return ONLY a JSON array of objects with fields: index (1-based), linkType (one of: generates, solves, validates, invalidates, contradicts, supports, depends_on), strength (0-100). Only include genuinely related items. Return [] if none are related.`;
  const userMessage = `SOURCE (${entityType}): "${entity.content}"\n\nPOTENTIAL TARGETS:\n${othersSummary}`;

  let discovered: { index: number; linkType: string; strength: number }[] = [];
  try {
    const raw = await callOpenAI(systemPrompt, userMessage, 300);
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    discovered = JSON.parse(cleaned);
    if (!Array.isArray(discovered)) discovered = [];
  } catch {
    discovered = [];
  }

  const validLinkTypes = ["generates", "solves", "validates", "invalidates", "contradicts", "supports", "evolves", "spawns", "depends_on"];
  const linksToCreate = discovered
    .filter(d => d.index >= 1 && d.index <= allOthers.length && validLinkTypes.includes(d.linkType))
    .map(d => {
      const target = allOthers[d.index - 1];
      return {
        source_type: entityType,
        source_id: entityId,
        target_type: target.type,
        target_id: target.id,
        link_type: d.linkType,
        strength: Math.min(100, Math.max(0, d.strength || 70)),
        created_by: null,
        created_by_agent: true,
      };
    });

  if (linksToCreate.length > 0) {
    await supabase.from("entity_links").upsert(linksToCreate, { onConflict: "source_type,source_id,target_type,target_id,link_type" });
  }

  return new Response(JSON.stringify({ links: linksToCreate }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action as string;

    // Service-role actions (no user auth needed)
    const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`;
    if (isServiceRole && action === "discover-links") {
      return await handleDiscoverLinks(body, supabase);
    }
    if (isServiceRole && action === "analyze-entity") {
      return await handleAnalyzeEntity(body, supabase);
    }

    // User-authenticated actions
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "analyze-entity") {
      return await handleAnalyzeEntity(body, supabase);
    }
    if (action === "link-entities") {
      return await handleLinkEntities(body, supabase, user.id);
    }
    if (action === "update-status") {
      return await handleUpdateStatus(body, supabase, user.id);
    }
    if (action === "discover-links") {
      return await handleDiscoverLinks(body, supabase);
    }
    if (action === "reply-to-discussion") {
      return await handleReplyToDiscussion(body, supabase);
    }

    return new Response(JSON.stringify({ error: "Unknown action", action }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
