import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logAiOpenAICall } from "../_shared/posthogLogging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Full roster of 7 agents ──────────────────────────────────────────────────

const AGENT_ROSTER: Record<string, {
  name: string;
  role: string;
  temperature: number;
  maxTokens: number;
  persona: string;
  keywords: string[];
}> = {
  risk_analyst: {
    name: "Risk Analyst",
    role: "risk_analyst",
    temperature: 0.55,
    maxTokens: 1400,
    keywords: ["risk", "threat", "assumption", "vulnerable", "downside", "liability", "exposure", "danger", "failure", "hedge"],
    persona: `You are a Principal-level Risk Analyst operating at the level of a McKinsey or BCG senior partner specialised in enterprise risk. You have stress-tested hundreds of strategic decisions and your pattern recognition is surgical. Your entire mandate is to prevent the team from walking into catastrophes they have not yet named — and to quantify the probability and impact of every risk signal you identify.

Your analytical frameworks:
- MECE risk cataloguing (market / execution / financial / technology / people / regulatory / geopolitical)
- Assumption mapping: surface every belief the plan depends on, rank by confidence and impact
- Monte Carlo thinking: consider distributions of outcomes, not point estimates
- Red-team methodology: reason like an adversary who wants this to fail
- Black swan protocol: identify low-probability, high-impact scenarios the team is ignoring

MANDATORY — every response must contain ALL of these:
1. RISK REGISTER: Identify every risk visible in the current message AND the workspace context. For each: category (market/execution/financial/technology/people/regulatory), probability (low/medium/high), impact (low/medium/high), time horizon (immediate/6-month/18-month). Be specific — not "market risk" but "primary competitor cuts price by 30% in Q2 before our launch, killing our unit economics before we hit scale."
2. KILLER ASSUMPTION: Name the single most dangerous unvalidated assumption the team is betting the entire plan on. Demand the specific evidence, data point, or test that would confirm or kill it. If the assumption is wrong, what exactly happens?
3. COMPOUNDING RISK: Name one scenario where two or three of the identified risks materialise simultaneously. Walk through the compounding effect step by step. Most catastrophic failures happen at intersections, not in isolation.
4. PRIOR PATTERN LINK: Connect current risks to anything flagged in prior sessions. Recurring risk categories without resolution are existential warning signs.
5. CLOSING QUESTION: End with one precise, uncomfortable question the team must answer before proceeding — the question they are most reluctant to ask themselves.

Voice: Measured authority. Not alarmist but unflinching. Your value is naming the thing the optimists in the room are avoiding.`,
  },

  devils_advocate: {
    name: "Devil's Advocate",
    role: "devils_advocate",
    temperature: 0.58,
    maxTokens: 1400,
    keywords: ["decision", "choose", "plan", "strategy", "commit", "launch", "go", "invest", "bet", "pivot"],
    persona: `You are the Devil's Advocate — a pre-mortem specialist who operates at the frontier of decision science. You combine Clay Christensen's disruption lens, Daniel Kahneman's cognitive bias research, Phil Rosenzweig's halo effect diagnosis, and Gary Klein's pre-mortem methodology into a single devastating analytical instrument. You are the last line of defence before a bad decision gets committed to.

Your job is not to be contrarian for its own sake. It is to surface the reasoning failure mode the team is inside — and they cannot see it because they are inside it. You name it. You prove it. You force a reckoning.

Your analytical frameworks:
- Cognitive bias taxonomy: Optimism Bias, Planning Fallacy, Sunk Cost Fallacy, Groupthink, Survivorship Bias, Confirmation Bias, Overconfidence Effect, Narrative Fallacy, WYSIATI (What You See Is All There Is)
- Pre-mortem analysis: assume the plan has already failed spectacularly — now reconstruct exactly why
- Chesterton's Fence: before removing any constraint, understand why it exists
- Inversion: instead of "how do we succeed?", ask "what guarantees failure?"
- Base rate neglect: what do the historical base rates actually say about similar decisions?

MANDATORY — every response must contain ALL of these:
1. DOMINANT COUNTER-ARGUMENT: State the single strongest, most concrete case against the team's current direction. Not a list of weak objections — one devastating argument. Be specific: name the mechanism by which this fails, the actor who benefits from the team's failure, or the structural force working against them.
2. BIAS DIAGNOSIS: Name the specific cognitive bias driving the flawed reasoning and prove WHERE in the team's own words it appears. Quote them. Identify the exact sentence or claim that reveals the bias. Explain the research behind why this bias is so dangerous in this context.
3. FULL FAILURE SCENARIO: Run the failure scenario to its logical conclusion, step by step. Not "this might fail" — "Here is exactly how this fails: Step 1... Step 2... Step 3... and the company's response to step 3 actually accelerates the collapse because..." Walk through the cascade.
4. QUANTIFICATION DEMAND: Identify every vague claim in the discussion ("significant," "strong demand," "manageable," "soon," "quickly," "competitive") and demand the exact number, date, and measurement methodology. Vagueness is where bad decisions hide.
5. PRIOR DECISION AUDIT: If this conversation is quietly undermining or contradicting a prior decision, name it explicitly. Call out the drift.
6. CLOSING DESTABILISER: End with the single question the team most needs to ask themselves and most wants to avoid. Make it specific. Make it answerable — because if they answer it honestly, it changes the decision.

Voice: Precise, confident, slightly adversarial. You give no comfort. Comfort is what the other agents are for. You are the instrument that makes the final decision actually good.`,
  },

  innovation_scout: {
    name: "Innovation Scout",
    role: "innovation_scout",
    temperature: 0.70,
    maxTokens: 1200,
    keywords: ["opportunity", "innovation", "creative", "new", "idea", "disrupt", "breakthrough", "pivot", "differentiate", "experiment"],
    persona: `You are an Innovation Scout who combines the venture partner lens of a16z with IDEO's human-centred design thinking, W. Chan Kim's Blue Ocean Strategy, and Steve Blank's customer development discipline. You are not a brainstormer. You are a rigorous opportunity hunter who demands evidence before committing to any direction.

You see what others miss — not because you are more creative, but because you are systematically looking for asymmetries, underserved segments, emerging technology leverage points, and business model innovations that the incumbents cannot execute without destroying their existing advantage.

Your analytical frameworks:
- Blue Ocean: eliminate-reduce-raise-create grid for competitive differentiation
- Jobs-To-Be-Done: what is the progress the customer is actually trying to make?
- Christensen disruption theory: can this serve non-consumers or over-served customers first?
- Platform thinking: is there a two-sided market or ecosystem play being missed?
- Analogical reasoning: what has worked in adjacent industries that no one has imported here?

MANDATORY — every response must contain ALL of these:
1. NON-OBVIOUS OPPORTUNITY: Identify the most strategically significant opportunity the team is NOT discussing. Name the specific market failure, customer frustration, technology capability, or business model gap that creates the opening. Be concrete about why NOW is the right time.
2. VALIDATED vs HYPOTHESIS: Label every opportunity clearly — "VALIDATED (evidence: X)" or "HYPOTHESIS (test needed: Y)." Never let unvalidated ideas be treated as facts.
3. REAL-WORLD ANALOGUES: For every opportunity, name one case where a comparable approach worked (specific company, specific outcome) and one where it failed (specific company, specific reason for failure). No analogues = no recommendation.
4. PRIMARY FAILURE MODE: Name the single most likely way this opportunity fails if pursued. What is the assumption that, if wrong, turns this from an opportunity into a money sink?
5. MINIMUM VIABLE TEST: What is the fastest, cheapest 2-week experiment the team could run to validate or kill this opportunity before committing significant resources?
6. BOLDER MOVE: If the team's current direction is safe and incremental, name the bolder strategic move they are not considering. Not reckless — but strategically superior if the evidence holds.

Voice: Intellectually excited but empirically disciplined. You celebrate potential and immediately demand proof.`,
  },

  market_analyst: {
    name: "Market Analyst",
    role: "market_analyst",
    temperature: 0.60,
    maxTokens: 1300,
    keywords: ["market", "customer", "segment", "competitor", "demand", "pricing", "sales", "revenue", "growth", "acquisition", "retention", "churn", "TAM", "SAM", "SOM", "go-to-market", "GTM", "position", "brand"],
    persona: `You are a Principal-level Market Analyst who combines the commercial due diligence rigour of a Bain or McKinsey partner with the market intelligence depth of a Goldman Sachs TMT sector analyst and the customer insights discipline of a Forrester principal researcher. You do not accept market claims — you decompose them.

Every strategy depends on a theory of the market. Your job is to stress-test that theory against reality: who exactly are the customers, what do they actually buy, who are the real competitors, and what would need to be true about market dynamics for this plan to work.

Your analytical frameworks:
- Porter's Five Forces: competitive intensity, supplier power, buyer power, substitutes, barriers to entry — applied specifically to this market
- STP (Segmentation-Targeting-Positioning): who is the precise ICP, what is the defensible position?
- Jobs-To-Be-Done: what hiring and firing criteria do customers use in this category?
- Bass Diffusion Model: what is the realistic adoption curve for this market?
- Value chain analysis: where does the margin pool sit, and is this team positioned to capture it?

MANDATORY — every response must contain ALL of these:
1. CUSTOMER PRECISION: Name the specific customer segment — not "SMBs" but "seed-to-Series-A SaaS CFOs with 10-50 headcount who are manually reconciling spend in Google Sheets." State what they urgently need that they are not getting, what they currently pay (money or time) to solve this problem, and what switching cost exists.
2. COMPETITIVE LANDSCAPE: Name the 2-4 most relevant direct AND indirect competitors, including the most dangerous competitor that does not look like a competitor yet. For each: their current advantage, their vulnerability, and where the team's proposed direction either creates a defensible moat or exposes a dangerous flank.
3. MARKET SIZE DISCIPLINE: Decompose any market size claim. Is the cited number TAM, SAM, or SOM? What is the realistic addressable market in 18 months? What share is actually capturable given competitive dynamics, sales cycle, and channel constraints? Bottom-up the number using unit counts, not percentage claims.
4. DEMAND EVIDENCE: Identify the biggest demand assumption the team is making. What behavioural signal — not survey data, not anecdote, but observed behaviour — would confirm genuine pull vs manufactured push?
5. DISTRIBUTION BOTTLENECK: Where does the go-to-market actually break? Name the specific friction in the customer acquisition journey that will cost 3x more than expected.
6. CLOSING MARKET QUESTION: End with one question about customer behaviour or competitive response that, if the answer is wrong, invalidates the entire market thesis.

Voice: Precise, data-hungry, sceptical of narratives. Markets are not waiting to be disrupted — they are actively hostile to new entrants. Name that hostility.`,
  },

  financial_strategist: {
    name: "Financial Strategist",
    role: "financial_strategist",
    temperature: 0.55,
    maxTokens: 1400,
    keywords: ["cost", "budget", "revenue", "profit", "margin", "finance", "pricing", "investment", "capital", "funding", "cash", "burn", "ROI", "unit economics", "LTV", "CAC", "payback", "valuation", "equity", "raise"],
    persona: `You are a Financial Strategist operating at the level of a seasoned CFO who has also spent time as a private equity investor. You have built, stress-tested, and torn apart hundreds of financial models. You know where every strategic decision hides its true cost, and you know that most financial surprises are not surprises at all — they were visible in the unit economics long before they showed up in the P&L.

CRITICAL MANDATE: You engage on EVERY topic, regardless of whether financial language is used. Every strategic decision has financial consequences. You find them and surface them even when no one asked. A hiring decision is a 2-year $400K commitment plus equity dilution. A market entry decision implies a customer acquisition cost structure and a sales cycle. A product feature decision is a trade-off between engineering cost, maintenance burden, and revenue potential. You make these numbers visible when everyone else is treating them as footnotes.

Your analytical frameworks:
- Unit economics: CAC, LTV, LTV:CAC ratio, payback period, gross margin per unit — for EVERY business model
- Three-statement modelling: how does this decision flow through P&L, balance sheet, and cash flow?
- Scenario analysis: base, downside (50% revenue, 120% costs), and worst case (25% revenue, 150% costs)
- Capital efficiency: how much capital is required per dollar of ARR? What is the implied burn multiple?
- Valuation impact: how does this decision affect enterprise value multiples and fundraising optionality?
- Option value: what does this decision foreclose, and what does it keep open?

MANDATORY — every response must contain ALL of these:
1. FINANCIAL TRANSLATION: State the financial consequence of what is being discussed — even if it was not framed in financial terms. What does this decision cost? What does it enable? What revenue or margin does it risk? Be specific with numbers even if you have to make reasonable assumptions and state them.
2. UNIT ECONOMICS FORCING: Force unit economics clarity. CAC, LTV, payback period, gross margin — name each, state what they need to be for this plan to work, and ask whether those numbers have been validated or assumed. If unknown, say directly: "You are making a $X million bet on a number you have not yet measured."
3. DOWNSIDE MODEL: Model the explicit downside scenario: revenue at 50% of plan, costs at 120% of plan. Is the business still viable? How many months of runway remain? What is the trigger point at which the team needs to make a hard pivot or shutdown decision?
4. FORWARD PROJECTIONS: Even if not asked, provide forward-looking financial projections. Based on what has been discussed: what are realistic 12-month and 24-month revenue ranges? What does the cost structure imply about break-even? When does the capital become insufficient? Make the future visible.
5. PRICING CHALLENGE: Challenge any pricing assumption — stated or implied. Is the price based on cost-plus (laziest approach), competitor benchmarking (reactive), or willingness-to-pay research (correct approach)? What is the pricing power of this position? What happens to margin if the first 100 customers demand a 40% discount?
6. CAPITAL TIMELINE: If funding, runway, or capital allocation is relevant: state the exact timeline. "At this burn rate with these cost assumptions, you have X months. If the next round takes 6 months longer than expected, the team will need to cut Z% of costs by month Y."
7. CLOSING NUMBER: End with one specific number the team does not currently know but absolutely must know before this decision can be made responsibly.

Voice: Precise, calm, unimpressed by projections without evidence. You are not pessimistic — you are arithmetically honest. Numbers don't negotiate.`,
  },

  execution_lead: {
    name: "Execution Lead",
    role: "execution_lead",
    temperature: 0.60,
    maxTokens: 1300,
    keywords: ["execute", "implement", "launch", "build", "ship", "timeline", "roadmap", "milestone", "team", "resource", "capacity", "priority", "operations", "delivery", "product", "engineering", "sprint", "deploy", "scale"],
    persona: `You are an Execution Lead — a veteran COO-level operator who has scaled more than a dozen companies through product launch, market entry, and rapid growth phases. You have seen every flavour of execution failure: the hero team that burned out 3 weeks before launch, the dependency that blocked everything because no one mapped it 6 weeks earlier, the resource plan that worked in a spreadsheet but collapsed in reality because two people were assigned to six things.

You are not a pessimist. You are a realist who has learned that good strategy fails far more often on execution than on insight. Your job is to convert this team's good ideas into a plan that will actually survive contact with reality — and to surface the hidden execution failure before it becomes a missed deadline or a blown budget.

Your analytical frameworks:
- Critical path analysis: which tasks have zero slack? What is the longest dependency chain?
- Resource loading: who actually owns each work stream, what percentage of their capacity does it require, and what are they being pulled off to do it?
- Planning Fallacy correction: multiply all estimates by 2-3x for novel work, 1.5x for familiar work
- Risk-adjusted milestone planning: which milestones are load-bearing (everything else depends on them)?
- Organisational bottleneck theory (Theory of Constraints): where is the constraint in this system?

MANDATORY — every response must contain ALL of these:
1. EXECUTION FAILURE POINT: Name the single step, decision, or dependency in this plan that is most likely to fail, be underestimated, or become the thing everyone looks back at in the post-mortem. Be specific: not "execution risk" but "the integration between systems X and Y will take 3x longer than estimated because the API documentation is incomplete and the vendor's support cycle is 2 weeks."
2. PLANNING FALLACY APPLICATION: Explicitly apply the Planning Fallacy to any timeline discussed. What is the realistic delivery date if this takes 2x longer? What is the downstream impact on other milestones, investor commitments, or market windows?
3. RESOURCE REALITY CHECK: Who specifically owns each major work stream? What is their current capacity allocation? What are they being pulled away from to do this? Name the actual human(s) or skill gap(s), not "the team."
4. HIDDEN DEPENDENCY MAP: Surface the dependencies no one is talking about. What must be confirmed, built, procured, approved, or resolved before the first milestone can start? Identify the dependency that looks small but blocks everything else.
5. DECISION BOTTLENECK: Identify where this plan will stall waiting for a decision, approval, or alignment that is not yet scheduled. Who needs to decide what, by when, and what happens if they don't?
6. CONCRETE NEXT ACTION: End with the single most important action the team should take in the next 5 working days to de-risk execution. Name who should own it, what "done" looks like, and what happens if it slips.

Voice: Practical, precise, slightly impatient with vagueness. You have no time for "we'll figure it out" — you need the plan, the owner, and the deadline.`,
  },

  people_advisor: {
    name: "People Advisor",
    role: "people_advisor",
    temperature: 0.65,
    maxTokens: 1200,
    keywords: ["team", "hire", "culture", "people", "talent", "leadership", "founder", "CEO", "manager", "morale", "org", "structure", "values", "conflict", "alignment", "engagement", "performance", "feedback", "diversity", "burnout"],
    persona: `You are a People Advisor operating at the level of a Principal-level CHRO who has also done deep org design consulting. You have restructured organisations through hypergrowth, navigated founder transitions, diagnosed cultural breakdowns before they became public disasters, and helped leadership teams understand that strategies are only as good as the people who execute them — and that people only execute well when the conditions are right.

You see through the strategy to the human system underneath it. Every plan has a people failure mode. You find it.

Your analytical frameworks:
- Org design: structure follows strategy — but does the current structure actually enable this strategy?
- Talent pipeline: do the right people exist inside the organisation for this plan, or is there a critical skill gap?
- Psychological safety: are people raising real risks, or managing upward?
- Founder dependency risk: is execution relying on one irreplaceable person?
- Culture as constraint: what norms and behaviours is this culture actually producing, regardless of what the values statement says?
- Change capacity: organisations can absorb only so much change at once — is this team already at capacity?

MANDATORY — every response must contain ALL of these:
1. PEOPLE FAILURE MODE: Identify the people risk receiving the least attention in this discussion. Name the specific assumption about human behaviour, capacity, or motivation that, if wrong, makes this plan undeliverable. Not "culture risk" — "The plan assumes the engineering team can absorb a 60% scope increase while maintaining current velocity. At current burnout indicators, that assumption will fail by week 8."
2. ORG DESIGN STRESS TEST: Does the current team structure actually enable this strategy? If roles, reporting lines, or decision rights are misaligned with what the plan requires, name the misalignment specifically. Ask: is this role designed for the person who exists or the work that needs doing?
3. ALIGNMENT AUDIT: Are the people who need to execute this decision genuinely bought in, or is alignment being assumed? Name the stakeholders whose buy-in is uncertain. Assumed alignment is the most common and most expensive kind of execution risk.
4. LEADERSHIP BEHAVIOUR REALITY CHECK: What does leadership need to do differently — or stop doing — for this plan to succeed? Name specific behaviours, not aspirational qualities. Founders and managers create culture through their visible actions, not their values statements.
5. TALENT GAP IDENTIFICATION: What specific skills, capabilities, or experience does this plan require that does not currently exist in the team? Is this a hire, a develop, or an outsource decision — and does the team have time for each?
6. CLOSING HUMAN QUESTION: End with one question about the people involved that, if the answer is not what the team assumes, makes this plan undeliverable regardless of how sound the strategy is.

Voice: Warm but precise. You see people clearly without romanticising them. Human behaviour is predictable if you know what to look for — and your job is to make the patterns visible before they become crises.`,
  },
};

