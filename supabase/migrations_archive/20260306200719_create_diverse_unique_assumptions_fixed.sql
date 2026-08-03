/*
  # Create Diverse Unique Assumptions
  
  1. Changes
    - Deletes all existing assumptions, forecasts, risks, and scenarios
    - Creates completely unique assumptions with varied topics
    - No repetitive "will X by Y%" patterns
    - Mix of technical, business, personal, and strategic topics
  
  2. Notes
    - Each assumption is genuinely different
    - Varied writing styles and perspectives
    - Real-world specific scenarios
*/

-- Clear existing data
DELETE FROM assumption_scenarios;
DELETE FROM assumption_risks;
DELETE FROM assumption_forecasts;
DELETE FROM pod_assumptions;

-- Create unique diverse assumptions
DO $BODY$
DECLARE
  v_pod_ids uuid[];
  v_user_ids uuid[];
  v_current_pod uuid;
  v_current_user uuid;
  v_pod_index int;
  v_user_index int;
BEGIN
  -- Get arrays for variety
  SELECT array_agg(id) INTO v_pod_ids FROM pods;
  SELECT array_agg(id) INTO v_user_ids FROM profiles;
  
  v_pod_index := 1;
  v_user_index := 1;

  -- Diverse assumption set (content field populated with title for compatibility)
  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Our authentication layer is the weakest point', 'Our authentication layer is the weakest point', 'Current implementation uses custom JWT handling instead of proven libraries. Team that built it left 18 months ago. Security audit flagged 3 critical issues we patched but structure remains fragile. One breach and we are done.', 'Technical Debt', 2);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Users actually want fewer features not more', 'Users actually want fewer features not more', 'Heatmaps show 80% of activity in 3 core workflows. We shipped 15 features last quarter. Adoption under 5% each. Maybe complexity is the enemy and we should be removing things.', 'Product Strategy', 1);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Our best engineer is actually hurting the team', 'Our best engineer is actually hurting the team', 'Ships more code than anyone. But 2 people quit citing him. Code reviews are brutal. Others afraid to push back. Short term we get velocity. Long term we might lose everyone else.', 'Team Dynamics', 3);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Enterprise customers will never pay for AI features', 'Enterprise customers will never pay for AI features', 'Every sales call they ask about AI. But when we quote prices 40% higher they ghost. Built entire AI roadmap. Risk is they want AI branding but not AI costs. Might need to eat the compute.', 'Business Model', 2);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Microservices were a mistake for our scale', 'Microservices were a mistake for our scale', 'Deployed 12 services for 300 users. Every deploy touches 4 services. Tracing is nightmare. Local dev requires docker compose with 15 containers. Considering merge back to monolith but scared of regression.', 'Architecture', 1);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Remote work is masking performance problems', 'Remote work is masking performance problems', 'Three people on team seem busy but ship nothing. In office you would notice. On Slack they respond fast. In standups they sound engaged. But PRs are empty. Not sure if overwhelmed or checked out.', 'Management', 2);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'We are building for Fortune 500 but selling to SMB', 'We are building for Fortune 500 but selling to SMB', 'Product roadmap is enterprise features: SSO, audit logs, role permissions. Revenue is 90% companies under 50 people who will never use this. Creating wrong product for actual customers.', 'Market Fit', 3);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Monthly pricing is killing our cash flow', 'Monthly pricing is killing our cash flow', 'Churn is 8% monthly. Marketing cost to acquire is 12 months payback. We are underwater on every customer for a year. Annual contracts could fix this but worried about conversion barrier.', 'Finance', 1);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Our database will collapse at 10K users', 'Our database will collapse at 10K users', 'Currently at 2K users and queries taking 800ms. No indexes on foreign keys. Full table scans everywhere. Can optimize but schema design is wrong. Might need migration that breaks backward compatibility.', 'Technical Scaling', 2);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Competitors are not sleeping - we are too slow', 'Competitors are not sleeping - we are too slow', 'Take us 6 weeks to ship feature. Competitor ships comparable feature in 10 days. They have more engineers but also different process. We do design docs, reviews, staging. They YOLO to prod. Who is right?', 'Velocity', 1);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Brand refresh will not fix our real problems', 'Brand refresh will not fix our real problems', 'CEO wants new logo and colors. Thinks we look outdated. But actual problem is onboarding flow has 60% drop-off. Spending 80K on brand while product is broken feels backwards.', 'Priorities', 2);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Usage metrics are lying to us', 'Usage metrics are lying to us', 'Dashboard shows 70% weekly active. But support tickets suggest confusion. People log in, click around, leave frustrated. Activity is not engagement. Need better signal on actual value delivery.', 'Analytics', 1);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Series A timing depends on market not our progress', 'Series A timing depends on market not our progress', 'Building toward 1M ARR for raise. But if market crashes like 2022 metrics do not matter. Could be profitable at current burn in 18 months. Raise now at worse terms or wait and risk window closing?', 'Fundraising', 3);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Free tier users will never convert', 'Free tier users will never convert', '5000 free users. 50 paying. 1% conversion after 18 months. Support cost for free tier is 20K monthly. Maybe free tier was mistake. Or maybe we need 50K free users to get meaningful conversion volume.', 'Pricing Model', 2);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Documentation is more valuable than new features right now', 'Documentation is more valuable than new features right now', 'Support gets same 10 questions daily. Docs are outdated. Users hack workarounds instead of using proper workflows. Could cut support cost 50% with good docs but eng team wants to build.', 'Customer Success', 1);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Offshore team quality is actually excellent - process is broken', 'Offshore team quality is actually excellent - process is broken', 'Blame offshore dev for bugs but they follow specs exactly. Problem is specs are wrong. Documentation is incomplete. US team writes vague tickets and complains about output. Not talent issue - communication issue.', 'Operations', 2);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Viral growth will never work for enterprise software', 'Viral growth will never work for enterprise software', 'Every SaaS playbook says build viral loops. But our buyers are IT directors who evaluate for 6 months. No one shares enterprise procurement software. Need traditional sales or accept SMB market.', 'Go-to-Market', 1);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Technical debt is compounding faster than we ship', 'Technical debt is compounding faster than we ship', 'Every sprint we add features but code quality degrades. Test coverage dropping. Deploy time increasing. Team velocity feels good but codebase health declining. At some point this catches up.', 'Engineering Health', 3);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Product-led growth only works if product is actually good', 'Product-led growth only works if product is actually good', 'Trying PLG motion but activation is 20%. Issue is product is confusing without sales demo. Might need to admit we are sales-led and stop pretending virality will save us.', 'Growth Strategy', 2);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Founders disagree on strategy but avoid the conversation', 'Founders disagree on strategy but avoid the conversation', 'Technical cofounder wants to focus on product. CEO cofounder pushing sales hard. Neither says it out loud. Team gets mixed signals. This will explode eventually if not addressed.', 'Founder Dynamics', 1);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Our positioning is too broad - trying to be everything', 'Our positioning is too broad - trying to be everything', 'Website says we serve marketing, sales, and product teams. Really we are best for product. Marketing features are half-baked. Sales barely use it. Niche down or actually build for all three?', 'Positioning', 2);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Investors will force pivot when market shifts', 'Investors will force pivot when market shifts', 'Raised on thesis of remote work tools. Now companies mandating return to office. Our pitch is stale. Investors have not said anything yet but bet they are worried. Need to evolve story before they do it for us.', 'Market Risk', 1);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Mobile app gets 5% usage but takes 40% of dev time', 'Mobile app gets 5% usage but takes 40% of dev time', 'Built iOS and Android apps. Almost everyone uses web. Apps are just wrappers. But now we maintain three codebases. Kill apps and focus or admit we need better mobile experience?', 'Resource Allocation', 3);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'AI features are marketing theater not real value', 'AI features are marketing theater not real value', 'Added AI everywhere because investors want it. Chat with documents. AI summaries. Smart suggestions. Usage is under 3%. Core product value is workflow not AI. But pitch deck is 50% AI slides.', 'Product Vision', 2);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Security audit will find issues that require 6 month fix', 'Security audit will find issues that require 6 month fix', 'SOC2 audit in 3 months. Know we have problems: no encryption at rest, weak password policy, no 2FA. Auditor will flag everything. Cannot fake it. Need real fixes or delay audit and miss enterprise deals.', 'Compliance', 1);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Churn is fixable with better onboarding not more features', 'Churn is fixable with better onboarding not more features', 'Users leave after 2 weeks. Survey says product is missing features. But suspect real issue is they never get set up properly. 10 minute onboarding gets 80% retention. 1 minute gets 30%. Math is clear.', 'Retention', 2);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Hiring senior people too early created title inflation', 'Hiring senior people too early created title inflation', 'First 3 engineers all senior level. Now hiring mid-level but they want senior title too. Cannot have company of all seniors. Made mistake early - how to fix without making people feel demoted?', 'Hiring', 1);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Best customers are ones we did not target', 'Best customers are ones we did not target', 'Built for tech startups. Revenue is 60% from healthcare companies using us off-label. They have budget and pay on time. Should we pivot ICP or stay focused on original vision?', 'Customer Segmentation', 3);

  v_current_pod := v_pod_ids[v_pod_index % array_length(v_pod_ids, 1) + 1];
  v_current_user := v_user_ids[v_user_index % array_length(v_user_ids, 1) + 1];
  v_pod_index := v_pod_index + 1;
  v_user_index := v_user_index + 1;
  INSERT INTO pod_assumptions (pod_id, created_by, content, title, description, category, challenge_count)
  VALUES (v_current_pod, v_current_user, 'Team morale is low but everyone pretends it is fine', 'Team morale is low but everyone pretends it is fine', 'Slack is quiet. 1-on-1s everyone says things are good. But feel in gut something is wrong. Maybe remote makes it hard to read. Maybe I am bad manager. Need way to surface real issues.', 'Culture', 2);

END $BODY$;
