/*
  # Add Realistic Forecasts, Risks, and Scenarios
  
  1. Changes
    - Clears existing generic forecasts, risks, and scenarios
    - Adds 80+ realistic, specific forecasts with varied probabilities and detailed justifications
    - Adds 50+ diverse risks with specific mitigation considerations
    - Adds 60+ scenarios exploring different outcome pathways
  
  2. Notes
    - Each forecast includes specific data points and reasoning
    - Risks cover regulatory, technical, market, and competitive dimensions
    - Scenarios explore both optimistic and pessimistic trajectories
*/

-- Clear existing generic data
DELETE FROM assumption_forecasts;
DELETE FROM assumption_risks;
DELETE FROM assumption_scenarios;

-- Add realistic forecasts with specific justifications
DO $$
DECLARE
  v_assumption_id uuid;
  v_user_id uuid;
  v_assumption_title text;
BEGIN
  -- Get random users for diversity
  FOR v_assumption_id, v_assumption_title IN 
    SELECT id, title FROM pod_assumptions ORDER BY created_at
  LOOP
    -- Add 2-4 forecasts per assumption with varying perspectives
    
    IF v_assumption_title LIKE '%Non-US startups%55%' THEN
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 68, 'China and India combined added 47 unicorns in 2024 vs 28 in 2022. Southeast Asia VC funding grew 83% YoY. Brazil and Nigeria showing similar trajectories with improving infrastructure and talent pools.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 52, 'Directionally correct but 55% may be optimistic. US still dominates late-stage funding (72% of Series C+). Currency risks and exit market depth favor US. More realistic target: 45-48% by 2028.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 71, 'Stripe Atlas data shows 63% of new incorporations now from outside US. Remote work enables global talent arbitrage. Secondary markets in APAC maturing rapidly with 12 IPOs >$1B in 2024.');
    
    ELSIF v_assumption_title LIKE '%seed round%$5M%' THEN
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 74, 'Crunchbase data: median seed rose from $2.2M (2020) to $3.8M (2024). Tiger Global and a16z raising $5-8M seeds regularly. Inflation + runway expectations (18-24mo) driving this up.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 61, 'Possible but bifurcation likely. Top 20% startups getting $5-7M while median stays $3-3.5M. Market correction could compress rounds. Distinction between "seed" and "Series A" blurring.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 79, 'Already happening in AI/infrastructure. Anthropic seed: $124M, Character.AI: $150M. Even traditional SaaS seeing $4-6M standard. Cost to build and compete has increased 40% since 2020.');
    
    ELSIF v_assumption_title LIKE '%Profitability%7 years%4 years%' THEN
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 66, 'Public market punishment for cash burn forcing private companies to adapt. Klaviyo profitable at IPO, Datadog by year 5. Investors now requiring path to profitability in Series B deck. CAC payback <12mo becoming standard.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 58, 'Sector-dependent. Enterprise SaaS: yes (3-4yr path viable). Consumer social: no (still needs scale first). Hardware/biotech: definitely no. Weighted average likely 5 years, not 4.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 71, '87% of 2023 unicorns now profitable or on path within 18 months per Bessemer Cloud Index. Founder mindset shifted from growth-at-all-costs to efficient growth. AI tools reducing sales/eng costs 25-35%.');
    
    ELSIF v_assumption_title LIKE '%Remote-first%30% lower burn%' THEN
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 82, 'GitLab and Zapier data confirms 28-33% lower costs. Office ($45/sqft SF), perks ($1200/employee/mo), relocation eliminated. Access to tier-2 markets reduces eng salaries 20-40% without quality drop.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 69, 'True for pure remote. Hybrid models (most common) only save 15-18%. Hidden costs: collaboration tools (+$85/user/mo), communication overhead, retention challenges. Net savings likely 22-25%.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 77, 'Analyzing 200+ remote-first startups: median burn 31% lower through Series B. But time-to-market 15% slower on average. Trade-off depends on capital availability and competitive dynamics.');
    
    ELSIF v_assumption_title LIKE '%Secondary markets%liquidity%' THEN
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 73, 'Forge Global, Hiive, EquityBee processing $8B+ annually. Stripe employees accessed $2.1B liquidity pre-IPO. 67% of late-stage startups now have tender offers. Becoming standard retention tool.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 64, 'Growing but fragmented. Discounts of 30-50% to last primary round common. Liquidity available but not at fair value. Only top 10% of startups have real secondary markets. Retail investors still locked out.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 79, 'SpaceX $500M+ annual secondary volume proves viability. OpenAI tender at $86B valuation gave employees liquidity. IPO window uncertain, secondaries becoming primary exit for individuals even if company stays private.');
    
    ELSIF v_assumption_title LIKE '%AI%automate 35%' THEN
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 71, 'GitHub Copilot shows 46% faster code completion. Jasper/Copy.ai handling 65% of marketing copy. Legal doc review, financial analysis, customer support seeing 30-40% task automation. 35% aggregate is conservative.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 58, 'Task automation ≠ job automation. Like Excel automated calculations but created more analyst jobs. AI will automate tasks but humans will do more tasks. Net headcount impact likely <10%.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 68, 'Possible but uneven distribution. Clerical/routine cognitive: 50-60% automation. Creative/strategic: 15-25%. Data entry, basic analysis, scheduling, reporting highly automatable. Knowledge work becoming more specialized.');
    
    ELSIF v_assumption_title LIKE '%Hybrid human-AI%4x more productive%' THEN
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 76, 'Morgan Stanley wealth advisors + AI: 3.7x more client interactions. Radiologists + AI: 4.2x faster diagnosis with higher accuracy. Software eng + Copilot: 3.1x more PR merges. Pattern is consistent.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 63, '4x feels high. Realistic range is 1.8-2.5x for most knowledge work. Early adopters see bigger gains but mainstream adoption hits diminishing returns. Productivity measurement also questionable (busy ≠ valuable).');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 81, 'Understated if anything. AI handling 80% of routine allows humans to focus on high-leverage 20%. Quality of output improves, not just quantity. Seeing 3-5x improvements in consulting, design, research roles.');
    
    ELSIF v_assumption_title LIKE '%AI literacy%exceed supply%200M%' THEN
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 69, 'LinkedIn data: AI skill mentions up 432% in job postings, only 78% increase in candidate profiles. Burning Glass shows 1.9M unfilled AI-adjacent roles. Educational pipeline producing 180K/year, need is 650K/year.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 55, 'AI literacy becoming commoditized fast. Cursor/ChatGPT make it accessible to non-technical. Gap exists for advanced AI (ML engineering, research) but basic usage is democratizing rapidly. 200M overstates shortage.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 74, 'Correct magnitude. Every knowledge worker needs AI fluency within 3 years. Current workforce: 1.2B knowledge workers, <15% AI literate. Even with Coursera/Udacity scaling, supply gap is 150-250M.');
    
    ELSIF v_assumption_title LIKE '%Remote work%stabilize at 60%' THEN
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 67, 'Stanford WFH study: settled at 58% hybrid/remote for info workers post-pandemic. Return-to-office mandates losing momentum. Workers willing to take 8% pay cut to stay remote. Employer savings on real estate bake this in.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 72, 'Could go higher. Gen Z workers demand flexibility (83% say remote is priority). AI collaboration tools removing friction. Commercial real estate crisis forcing companies to downsize. 65-70% more likely than 60%.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 61, 'Depends on definition. Fully remote: 30%. Hybrid (2-3 days): 35%. In-office: 35%. Finance, consulting, enterprise pushing RTO. Tech, creative, ops staying flexible. Bifurcation by industry more than convergence.');
    
    ELSIF v_assumption_title LIKE '%AI ethics%mandatory%' THEN
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 78, 'EU AI Act requires responsible AI officers. US federal contractors need AI governance. 41% of F500 already have ethics boards. Insurance/liability considerations will drive adoption. Similar to data protection officers post-GDPR.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 64, 'Title creep risk. May get lumped into existing compliance/legal roles rather than dedicated position. Smaller companies (500-2000 employees) likely outsource vs hire. Only tier-1 tech companies need full-time ethics teams.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 82, 'Liability exposure from algorithmic bias, privacy violations, safety incidents will mandate this. AI ethics = risk management. Boards demanding governance frameworks. Every company using AI at scale needs dedicated oversight by 2026.');
    
    ELSIF v_assumption_title LIKE '%Multi-hyphenate%45%%' THEN
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 71, 'Gig economy + passion economy + AI tools enabling multiple income streams. Substack writers + consultants + investors common. "Slash careers" (designer/podcaster/advisor) are cultural norm for millennials/Gen-Z.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 59, 'Selection bias. Multi-hyphenate is loud minority on Twitter. Most people still want one job with benefits. Economic necessity may force portfolio income, but 45% seems high. 25-30% more realistic.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 68, 'Already at 38% per McKinsey independent worker survey. Growth accelerating 8% annually. Healthcare decoupling from employment removes major barrier. Platforms (Contra, Toptal, Maven) making it easier to monetize multiple skills.');
    
    ELSIF v_assumption_title LIKE '%job tenure%2.5 years%' THEN
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 73, 'BLS data shows tech workers at 2.8 years median tenure currently. 20-25% salary increases for job hopping vs 3-5% raises. Loyalty is dead, skills are portable, vesting schedules front-loaded. Trend is clear.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 67, 'Directionally right. Might stabilize at 3.0 years vs 2.5. Too-frequent job hopping still stigmatized (1-year tenures are red flags). Sweet spot is 2-3 years: long enough to show impact, short enough to optimize compensation.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 79, 'We are already there in tech. Median tenure for engineers: 2.3 years. Product: 2.6. Design: 2.1. Only executives stay 4+. Institutional knowledge evaporating but companies adapting with better docs/onboarding.');
    
    ELSIF v_assumption_title LIKE '%Skills half-life%3 years%' THEN
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 76, 'IBM research: tech skills obsolete in 2.5 years. React hooks (2019) made class components legacy. GPT-4 changed entire ML engineering practice in 12 months. Continuous learning is only constant now.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 68, 'Tool-level skills: yes, 2-3 years. Fundamental skills (systems thinking, communication, problem solving): 10+ year half-life. Smart workers focus on durable skills, treat tools as commodities to be learned as needed.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 81, 'Accelerating further. AI will make current skills obsolete faster than we can teach new ones. T-shaped -> M-shaped -> comb-shaped professionals. Meta-skill is "learning how to learn" with 1-2 year reinvention cycles.');
    
    ELSIF v_assumption_title LIKE '%Internal mobility%reduce%40%' THEN
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 69, 'Gartner data: companies with talent marketplaces see 35-42% reduction in external hiring. Lower risk, faster ramp, better retention. Schneider Electric, Unilever, Mastercard cutting backfill costs 30-45%.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 61, 'Works for large orgs (5000+ employees). Smaller companies lack candidate pool. Manager hoarding still a barrier. Only 23% of companies have real mobility programs. Aspiration vs reality gap is wide.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 74, 'Retention impact is bigger than headline stat. Keeping top performers worth 3-5x their salary. Internal mobility extends tenure 2-3 years on average. ROI calculation: 40% fewer external hires + 25% better retention = massive savings.');
    
    ELSE
      -- Default forecasts for remaining assumptions
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 60 + (random() * 25)::int, 'Early data from pilot programs shows 15-30% improvement in key metrics, though sample size is limited. Larger-scale deployment needed to validate with statistical significance.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 55 + (random() * 30)::int, 'Directionally plausible but timeline seems optimistic given implementation challenges and change management requirements. External dependencies could shift outcomes by 12-18 months.');
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
      VALUES (v_assumption_id, v_user_id, 65 + (random() * 20)::int, 'Three independent research studies corroborate core thesis with confidence intervals of 70-85%. Historical precedent from similar transitions supports viability with appropriate resourcing.');
    END IF;
  END LOOP;
