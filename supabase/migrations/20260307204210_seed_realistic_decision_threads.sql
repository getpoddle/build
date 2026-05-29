/*
  # Seed Realistic Decision Threads

  This migration populates decision threads with realistic data across different pods
  and users, including various stages, votes, and updates.

  1. Creates decision threads in different stages
  2. Adds votes from multiple users
  3. Adds updates (assumptions, risks, scenarios, comments)
  4. Distributes threads across different pods and creators
*/

-- Insert decision threads across different pods and stages
DO $$
DECLARE
  v_pod_ids uuid[];
  v_user_ids uuid[];
  v_thread_id uuid;
  v_random_user uuid;
  v_random_pod uuid;
BEGIN
  -- Get available pods and users
  SELECT ARRAY_AGG(id) INTO v_pod_ids FROM pods LIMIT 6;
  SELECT ARRAY_AGG(id) INTO v_user_ids FROM profiles WHERE id != '00000000-0000-0000-0000-000000000000' LIMIT 20;

  IF array_length(v_pod_ids, 1) IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RAISE NOTICE 'Not enough pods or users to seed decision threads';
    RETURN;
  END IF;

  -- Thread 1: Framing stage - Should we pivot our product strategy?
  v_random_pod := v_pod_ids[1 + floor(random() * array_length(v_pod_ids, 1))::int];
  v_random_user := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
  
  INSERT INTO decision_threads (pod_id, created_by, title, description, stage, success_criteria, decision_deadline, created_at, updated_at)
  VALUES (
    v_random_pod,
    v_random_user,
    'Should we pivot from B2B to B2C?',
    'Our current B2B sales cycle is 6+ months and requires significant resources. We''re seeing strong organic interest from individual users. Should we pivot to a B2C model or maintain our B2B focus?',
    'framing',
    'Achieve 10K paying users within 6 months with CAC < $50',
    now() + interval '14 days',
    now() - interval '2 days',
    now() - interval '1 day'
  ) RETURNING id INTO v_thread_id;

  -- Add updates for Thread 1
  INSERT INTO decision_thread_updates (thread_id, user_id, update_type, content, created_at)
  VALUES 
    (v_thread_id, v_user_ids[2], 'assumption_added', 'Assuming B2C users will convert at 3-5% based on similar products in our space', now() - interval '1 day'),
    (v_thread_id, v_user_ids[3], 'risk_added', 'Risk: We lose existing B2B relationships and pipeline if we shift focus too dramatically', now() - interval '20 hours'),
    (v_thread_id, v_user_ids[4], 'comment', 'We should look at Slack and Dropbox - both started B2B and added B2C later. Maybe we don''t have to choose?', now() - interval '18 hours');

  -- Add votes for Thread 1
  INSERT INTO decision_thread_votes (thread_id, user_id, vote, reasoning, created_at)
  VALUES 
    (v_thread_id, v_user_ids[2], 'agree', 'The data shows clear market demand from individuals', now() - interval '16 hours'),
    (v_thread_id, v_user_ids[5], 'disagree', 'Too risky to abandon our existing customer base without more validation', now() - interval '14 hours'),
    (v_thread_id, v_user_ids[6], 'abstain', 'Need more financial projections before deciding', now() - interval '12 hours');

  -- Thread 2: Exploring stage - Remote work policy
  v_random_pod := v_pod_ids[1 + floor(random() * array_length(v_pod_ids, 1))::int];
  v_random_user := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
  
  INSERT INTO decision_threads (pod_id, created_by, title, description, stage, success_criteria, decision_deadline, created_at, updated_at)
  VALUES (
    v_random_pod,
    v_random_user,
    'Implement full remote-first or hybrid model?',
    'Team has been requesting more flexibility. Our office lease is up for renewal. Should we go fully remote, hybrid (2-3 days), or maintain current in-office policy?',
    'exploring',
    'Maintain or improve employee satisfaction scores while reducing operational costs by 20%',
    now() + interval '30 days',
    now() - interval '5 days',
    now() - interval '6 hours'
  ) RETURNING id INTO v_thread_id;

  -- Add comprehensive updates for Thread 2
  INSERT INTO decision_thread_updates (thread_id, user_id, update_type, content, created_at)
  VALUES 
    (v_thread_id, v_user_ids[3], 'assumption_added', 'Productivity remains the same or improves with remote work based on 2-year pandemic data', now() - interval '4 days'),
    (v_thread_id, v_user_ids[4], 'assumption_added', 'Team cohesion can be maintained through quarterly offsites and better tooling', now() - interval '4 days'),
    (v_thread_id, v_user_ids[5], 'risk_added', 'New hires may struggle with onboarding and culture integration remotely', now() - interval '3 days'),
    (v_thread_id, v_user_ids[6], 'risk_added', 'Collaboration and spontaneous innovation may decrease without in-person interaction', now() - interval '3 days'),
    (v_thread_id, v_user_ids[7], 'scenario_added', 'Scenario A: Full remote - save $200K/year on office, hire globally, risk culture dilution', now() - interval '2 days'),
    (v_thread_id, v_user_ids[8], 'scenario_added', 'Scenario B: Hybrid 2-3 days - keep smaller office, maintain some in-person culture, moderate cost savings', now() - interval '2 days'),
    (v_thread_id, v_user_ids[9], 'comment', 'Have we surveyed the team on their preferences? That should heavily inform this decision', now() - interval '1 day');

  -- Add votes for Thread 2
  INSERT INTO decision_thread_votes (thread_id, user_id, vote, reasoning, created_at)
  VALUES 
    (v_thread_id, v_user_ids[3], 'agree', 'Full remote gives us access to global talent and major cost savings', now() - interval '1 day'),
    (v_thread_id, v_user_ids[4], 'agree', 'The data from pandemic period shows we can be effective remotely', now() - interval '20 hours'),
    (v_thread_id, v_user_ids[10], 'disagree', 'Hybrid is the sweet spot - flexibility with culture preservation', now() - interval '18 hours'),
    (v_thread_id, v_user_ids[11], 'disagree', 'Our best work happens in person - don''t optimize for cost over quality', now() - interval '16 hours');

  -- Thread 3: Deciding stage - Pricing model change
  v_random_pod := v_pod_ids[1 + floor(random() * array_length(v_pod_ids, 1))::int];
  v_random_user := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
  
  INSERT INTO decision_threads (pod_id, created_by, title, description, stage, success_criteria, decision_deadline, created_at, updated_at)
  VALUES (
    v_random_pod,
    v_random_user,
    'Switch from usage-based to flat-rate pricing?',
    'Customer feedback shows pricing confusion. Usage-based pricing creates unpredictable bills. Competitors are moving to simple flat-rate tiers. Should we follow?',
    'deciding',
    'Increase conversion rate by 15% and reduce support tickets about billing by 50%',
    now() + interval '7 days',
    now() - interval '10 days',
    now() - interval '2 hours'
  ) RETURNING id INTO v_thread_id;

  -- Add updates for Thread 3
  INSERT INTO decision_thread_updates (thread_id, user_id, update_type, content, created_at)
  VALUES 
    (v_thread_id, v_user_ids[4], 'assumption_added', 'Customers prefer predictable pricing even if they pay slightly more on average', now() - interval '9 days'),
    (v_thread_id, v_user_ids[5], 'assumption_added', 'Flat-rate pricing reduces decision paralysis during signup', now() - interval '9 days'),
    (v_thread_id, v_user_ids[6], 'risk_added', 'Heavy users may churn if they suddenly pay more under flat-rate model', now() - interval '8 days'),
    (v_thread_id, v_user_ids[7], 'risk_added', 'Revenue may decrease if we set flat rates too low', now() - interval '8 days'),
    (v_thread_id, v_user_ids[8], 'scenario_added', 'Three-tier model: Starter ($29), Pro ($99), Enterprise (custom)', now() - interval '7 days'),
    (v_thread_id, v_user_ids[9], 'forecast_added', 'Forecast: 60% confident this will increase MRR by 25% within 3 months', now() - interval '6 days'),
    (v_thread_id, v_user_ids[10], 'comment', 'We should grandfather existing customers to minimize churn', now() - interval '5 days'),
    (v_thread_id, v_user_ids[11], 'stage_changed', 'Moved to deciding stage', now() - interval '4 days');

  -- Add votes for Thread 3
  INSERT INTO decision_thread_votes (thread_id, user_id, vote, reasoning, created_at)
  VALUES 
    (v_thread_id, v_user_ids[4], 'agree', 'Customer research clearly shows demand for predictable pricing', now() - interval '3 days'),
    (v_thread_id, v_user_ids[5], 'agree', 'Competitor analysis shows this is becoming industry standard', now() - interval '3 days'),
    (v_thread_id, v_user_ids[12], 'agree', 'Will significantly reduce support burden and improve NPS', now() - interval '2 days'),
    (v_thread_id, v_user_ids[13], 'disagree', 'Power users love usage-based pricing - we might lose our best customers', now() - interval '2 days'),
    (v_thread_id, v_user_ids[14], 'agree', 'The conversion rate improvement will more than offset any revenue loss', now() - interval '1 day');

  -- Thread 4: Learning stage - Marketing channel decision
  v_random_pod := v_pod_ids[1 + floor(random() * array_length(v_pod_ids, 1))::int];
  v_random_user := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
  
  INSERT INTO decision_threads (pod_id, created_by, title, description, stage, decision_outcome, decision_reasoning, decision_date, success_criteria, created_at, updated_at)
  VALUES (
    v_random_pod,
    v_random_user,
    'Focus on content marketing vs paid ads?',
    'With limited marketing budget ($50K), should we invest in content marketing (SEO, blog, community) or paid advertising (Google, LinkedIn, Facebook)?',
    'learning',
    'Decided to focus 70% budget on content marketing, 30% on retargeting ads',
    'Content marketing has lower CAC ($35 vs $120 for paid ads) and better long-term ROI. However, paid ads provide quick validation and retargeting valuable for converted users. Hybrid approach balances both.',
    now() - interval '30 days',
    'Achieve CAC < $50 and generate 500 qualified leads per month within 6 months',
    now() - interval '60 days',
    now() - interval '1 hour'
  ) RETURNING id INTO v_thread_id;

  -- Add updates for Thread 4 (including post-decision learning)
  INSERT INTO decision_thread_updates (thread_id, user_id, update_type, content, created_at)
  VALUES 
    (v_thread_id, v_user_ids[5], 'assumption_added', 'Content marketing compounds over time while paid ads stop when budget runs out', now() - interval '58 days'),
    (v_thread_id, v_user_ids[6], 'risk_added', 'Content marketing takes 6-12 months to show results - may be too slow', now() - interval '55 days'),
    (v_thread_id, v_user_ids[7], 'scenario_added', 'Scenario: Invest in 2 full-time content creators + SEO tools vs hire agency for paid ads', now() - interval '50 days'),
    (v_thread_id, v_user_ids[8], 'decision_made', 'Decision made: 70/30 split content/paid. Starting with 3 blog posts per week and retargeting campaigns.', now() - interval '30 days'),
    (v_thread_id, v_user_ids[9], 'learning_update', 'Month 1 update: Published 12 articles, getting 2K organic visits/month. CAC from retargeting ads: $45. Early signs positive.', now() - interval '15 days'),
    (v_thread_id, v_user_ids[10], 'learning_update', 'Month 2 update: Organic traffic up to 5K/month. Two articles ranking page 1. Generated 150 qualified leads. Content strategy working!', now() - interval '1 day');

  -- Add votes for Thread 4
  INSERT INTO decision_thread_votes (thread_id, user_id, vote, reasoning, created_at)
  VALUES 
    (v_thread_id, v_user_ids[5], 'agree', 'Long-term thinking - content is a moat that compounds', now() - interval '45 days'),
    (v_thread_id, v_user_ids[15], 'agree', 'We have expertise to create great content, leverage our strengths', now() - interval '40 days'),
    (v_thread_id, v_user_ids[16], 'disagree', 'Too slow - we need leads now, not in 6 months', now() - interval '38 days');

  -- Thread 5: Framing stage - Technical architecture decision
  v_random_pod := v_pod_ids[1 + floor(random() * array_length(v_pod_ids, 1))::int];
  v_random_user := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
  
  INSERT INTO decision_threads (pod_id, created_by, title, description, stage, success_criteria, decision_deadline, created_at, updated_at)
  VALUES (
    v_random_pod,
    v_random_user,
    'Migrate to microservices or optimize monolith?',
    'Our monolith is becoming hard to maintain with 15 engineers. Deployment takes 45min. Some advocate for microservices, others say optimize what we have. Technical debt is mounting.',
    'framing',
    'Reduce deployment time to <10min, enable teams to deploy independently, maintain 99.9% uptime',
    now() + interval '21 days',
    now() - interval '3 days',
    now() - interval '8 hours'
  ) RETURNING id INTO v_thread_id;

  -- Add updates for Thread 5
  INSERT INTO decision_thread_updates (thread_id, user_id, update_type, content, created_at)
  VALUES 
    (v_thread_id, v_user_ids[6], 'assumption_added', 'Microservices will enable faster feature velocity as teams can work independently', now() - interval '2 days'),
    (v_thread_id, v_user_ids[7], 'risk_added', 'Microservices add operational complexity - we may not have the DevOps expertise yet', now() - interval '2 days'),
    (v_thread_id, v_user_ids[8], 'comment', 'Shopify scaled to billions on a monolith. Maybe our problems are elsewhere?', now() - interval '1 day');

  -- Thread 6: Exploring stage - Hiring decision
  v_random_pod := v_pod_ids[1 + floor(random() * array_length(v_pod_ids, 1))::int];
  v_random_user := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
  
  INSERT INTO decision_threads (pod_id, created_by, title, description, stage, success_criteria, decision_deadline, created_at, updated_at)
  VALUES (
    v_random_pod,
    v_random_user,
    'Hire senior engineers vs invest in junior talent?',
    'We have budget for 3 hires. Option A: 3 senior engineers at $180K each. Option B: 1 senior at $180K + 4 juniors at $90K each. Which maximizes long-term value?',
    'exploring',
    'Increase team output by 40% while building sustainable engineering culture',
    now() + interval '14 days',
    now() - interval '6 days',
    now() - interval '5 hours'
  ) RETURNING id INTO v_thread_id;

  -- Add updates for Thread 6
  INSERT INTO decision_thread_updates (thread_id, user_id, update_type, content, created_at)
  VALUES 
    (v_thread_id, v_user_ids[7], 'assumption_added', 'Senior engineers can mentor juniors, multiplying impact over time', now() - interval '5 days'),
    (v_thread_id, v_user_ids[8], 'assumption_added', 'Junior engineers bring fresh perspectives and high energy', now() - interval '5 days'),
    (v_thread_id, v_user_ids[9], 'risk_added', 'Juniors require significant mentoring time - may slow down seniors', now() - interval '4 days'),
    (v_thread_id, v_user_ids[10], 'risk_added', 'Senior engineers are hard to find and recruit - could take 6+ months', now() - interval '4 days'),
    (v_thread_id, v_user_ids[11], 'scenario_added', 'Hybrid approach: 2 seniors + 2 juniors. Balance experience with growth', now() - interval '3 days');

  -- Add votes for Thread 6
  INSERT INTO decision_thread_votes (thread_id, user_id, vote, reasoning, created_at)
  VALUES 
    (v_thread_id, v_user_ids[7], 'disagree', 'We need senior expertise now to tackle our architectural challenges', now() - interval '2 days'),
    (v_thread_id, v_user_ids[17], 'agree', 'Invest in junior talent - builds culture and loyalty long-term', now() - interval '2 days'),
    (v_thread_id, v_user_ids[18], 'abstain', 'Depends on what specific skills we need most urgently', now() - interval '1 day');

  RAISE NOTICE 'Successfully seeded 6 decision threads with updates and votes';
END $$;