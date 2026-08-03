/*
  # Create Realistic Topic-Specific Challenges
  
  1. Changes
    - Clears existing generic challenges
    - Creates 50+ unique, topic-specific challenges for each pod
    - Each challenge has realistic titles, descriptions, and time limits
    - Challenges are relevant to their specific domain (AI, Startups, Leadership, etc.)
  
  2. Notes
    - Challenges vary in difficulty and time commitment
    - Descriptions are actionable and specific
    - Mix of analytical, creative, and critical thinking challenges
*/

-- Clear existing generic challenges
DELETE FROM challenge_responses;
DELETE FROM challenges;

-- Create topic-specific challenges
DO $BODY$
DECLARE
  v_pod_id uuid;
  v_pod_name text;
  v_user_id uuid;
BEGIN
  -- Digital Transformation Pod
  SELECT id INTO v_pod_id FROM pods WHERE name = 'Digital Transformation' LIMIT 1;
  IF v_pod_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'API-First Architecture Analysis', 'Review 3 companies that successfully migrated to API-first (Stripe, Twilio, Plaid). Document their migration timeline, technical debt addressed, and ROI metrics. Identify 5 key lessons applicable to enterprise software companies.', 120, 'active', NOW() + INTERVAL '7 days'),
      (v_user_id, 'Legacy System Migration Strategy', 'Design a 18-month roadmap for migrating a Fortune 500 company from monolithic architecture to microservices. Include risk mitigation, team training, parallel run strategy, and success metrics. Budget: 15M dollars.', 180, 'active', NOW() + INTERVAL '10 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Cloud Cost Optimization Exercise', 'Given a 2M annual AWS bill for a SaaS company (5M users, 200 microservices), identify 10 optimization opportunities. Quantify savings potential for each. Address compute, storage, data transfer, and database costs.', 90, 'active', NOW() + INTERVAL '5 days'),
      (v_user_id, 'Digital Twin Implementation Feasibility', 'Evaluate digital twin technology for manufacturing operations. Compare Azure Digital Twins vs AWS IoT TwinMaker vs custom build. Include ROI calculation, implementation timeline, and organizational readiness assessment.', 150, 'active', NOW() + INTERVAL '8 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Real-Time Data Pipeline Design', 'Architect a streaming data pipeline processing 500K events/second for fraud detection. Choose between Kafka, Kinesis, Pulsar. Include latency requirements (<100ms), failure handling, and cost estimates. Must handle 10x spike.', 120, 'active', NOW() + INTERVAL '6 days'),
      (v_user_id, 'Mobile-First Transformation Case Study', 'Document how a traditional bank shifted to mobile-first banking. Analyze their tech stack evolution, customer adoption curve (0% to 75% mobile usage in 3 years), and lessons from failed features. What would you do differently?', 100, 'active', NOW() + INTERVAL '7 days');
  END IF;

  -- Product Management 2.0 Pod
  SELECT id INTO v_pod_id FROM pods WHERE name = 'Product Management 2.0' LIMIT 1;
  IF v_pod_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'No-Code Tool Evaluation for PMs', 'Test Retool, Bubble, and Webflow for 3 common PM tasks: building admin dashboards, prototyping user flows, and creating landing pages. Rate ease of use, limitations, and when to hand off to engineering. Include time tracking.', 240, 'active', NOW() + INTERVAL '14 days'),
      (v_user_id, 'AI Copilot for Product Discovery', 'Experiment with Claude, GPT-4, and Gemini for: user research synthesis, competitive analysis, PRD writing, and prioritization frameworks. Document 10 effective prompts and time saved vs manual process.', 150, 'active', NOW() + INTERVAL '7 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'PLG Motion Teardown', 'Reverse engineer Notion product-led growth strategy. Map their user journey from signup to paid conversion. Identify 10 growth tactics, A/B test ideas, and activation metrics. What makes their freemium model work?', 120, 'active', NOW() + INTERVAL '6 days'),
      (v_user_id, 'Feature Prioritization with AI', 'You have 200 feature requests from users. Use AI tools to cluster themes, extract sentiment, identify power users, and create a RICE-scored roadmap. Compare AI approach vs manual. Did you discover insights you would have missed?', 90, 'active', NOW() + INTERVAL '5 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'B2B vs B2C PM Differences', 'Interview 3 PMs (1 enterprise SaaS, 1 consumer social, 1 marketplace). Document differences in: discovery process, success metrics, stakeholder management, and release cycles. Create comparison matrix.', 180, 'active', NOW() + INTERVAL '10 days'),
      (v_user_id, 'Metrics That Matter Challenge', 'Pick a failing product (Quibi, Google+, Clubhouse decline). Identify the vanity metrics they tracked vs the leading indicators they should have watched. Propose 5 key metrics that would have predicted failure 6 months early.', 60, 'active', NOW() + INTERVAL '4 days');
  END IF;

  -- Startup Ecosystem Pod
  SELECT id INTO v_pod_id FROM pods WHERE name = 'Startup Ecosystem' LIMIT 1;
  IF v_pod_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Emerging Market Startup Analysis', 'Compare startup ecosystems in Lagos, Bangalore, and Sao Paulo. Analyze: VC funding trends, unicorn count, exit environment, talent pool, regulatory support. Which will produce the most unicorns by 2028?', 150, 'active', NOW() + INTERVAL '8 days'),
      (v_user_id, 'Seed Round Evolution Study', 'Analyze 50 seed rounds from 2020 vs 50 from 2024. Compare: check sizes, valuations, dilution, investor profiles, and traction required. Document the shift and predict 2026 norms. Use Crunchbase and public sources.', 180, 'active', NOW() + INTERVAL '9 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Path to Profitability Modeling', 'Model 3 paths to profitability for a company with 10M ARR and 75% growth with 50% burn rate: aggressive efficiency (18mo), balanced (30mo), growth-first (48mo). Include CAC payback, headcount, and valuation impact.', 120, 'active', NOW() + INTERVAL '7 days'),
      (v_user_id, 'Remote-First Startup Economics', 'Calculate true cost savings of remote-first for a 50-person startup. Include: office savings, salary arbitrage, tooling costs, travel, and productivity impact. Compare SF vs distributed team over 3 years.', 90, 'active', NOW() + INTERVAL '5 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Secondary Market Liquidity Analysis', 'Research Forge Global, Hiive, and Carta secondaries. Document: transaction volume, discounts vs last primary, minimum investment, buyer profiles. Design a secondary program for late-stage startup employees.', 120, 'active', NOW() + INTERVAL '6 days'),
      (v_user_id, 'Vertical SaaS Opportunities', 'Identify 5 underserved vertical markets ripe for SaaS disruption. For each: market size, incumbent weaknesses, why now, and ideal founding team. Use construction, agriculture, legal, manufacturing, etc.', 150, 'active', NOW() + INTERVAL '8 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Founder Market Fit Deep Dive', 'Pick 5 successful founders (Tobi Lutke, Melanie Perkins, Dylan Field, etc). Analyze their unique insights from personal experience. Create framework for evaluating founder-market fit in your next investment.', 90, 'active', NOW() + INTERVAL '5 days');
  END IF;

  -- AI & Future of Work Pod
  SELECT id INTO v_pod_id FROM pods WHERE name = 'AI & Future of Work' LIMIT 1;
  IF v_pod_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Task Automation Impact Study', 'Choose one job role (paralegal, financial analyst, marketer, or developer). Document 20 daily tasks, categorize by automation potential (high/medium/low). Use AI tools to automate 5 high-potential tasks. Measure time savings.', 180, 'active', NOW() + INTERVAL '10 days'),
      (v_user_id, 'Human-AI Collaboration Experiment', 'Complete 3 complex tasks: write market analysis, design customer survey, debug production issue. Do each twice: once solo, once with AI copilot. Compare quality, time, and insights. Document when AI helped vs hindered.', 240, 'active', NOW() + INTERVAL '12 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'AI Literacy Skills Gap Mapping', 'Survey 20 knowledge workers on AI tool usage. Create taxonomy of: never used, basic user, power user, builder. Identify skill gaps and design 3-month upskilling curriculum. Include tools, resources, and success metrics.', 150, 'active', NOW() + INTERVAL '8 days'),
      (v_user_id, 'Remote Work Productivity Analysis', 'Compare productivity metrics for same team working: fully remote, hybrid (2-3 days), and full office. Use real data or case studies. Measure: output, meeting load, focus time, collaboration quality, and satisfaction. What is optimal?', 120, 'active', NOW() + INTERVAL '7 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'AI Ethics Framework Design', 'Create governance framework for AI deployment in enterprise. Address: bias testing, privacy, transparency, accountability, safety. Include decision trees, approval workflows, and audit requirements. Reference EU AI Act compliance.', 180, 'active', NOW() + INTERVAL '9 days'),
      (v_user_id, 'Skills Half-Life Research', 'Pick 3 technical domains (web dev, data science, cloud infrastructure). Document skills from 2019 that are now obsolete vs still relevant. Project which 2024 skills will be obsolete by 2027. Create learning strategy.', 90, 'active', NOW() + INTERVAL '5 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Prompt Engineering Best Practices', 'Develop 20 high-quality prompts for common work tasks: summarization, analysis, writing, coding, research. Test across ChatGPT, Claude, and Gemini. Document what works, what fails, and platform differences.', 150, 'active', NOW() + INTERVAL '8 days');
  END IF;

  -- Career Growth Paths Pod
  SELECT id INTO v_pod_id FROM pods WHERE name = 'Career Growth Paths' LIMIT 1;
  IF v_pod_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Multi-Hyphenate Career Modeling', 'Design 3 portfolio career models: consultant+advisor+investor, designer+content creator+teacher, engineer+founder+writer. For each: income diversification, time allocation, skill development, and sustainability.', 120, 'active', NOW() + INTERVAL '7 days'),
      (v_user_id, 'Optimal Job Tenure Analysis', 'Analyze LinkedIn data (or proxies) for 100 successful tech professionals. Plot tenure vs outcomes: promotion rate, salary growth, title progression. What is the sweet spot? When does staying too long hurt? When is leaving too soon a red flag?', 150, 'active', NOW() + INTERVAL '8 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Continuous Learning Strategy', 'Given 10 hours per week for learning, design a 12-month plan to stay relevant in a fast-changing field. Balance: technical depth, breadth, soft skills, networking. Include resources, budget (2K per year), and progress metrics.', 90, 'active', NOW() + INTERVAL '6 days'),
      (v_user_id, 'Internal Mobility vs External Moves', 'Compare career progression strategies: stay at one company 8 years with internal moves vs switch companies every 2-3 years. Model total comp, title growth, skill diversity, network, and burnout risk.', 120, 'active', NOW() + INTERVAL '7 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'T-Shaped to M-Shaped Evolution', 'Document your current skill profile. Design path from T-shaped (one deep expertise) to M-shaped (two deep areas plus broad). Identify second vertical, learning plan, and timeline. When is depth better than breadth?', 60, 'active', NOW() + INTERVAL '4 days'),
      (v_user_id, 'Salary Negotiation Data Analysis', 'Research salary benchmarks for your role across 10 companies (use Levels.fyi, H1B data, Blind). Calculate opportunity cost of not negotiating. Create negotiation playbook with tactics, timing, and leverage points.', 90, 'active', NOW() + INTERVAL '5 days');
  END IF;

  -- Mental Models & Growth Pod
  SELECT id INTO v_pod_id FROM pods WHERE name = 'Mental Models & Growth' LIMIT 1;
  IF v_pod_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Second-Order Effects Analysis', 'Pick a major trend (AI adoption, remote work, etc). Map first-order effects (obvious), second-order (consequences of consequences), third-order (systemic changes). Identify non-obvious opportunities and risks.', 90, 'active', NOW() + INTERVAL '6 days'),
      (v_user_id, 'Inversion Thinking Exercise', 'Choose a goal (successful product launch, great team culture, etc). Instead of planning how to succeed, list all ways to fail. Then invert each failure mode into a strategy. Compare to traditional planning.', 60, 'active', NOW() + INTERVAL '5 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Base Rate Neglect Study', 'Find 5 examples where startups or leaders ignored base rates (most restaurants fail, most B2C apps do not retain, etc). What made them think they would be different? When is ignoring base rates justified vs delusional?', 120, 'active', NOW() + INTERVAL '7 days'),
      (v_user_id, 'Cognitive Bias Blind Spot Audit', 'Document 10 decisions you made in the last 6 months. For each, identify cognitive biases that may have influenced you: confirmation bias, availability heuristic, sunk cost fallacy, anchoring. How would you decide differently?', 90, 'active', NOW() + INTERVAL '6 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Scenario Planning Workshop', 'For your company or project, create 4 scenarios using 2x2 matrix of key uncertainties. Develop strategies that work across multiple scenarios vs optimizing for one future. Identify no regret moves and leading indicators.', 150, 'active', NOW() + INTERVAL '8 days'),
      (v_user_id, 'Incentive Structure Analysis', 'Choose an organization (company, government agency, non-profit). Map stated goals vs actual incentive structures. Identify misalignments. Propose 5 incentive redesigns to better align behavior with objectives.', 120, 'active', NOW() + INTERVAL '7 days');
  END IF;

  -- Leadership Excellence Pod
  SELECT id INTO v_pod_id FROM pods WHERE name = 'Leadership Excellence' LIMIT 1;
  IF v_pod_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Leadership Bench Strength Audit', 'Evaluate your organization leadership pipeline. Map: key roles, succession plans, internal candidates, readiness gaps, development programs. Calculate risk: what happens if top 3 leaders leave? Design bench-building strategy.', 180, 'active', NOW() + INTERVAL '9 days'),
      (v_user_id, 'Emotional Intelligence ROI Study', 'Research correlation between EQ and performance. Find studies and case studies showing EQ impact on: retention, team performance, conflict resolution, change management. Build business case for EQ training programs.', 120, 'active', NOW() + INTERVAL '7 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Distributed Leadership Model Design', 'Design decision-making framework that pushes authority down. Define: what decisions stay centralized vs distributed, decision rights matrix, escalation criteria, and accountability. Test with 5 real decisions.', 150, 'active', NOW() + INTERVAL '8 days'),
      (v_user_id, 'Founder Mode vs Manager Mode', 'Analyze Paul Graham Founder Mode essay. Interview 3 founders about how they lead differently than traditional managers. Document tactics: skip-level engagement, all-hands, context over control. When does each mode fit?', 120, 'active', NOW() + INTERVAL '7 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Transparent Leadership Experiment', 'Practice radical transparency for 2 weeks. Share: strategy context, financial metrics, decision rationale, mistakes, and uncertainties. Document team reactions, trust impact, and decisions made differently. What is optimal transparency level?', 240, 'active', NOW() + INTERVAL '14 days'),
      (v_user_id, 'Crisis Leadership Simulation', 'Study 3 crisis responses: Airbnb COVID layoffs, Stripe 2022 layoffs, Twitter chaos. Analyze communication, speed, empathy, and outcomes. Create crisis playbook: communication templates, decision framework, stakeholder management.', 150, 'active', NOW() + INTERVAL '8 days');
  END IF;

  -- Business Strategy Evolution Pod
  SELECT id INTO v_pod_id FROM pods WHERE name = 'Business Strategy Evolution' LIMIT 1;
  IF v_pod_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Data-Driven Strategy Analysis', 'Compare decision-making at 3 companies: one analytics-driven (Netflix), one intuition-led (Apple), one balanced. Analyze: decision speed, success rate, innovation vs optimization. When does data hurt more than help?', 120, 'active', NOW() + INTERVAL '7 days'),
      (v_user_id, 'Flywheel Effect Modeling', 'Design a flywheel model for a business (Amazon: lower prices lead to more customers leads to more sellers leads to selection leads to lower prices). Map reinforcing loops, identify bottlenecks, and quantify momentum. Apply to your company.', 90, 'active', NOW() + INTERVAL '6 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Platform vs Linear Business Models', 'Compare Uber (platform) vs traditional taxi company (linear). Analyze: margin structure, scaling costs, network effects, capital efficiency. Identify industries ripe for platform disruption. Design conversion strategy.', 150, 'active', NOW() + INTERVAL '8 days'),
      (v_user_id, 'Competitive Moat Analysis', 'Pick a dominant company (Nvidia, Stripe, Figma). Decompose their moat: network effects, switching costs, brand, scale economies, proprietary tech. Rate each dimension 1-10. How durable is their advantage? Where are they vulnerable?', 120, 'active', NOW() + INTERVAL '7 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Strategic Foresight Exercise', 'Identify 5 weak signals today that could become major trends in 3-5 years. For each: current evidence, growth trajectory, implications for your industry. Design hedging strategies to benefit regardless of which materialize.', 180, 'active', NOW() + INTERVAL '10 days'),
      (v_user_id, 'Business Model Innovation', 'Take a traditional business (consulting, education, healthcare). Design 3 alternative business models: freemium, marketplace, SaaS, usage-based, etc. Compare unit economics, CAC payback, LTV, and capital requirements.', 150, 'active', NOW() + INTERVAL '8 days');
  END IF;

END $BODY$;