END $$;

-- Add specific, realistic risks
DO $$
DECLARE
  v_assumption_id uuid;
  v_user_id uuid;
  v_assumption_title text;
  v_counter int := 0;
BEGIN
  FOR v_assumption_id, v_assumption_title IN 
    SELECT id, title FROM pod_assumptions ORDER BY created_at
  LOOP
    v_counter := v_counter + 1;
    
    -- Add 1-2 specific risks per assumption
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    
    IF v_assumption_title LIKE '%Non-US startups%' THEN
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Geopolitical fragmentation risk', 'US-China decoupling, sanctions, and capital controls could create two separate venture ecosystems. Cross-border investments declining 34% YoY. Regulatory barriers (CFIUS, CAC) making global rounds harder.', 4);
      
      IF random() > 0.5 THEN
        SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
        INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
        VALUES (v_assumption_id, v_user_id, 'Exit market depth concerns', 'Non-US public markets lack depth for tech. Nasdaq still captures 78% of tech IPOs globally. Secondary sales and private equity may not provide same liquidity/valuations as US exits.', 3);
      END IF;
    
    ELSIF v_assumption_title LIKE '%seed round%$5M%' THEN
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Market correction vulnerability', 'Seed sizes are at cycle peak. Bear market could compress rounds 30-50% quickly like 2022-23. Current $5M seeds assume continued capital availability which may not persist.', 4);
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Valuation inflation cascade', 'Larger seeds at higher valuations create difficult Series A bars. Need 3-4x growth for up-round. 67% of 2023 $5M+ seeds struggling to raise A. Down rounds and wipeouts increasing.', 3);
    
    ELSIF v_assumption_title LIKE '%Profitability%compress%' THEN
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Premature optimization risk', 'Pushing profitability too early can mean underfunding growth. Competitors with more capital can out-invest in market share. Fine line between efficient and starved.', 3);
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Category-dependent variance', 'Infrastructure and marketplace businesses need scale before unit economics work. Consumer social requires network effects first. Applying SaaS profitability timelines to other models is dangerous.', 3);
    
    ELSIF v_assumption_title LIKE '%Remote-first%lower burn%' THEN
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Hidden coordination costs', 'Async communication overhead, timezone challenges, reduced spontaneous collaboration. What saves in office costs may lose in velocity. Hybrid models see 18% lower productivity per Stanford study.', 3);
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Retention and culture decay', 'Remote employees 21% more likely to leave. Culture building is harder. Early-stage startups need density for rapid iteration. Savings on burn may cost 6-12 months of time-to-market.', 4);
    
    ELSIF v_assumption_title LIKE '%Secondary markets%liquidity%' THEN
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Valuation discovery dysfunction', 'Illiquid secondary markets with 30-50% discounts create misaligned expectations. Employees selling at discount demoralizes those who hold. Insider selling signals lack of confidence to market.', 3);
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Regulatory tightening risk', 'SEC scrutiny of secondary trading increasing. Potential changes to who can access markets, disclosure requirements, lock-up rules. Similar to crowdfunding regulations limiting effectiveness.', 3);
    
    ELSIF v_assumption_title LIKE '%AI%automate 35%' THEN
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Deployment-reality gap', 'GPT-4 impressive in demo, messy in production. Hallucinations, reliability issues, integration complexity slow adoption. Task automation in lab ≠ task automation in enterprise. 35% likely overstates near-term impact.', 3);
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Social and regulatory backlash', 'Job displacement fears could trigger regulation slowing AI adoption. EU AI Act already restrictive. Union pressure, public sentiment may limit where AI can be deployed, especially in government and healthcare.', 4);
    
    ELSIF v_assumption_title LIKE '%Hybrid human-AI%4x%' THEN
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Productivity measurement challenges', 'Faster output ≠ better outcomes. AI may increase quantity while reducing quality. "Productivity theater" where people look busy but value creation unclear. Hard to measure knowledge work productivity reliably.', 3);
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Over-reliance and deskilling', 'Workers becoming dependent on AI for tasks they should understand fundamentally. Loss of core competencies. When AI fails, humans can not pick up slack. Junior employees never learning foundational skills.', 4);
    
    ELSIF v_assumption_title LIKE '%AI literacy%200M%' THEN
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Commoditization faster than expected', 'AI interfaces becoming so simple that "literacy" is not a differentiator. Like how typing is not a specialized skill. Everyone will use AI, few will need deep literacy. Demand spike may be short-lived.', 3);
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Education system inability to adapt', 'Universities and bootcamps teaching 2-year-old content in fast-moving field. By time students graduate, curriculum is obsolete. Self-learning may be only path, leaving most workers behind.', 4);
    
    ELSIF v_assumption_title LIKE '%Remote work%60%%' THEN
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'RTO mandate momentum shift', 'Amazon, Disney, Salesforce forcing full RTO. If recession hits, employer leverage increases. Workers may lose bargaining power. Could snap back to 35-40% remote if economic conditions change.', 3);
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Generational and sector divides', 'Gen Z workers report feeling isolated, want office time. Finance and consulting heavily in-office. Remote may stabilize at 60% for tech but 20-30% across all sectors. Sampling bias in data.', 2);
    
    ELSIF v_assumption_title LIKE '%Multi-hyphenate%45%%' THEN
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Healthcare and benefits gap', 'Gig workers lack healthcare, retirement, stability. Unless portable benefits emerge, most will prefer single employer. Multi-hyphenate lifestyle works for wealthy, not median worker.', 4);
      
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 'Burnout and sustainability concerns', 'Portfolio careers sound appealing but lead to overwork. No boundaries between work modes. 60-70 hour weeks become norm. Not sustainable long-term. Many will retreat to single career.', 3);
    
    ELSE
      -- Default risks for other assumptions
      INSERT INTO assumption_risks (assumption_id, created_by, title, description, severity)
      VALUES (v_assumption_id, v_user_id, 
        CASE (v_counter % 5)
          WHEN 0 THEN 'Regulatory uncertainty risk'
          WHEN 1 THEN 'Market adoption slower than expected'
          WHEN 2 THEN 'Competitive dynamics shift'
          WHEN 3 THEN 'Technology maturity gaps'
          ELSE 'Organizational resistance to change'
        END,
        CASE (v_counter % 5)
          WHEN 0 THEN 'Evolving regulations could create compliance barriers or slow implementation by 12-24 months. Legislative uncertainty makes long-term planning difficult. International markets have different regulatory frameworks.'
          WHEN 1 THEN 'Early adopters are enthusiastic but mainstream market is conservative. Crossing the chasm requires 2-3x longer than initial projections suggest. Change management challenges underestimated.'
          WHEN 2 THEN 'Incumbents responding faster than anticipated with competitive offerings. New entrants creating fragmentation. Commoditization pressure on differentiation. Market share assumptions may not hold.'
          WHEN 3 THEN 'Core enabling technologies not as mature as believed. Production readiness issues emerge at scale. Integration complexity higher than lab environment testing suggested. Need more R&D time.'
          ELSE 'Internal stakeholders resistant to disruption of existing workflows. Culture change harder than process change. Middle management blocking initiatives. Top-down mandate without bottom-up buy-in fails.'
        END,
        2 + (v_counter % 3));
    END IF;
  END LOOP;
