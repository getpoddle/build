import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Industry = "technology" | "finance" | "entrepreneurship";

const AGENT_ROLES: Record<Industry, string[]> = {
  technology: ["Tech Futurist", "Systems Thinker", "The Skeptic", "Data Detective", "Risk Analyst"],
  finance: ["Market Analyst", "Risk Analyst", "Devil's Advocate", "The Historian", "The Pragmatist"],
  entrepreneurship: ["The Pragmatist", "The Optimist", "Risk Analyst", "Systems Thinker", "Tech Futurist"],
};

type Seed = {
  headline: string;
  thesis: string;
  horizon_years: 5 | 10;
  confidence: number;
  signal_strength: "weak" | "building" | "strong";
  contrarian: boolean;
  evidence: string[];
  implications: string[];
};

const SEEDS: Record<Industry, Seed[]> = {
  technology: [
    {
      headline: "Neural interfaces move from medical novelty to consumer productivity tool between 2029 and 2032",
      thesis: "Non-invasive BCI wristbands and EEG earbuds cross the accuracy threshold where silent typing beats thumbs. Meta, Neurable, and Synchron each ship consumer SKUs. The first killer app is not gaming — it is hands-free agentic computing.",
      horizon_years: 5, confidence: 58, signal_strength: "weak", contrarian: true,
      evidence: ["Meta's sEMG wristband demos already at 30+ wpm silent typing", "Synchron's Stentrode in >10 human patients with reliable cursor control", "Apple Vision Pro eye+pinch validates the post-keyboard UX assumption"],
      implications: ["Keyboards become optional peripherals within a decade", "Accessibility tech becomes mass-market tech", "New privacy regime needed for ambient neural signal"],
    },
    {
      headline: "The open-weights frontier catches the closed frontier on most tasks by late 2027",
      thesis: "Compute is no longer the bottleneck; curated post-training data is. Distillation, synthetic reasoning traces, and community RLHF close the gap. For 80% of enterprise workloads, self-hosted open models become the default by 2028.",
      horizon_years: 5, confidence: 69, signal_strength: "building", contrarian: false,
      evidence: ["Llama, Qwen, DeepSeek, Mistral each within one generation of frontier on benchmarks", "Inference on MoE open models under $0.20 per million tokens", "Enterprise data-residency rules pushing teams off hosted APIs"],
      implications: ["API-only LLM startups squeezed between open models and hyperscaler bundles", "Model choice becomes a routing decision, not a vendor decision", "Fine-tuning studios become a category, not a feature"],
    },
    {
      headline: "Robotics foundation models create the first mass-market humanoid deployment by 2030",
      thesis: "Pretraining on multi-embodiment video plus simulation plus teleop logs produces general manipulation policies good enough for logistics, elder care, and restaurant back-of-house. The winner looks more like Tesla + Figure than Boston Dynamics.",
      horizon_years: 5, confidence: 61, signal_strength: "building", contrarian: false,
      evidence: ["Physical Intelligence's pi0 and Nvidia GR00T showing zero-shot transfer", "Figure, Agility, 1X, and Tesla all shipping early pilots in 2025-2026", "Unit-economics projections crossing minimum wage around 2028"],
      implications: ["Labor shortage in logistics papered over in wealthy markets first", "Humanoid fleet management becomes a SaaS category", "Safety and liability law re-litigated from scratch"],
    },
    {
      headline: "Most enterprise software replaces its UI with an agent by 2030",
      thesis: "The SaaS dashboard is an artefact of human-bandwidth constraints. Once agents can call tools reliably, the UI collapses to a chat + action-log + approval queue. Legacy SaaS either wraps itself in an agent or gets replaced by one.",
      horizon_years: 5, confidence: 72, signal_strength: "strong", contrarian: false,
      evidence: ["MCP protocol adoption by Anthropic, OpenAI, Google as the tool-call standard", "Salesforce Agentforce, ServiceNow Now Assist already reshaping dashboards", "Gartner reports 40% of enterprise app spend shifting to agent-layer by 2028"],
      implications: ["Seat-based SaaS pricing breaks; outcome-based pricing takes over", "Frontline staff upskill into agent supervisors", "Systems of record consolidate; systems of engagement fragment"],
    },
    {
      headline: "The dominant consumer social platform of 2032 is AI-native, not human-native",
      thesis: "The next generation of teens will prefer feeds where AI personas are first-class participants, not a gimmick. The line between creator and character blurs. This is not TikTok with AI — it is a new primitive: ambient, persistent, co-authored entertainment.",
      horizon_years: 10, confidence: 55, signal_strength: "weak", contrarian: true,
      evidence: ["Character.ai usage patterns show daily-active engagement 2-3x general-purpose chatbots", "Meta rolling out AI-character creators across Instagram and Facebook", "Teen survey data: 42% already interacting with at least one AI persona daily"],
      implications: ["Content authenticity labels become a legal regime, not a convention", "Advertising shifts from influencer to agent-sponsor", "New category of ''AI talent'' agencies emerges"],
    },
  ],
  finance: [
    {
      headline: "Tokenised treasuries cross $1T in AUM before 2029 and kill off money-market funds in emerging markets",
      thesis: "BlackRock BUIDL, Franklin OnChain, and Ondo are the vanguard. On-chain T-bills plus stablecoins give EM savers instant USD-yield exposure with no bank intermediary. Local MMF industries in the Global South lose their moat.",
      horizon_years: 5, confidence: 74, signal_strength: "building", contrarian: false,
      evidence: ["BUIDL crossed $2.5B in under 12 months", "MiCA provides the EU regulatory runway", "Retail demand in Nigeria, Argentina, Turkey already routing through USD stablecoin yields"],
      implications: ["Local banking systems face structural deposit flight", "Central banks in EMs forced to raise rates to defend spreads", "Tokenisation rail becomes systemic infrastructure, not a crypto niche"],
    },
    {
      headline: "The first fully AI-managed hedge fund beats a top-quartile human PM over a 5-year window before 2031",
      thesis: "Not an RL bot — a reasoning-model-driven PM agent with access to market, fundamental, and alternative data, operating inside a human-defined risk envelope. The point is not that AI beats humans; it is that the cost structure of the winning fund drops 80%.",
      horizon_years: 5, confidence: 60, signal_strength: "building", contrarian: true,
      evidence: ["Renaissance, Two Sigma, and Point72 all quietly building agent-PM stacks", "Public equity backtests of LLM-derived factors showing alpha in 2024-2025 papers", "First regulated AI-only fund licences in Abu Dhabi and Singapore"],
      implications: ["Active management fees compress to hedge-fund-minus-zero", "Talent moves from analyst to agent-ops roles", "Regulators introduce ''explainability audits'' for autonomous PMs"],
    },
    {
      headline: "At least one major pension system faces a solvency crisis between 2030 and 2034",
      thesis: "Aging demographics + private asset illiquidity + rising real rates collide. The canaries are Dutch, UK LDI-reliant, and US state pension systems. The crisis is not market-driven — it is denominator-effect-driven.",
      horizon_years: 5, confidence: 64, signal_strength: "building", contrarian: false,
      evidence: ["UK LDI 2022 episode was a preview, not a one-off", "Dutch pension transition creates forced-seller dynamics from 2028", "CalPERS, Illinois, New Jersey all projected funded ratios below 60% in downside scenarios"],
      implications: ["Generational politics in pensions becomes unavoidable", "Illiquid allocation limits get re-regulated", "Secondary market for LP stakes becomes a trillion-dollar asset class"],
    },
    {
      headline: "The US dollar's share of global FX reserves falls below 50% by 2032 — but not because of the yuan",
      thesis: "Multipolar de-dollarisation is real but slow. The gainers are gold, the euro, and a basket of mid-sized reserve currencies (AUD, CAD, SGD, CHF). The yuan remains capital-controlled and structurally capped.",
      horizon_years: 10, confidence: 56, signal_strength: "weak", contrarian: true,
      evidence: ["Central bank gold buying at record highs for 3 consecutive years", "USD share of IMF COFER already below 58% and declining", "Cross-border yuan settlement still under 3% of global trade"],
      implications: ["Gold re-legitimised as a tier-1 reserve asset", "Commodities increasingly priced in basket-terms", "Sanctions as a policy tool lose marginal effectiveness"],
    },
    {
      headline: "Climate-linked insurance becomes uneconomic in large parts of Florida, California, and southern Europe by 2030",
      thesis: "Reinsurers pull back first; primary insurers exit next; public state-backed pools become insurer of last resort. Property values in affected ZIP codes reprice downward 20-40%. This is the first visible wealth transfer from climate risk.",
      horizon_years: 5, confidence: 78, signal_strength: "strong", contrarian: false,
      evidence: ["State Farm, Allstate, AIG already exiting California markets", "Florida Citizens exposure now >$500B", "EU insurance regulator warnings on southern Europe wildfire risk"],
      implications: ["Mortgage market fractures along insurability lines", "Municipal bond spreads widen in exposed jurisdictions", "Managed retreat becomes an explicit fiscal policy"],
    },
  ],
  entrepreneurship: [
    {
      headline: "By 2029 more new companies are started by former operators of AI agents than by former engineers",
      thesis: "The archetype shifts. Engineers built SaaS; agent-ops people build autonomous businesses. The binding constraint is orchestration literacy and distribution, not code. YC and Techstars quietly reshape cohorts around this profile.",
      horizon_years: 5, confidence: 63, signal_strength: "building", contrarian: true,
      evidence: ["Recent accelerator cohorts leaning toward non-engineering founders with agent-ops backgrounds", "No-code + agent platforms hitting production reliability", "Rise of ''solo studio'' founders at Midjourney, Cursor, Photoroom scale"],
      implications: ["Founder curriculum splits: prompt-ops, systems-ops, code-ops", "Developer tools vendors pivot toward non-engineer buyers", "Capital efficiency at seed stage doubles"],
    },
    {
      headline: "Emerging market SMB software produces the next wave of $10B outcomes, not enterprise SaaS",
      thesis: "Flutterwave, Moniepoint, Nubank, Rappi, Meesho and their descendants have the demographic wind behind them. Mobile-native SMB workflows + embedded finance + local LLMs create defensible local flywheels where US SaaS cannot compete.",
      horizon_years: 5, confidence: 68, signal_strength: "building", contrarian: false,
      evidence: ["Nubank passes 100M customers in Latin America", "India's ONDC hits $100M GMV monthly", "African fintech corridor volumes compounding 30%+ annually"],
      implications: ["Global VC allocation rebalances to EM by 3-5 percentage points", "Local champions acquire rather than be acquired", "English-first product strategy becomes a disadvantage"],
    },
    {
      headline: "The first $100M ARR one-person company exists before 2028",
      thesis: "Not a creator business, not an affiliate play — a software or service business running at scale with one human founder and a fleet of agents. The bottleneck is distribution, and the founder who wins is the one who best understands a specific, unloved vertical.",
      horizon_years: 5, confidence: 65, signal_strength: "building", contrarian: true,
      evidence: ["Midjourney hit $200M ARR at <50 people", "Cursor, Perplexity, ElevenLabs each setting new revenue-per-employee records", "Freelance platforms reporting solo operators at $5M+ ARR already"],
      implications: ["VC deal sizing shrinks at seed; revenue-based financing expands", "M&A at low seven figures becomes the most active exit window", "The ''team-building'' skill becomes less central to founder identity"],
    },
    {
      headline: "Vertical AI roll-ups overtake traditional PE buyouts as the dominant mid-market strategy by 2031",
      thesis: "PE firms and ex-operators buy unglamorous services businesses (HVAC, dental, vet, legal back-office) and re-platform them on AI-native ops. The returns compound faster than leveraged buyouts because the cost curve bends downward over time.",
      horizon_years: 5, confidence: 70, signal_strength: "strong", contrarian: false,
      evidence: ["Thrasio-style consumer roll-ups failed; vertical services roll-ups are compounding", "Valsoft, Banyan, Topgrade, and dozens of micro-HoldCos now multi-unicorn", "Legacy PE firms spinning up dedicated AI-ops funds"],
      implications: ["Main Street M&A becomes the most active tech-adjacent category", "Operator-founder archetype surpasses the code-founder", "Private-equity league tables reshape around AI-ops capability"],
    },
    {
      headline: "Venture capital fund sizes bifurcate: sub-$100M nano-funds and $10B mega-funds dominate by 2030",
      thesis: "The middle dies. Seed is won by high-velocity nano-funds with sharp theses; growth is won by capital aggregators with data advantages. $200M–$800M funds — the industry's historical bread and butter — can't compete on either end.",
      horizon_years: 5, confidence: 66, signal_strength: "building", contrarian: true,
      evidence: ["Nano-fund formation at record highs; mid-sized fund-raising struggling", "Tiger, Andreessen, Thrive each crossing $10B vehicle scale", "LP allocation patterns favor barbell strategy"],
      implications: ["Junior-VC career paths compress; operator-investors dominate", "Portfolio support services become a standalone industry", "LP reporting becomes real-time and agent-assisted"],
    },
  ],
};

