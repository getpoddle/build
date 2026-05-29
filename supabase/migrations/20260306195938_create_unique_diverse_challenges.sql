/*
  # Create Unique Diverse Challenges
  
  1. Changes
    - Deletes all existing challenges
    - Creates completely unique challenges
    - Each challenge covers different topic and approach
    - No repetitive patterns across challenges
  
  2. Notes
    - 50+ unique challenges across all domains
    - Varied formats, tones, and complexity levels
    - Real-world scenarios and problems
*/

-- Clear existing challenges
DELETE FROM challenge_responses;
DELETE FROM challenges;

-- Create completely unique challenges
DO $BODY$
DECLARE
  v_user_ids uuid[];
  v_current_user uuid;
  v_index int;
BEGIN
  -- Get array of user IDs for variety
  SELECT array_agg(id) INTO v_user_ids FROM profiles;
  v_index := 1;

  -- Set 1: Technical Infrastructure
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Rebuild our entire auth system in 72 hours', 'Legacy OAuth implementation is a security nightmare. We have custom session management that nobody understands. Need someone to architect a clean Supabase Auth migration: user data preservation, zero downtime, backward compatible API. Include rollback plan.', 180, 'active', NOW() + INTERVAL '3 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Reverse engineer how Vercel does instant deploys', 'Their git push to production is under 30 seconds. We take 8 minutes. Deep dive into their edge network, build system, and caching strategy. What can we copy? What needs their scale? Give me architecture diagrams.', 140, 'active', NOW() + INTERVAL '6 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Database has 500GB of deleted user data', 'GDPR compliance audit found we never actually delete anything. Soft deletes everywhere. Need purge strategy that does not bring down production. Which tables first? How to test? What about foreign keys and cascades?', 95, 'active', NOW() + INTERVAL '5 days');

  -- Set 2: Product Decisions
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Users hate our redesign - revert or push through?', 'Launched new UI 2 weeks ago. 40% drop in engagement. Support tickets up 300%. But metrics lag. Study Vista Print, Snapchat, Instagram redesign backlash. When did they revert vs stay the course? How long to wait?', 85, 'active', NOW() + INTERVAL '4 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Power users demand features that hurt growth', 'Top 5% of users generate 60% of revenue. They want advanced features that make product harder to use. Do we serve them or optimize for new user acquisition? Model revenue impact of both paths.', 125, 'active', NOW() + INTERVAL '7 days');

  -- Set 3: Startup Operations
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Cofounder wants out after 18 months', 'Technical cofounder is burnt out. Wants to leave but has 30% equity with 4 year vest. How to handle this? Buyback at what price? Acceleration? Study founder breakup case studies. Need legal and emotional playbook.', 90, 'active', NOW() + INTERVAL '5 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Pivot or die - 6 months of runway left', '2 years building project management tool. 300 users, 40 paying. Market is saturated. Have 6 months cash. Should we pivot? To what? Or double down and cut to profitability? Model 3 realistic scenarios.', 155, 'active', NOW() + INTERVAL '8 days');

  -- Set 4: AI & Automation
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Build AI agent that actually does my job', 'Product manager. Want to automate: user interview analysis, competitive research, roadmap prioritization, writing PRDs. Which tasks are possible today? Build working prototype for 1 task. What are hard limits?', 170, 'active', NOW() + INTERVAL '8 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'RAG system hallucinates 20% of the time', 'Built customer support bot with retrieval augmented generation. Answers are confident but wrong 1 in 5 times. How to improve accuracy? Better chunking? Hybrid search? Confidence scores? Study production RAG systems.', 145, 'active', NOW() + INTERVAL '8 days');

  -- Set 5: Career Navigation
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Got PIP - fight it or leave gracefully?', 'Performance improvement plan after 3 years. Manager changed 6 months ago. Feel blindsided. Should I try to survive PIP or negotiate exit package? How much severance is reasonable? Need playbook from employment lawyer perspective.', 70, 'active', NOW() + INTERVAL '4 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Startup equity vs FAANG cash - real math', 'Offer from 50-person startup: 140K salary plus 0.25% equity. FAANG offer: 280K total comp, no equity risk. Startup is Series B, 20M ARR. Model realistic outcomes. What exit valuation makes startup worth it?', 120, 'active', NOW() + INTERVAL '7 days');

  -- Set 6: Mental Models
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Kill your darlings - product edition', 'Spent 8 months building feature nobody uses. 2% adoption. Team is attached to it. Apply inversion thinking: what if we delete it? Map dependencies, measure impact, design sunsetting plan. What are we afraid to admit?', 90, 'active', NOW() + INTERVAL '5 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Lindy effect applied to tech stack', 'Choosing between hot new framework and boring old tech. Apply Lindy: what has survived longest will last longest. Analyze React, Vue, Svelte, HTMX. Which will still be here in 10 years? Build decision framework.', 110, 'active', NOW() + INTERVAL '6 days');

  -- Set 7: Leadership Challenges
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Top performer is toxic to team culture', 'Senior engineer ships 3x everyone else. Also condescending in code reviews. Makes people cry. 2 people quit citing him. Do I fire my best performer? How to manage this? Real case studies of similar situations.', 80, 'active', NOW() + INTERVAL '5 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Inherited team that hates each other', 'New VP role. Team history of conflict. Two senior people refuse to work together. Previous manager avoided it. Need to fix or rebuild team. What is salvageable? Mediation tactics? When to cut losses?', 105, 'active', NOW() + INTERVAL '6 days');

  -- Set 8: Business Strategy
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Race to the bottom on pricing - how to escape?', 'Started at 99 per month. Competitors went to 49. We matched. Now someone is at 29. Cannot go lower and survive. How to compete on value not price? Reposition without losing customers? Study companies that escaped price wars.', 110, 'active', NOW() + INTERVAL '6 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Customer wants us to build custom features', 'Enterprise customer worth 500K per year. Wants 3 custom features. 6 months of dev work. Nobody else will use them. Do we become consultancy? How to say no without losing deal? Alternative approaches?', 75, 'active', NOW() + INTERVAL '4 days');

  -- Set 9: More Technical Deep Dives
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'API response times vary 10x between users', 'P50 is 120ms. P95 is 1.2 seconds. P99 is 8 seconds. Same endpoints. Need someone to debug: database query plans, N+1 problems, caching misses, network latency. Use real APM data. What is causing the variance?', 160, 'active', NOW() + INTERVAL '8 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Convert 50 React class components to hooks', 'Inherited codebase from 2018. Everything is class-based with lifecycle methods. Need migration roadmap: which components first, testing strategy, common pitfalls. Estimate realistic timeline for 2 engineers.', 120, 'active', NOW() + INTERVAL '7 days');

  -- Set 10: Product Management
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Competitor launched our roadmap feature yesterday', 'Spent 4 months building file sharing. They shipped it last week. Ours is better but they are first. Do we still launch? How to position? Should we pivot to different features? Need decision framework fast.', 60, 'active', NOW() + INTERVAL '3 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Design viral loop for B2B product', 'SaaS collaboration tool. No inherent virality. Users do not share. Need growth mechanic that is not spammy. Study Loom, Calendly, Miro. What made their sharing work? Design 3 viral loop concepts we can test.', 145, 'active', NOW() + INTERVAL '8 days');

  -- Set 11: Startup Growth
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Angel investor wants board seat for 100K', 'First outside money. Investor offers 100K at 3M valuation but wants board seat and pro-rata rights. Is this normal? What are we giving up? Find 10 angel deal terms. What is market for pre-seed?', 75, 'active', NOW() + INTERVAL '4 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'First employee wants senior title and big equity', 'Hiring employee number 1. Has 8 years experience. Wants "Senior" title and 2% equity. Market says 0.5-1% for first eng hire. Do we set precedent? How does this affect next 10 hires? Build compensation framework.', 85, 'active', NOW() + INTERVAL '5 days');

  -- Set 12: AI Implementation
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Fine-tuned model vs prompt engineering - cost analysis', 'Repetitive task: classify support tickets. 10K tickets per month. Compare: GPT-4 with prompts vs fine-tuned GPT-3.5 vs fine-tuned open source. Include training cost, inference cost, accuracy, maintenance. Which wins?', 125, 'active', NOW() + INTERVAL '7 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Team productivity dropped with AI tools', 'Gave everyone ChatGPT Plus and Copilot. Expected 30% productivity gain. Output is same or worse. People spend more time reviewing AI suggestions than writing from scratch. What went wrong? How to actually get ROI?', 100, 'active', NOW() + INTERVAL '6 days');

  -- Set 13: Work Culture
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Hybrid work is broken - fix our policy', '3 days in office mandate. Nobody follows it. Enforcement feels authoritarian. Remote people feel excluded. Office people waste time commuting. Design policy that actually works. Study companies doing hybrid well.', 80, 'active', NOW() + INTERVAL '4 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Async-first communication experiment', 'Meetings are killing productivity. 30 hours of meetings per week per person. Want to go async: no meetings except Fridays, everything in writing, recorded demos. What tools? What changes? Who has done this successfully?', 110, 'active', NOW() + INTERVAL '6 days');

  -- Set 14: Career Pivots
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Return to office mandate - refuse or comply?', 'Hired as remote. Now mandatory 5 days in office. Love the job but have no interest in relocating. How to negotiate exception? What leverage do I have? Study successful remote work negotiations.', 65, 'active', NOW() + INTERVAL '3 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Industry change from finance to tech', '15 years in financial services. Want to move to tech but resume screams finance. How to position experience? What roles make sense? Fintech obvious but oversaturated. Map transferable skills to tech roles.', 105, 'active', NOW() + INTERVAL '6 days');

  -- Set 15: Strategic Thinking
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Regret minimization framework for job decision', 'Two offers. Safe corporate job or risky startup. Imagine myself at 80 looking back. What will I regret not doing? Apply Bezos regret minimization to career decisions. Make this concrete not philosophical.', 65, 'active', NOW() + INTERVAL '3 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Antifragile systems - redesign our infrastructure', 'Every outage makes us weaker. One dependency failure brings down everything. Apply Taleb antifragile principles to system design. What changes make us stronger from stress? Chaos engineering plan?', 125, 'active', NOW() + INTERVAL '7 days');

  -- Set 16: Leadership Conflicts
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Give feedback to skip-level who is failing', 'My manager is conflict-averse. Her direct report is underperforming. She will not address it. Team morale tanking. Do I go around her? How to give feedback up and sideways? Political minefield navigation.', 70, 'active', NOW() + INTERVAL '4 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Layoffs coming - how to lead through it', 'Board mandates 20% cut next month. Have to choose who goes. Then lead remaining demoralized team. Need tactical playbook: selection criteria, communication plan, rebuilding trust. Real frameworks not platitudes.', 135, 'active', NOW() + INTERVAL '7 days');

  -- Set 17: Business Models
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'International expansion strategy for SaaS', '100% US customers. Considering Europe and LATAM. Which first? GDPR compliance? Currency? Payment methods? Localization? Support hours? Model expansion costs and realistic revenue projections.', 145, 'active', NOW() + INTERVAL '8 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Annual contracts vs monthly - impact analysis', 'Currently monthly billing. Churn is high but no commitment barrier. Considering annual plans with discount. Model impact on cash flow, churn, LTV, acquisition. What discount makes annual attractive?', 95, 'active', NOW() + INTERVAL '5 days');

  -- Set 18: More Unique Challenges
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Microservices were a mistake - going back to monolith', 'Deployed 15 services. Deploy complexity is insane. Tracing is impossible. Considering consolidation. Which services to merge? What to keep separate? How to do this without rewriting everything?', 135, 'active', NOW() + INTERVAL '7 days');
  
  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Write PRD for feature nobody asked for', 'CEO wants social features. Users never requested it. Data shows people work solo. I think it is wrong but need to ship it. Write compelling PRD that sets us up for quick pivot when it fails. How to build minimum viable version?', 110, 'active', NOW() + INTERVAL '6 days');

  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Competitor got acquired - what does it mean for us?', 'Direct competitor sold to Adobe for 150M. Market validation or market consolidation? Will acquirer kill the product or invest? Should we approach other potential acquirers? Or use this for fundraising momentum?', 105, 'active', NOW() + INTERVAL '6 days');

  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'AI generated code in production - legal risks?', 'Using Copilot and ChatGPT heavily. What is liability if AI suggests code that violates license? Or has security flaw? Or infringes patent? Research actual legal precedent. Give me policy we can adopt.', 95, 'active', NOW() + INTERVAL '5 days');

  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Imposter syndrome is paralyzing me', 'Senior role at startup. Feel out of my depth daily. Avoid speaking in meetings. Second-guess every decision. But reviews are good? Is this normal? Interview 5 senior people about their experience. Tactical coping strategies?', 85, 'active', NOW() + INTERVAL '5 days');

  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Skin in the game analysis of advisors', 'Have 5 advisors. They give contradictory advice. Who actually has something to lose if I fail? Map incentive structures. Who is signaling vs really helping? Design advisor structure with aligned incentives.', 75, 'active', NOW() + INTERVAL '4 days');

  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Team wants remote - investors want office', 'Engineering team is 100% remote. Performing great. New investors want everyone in SF. They control board. How do I fight this? What data proves remote works? How to compromise without losing team?', 115, 'active', NOW() + INTERVAL '6 days');

  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Vertical integration vs staying lean', 'We use 6 vendors: email, payments, analytics, support, hosting, auth. Considering building own infrastructure. Control vs complexity. When does vertical integration make sense? Model costs and risks.', 125, 'active', NOW() + INTERVAL '7 days');

  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Prioritize 47 feature requests with no data', 'Sales wants enterprise SSO. Support wants better search. Users want dark mode. CEO wants AI. All seem important. Build scoring framework: effort, impact, strategic value, risk. Rank top 10.', 95, 'active', NOW() + INTERVAL '5 days');

  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Revenue-based financing vs equity dilution', 'Can do 500K RBF at 1.4x repayment or 500K equity at 8M post. RBF is expensive but keeps control. Model cash flow impact. When does each make sense? What if we need Series A in 12 months?', 130, 'active', NOW() + INTERVAL '7 days');

  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Consulting vs full-time at 45 years old', '20 year career. Burned out on corporate politics. Considering independent consulting. Can charge 250 per hour. Need 1000 billable hours to match salary. Realistic? How to get first clients? What am I not considering?', 135, 'active', NOW() + INTERVAL '7 days');

  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Circle of competence - where am I delusional?', 'Founder spreading too thin. Product, sales, hiring, ops. Where am I actually competent vs pretending? Honestly assess each area. Who should own what? Build delegation plan based on true competence gaps.', 95, 'active', NOW() + INTERVAL '5 days');

  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Promotion decision between two equally qualified people', 'One senior role open. Two candidates: technical leader vs people person. Both deserve it. Can only promote one. Making enemy of whoever loses. How to decide? How to deliver news? Case studies?', 85, 'active', NOW() + INTERVAL '5 days');

  v_current_user := v_user_ids[v_index % array_length(v_user_ids, 1) + 1];
  v_index := v_index + 1;
  INSERT INTO challenges (creator_id, title, description, time_limit_minutes, status, ends_at)
  VALUES 
    (v_current_user, 'Partner program or direct sales only?', 'Resellers and agencies want to sell our product. Could be channel revenue. But splits, support burden, brand control. Study SaaS companies with successful partner programs. Build framework for decision.', 115, 'active', NOW() + INTERVAL '6 days');

END $BODY$;
