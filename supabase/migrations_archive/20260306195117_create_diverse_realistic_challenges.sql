/*
  # Create Diverse Realistic Challenges
  
  1. Changes
    - Replaces generic challenges with truly unique, varied content
    - Each challenge has distinct voice, format, and style
    - Challenges reflect real-world problems and scenarios
    - Natural variation in tone, specificity, and structure
  
  2. Notes
    - Challenges look like they were created by different people
    - Mix of formal/informal, detailed/brief, tactical/strategic
    - Realistic time limits and end dates
*/

-- Clear existing challenges
DELETE FROM challenge_responses;
DELETE FROM challenges;

-- Create diverse, realistic challenges
DO $BODY$
DECLARE
  v_pod_id uuid;
  v_user_id uuid;
BEGIN
  -- Digital Transformation Pod
  SELECT id INTO v_pod_id FROM pods WHERE name = 'Digital Transformation' LIMIT 1;
  IF v_pod_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Shopify migrated to React Native - worth it?', 'They rebuilt their mobile app from scratch. I need someone to break down the technical blog posts, calculate the actual ROI (dev time, performance gains, team velocity), and tell me if this makes sense for a 30-person eng team. Be honest about the risks.', 90, 'active', NOW() + INTERVAL '4 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'PostgreSQL vs MongoDB for our use case', 'Scaling issues at 50M records. Current stack: Node.js, PostgreSQL, Redis. Considering MongoDB for flexibility. Need architectural analysis: query patterns, indexing strategy, migration path, and honest assessment of whether this solves our problem or creates new ones.', 120, 'active', NOW() + INTERVAL '6 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Infrastructure cost spiraling - help!', 'Our AWS bill went from 45K to 180K in 8 months. Growth is 3x but costs are 4x. Looking for someone to audit our setup and find the waste. Focus on RDS, EC2, data transfer. I suspect over-provisioning but need proof.', 150, 'active', NOW() + INTERVAL '5 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Real-world Kubernetes migration case study', 'Company moved from Heroku to k8s. Document their journey: timeline, team size, cost change, complexity added, what they underestimated. Then answer: at what scale does k8s actually make sense? 10 services? 50? 200?', 180, 'active', NOW() + INTERVAL '9 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Stripe vs Plaid API design comparison', 'Both are API-first companies but their DX is wildly different. Compare authentication, error handling, webhooks, docs, SDKs, and versioning. What can we steal for our own API? Give me 10 specific takeaways I can implement.', 75, 'active', NOW() + INTERVAL '5 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'GraphQL killed our performance', 'Switched from REST to GraphQL 6 months ago. N+1 queries everywhere, caching is a nightmare, mobile app makes 200ms requests that take 2 seconds. What did we do wrong? Study DataLoader, persisted queries, and tell me if we should stick with it or revert.', 110, 'active', NOW() + INTERVAL '7 days');
  END IF;

  -- Product Management 2.0 Pod
  SELECT id INTO v_pod_id FROM pods WHERE name = 'Product Management 2.0' LIMIT 1;
  IF v_pod_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Why did Superhuman succeed where Mailbox failed?', 'Both tried to reinvent email. One sold to Dropbox then shut down. One is thriving. I think it is about pricing, not product. Prove me wrong. Analyze positioning, GTM, viral loops, and monetization. What are the 3 key differences?', 65, 'active', NOW() + INTERVAL '4 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Build vs buy for internal tools', 'We spend 40% of eng time building admin panels, analytics dashboards, approval workflows. Retool costs 120K per year. Create a framework: when to build, when to buy, when to use no-code. Include Retool, Internal, Airplane, Tooljet comparison.', 95, 'active', NOW() + INTERVAL '6 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Product analytics - which tool actually matters?', 'Using Mixpanel, Amplitude, and GA4. 90% feature overlap. Team ignores most insights. Looking for someone to interview 5 PMs about which tool they actually use daily and why. Then recommend one tool we should consolidate to.', 140, 'active', NOW() + INTERVAL '8 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Linear vs Jira for product teams', 'Engineering loves Linear. PMs want Jira for reporting. Roadmapping in Productboard, specs in Notion, feedback in Zendesk. This is insane. Design a single source of truth system. What tools, what integrations, what stays manual?', 85, 'active', NOW() + INTERVAL '5 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Reverse engineer Calendly pricing page', 'They nail value-based pricing. Free tier is useful but limited. Paid tiers are obvious upgrades. Analyze their feature gating, upgrade prompts, and conversion tactics. Then apply the framework to our product. Include screenshots and mockups.', 120, 'active', NOW() + INTERVAL '7 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Should we kill our mobile app?', 'Web is 85% of usage. Mobile app has 12K MAU, 20% MoM churn, 2.5 star rating. Costs 200K per year to maintain (2 iOS, 1 Android eng). Make the case for killing it vs fixing it. What would you do?', 55, 'active', NOW() + INTERVAL '3 days');
  END IF;

  -- Startup Ecosystem Pod
  SELECT id INTO v_pod_id FROM pods WHERE name = 'Startup Ecosystem' LIMIT 1;
  IF v_pod_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Series A bar in 2025 - what is real?', 'VCs say 2M ARR, 100% NRR, 40% growth. But I see companies raising with 800K ARR. What is the actual bar for top-tier firms vs everyone else? Use Crunchbase data for 50 recent Series A deals. Break down by sector.', 135, 'active', NOW() + INTERVAL '7 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Why are vertical SaaS companies crushing it?', 'ServiceTitan, Toast, Procore all worth billions. Horizontal SaaS is commoditized. I want to find the next vertical. Research: HVAC, plumbing, electrical, landscaping software markets. Which has the worst incumbent and biggest TAM?', 160, 'active', NOW() + INTERVAL '8 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Selling equity to employees on secondary', 'Early employees want liquidity. Considering 10% secondary in next round. What discount to primary? Who can sell? How much? What signals does this send? Study Stripe, Databricks, and Figma secondary programs.', 95, 'active', NOW() + INTERVAL '6 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Raising in this market is brutal', 'Pitched 40 VCs. Got 3 partner meetings. No term sheets. 3M ARR, growing 15% MoM, burned 1.5M. Runway is 8 months. Should I cut to profitability or keep growth high? Model both scenarios with real numbers.', 70, 'active', NOW() + INTERVAL '4 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Remote team in LATAM - good idea?', 'Hiring senior engineers in SF costs 200K plus equity. Same talent in Buenos Aires or Mexico City is 80K. Culture fit? Time zones? Legal complexity? Interview 3 founders doing this successfully. What works, what does not?', 145, 'active', NOW() + INTERVAL '8 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'YC vs Techstars vs going solo', 'Got into both. YC is 7%, Techstars is 6%. Or raise 500K angel round at 8M cap with no dilution. Which path gives best outcomes? Look at data on follow-on funding rates, failure rates, and network value.', 110, 'active', NOW() + INTERVAL '6 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Solo founder red flag or not?', 'Every VC says no solo founders. But look at Levels, Pieter Levels, DHH. Is the bias justified? Analyze failure rates, funding success, and exits for solo vs co-founded companies. Use real data not vibes.', 80, 'active', NOW() + INTERVAL '5 days');
  END IF;

  -- AI & Future of Work Pod
  SELECT id INTO v_pod_id FROM pods WHERE name = 'AI & Future of Work' LIMIT 1;
  IF v_pod_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'ChatGPT replaced our junior devs', 'Honest take: we let go 4 junior engineers and kept 2 seniors with AI tools. Velocity is same, code quality is higher, costs down 200K. Document this trend. Is junior dev role dead? What should new grads learn instead?', 105, 'active', NOW() + INTERVAL '6 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Testing Claude vs ChatGPT for real work', 'Want someone to spend a full day using both for actual job tasks. Writing code, analyzing data, drafting emails, research. Track: quality, speed, cost, context limits. Which one would you pay for? Be specific.', 180, 'active', NOW() + INTERVAL '8 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Prompt engineering is overhyped', 'Everyone selling courses. But is it a skill or just trial and error? Create 20 prompts for common tasks. Test systematic approaches vs random tweaking. Does expertise actually matter or is it mostly model quality?', 90, 'active', NOW() + INTERVAL '5 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Remote work productivity - the data', 'Tired of hot takes. Find actual studies with numbers. WFH vs office vs hybrid. Measure: output per hour, meeting time, focus time, satisfaction, retention. Control for role type. What does the research actually say?', 125, 'active', NOW() + INTERVAL '7 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'AI ethics is slowing us down', 'Spent 3 months on bias audits, red teaming, safety reviews. Competitors shipped. Are we overthinking this? Research what companies actually do vs what they say. OpenAI, Anthropic, Meta. What is table stakes vs theatre?', 85, 'active', NOW() + INTERVAL '5 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Upskilling team for AI - realistic plan?', 'Team of 40 knowledge workers. Need everyone AI-literate in 6 months. Budget is 50K. Design training program: tools to learn, use cases to practice, metrics to track. What is realistic improvement? Not looking for perfection.', 140, 'active', NOW() + INTERVAL '8 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Which jobs are actually at risk?', 'Cut through the hype. Radiologists? Paralegals? Customer support? Writers? Analyze: task complexity, data availability, regulation, economics. For 5 roles, predict displacement timeline: 2 years, 5 years, 10+ years, never.', 115, 'active', NOW() + INTERVAL '6 days');
  END IF;

  -- Career Growth Paths Pod
  SELECT id INTO v_pod_id FROM pods WHERE name = 'Career Growth Paths' LIMIT 1;
  IF v_pod_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Staff engineer or EM - which path?', 'Year 7 as senior engineer. Can go IC to staff or manager track. Staff is 220K-280K, EM is 240K-320K but seems political. Interview 3 people in each role. What is day-to-day actually like? Which path has more leverage?', 150, 'active', NOW() + INTERVAL '8 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Job hopping vs loyalty - what wins?', 'Been at same company 5 years. Promoted twice but salary is 30% below market. Friends who switched every 2 years make way more. Analyze comp data from Levels.fyi for tech roles. What is optimal tenure? When does loyalty become stupidity?', 80, 'active', NOW() + INTERVAL '5 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Building personal brand - worth it?', 'People say content creation opens doors. But it takes 10 hours per week. Is ROI real? Study 10 people who built audiences on Twitter or LinkedIn. Did it lead to jobs, customers, investment? Or just vanity metrics?', 95, 'active', NOW() + INTERVAL '6 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'MBA worth it for tech careers?', 'Top 15 MBA programs cost 200K plus 2 years opportunity cost. Tech does not care about credentials. But network and career switching? Compare MBA grads vs non-MBA in tech. 5 year earnings, satisfaction, trajectory.', 135, 'active', NOW() + INTERVAL '7 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Negotiating competing offers', 'Have 3 offers: big tech 300K cash heavy, startup 200K plus equity, remote company 250K. How to play them against each other? Create negotiation script and strategy. What leverage do I actually have?', 60, 'active', NOW() + INTERVAL '4 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Learning new tech stack at 35+', 'Senior in Ruby on Rails. Market wants Go, Rust, TypeScript. Is it worth pivoting? Or double down on seniority? Interview developers who successfully switched languages late career. What was timeline, how did they stay relevant?', 110, 'active', NOW() + INTERVAL '6 days');
  END IF;

  -- Mental Models & Growth Pod
  SELECT id INTO v_pod_id FROM pods WHERE name = 'Mental Models & Growth' LIMIT 1;
  IF v_pod_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Why do smart people make dumb decisions?', 'Founder with 20 years experience tanked their company with obvious mistakes. Sunk cost fallacy? Overconfidence? Study cognitive biases in startup failures. Find 5 case studies. What were the red flags they ignored?', 100, 'active', NOW() + INTERVAL '6 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Pre-mortem on my product launch', 'Launching in 4 weeks. Instead of planning success, assume total failure. List 20 ways this goes wrong: tech, market, team, timing, competition. Then work backwards. What can we do now to prevent each failure mode?', 75, 'active', NOW() + INTERVAL '5 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Base rates everyone ignores', 'Most consumer apps fail. Most restaurants close. Most B2B deals fall through. Find 10 base rates relevant to startups. Then identify what makes the exceptions successful. When should you ignore base rates?', 90, 'active', NOW() + INTERVAL '5 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Second-order thinking practice', 'AI makes content creation easy. First order: more content. Second order: content is worthless. Third order: curation and trust become valuable. Pick 3 trends and map out to third order effects. What opportunities emerge?', 85, 'active', NOW() + INTERVAL '5 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Incentives explain everything', 'Pick a broken system: healthcare, education, social media. Map the incentive structures. Why do people act against stated goals? Design new incentives that align behavior. Show your work with real examples.', 120, 'active', NOW() + INTERVAL '7 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Mental models that changed my decisions', 'Looking for personal stories. Interview 5 people about a mental model that shifted how they think. Inversion, first principles, probabilistic thinking, etc. Get specific examples of decisions that changed.', 140, 'active', NOW() + INTERVAL '8 days');
  END IF;

  -- Leadership Excellence Pod
  SELECT id INTO v_pod_id FROM pods WHERE name = 'Leadership Excellence' LIMIT 1;
  IF v_pod_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'New manager and team hates me', 'Promoted 3 months ago. Team sees me as a peer, not a leader. 1on1s are awkward. My decisions get questioned. How do I earn authority without being a jerk? Need tactical playbook from someone who has done this transition successfully.', 65, 'active', NOW() + INTERVAL '4 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Radical transparency experiment', 'Share everything with team: finances, strategy, mistakes, board feedback. Is this genius or stupid? Study Buffer, Gitlab, Basecamp. What did they share? What did they hide? What was impact on trust, retention, performance?', 110, 'active', NOW() + INTERVAL '6 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Firing someone for the first time', 'Have to let go underperformer next week. Never done this. What do I say? How much detail? Severance? Legal risks? Escorting out? Need step-by-step guide and script from someone who has fired 20+ people. Make it humane but clear.', 85, 'active', NOW() + INTERVAL '5 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'CEO coach worth 50K per year?', 'Several people recommended exec coaching. Reboot, Conscious Leadership, individual coaches. Prices range 20K to 100K per year. Is this real or woo woo? Interview 3 founders who used coaches. What changed? Specific outcomes not vague feelings.', 125, 'active', NOW() + INTERVAL '7 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Building bench strength on a budget', 'Small team, no succession plan. If I or VP Eng leave, we are screwed. How to develop leaders with limited time and money? Study companies that promote from within successfully. What development programs actually work?', 95, 'active', NOW() + INTERVAL '6 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Managing up when CEO is founder', 'Founder CEO has strong opinions on everything. Hard to give feedback. Ideas get shot down. How do I influence without seeming like I am overstepping? Need tactics from people who have successfully managed founder CEOs.', 70, 'active', NOW() + INTERVAL '5 days');
  END IF;

  -- Business Strategy Evolution Pod
  SELECT id INTO v_pod_id FROM pods WHERE name = 'Business Strategy Evolution' LIMIT 1;
  IF v_pod_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Freemium killed our revenue', 'Launched free tier to drive growth. Got 50K users but only 200 paid. Free users abuse support. Should we kill freemium? Study Notion, Figma, Slack. When does freemium work vs cannibalize paid? What conversion rate makes it worth it?', 105, 'active', NOW() + INTERVAL '6 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Usage-based pricing is a trap', 'Considering shift from seats to usage-based. Sounds good but revenue becomes unpredictable. Customers hate bill shock. Study Snowflake, Twilio, AWS. What makes usage pricing work? What are the gotchas? Give me the honest take.', 120, 'active', NOW() + INTERVAL '7 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Churn analysis - which customers leave?', 'Month 3 churn is 15%. Month 12 churn is 8%. Need someone to analyze our data or find similar SaaS benchmarks. What patterns predict churn? Company size, use case, activation metrics? Build a churn risk model I can actually use.', 155, 'active', NOW() + INTERVAL '8 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Should we go upmarket or downmarket?', 'Currently mid-market: 25K ACV, 200 customers. Can go enterprise (100K+ ACV, longer sales) or SMB (5K ACV, higher volume). Model both: CAC, LTV, sales cycle, churn, margins. Which is better business?', 135, 'active', NOW() + INTERVAL '7 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Competitors copying our features', 'Every feature we launch gets copied in 2 months. We are faster but they have bigger brand. How do we compete? Study iPhone vs Android, Figma vs Adobe. What moats matter when features are commoditized?', 90, 'active', NOW() + INTERVAL '6 days');
    
    SELECT id INTO v_user_id FROM profiles ORDER BY random() LIMIT 1;
    INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
    VALUES 
      (v_user_id, 'Building moat with network effects', 'Marketplace has 500 sellers, 5K buyers. Liquidity is there but no defensibility. How to create network effects? Study Airbnb, Uber, Etsy. What tactics actually work vs what is just buzzwords? Be specific about implementation.', 115, 'active', NOW() + INTERVAL '6 days');
  END IF;

END $BODY$;