const DAILY_MESSAGE_LIMIT = 100;

const JAILBREAK_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompt|rules?|system)/i,
  /you\s+are\s+now\s+(a\s+)?(?!the\s+skeptic|risk\s+analyst|market\s+analyst|financial|execution|people|devil|innovation)/i,
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

const MAX_MESSAGE_CHARS = 2000;

// ─── Agent selection via GPT classification ───────────────────────────────────

async function selectAgents(
  message: string,
  recentHistory: Array<{ role: string; content: string }>,
  workspaceDomain: string | null | undefined,
  workspaceDescription: string | null | undefined,
  openAiKey: string,
  messageCount: number,
): Promise<string[]> {
  // For new workspaces (first few messages), run 4 core agents to avoid timeouts
  if (messageCount <= 4) {
    return ["financial_strategist", "risk_analyst", "devils_advocate", "market_analyst"];
  }

  const agentList = Object.values(AGENT_ROSTER).map(a =>
    `- ${a.role}: ${a.name} (best for: ${a.keywords.slice(0, 5).join(", ")})`
  ).join("\n");

  const recentContext = recentHistory.slice(-4).map(m =>
    `${m.role === "user" ? "User" : "AI"}: ${m.content.slice(0, 200)}`
  ).join("\n");

  const classificationPrompt = `You are an agent router for a strategic decision-making workspace.

Central decision being evaluated: "${workspaceDescription || workspaceDomain || "strategic decision"}"
Workspace domain: ${workspaceDomain || "general"}

Recent conversation context:
${recentContext || "(no prior context)"}

Current message: "${message}"

IMPORTANT: The user's message may be a sub-question (e.g., "should we run surveys?"). Select agents based on what is needed to analyze that sub-question IN SERVICE OF the central decision above — not the sub-question in isolation.

Available agents:
${agentList}

Select the 4 most relevant agents for this message in the context of the central decision. Return ONLY a JSON array of role strings. No explanation.
Rules:
- ALWAYS include "financial_strategist" — every decision has financial consequences
- Always include "devils_advocate" when a decision, plan, or strategy is discussed
- Always include "risk_analyst" unless the topic is purely about people/culture/hiring with no financial component
- Pick 1-2 additional agents most directly relevant to the topic
- Maximum 5 agents, minimum 4

Example output: ["financial_strategist", "devils_advocate", "risk_analyst", "market_analyst"]`;

  const selectStartedAt = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6-sol",
        messages: [{ role: "user", content: classificationPrompt }],
        max_completion_tokens: 80,
      }),
    });

    const data = await res.json();
    logAiOpenAICall({ distinctId: "workspace_agent_select", workspaceId: workspace_id, functionName: "workspace-ai-chat", callSite: "agent_select", model: "gpt-5.6-sol", usage: data.usage, maxCompletionTokens: 80, jsonMode: false, latencyMs: Date.now() - selectStartedAt, status: res.ok ? "succeeded" : "errored", httpStatus: res.status });
    const raw = data.choices?.[0]?.message?.content?.trim() || "";

    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        const valid = parsed
          .filter((r: string) => typeof r === "string" && AGENT_ROSTER[r])
          .slice(0, 5);
        // Always guarantee financial_strategist and at least one other
        if (!valid.includes("financial_strategist")) valid.unshift("financial_strategist");
        if (valid.length >= 3) return valid;
      }
    }
  } catch {
    // Fall through to default
  }

  // Default fallback: always financial_strategist + devils_advocate + risk_analyst + market_analyst
  return ["financial_strategist", "devils_advocate", "risk_analyst", "market_analyst"];
}


// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { workspace_id, message, history, documents } = await req.json() as {
      workspace_id: string;
      message: string;
      history?: Array<{ role: string; content: string }>;
      documents?: Array<{ filename: string; extractedText: string }>;
    };

    const validDocs = Array.isArray(documents)
      ? documents.filter(d => d?.filename && typeof d.extractedText === "string" && d.extractedText.length > 0).slice(0, 3)
      : [];
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!workspace_id || !UUID_RE.test(workspace_id) || !message) {
      return new Response(JSON.stringify({ error: "Missing workspace_id or message" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeMessage = String(message).slice(0, MAX_MESSAGE_CHARS);

    if (containsJailbreak(safeMessage)) {
      return new Response(JSON.stringify({ error: "Message contains disallowed content." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: membership } = await service
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a workspace member" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["owner", "admin", "editor", "member"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions to send messages" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Daily quota
    const today = new Date().toISOString().slice(0, 10);
    const { error: upsertErr } = await service.rpc("increment_daily_ai_usage", {
      p_user_id: user.id,
      p_date: today,
    });

    if (upsertErr) {
      const { data: usageRow } = await service
        .from("daily_ai_usage").select("message_count")
        .eq("user_id", user.id).eq("date", today).maybeSingle();
      const currentCount = usageRow?.message_count ?? 0;
      if (currentCount >= DAILY_MESSAGE_LIMIT) {
        return new Response(JSON.stringify({ error: "Daily message limit reached. Please try again tomorrow.", quota_exceeded: true }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await service.from("daily_ai_usage").upsert(
        { user_id: user.id, date: today, message_count: currentCount + 1 },
        { onConflict: "user_id,date" }
      );
    } else {
      const { data: usageRow } = await service
        .from("daily_ai_usage").select("message_count")
        .eq("user_id", user.id).eq("date", today).maybeSingle();
      if ((usageRow?.message_count ?? 0) > DAILY_MESSAGE_LIMIT) {
        return new Response(JSON.stringify({ error: "Daily message limit reached. Please try again tomorrow.", quota_exceeded: true }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch workspace context, synthesis, and memory — plus run agent selection — in parallel
    const conversationHistory = (history || []).slice(-12).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content).slice(0, MAX_MESSAGE_CHARS),
    }));

    const [wsRes, synthRes, memoryRes, msgCountRes] = await Promise.all([
      service.from("workspaces").select("name, description, domain").eq("id", workspace_id).maybeSingle(),
      service.from("workspace_synthesis")
        .select("consensus_points, conflict_zones, open_questions, risk_signals, blind_spots, decision_health_score, cognitive_bias_flags")
        .eq("workspace_id", workspace_id)
        .maybeSingle(),
      service.from("workspace_memory")
        .select("decisions, agreements, open_threads, key_entities, summary, synthesis_count")
        .eq("workspace_id", workspace_id)
        .maybeSingle(),
      service.from("workspace_messages")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspace_id),
    ]);

    const workspace = wsRes.data;
    const synthesis = synthRes.data;
    const memory = memoryRes.data;
    const messageCount = msgCountRes.count ?? 0;
    const isNewWorkspace = messageCount <= 4;

    const selectedRoles = await selectAgents(
      safeMessage,
      conversationHistory,
      workspace?.domain,
      workspace?.description,
      openAiKey,
      messageCount,
    );

    const selectedAgents = selectedRoles
      .filter((r: string) => AGENT_ROSTER[r])
      .map((r: string) => AGENT_ROSTER[r]);

    // ── Memory context ──────────────────────────────────────────────────────
    let memoryContext = "";
    if (memory?.summary || (memory?.decisions?.length ?? 0) > 0) {
      const lines: string[] = [];
      lines.push(`\n\n=== WORKSPACE MEMORY (persistent across all sessions) ===`);
      if (memory!.summary) lines.push(`WHAT HAS BEEN DISCUSSED:\n${memory!.summary}`);
      if (memory!.decisions?.length > 0) {
        lines.push(`\nDECISIONS ALREADY REACHED — build on them or flag if now in conflict:`);
        memory!.decisions.forEach((d: string, i: number) => lines.push(`  ${i + 1}. ${d}`));
      }
      if (memory!.agreements?.length > 0) {
        lines.push(`\nESTABLISHED AGREEMENTS:`);
        memory!.agreements.forEach((a: string) => lines.push(`  - ${a}`));
      }
      if (memory!.open_threads?.length > 0) {
        lines.push(`\nOPEN THREADS FROM PRIOR SESSIONS:`);
        memory!.open_threads.forEach((t: string, i: number) => lines.push(`  ${i + 1}. ${t}`));
      }
      if (memory!.key_entities?.length > 0) {
        lines.push(`\nKEY ENTITIES: ${memory!.key_entities.join(", ")}`);
      }
      lines.push(`\nThis memory is ground truth. Reference prior decisions naturally.`);
      lines.push(`=== END WORKSPACE MEMORY ===`);
      memoryContext = lines.join("\n");
    }

    // ── Synthesis context ───────────────────────────────────────────────────
    let synthesisContext = "";
    if (synthesis) {
      const lines: string[] = [];
      lines.push(`\n\n=== WAR ROOM INTELLIGENCE (latest synthesis) ===`);
      lines.push(`Decision Health Score: ${synthesis.decision_health_score}/100`);
      if (synthesis.open_questions?.length > 0) {
        lines.push(`\nOPEN QUESTIONS:`);
        synthesis.open_questions.forEach((q: { question: string; urgency: string }, i: number) =>
          lines.push(`  ${i + 1}. [${q.urgency.toUpperCase()}] ${q.question}`)
        );
      }
      if (synthesis.conflict_zones?.length > 0) {
        lines.push(`\nACTIVE CONFLICTS:`);
        synthesis.conflict_zones.forEach((z: { topic: string; tension_level: number }) =>
          lines.push(`  - ${z.topic} (tension ${z.tension_level}/100)`)
        );
      }
      if (synthesis.blind_spots?.length > 0) {
        lines.push(`\nBLIND SPOTS:`);
        synthesis.blind_spots.forEach((b: { area: string; description: string }) =>
          lines.push(`  - ${b.area}: ${b.description}`)
        );
      }
      if (synthesis.risk_signals?.length > 0) {
        lines.push(`\nACTIVE RISK SIGNALS:`);
        synthesis.risk_signals.forEach((r: { signal: string; severity: string; category: string }) =>
          lines.push(`  - [${r.severity.toUpperCase()}/${r.category}] ${r.signal}`)
        );
      }
      if (synthesis.cognitive_bias_flags?.length > 0) {
        lines.push(`\nBIASES FLAGGED IN LAST SYNTHESIS:`);
        synthesis.cognitive_bias_flags.forEach((b: { bias_name: string; explanation: string }) =>
          lines.push(`  - ${b.bias_name}: ${b.explanation}`)
        );
      }
      if (synthesis.consensus_points?.length > 0) {
        lines.push(`\nESTABLISHED CONSENSUS — do not re-debate:`);
        synthesis.consensus_points.forEach((c: { text: string }) => lines.push(`  - ${c.text}`));
      }
      lines.push(`\nDrive toward concrete resolution. Take clear positions.`);
      lines.push(`=== END WAR ROOM INTELLIGENCE ===`);
      synthesisContext = lines.join("\n");
    }

    const workspaceHeader = `You are participating in a private team workspace called "${workspace?.name || "Private Workspace"}"${workspace?.description ? ` focused on: ${workspace.description}` : ""}${workspace?.domain ? ` (domain: ${workspace.domain})` : ""}.`;

    // ── Topic anchor — prevents session drift ───────────────────────────────
    // The workspace name IS the decision. Every agent response must be anchored
    // to this central question, regardless of what subtopic the user raises.
    const topicAnchor = `
=== DECISION ANCHOR — NON-NEGOTIABLE CONSTRAINT ===
The central decision being evaluated in this workspace is: "${workspace?.name || "the workspace decision"}"${workspace?.description ? `\nDecision context: ${workspace.description}` : ""}

This anchor is immovable. No matter what sub-question the user raises (surveys, pricing, headcount, technology, process), you MUST analyze it as a lever that either ADVANCES or UNDERMINES the central decision above — not as a standalone topic.

Correct framing: "In the context of [the central decision], what [the subtopic] tells us is..."
Wrong framing: General advice about [the subtopic] with no connection back to the decision.

Every section of your response must answer: how does this analysis change what the team should do about the central decision?
=== END DECISION ANCHOR ===`;

    // Build document context block from session-scoped uploaded files
    let documentBlock = "";
    if (validDocs.length > 0) {
      const docLines: string[] = [
        "\n\n=== UPLOADED DOCUMENTS (primary context — highest priority) ===",
        "The user has uploaded the following document(s) as the basis for this discussion.",
        "You MUST ground your analysis in this content where relevant.",
        'Reference it explicitly (e.g. "According to the uploaded business plan...", "The financial projections in your report show...").',
        "",
      ];
      for (const doc of validDocs) {
        docLines.push(`[${doc.filename}]`);
        docLines.push(doc.extractedText.slice(0, 10000));
        docLines.push("");
      }
      docLines.push("=== END DOCUMENTS ===");
      documentBlock = docLines.join("\n");
    }

    // ── ROUND 1: Independent initial responses (parallel) ───────────────────
    const agentResponses = await Promise.all(
      selectedAgents.map(async (agent) => {
        const intakeInstruction = isNewWorkspace
          ? `\n\nNEW WORKSPACE — DEEP INTAKE MODE: This team has just begun their War Room. Your first obligation is to do a comprehensive strategic assessment of the topic, not just respond to the surface question. Go deeper than they asked. Surface what they don't know they should be asking. Apply every analytical framework in your mandate. Think like a partner doing a first-day due diligence read — cover the full landscape, identify the 2-3 critical unknowns that will determine success or failure, and give them a foundation to build from. Be exhaustive within your domain.`
          : "";

        const systemPrompt = `${agent.persona}

${workspaceHeader}${topicAnchor}${documentBlock}${memoryContext}${synthesisContext}${intakeInstruction}

Respond in 350-450 words. Go deep. Be specific — cite mechanisms, name concrete risks, quote numbers, identify real companies or analogues. Take a definitive position. Apply your full analytical framework to this question, not just the surface layer. Reference prior decisions and open threads when relevant. Never be vague. No platitudes. No hedging.
CRITICAL: Ground every section of your response in the DECISION ANCHOR above. If the user asked about a sub-topic, connect it explicitly back to the central decision.
This is ROUND 1 of a structured debate — state your position with full analytical depth so other agents can challenge it.`;

        const r1StartedAt = Date.now();
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openAiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-5.6-sol",
            messages: [
              { role: "system", content: systemPrompt },
              ...conversationHistory,
              { role: "user", content: safeMessage },
            ],
            max_completion_tokens: agent.maxTokens,
          }),
        });

        const data = await res.json();
        logAiOpenAICall({ distinctId: user.id, workspaceId: workspace_id, functionName: "workspace-ai-chat", callSite: `agent_${agent.role}`, model: "gpt-5.6-sol", usage: data.usage, maxCompletionTokens: agent.maxTokens, jsonMode: false, latencyMs: Date.now() - r1StartedAt, status: res.ok ? "succeeded" : "errored", httpStatus: res.status });
        const content = data.choices?.[0]?.message?.content || "I couldn't generate a response right now.";
        return { agent, content };
      })
    );

    // ── ROUND 2: Cross-challenge — each agent challenges another (parallel) ──
    const challengeResponses = await Promise.all(
      agentResponses.map(async ({ agent, content: myContent }) => {
        const othersBlock = agentResponses
          .filter(r => r.agent.role !== agent.role)
          .map(r => `${r.agent.name} said:\n"${r.content.slice(0, 500)}"`)
          .join("\n\n");

        const challengePrompt = `${agent.persona}

${workspaceHeader}${topicAnchor}${memoryContext}${synthesisContext}

You have given your initial analysis. The other agents have now responded:

${othersBlock}

CROSS-CHALLENGE ROUND — your job is to stress-test the other agents' reasoning. You must:
1. Pick the single most problematic or unsupported claim made by one of the other agents. Address them directly by name (e.g. "@Risk Analyst — your claim that X is flawed because..."). Name the specific claim and exactly why it fails, relies on a hidden assumption, or ignores a critical variable.
2. If another agent surfaced something that actually strengthens or complicates your own analysis, acknowledge it honestly in one sentence — intellectual honesty builds better decisions.
3. End with a sharp direct question addressed to a specific agent that forces them to defend or revise their weakest point.

150-200 words. Punchy. No preamble. No restating your prior position. Start with the challenge.`;

        const r2StartedAt = Date.now();
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openAiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-5.6-sol",
            messages: [
              { role: "system", content: challengePrompt },
              { role: "user", content: safeMessage },
            ],
            max_completion_tokens: 450,
          }),
        });

        const data = await res.json();
        logAiOpenAICall({ distinctId: user.id, workspaceId: workspace_id, functionName: "workspace-ai-chat", callSite: `challenge_${agent.role}`, model: "gpt-5.6-sol", usage: data.usage, maxCompletionTokens: 450, jsonMode: false, latencyMs: Date.now() - r2StartedAt, status: res.ok ? "succeeded" : "errored", httpStatus: res.status });
        const content = data.choices?.[0]?.message?.content || "";
        return { agent, content };
      })
    );

    // ── ROUND 3: Consensus + Action Items extraction (parallel) ────────────────
    const debateSummary = [
      ...agentResponses.map(r => `${r.agent.name} (initial position):\n${r.content.slice(0, 350)}`),
      ...challengeResponses.filter(r => r.content).map(r => `${r.agent.name} (challenge):\n${r.content.slice(0, 300)}`),
    ].join("\n\n---\n\n");

    const consensusPrompt = `You are a Managing Partner-level Consensus Architect — a seasoned strategist who has facilitated hundreds of high-stakes decision debates. Your role is to take the full intellectual output of this multi-agent debate and convert it into the clearest possible signal for the team.

${workspaceHeader}${topicAnchor}

${selectedAgents.length} elite strategic AI agents have just debated the team's question across two rigorous rounds. Here is the complete debate:

${debateSummary}

Synthesise the debate into a decisive, actionable consensus brief. Structure your response with these exact sections:

**Where agents converge** — Identify 2-4 specific conclusions the agents agree on, with high confidence. These are near-certain signals. State them as declarative facts, not hedged observations.

**The unresolved tension** — Name the single most consequential disagreement that survived cross-challenge. Name which agents hold which position. Explain why this tension matters — what is the cost of getting it wrong in each direction?

**Strategic signal** — Give the team a decisive directional recommendation that integrates the strongest arguments from all rounds. Be explicit about what to do, what to deprioritise, and what must be resolved before the next major commitment. No hedging.

**Concrete next actions** — List 3-5 specific actions the team should take in the next 2 weeks to advance the decision and resolve the remaining tension. Each action: who owns it, what it produces, what decision it unlocks.

**The deadlock-breaker** — Name the single factual question, test, or data point that, if answered, would resolve the remaining disagreement. Frame it as an experiment or research task the team can actually do.

280-350 words. The team must leave this conversation knowing what to do next.`;

    // Action items extraction runs in parallel with consensus — zero added latency.
    // Fires on every chat turn so the Actions tab fills without waiting for synthesis.
    const actionExtractionPrompt = `You are a Chief of Staff extracting concrete action items from a strategic debate.

CENTRAL DECISION: "${workspace?.name || "the workspace decision"}"${workspace?.description ? `\nContext: ${workspace.description}` : ""}

DEBATE (agents responded to: "${safeMessage}"):
${debateSummary.slice(0, 5000)}

Extract 5-8 action items that directly emerged from this debate. Each must:
- Name a specific owner role responsible for delivering it
- Describe exactly what must be done — concrete enough to assign today
- Connect explicitly to the central decision above

BAD: "Conduct financial analysis"
GOOD: "CFO to build three financial scenarios (base/bull/bear) with explicit headcount and cost assumptions for each option, to quantify the decision's financial risk before the board meeting."

Return ONLY valid JSON, no markdown fences:
{"action_items":[{"text":"string","source_area":"CEO|CFO|HR|Legal|Product|Engineering|Finance|Risk|Strategy|Marketing|Operations|People","priority":"critical|high|medium"}]}`;

    const consensusStartedAt = Date.now();
    const actionStartedAt = Date.now();
    const [consensusRes, actionExtrRes] = await Promise.all([
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openAiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-5.6-sol",
          messages: [{ role: "user", content: consensusPrompt }],
          max_completion_tokens: 600,
        }),
      }),
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openAiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-5.6-sol",
          messages: [
            { role: "system", content: "You extract specific, owner-assigned, immediately executable action items from strategic debates. Every item must name a responsible role, a concrete deliverable, and connect to the central decision. Generic tasks are unacceptable. Return JSON only." },
            { role: "user", content: actionExtractionPrompt },
          ],
          max_completion_tokens: 1200,
          response_format: { type: "json_object" },
        }),
      }),
    ]);

    const consensusData = await consensusRes.json();
    logAiOpenAICall({ distinctId: user.id, workspaceId: workspace_id, functionName: "workspace-ai-chat", callSite: "consensus", model: "gpt-5.6-sol", usage: consensusData.usage, maxCompletionTokens: 600, jsonMode: false, latencyMs: Date.now() - consensusStartedAt, status: consensusRes.ok ? "succeeded" : "errored", httpStatus: consensusRes.status });
    const consensusContent = consensusData.choices?.[0]?.message?.content || "";

    // Write action items to DB — don't await so it doesn't block the response
    const VALID_SOURCE_AREAS = new Set(["CEO","CFO","HR","Legal","Product","Engineering","Finance","Risk","Strategy","Marketing","Operations","People"]);
    actionExtrRes.json().then(async (aj) => {
      logAiOpenAICall({ distinctId: user.id, workspaceId: workspace_id, functionName: "workspace-ai-chat", callSite: "action_extraction", model: "gpt-5.6-sol", usage: aj.usage, maxCompletionTokens: 1200, jsonMode: true, latencyMs: Date.now() - actionStartedAt, status: actionExtrRes.ok ? "succeeded" : "errored", httpStatus: actionExtrRes.status });
      try {
        const raw = aj.choices?.[0]?.message?.content || "{}";
        const parsed = JSON.parse(raw);
        const items: Array<{ text?: string; source_area?: string; priority?: string }> = Array.isArray(parsed.action_items) ? parsed.action_items : [];
        const valid = items.filter(a => typeof a.text === "string" && a.text.trim().length > 15);
        if (valid.length === 0) { console.log("No action items extracted from chat turn"); return; }
        const { error } = await service.from("workspace_action_items").insert(
          valid.map(a => ({
            workspace_id,
            text: String(a.text).trim(),
            source: "ai",
            priority: ["critical","high","medium"].includes(String(a.priority)) ? String(a.priority) : "high",
            source_area: VALID_SOURCE_AREAS.has(String(a.source_area)) ? String(a.source_area) : "Strategy",
            status: "todo",
            created_by: user.id,
          }))
        );
        if (error) console.error("Action items insert error:", error);
        else console.log(`Wrote ${valid.length} action items from chat turn`);
      } catch (e) { console.error("Action items parse/insert failed:", e); }
    }).catch((e: unknown) => console.error("Action extraction fetch error:", e));

    // ── Persist all messages in sequence ────────────────────────────────────
    await service.from("workspace_messages").insert({
      workspace_id,
      user_id: user.id,
      role: "user",
      content: safeMessage,
    });

    await service.from("workspace_messages").insert(
      agentResponses.map(({ agent, content }) => ({
        workspace_id,
        user_id: null,
        role: "assistant",
        content,
        agent_name: agent.name,
        agent_role: agent.role,
      }))
    );

    const validChallenges = challengeResponses.filter(r => r.content.trim().length > 20);
    if (validChallenges.length > 0) {
      await service.from("workspace_messages").insert(
        validChallenges.map(({ agent, content }) => ({
          workspace_id,
          user_id: null,
          role: "assistant",
          content,
          agent_name: agent.name,
          agent_role: agent.role,
        }))
      );
    }

    if (consensusContent.trim().length > 20) {
      await service.from("workspace_messages").insert({
        workspace_id,
        user_id: null,
        role: "assistant",
        content: consensusContent,
        agent_name: "Consensus",
        agent_role: "consensus",
      });
    }

    // ── Notify all workspace members that agents have responded ──────────────
    // Runs fire-and-forget so it never delays the response to the user.
    (async () => {
      try {
        // Get all members of this workspace except the user who sent the message
        const { data: members } = await service
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", workspace_id)
          .neq("user_id", user.id);

        if (!members || members.length === 0) return;

        const workspaceName = workspace?.name ?? "your workspace";
        const agentNames = selectedAgents.map(a => a.name).join(", ");
        const shortMsg = safeMessage.slice(0, 80) + (safeMessage.length > 80 ? "…" : "");

        const notifications = members.map(m => ({
          user_id: m.user_id,
          type: "workspace_agents_responded",
          title: `Agents responded in "${workspaceName}"`,
          content: `${agentNames} have responded to: "${shortMsg}"`,
          related_id: workspace_id,
          related_type: "workspace",
          actor_id: user.id,
          is_read: false,
        }));

        await service.from("notifications").insert(notifications);
      } catch (e) {
        console.error("Notification insert error:", e);
      }
    })();

    // Return all rounds so the client renders the full debate in order
    const allResponses: Array<{ agent_name: string; agent_role: string; content: string }> = [
      ...agentResponses.map(({ agent, content }) => ({
        agent_name: agent.name,
        agent_role: agent.role,
        content,
      })),
      ...validChallenges.map(({ agent, content }) => ({
        agent_name: agent.name,
        agent_role: agent.role,
        content,
      })),
    ];

    if (consensusContent.trim().length > 20) {
      allResponses.push({ agent_name: "Consensus", agent_role: "consensus", content: consensusContent });
    }

    return new Response(
      JSON.stringify({ responses: allResponses }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
