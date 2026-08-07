-- Add week_number column to blog_posts for the weekly digest rotation
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS week_number integer;

-- Create index for weekly lookup
CREATE INDEX IF NOT EXISTS idx_blog_posts_week_number ON blog_posts (week_number) WHERE week_number IS NOT NULL;

-- Insert the 12-week decision-intelligence article series
-- Each article is published, uses 'use-case' category, authored by 'Poddle Team'
-- week_number cycles 1-12, used by the digest function to select the current week's article

INSERT INTO blog_posts (slug, title, excerpt, content, category, author_name, reading_time_minutes, is_published, is_featured, published_at, week_number)
VALUES
(
  'decision-intelligence-week-01-the-hire-you-cant-undo',
  'The Hire You Can''t Undo',
  'Irreversible decisions deserve a panel. Here''s how to stress-test the one decision you can''t take back.',
  '<h2>The decision that defines your company</h2><p>Every founder knows the feeling. You''re staring at a resume, a referral, a gut feeling. The role is senior. The stakes are high. And the decision is irreversible — once you hire, un-hiring is painful, expensive, and culturally corrosive.</p><p>Yet most hiring decisions are made the same way: a few interviews, a reference call, and a judgment call. One perspective. One set of assumptions. One moment of optimism or doubt that tips the scale.</p><h2>The decision-intelligence lesson</h2><p>Irreversible decisions deserve more than one perspective. They deserve a panel — not a panel that agrees, but one that disagrees productively. The Skeptic asks what happens if this person fails. The Risk Analyst quantifies the cost of a bad hire. The Optimist asks what upside you''re undervaluing. The Pragmatist asks whether you can actually afford the salary.</p><p>The point isn''t to paralyze yourself. It''s to surface the assumptions hiding behind your gut — and test them before they become expensive.</p><h2>How Poddle helps</h2><p>Bring your hiring decision to a Poddle workspace. Describe the role, the candidate, the context. Seven AI agents debate it from completely different angles — risk, market, finance, execution, people. The War Room synthesizes the debate into a clear recommendation with dissenting views kept in, so you see the full picture before you make the call.</p><div style="background:#1e293b;border-radius:12px;padding:20px 24px;margin:24px 0;border-left:4px solid #2563eb;"><p style="font-style:italic;color:#94a3b8;font-size:15px;margin:0;">"I had a candidate everyone loved. The Skeptic asked what happens in month four if they don''t ramp. That question changed the conversation — and the hire."</p><p style="color:#64748b;font-size:13px;margin:8px 0 0 0;">— A Poddle user, on a senior engineering hire</p></div><h2>Try this</h2><p>Open a workspace, paste the job description and candidate summary, and ask: <em>"What is the single assumption in this hire that would hurt most if it turned out to be wrong?"</em></p>',
  'use-case',
  'Poddle Team',
  6,
  true,
  false,
  now(),
  1
),
(
  'decision-intelligence-week-02-pricing-is-a-position-not-a-number',
  'Pricing Is a Position, Not a Number',
  'Your price cascades into positioning, churn, and who you attract. Here''s how to think about it as a strategic signal.',
  '<h2>The number that says everything</h2><p>Pricing is the most under-analyzed decision in most companies. It gets set early, changed rarely, and debated in fragments — a competitor launched at $19, should we match? A customer said it''s too expensive, should we discount?</p><p>But pricing isn''t a number. It''s a signal. It tells the market who you''re for, what you''re worth, and how you compare to alternatives. Price too low and you attract churn-prone customers who don''t value the product. Price too high and you shrink your market to the segment that can afford it — which may or may not be the right segment.</p><h2>The decision-intelligence lesson</h2><p>Every price change is a positioning decision. When you drop price, you''re signaling that the product is worth less. When you raise it, you''re signaling confidence. The question isn''t "what will customers pay?" — it''s "what position do we want to occupy, and what price reinforces it?"</p><p>Second-order thinking matters here. A price cut might win a few deals this quarter. But it also trains customers to wait for discounts, signals weakness to competitors, and compresses margins that fund the product roadmap.</p><h2>How Poddle helps</h2><p>Bring your pricing question to a Poddle workspace. The Market Analyst maps competitive positioning. The Financial Strategist models margin impact. The Systems Thinker traces second-order consequences — what happens to churn, to sales cycles, to your brand. The War Room synthesizes all perspectives into a recommendation with the trade-offs made explicit.</p><div style="background:#1e293b;border-radius:12px;padding:20px 24px;margin:24px 0;border-left:4px solid #2563eb;"><p style="font-style:italic;color:#94a3b8;font-size:15px;margin:0;">"We were about to cut prices to match a competitor. The Systems Thinker traced what that does to our brand over 18 months. We raised prices instead."</p><p style="color:#64748b;font-size:13px;margin:8px 0 0 0;">— A Poddle user, on a SaaS pricing decision</p></div><h2>Try this</h2><p>Open a workspace and ask: <em>"If we raise prices 20%, what changes — not just in revenue, but in who we attract, who we lose, and how competitors respond?"</em></p>',
  'use-case',
  'Poddle Team',
  6,
  true,
  false,
  now(),
  2
),
(
  'decision-intelligence-week-03-the-pivot-that-almost-wasnt',
  'The Pivot That Almost Wasn''t',
  'Second-order thinking on direction changes — and why the best pivots are the ones you almost didn''t make.',
  '<h2>The pivot paradox</h2><p>Pivots are romanticized in startup culture. "We were building X, then we realized the real opportunity was Y, and everything took off." The story is clean in retrospect. In the moment, it''s terrifying.</p><p>The problem with pivots isn''t that they''re wrong. It''s that they''re made under pressure — running out of runway, losing a key customer, watching a competitor pull ahead. Under pressure, the mind narrows. You see the escape route, not the destination.</p><h2>The decision-intelligence lesson</h2><p>Second-order thinking means asking not just "what happens if we pivot?" but "what happens after that?" A pivot that solves this quarter''s revenue problem but puts you in a worse competitive position next year isn''t a pivot — it''s a delay.</p><p>The best pivots are the ones where you''ve stress-tested the new direction as hard as the old one. Not a leap of faith, but a calculated redirect based on evidence that the new path has more upside.</p><h2>How Poddle helps</h2><p>Bring your pivot question to Poddle. The Market Analyst evaluates the new market. The Risk Analyst quantifies what you''re giving up. The Innovation Scout finds the upside you might be missing. The Systems Thinker traces the cascade — what happens to your team, your customers, your brand. The War Room synthesizes it all into a recommendation with the dissent kept in.</p><div style="background:#1e293b;border-radius:12px;padding:20px 24px;margin:24px 0;border-left:4px solid #2563eb;"><p style="font-style:italic;color:#94a3b8;font-size:15px;margin:0;">"We were 48 hours from pivoting. The Skeptic asked what evidence we had that the new market was bigger. We didn''t have any. We stayed — and it was the right call."</p><p style="color:#64748b;font-size:13px;margin:8px 0 0 0;">— A Poddle user, on a near-pivot</p></div><h2>Try this</h2><p>Open a workspace and ask: <em>"What evidence would make this pivot the right call? Do we have that evidence?"</em></p>',
  'use-case',
  'Poddle Team',
  7,
  true,
  false,
  now(),
  3
),
(
  'decision-intelligence-week-04-kill-it-or-keep-it',
  'Kill It or Keep It',
  'The sunk-cost trap in product roadmaps — and how a panel helps you see what you can''t.',
  '<h2>The feature nobody uses</h2><p>Every product has one. A feature that took three months to build, launched with excitement, and now sits in the analytics with single-digit adoption. Nobody wants to kill it — someone on the team advocated for it, a customer asked for it, and there''s always the argument that "it just needs more time."</p><p>Sunk cost fallacy is the most common bias in product decisions. You invested in building it, so you keep maintaining it. The investment is already gone. The question is only about the future: is this feature worth the cost of maintaining it going forward?</p><h2>The decision-intelligence lesson</h2><p>The sunk cost isn''t a reason to keep something — it''s a reason to be honest about why you''re keeping it. If the only argument for a feature is "we already built it," that''s not an argument. It''s a bias.</p><p>The flip side: sometimes low adoption means the feature is valuable but under-discovered. The question isn''t "kill or keep" — it''s "is this worth the ongoing cost, and if so, what would need to change for it to earn its place?"</p><h2>How Poddle helps</h2><p>Bring your feature decision to Poddle. The Data Detective challenges the assumption that adoption will improve. The Pragmatist asks what the maintenance cost actually is. The Optimist finds the upside of doubling down. The War Room synthesizes the debate into a clear kill/keep/invest recommendation.</p><div style="background:#1e293b;border-radius:12px;padding:20px 24px;margin:24px 0;border-left:4px solid #2563eb;"><p style="font-style:italic;color:#94a3b8;font-size:15px;margin:0;">"We had a feature with 2% adoption. Everyone wanted to kill it. The Data Detective found that the 2% were our highest-LTV customers. We kept it — and marketed it."</p><p style="color:#64748b;font-size:13px;margin:8px 0 0 0;">— A Poddle user, on a product roadmap decision</p></div><h2>Try this</h2><p>Open a workspace and ask: <em>"What would have to be true for this feature to be worth keeping? Is any of it true today?"</em></p>',
  'use-case',
  'Poddle Team',
  6,
  true,
  false,
  now(),
  4
),
(
  'decision-intelligence-week-05-raise-now-or-raise-later',
  'Raise Now or Raise Later',
  'Timing fundraising under uncertainty — the decision that shapes every decision after it.',
  '<h2>The funding clock</h2><p>When to raise is one of the highest-stakes decisions a founder makes. Raise too early and you dilute at a low valuation. Raise too late and you run out of options — forced to take whatever terms are on the table.</p><p>Most founders approach this with a simple heuristic: "we have X months of runway, so we start raising at X minus 6." But this ignores the strategic dimension. Market conditions, competitive dynamics, and your own growth trajectory all affect when the window is widest.</p><h2>The decision-intelligence lesson</h2><p>Fundraising is a timing decision, not just a necessity. The question isn''t "do we need money?" — it''s "when do we have the most leverage?" Leverage comes from momentum: strong metrics, a clear narrative, and a market that''s paying attention. Raising when you have momentum gets you better terms. Raising when you''re desperate gets you whatever you can get.</p><p>But there''s a second-order risk: waiting for "better momentum" can mean missing the window entirely. Markets close. Competitors raise first. The optimal time is rarely obvious.</p><h2>How Poddle helps</h2><p>Bring your fundraising timing question to Poddle. The Financial Strategist models runway scenarios. The Market Analyst maps investor sentiment and competitive timing. The Risk Analyst quantifies the cost of waiting. The War Room synthesizes into a recommendation with the trade-offs explicit.</p><div style="background:#1e293b;border-radius:12px;padding:20px 24px;margin:24px 0;border-left:4px solid #2563eb;"><p style="font-style:italic;color:#94a3b8;font-size:15px;margin:0;">"We were going to wait one more quarter for better metrics. The Market Analyst pointed out two competitors were raising. We went out that week."</p><p style="color:#64748b;font-size:13px;margin:8px 0 0 0;">— A Poddle user, on fundraising timing</p></div><h2>Try this</h2><p>Open a workspace and ask: <em>"What gives us more leverage — better metrics in 3 months, or going out now while competitors are quiet?"</em></p>',
  'use-case',
  'Poddle Team',
  6,
  true,
  false,
  now(),
  5
),
(
  'decision-intelligence-week-06-build-buy-or-partner',
  'Build, Buy, or Partner',
  'Make-vs-buy at speed — when building it yourself is the most expensive option.',
  '<h2>The default answer</h2><p>Most engineering teams default to "build." It''s understandable — you control the code, the roadmap, the quality. But building takes time, talent, and focus. Every hour spent building a feature that could be bought or partnered is an hour not spent on your core differentiator.</p><p>The make-vs-buy decision is rarely just about cost. It''s about speed, strategic fit, and what you''re giving up by choosing one path over another.</p><h2>The decision-intelligence lesson</h2><p>The right answer depends on whether the capability is core or commodity. If it''s core — the thing that makes your product better than alternatives — you should probably build. If it''s commodity — something every competitor needs but nobody wins by having — you should probably buy or partner.</p><p>The trap is when teams treat everything as core. They end up building infrastructure that doesn''t differentiate, while competitors who bought the commodity piece ship faster on the part that matters.</p><h2>How Poddle helps</h2><p>Bring your build/buy/partner decision to Poddle. The Pragmatist asks what you can realistically ship and when. The Market Analyst maps what competitors are doing. The Systems Thinker traces the long-term implications of each path. The War Room synthesizes into a recommendation that weighs speed, cost, and strategic fit.</p><div style="background:#1e293b;border-radius:12px;padding:20px 24px;margin:24px 0;border-left:4px solid #2563eb;"><p style="font-style:italic;color:#94a3b8;font-size:15px;margin:0;">"We spent four months building analytics that a vendor could have given us in a week. The Pragmatist asked what else we could have shipped in those four months. The answer was our entire next release."</p><p style="color:#64748b;font-size:13px;margin:8px 0 0 0;">— A Poddle user, on a build-vs-buy decision</p></div><h2>Try this</h2><p>Open a workspace and ask: <em>"Is this capability something we win by having, or something we win by building better than anyone else?"</em></p>',
  'use-case',
  'Poddle Team',
  6,
  true,
  false,
  now(),
  6
),
(
  'decision-intelligence-week-07-the-assumption-that-would-hurt-most',
  'The Assumption That Would Hurt Most',
  'Stress-testing load-bearing assumptions — the ones your entire plan rests on without anyone noticing.',
  '<h2>The hidden foundation</h2><p>Every plan rests on assumptions. Most are invisible. "Customers will pay for this." "The market is big enough." "We can hire fast enough." "Competitors won''t respond for 12 months." These assumptions are load-bearing — if one fails, the plan collapses.</p><p>The problem is that teams rarely identify which assumption is the most load-bearing. They debate the plan — the features, the timeline, the budget — but not the assumptions underneath it. And the assumption that would hurt most if wrong is usually the one nobody questioned.</p><h2>The decision-intelligence lesson</h2><p>Before you commit to a plan, find the assumption that would hurt most if it turned out to be wrong. Not the most likely to be wrong — the one with the worst consequences if it is. Then stress-test that assumption specifically.</p><p>This is premortem thinking: imagine the plan failed, work backwards to why, and you''ll find the assumption that was load-bearing all along.</p><h2>How Poddle helps</h2><p>Bring your plan to Poddle and ask which assumption is most load-bearing. The Skeptic looks for the weakest link. The Data Detective challenges assumptions that lack evidence. The Risk Analyst quantifies the damage if each assumption fails. The War Room synthesizes into a prioritized list of assumptions to validate — ranked by impact, not by likelihood.</p><div style="background:#1e293b;border-radius:12px;padding:20px 24px;margin:24px 0;border-left:4px solid #2563eb;"><p style="font-style:italic;color:#94a3b8;font-size:15px;margin:0;">"We assumed our biggest customer wouldn''t leave. They were 40% of revenue. The Skeptic asked: what if they do? We had no backup plan. We built one that week."</p><p style="color:#64748b;font-size:13px;margin:8px 0 0 0;">— A Poddle user, on a load-bearing assumption</p></div><h2>Try this</h2><p>Open a workspace and ask: <em>"If this plan failed six months from now, what was the assumption that killed it?"</em></p>',
  'use-case',
  'Poddle Team',
  7,
  true,
  false,
  now(),
  7
),
(
  'decision-intelligence-week-08-when-data-and-gut-disagree',
  'When Data and Gut Disagree',
  'Reconciling intuition with evidence — the decision that separates experienced leaders from everyone else.',
  '<h2>The conflict every leader faces</h2><p>The data says one thing. Your gut says another. The dashboard shows declining engagement, but you''ve been in enough markets to feel a shift coming. Or the metrics look great, but something feels off — too easy, too smooth, too good to be true.</p><p>This is the hardest decision moment: when evidence and intuition point in different directions. Most people pick a side. The best leaders find a way to hold both.</p><h2>The decision-intelligence lesson</h2><p>Data and gut aren''t opponents — they''re different instruments. Data tells you what''s happening. Gut tells you what might be happening that the data can''t see yet. When they disagree, the question isn''t "which is right?" — it''s "what would explain both being true?"</p><p>Often the answer is that the data is lagging and the gut is leading. Or the data is measuring the wrong thing. Or the gut is biased by recent experience. The point is to investigate the disagreement, not resolve it by picking a side.</p><h2>How Poddle helps</h2><p>Bring the conflict to Poddle. The Data Detective challenges what the data actually measures. The Skeptic questions whether your gut is biased. The Systems Thinker looks for a model that explains both signals. The War Room synthesizes into a recommendation that acknowledges the tension and suggests how to resolve it — often with a small experiment.</p><div style="background:#1e293b;border-radius:12px;padding:20px 24px;margin:24px 0;border-left:4px solid #2563eb;"><p style="font-style:italic;color:#94a3b8;font-size:15px;margin:0;">"Our churn data said we were fine. My gut said we were losing the wrong customers. The Data Detective found that our churn was concentrated in our highest-potential segment. The data was right — and so was my gut."</p><p style="color:#64748b;font-size:13px;margin:8px 0 0 0;">— A Poddle user, on reconciling data and intuition</p></div><h2>Try this</h2><p>Open a workspace and ask: <em>"What model would explain both the data and my gut being right at the same time?"</em></p>',
  'use-case',
  'Poddle Team',
  7,
  true,
  false,
  now(),
  8
),
(
  'decision-intelligence-week-09-entering-a-new-market-without-blowing-the-core',
  'Entering a New Market Without Blowing the Core',
  'Expansion and focus risk — the decision that growing companies get wrong in both directions.',
  '<h2>The expansion dilemma</h2><p>Your core product is working. Customers love it. Revenue is growing. And now someone — an investor, a salesperson, a customer — is asking: "Have you thought about [adjacent market]?"</p><p>Expansion is how companies grow. But it''s also how companies lose focus, dilute their core, and end up serving two markets poorly instead of one well. The question isn''t whether to expand — it''s when, where, and at what cost to the core.</p><h2>The decision-intelligence lesson</h2><p>Every expansion decision is a focus decision. Resources spent on the new market are resources not spent on the core. The question is whether the upside of the new market exceeds the compounding value of doubling down on the core.</p><p>The most common mistake is expanding too early — before the core is defensible. The second most common is expanding too late — after competitors have already established themselves in the adjacent space. Timing and sequencing matter as much as the market choice itself.</p><h2>How Poddle helps</h2><p>Bring your expansion question to Poddle. The Market Analyst evaluates the new market''s size and competitive landscape. The Systems Thinker traces the impact on your core — resources, attention, brand. The Pragmatist asks whether you can realistically serve both markets. The War Room synthesizes into a recommendation with the focus trade-off made explicit.</p><div style="background:#1e293b;border-radius:12px;padding:20px 24px;margin:24px 0;border-left:4px solid #2563eb;"><p style="font-style:italic;color:#94a3b8;font-size:15px;margin:0;">"We were about to enter enterprise. The Systems Thinker asked what happens to our SMB product if half the engineering team shifts to enterprise features. We realized we''d lose our core advantage."</p><p style="color:#64748b;font-size:13px;margin:8px 0 0 0;">— A Poddle user, on a market expansion decision</p></div><h2>Try this</h2><p>Open a workspace and ask: <em>"If we expand, what does the core product lose — and is the new market worth that loss?"</em></p>',
  'use-case',
  'Poddle Team',
  7,
  true,
  false,
  now(),
  9
),
(
  'decision-intelligence-week-10-the-customer-you-should-fire',
  'The Customer You Should Fire',
  'When saying no protects the business — and why the hardest customer decision is the one that''s best for everyone.',
  '<h2>The customer who costs more than they pay</h2><p>Every business has one: the customer who demands disproportionate support, negotiates every invoice, and consumes the time of your best people. They pay, but they cost — in morale, in focus, in opportunity.</p><p>Firing a customer feels wrong. Revenue is revenue. But some customers are net-negative: the cost of serving them exceeds the value they bring, once you account for the time, stress, and distraction they create.</p><h2>The decision-intelligence lesson</h2><p>Saying no to a customer is a strategic decision. The question isn''t "can we afford to lose this revenue?" — it''s "what could we do with the resources this customer consumes?"</p><p>The second-order effect: firing a bad customer frees up capacity to serve better customers. It also sends a signal to your team that you value their time and focus. And it sets a precedent — you become the kind of company that doesn''t tolerate bad-fit customers, which attracts better ones.</p><h2>How Poddle helps</h2><p>Bring your customer decision to Poddle. The Financial Strategist models the true cost of serving the customer. The Pragmatist asks what you''d do with the freed capacity. The Optimist finds the upside of replacing them with a better-fit customer. The War Room synthesizes into a recommendation with the financial and strategic trade-offs explicit.</p><div style="background:#1e293b;border-radius:12px;padding:20px 24px;margin:24px 0;border-left:4px solid #2563eb;"><p style="font-style:italic;color:#94a3b8;font-size:15px;margin:0;">"We fired our second-largest customer. They consumed 40% of support time for 10% of revenue. Within two months, we onboarded three customers who paid more and asked for less."</p><p style="color:#64748b;font-size:13px;margin:8px 0 0 0;">— A Poddle user, on firing a customer</p></div><h2>Try this</h2><p>Open a workspace and ask: <em>"What is the true cost of this customer — including the time, morale, and opportunity cost — and what would we do if they were gone?"</em></p>',
  'use-case',
  'Poddle Team',
  6,
  true,
  false,
  now(),
  10
),
(
  'decision-intelligence-week-11-hiring-a-vendor-is-a-decision-too',
  'Hiring a Vendor Is a Decision Too',
  'Procurement as strategy — the decision that quietly shapes your product, your margins, and your risk profile.',
  '<h2>The decision hidden in plain sight</h2><p>Choosing a vendor feels like an operational task, not a strategic decision. You need a payment processor, a hosting provider, an analytics tool. You compare features, negotiate price, sign the contract. Done.</p><p>But vendor decisions are strategic. They create dependencies, lock in costs, and shape what you can build. The wrong payment processor limits your expansion. The wrong hosting provider creates reliability risk. The wrong analytics tool means you can''t measure what you need to measure.</p><h2>The decision-intelligence lesson</h2><p>Every vendor decision is a bet on the future. The question isn''t just "does this tool do what we need today?" — it''s "will this vendor grow with us, or will we outgrow them?"</p><p>The hidden cost is switching cost. A vendor that''s easy to adopt but hard to leave creates a lock-in that compounds over time. The decision isn''t just about the present — it''s about how hard it will be to reverse if you''re wrong.</p><h2>How Poddle helps</h2><p>Bring your vendor decision to Poddle. The Risk Analyst quantifies the switching cost. The Market Analyst evaluates the vendor''s trajectory and stability. The Systems Thinker traces the dependency chain — what breaks if this vendor fails or changes pricing. The War Room synthesizes into a recommendation with the lock-in risk explicit.</p><div style="background:#1e293b;border-radius:12px;padding:20px 24px;margin:24px 0;border-left:4px solid #2563eb;"><p style="font-style:italic;color:#94a3b8;font-size:15px;margin:0;">"We chose the cheaper hosting provider. Eighteen months later, they had three outages that cost us customers. The Risk Analyst had flagged their reliability record. We switched — at 10x the cost of choosing right the first time."</p><p style="color:#64748b;font-size:13px;margin:8px 0 0 0;">— A Poddle user, on a vendor decision</p></div><h2>Try this</h2><p>Open a workspace and ask: <em>"What is the cost of switching away from this vendor in 12 months — and does that cost change our decision today?"</em></p>',
  'use-case',
  'Poddle Team',
  6,
  true,
  false,
  now(),
  11
),
(
  'decision-intelligence-week-12-the-decision-you-keep-postponing',
  'The Decision You Keep Postponing',
  'How a panel forces clarity — and why the decision you''re avoiding is the one that matters most.',
  '<h2>The decision that won''t go away</h2><p>There''s a decision you''ve been postponing. You know which one. It''s been on your list for weeks — maybe months. You keep finding reasons to defer it. "We need more data." "Let''s see how next quarter goes." "After we ship this release."</p><p>Postponement feels safe. But it''s an illusion. Every week you defer a decision, you''re making a decision — the decision to maintain the status quo. And the status quo has a cost you''re not measuring.</p><h2>The decision-intelligence lesson</h2><p>The decision you''re avoiding is usually the one that matters most. It''s uncomfortable because it''s consequential. If it were easy, you''d have made it already. The discomfort is a signal, not a obstacle.</p><p>The way through isn''t more data — it''s a structured debate that forces the assumptions into the open. Once you can see the assumptions, you can test them. Once you can test them, you can decide. The panel doesn''t make the decision for you — it makes the decision possible.</p><h2>How Poddle helps</h2><p>Bring the decision you''ve been avoiding to Poddle. The Skeptic asks what you''re actually afraid of. The Pragmatist asks what the status quo is costing you. The Systems Thinker traces what happens if you defer another quarter. The War Room synthesizes into a recommendation — not to tell you what to do, but to make the trade-off visible enough that you can finally choose.</p><div style="background:#1e293b;border-radius:12px;padding:20px 24px;margin:24px 0;border-left:4px solid #2563eb;"><p style="font-style:italic;color:#94a3b8;font-size:15px;margin:0;">"I''d been postponing a co-founder equity decision for six months. The Skeptic asked what happens if we raise funding and still haven''t resolved it. I made the decision that week."</p><p style="color:#64748b;font-size:13px;margin:8px 0 0 0;">— A Poddle user, on a postponed decision</p></div><h2>Try this</h2><p>Open a workspace and ask: <em>"What is the cost of not making this decision — and how long have I been paying it?"</em></p>',
  'use-case',
  'Poddle Team',
  6,
  true,
  false,
  now(),
  12
)
ON CONFLICT (slug) DO NOTHING;