END $$;

-- Add diverse scenarios
DO $$
DECLARE
  v_assumption_id uuid;
  v_user_id uuid;
  v_assumption_title text;
  v_counter int := 0;
BEGIN
  FOR v_assumption_id, v_assumption_title IN 
    SELECT id, title FROM pod_assumptions ORDER BY created_at
  LOOP
    v_counter := v_counter + 1;
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    
    -- Optimistic scenario
    IF v_counter % 3 = 0 THEN
      INSERT INTO assumption_scenarios (assumption_id, created_by, title, description)
      VALUES (v_assumption_id, v_user_id, 'Accelerated adoption with network effects', 
        'If 2-3 major industry players adopt early and see success, creates bandwagon effect. Network effects and ecosystem development could compress timeline by 40-50%. Winner-take-most dynamics emerge with exponential growth curve. Example: Zoom went from 10M to 300M daily users in 3 months during COVID.');
    END IF;
    
    -- Pessimistic scenario
    IF v_counter % 3 = 1 THEN
      INSERT INTO assumption_scenarios (assumption_id, created_by, title, description)
      VALUES (v_assumption_id, v_user_id, 'Delayed rollout with implementation challenges', 
        'If technical debt, integration complexity, or organizational resistance proves higher than expected, timeline extends 18-30 months. Need phased rollout, pilot programs, extensive change management. Example: Enterprise blockchain promised revolution but took 5+ years longer than predicted to see real adoption.');
    END IF;
    
    -- Alternative/wildcard scenario
    IF v_counter % 3 = 2 OR random() > 0.6 THEN
      SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
      INSERT INTO assumption_scenarios (assumption_id, created_by, title, description)
      VALUES (v_assumption_id, v_user_id, 
        CASE (v_counter % 6)
          WHEN 0 THEN 'Regulatory intervention reshapes landscape'
          WHEN 1 THEN 'Disruptive technology makes assumption obsolete'
          WHEN 2 THEN 'Market bifurcates into two distinct models'
          WHEN 3 THEN 'Unexpected synergy accelerates adjacent trends'
          WHEN 4 THEN 'Black swan event forces rapid adaptation'
          ELSE 'Paradigm shift changes fundamental premise'
        END,
        CASE (v_counter % 6)
          WHEN 0 THEN 'Government mandates or prohibits key aspects, forcing alternative approach. EU AI Act, GDPR-style regulation could completely reshape how this develops. Industry pushed toward compliance-first vs innovation-first orientation with different winners.'
          WHEN 1 THEN 'New breakthrough technology emerges making current approach leapfrogged. Like how mobile skipped desktop in emerging markets. Assumption becomes moot because future arrives differently than expected. Need scenario planning for discontinuous innovation.'
          WHEN 2 THEN 'Market divides into premium tier (20% paying for high-end version) and commoditized tier (80% using free/cheap alternative). Different economics and strategies for each segment. No unified market assumption.'
          WHEN 3 THEN 'Convergence with another trend creates compounding effects. AI + remote work, blockchain + climate tech, etc. 1+1=5 scenarios where multiple tailwinds align. Could see 2-3x the impact if timing aligns.'
          WHEN 4 THEN 'Pandemic-style forcing function or crisis accelerates adoption by necessity. War, climate disaster, financial crisis removes friction to change. Years of gradual adoption compressed into months of emergency deployment.'
          ELSE 'Fundamental mental model shifts making entire framing obsolete. Like how "information superhighway" framing missed social media. New generation approaches problem completely differently, asks different questions, optimizes for different values.'
        END);
    END IF;
  END LOOP;
END $$;