function pickUnused<T>(candidates: T[], used: Set<string>, keyOf: (c: T) => string): T | null {
  const available = candidates.filter(c => !used.has(keyOf(c)));
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

async function generateBatch(supabase: ReturnType<typeof createClient>, count: number) {
  const { data: existing } = await supabase
    .from("agent_predictions")
    .select("headline, industry");
  const usedHeadlines = new Set<string>(((existing as { headline: string }[] | null) || []).map(r => r.headline));

  const industries: Industry[] = ["technology", "finance", "entrepreneurship"];
  const inserted: string[] = [];

  for (let i = 0; i < count; i++) {
    const industry = industries[Math.floor(Math.random() * industries.length)];
    const seed = pickUnused(SEEDS[industry], usedHeadlines, s => s.headline);
    if (!seed) continue;

    const roles = AGENT_ROLES[industry];
    const agent_role = roles[Math.floor(Math.random() * roles.length)];

    const confJitter = Math.max(40, Math.min(95, seed.confidence + Math.floor((Math.random() - 0.5) * 8)));

    const { error } = await supabase.from("agent_predictions").insert({
      industry,
      agent_role,
      headline: seed.headline,
      thesis: seed.thesis,
      horizon_years: seed.horizon_years,
      confidence: confJitter,
      signal_strength: seed.signal_strength,
      contrarian: seed.contrarian,
      evidence: seed.evidence,
      implications: seed.implications,
    });
    if (!error) {
      inserted.push(seed.headline);
      usedHeadlines.add(seed.headline);
    }
  }

  return inserted;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let count = 1;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.count === "number") count = Math.max(1, Math.min(5, body.count));
      } catch { /* no body */ }
    }

    const inserted = await generateBatch(supabase, count);

    return new Response(
      JSON.stringify({ ok: true, inserted_count: inserted.length, headlines: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
