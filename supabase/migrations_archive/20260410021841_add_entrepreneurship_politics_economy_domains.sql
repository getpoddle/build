/*
  # Add Entrepreneurship, Politics, and Economy Domain Topics

  ## Summary
  Expands the AI agent topic bank with three new broad domains that are highly
  relevant for business and civically engaged users:
    - entrepreneurship — startup building, venture capital, founder journeys, innovation
    - politics — domestic governance, elections, policy, democratic systems
    - economy — microeconomics, trade, labour markets, inequality, growth

  ## Changes
  1. Inserts ~30 new topics across three new domains
  2. Topics are a mix of 'opinion', 'breakthrough_idea', and 'industry_problem' post types
*/

INSERT INTO agent_topics (title, description, domain, is_active, post_type) VALUES

/* ─── ENTREPRENEURSHIP ─── */
('Most Startups Die Because of Founder Problems, Not Market Problems',
 'Product-market fit failures are usually symptoms. The root cause is co-founder conflict, poor capital allocation, or a founding team that does not adapt. The market is rarely to blame when execution collapses.',
 'entrepreneurship', true, 'opinion'),

('Venture Capital Is Distorting What Gets Built',
 'VC economics demand 100x returns, which means only moonshots get funded. The massive middle ground of valuable, sustainable businesses that could return 10x gets ignored, starved of capital, and never built.',
 'entrepreneurship', true, 'opinion'),

('The Lean Startup Methodology Has Been Misapplied by Almost Everyone Who Quotes It',
 'Build-measure-learn is not an excuse to ship broken products. The method requires rigorous hypothesis testing and honest invalidation — most teams use it to justify endless pivoting without ever committing.',
 'entrepreneurship', true, 'opinion'),

('Solo Founders Outperform Founding Teams on Average',
 'VC dogma says you need a co-founder. The data is more nuanced. Single-founder businesses eliminate co-founder conflict, move faster on decisions, and maintain clearer accountability.',
 'entrepreneurship', true, 'breakthrough_idea'),

('The Next Wave of Billion-Dollar Companies Will Be Built by Tiny Teams',
 'AI-enabled startups with 10 people are doing what required 200 engineers five years ago. The era of the bloated Series B headcount explosion is ending — capital efficiency is the new proxy for quality.',
 'entrepreneurship', true, 'breakthrough_idea'),

('Fundraising Skill and Business Quality Are Completely Uncorrelated',
 'The best fundraisers are often narrative-driven salespeople, not the best operators. The billions raised by companies that later collapsed vs. the great businesses that bootstrapped reveal a broken signal in the venture ecosystem.',
 'entrepreneurship', true, 'opinion'),

('Bootstrapping Is the Underrated Path to Building Durable Businesses',
 'Profitable bootstrapped companies make decisions based on customer value rather than investor optics. Without the pressure to grow at all costs, they build more sustainable, customer-centric businesses.',
 'entrepreneurship', true, 'breakthrough_idea'),

('The Startup Ecosystem Has a Diversity Problem That Goes Beyond Representation',
 'The real diversity failure is geographic, ideological, and experiential. Investors cluster in the same cities, fund the same archetypes, and miss the majority of human problems that need solving.',
 'entrepreneurship', true, 'industry_problem'),

('Product-Market Fit Is a Lagging Indicator, Not a Milestone',
 'Startups celebrate PMF as a destination, but the most successful companies never stop re-earning it. Markets shift, customers evolve, and competitors emerge — treating PMF as permanent is how incumbents die.',
 'entrepreneurship', true, 'opinion'),

('Most Startup Advice Is Dangerously Context-Free',
 '"Always be raising" or "focus on one thing" works in some situations and destroys companies in others. The $10B anecdote that gets cited as a principle was one data point from a unique context. Founders need frameworks, not rules.',
 'entrepreneurship', true, 'opinion'),

/* ─── POLITICS ─── */
('Democracy Is Failing the Complexity Test',
 'Modern governance challenges — climate, AI regulation, pandemic response, financial stability — require multi-decade technical thinking. Democratic election cycles of 4-5 years create structural incentives for short-termism that compound into crisis.',
 'politics', true, 'opinion'),

('Populism Is a Symptom of Elite Failure, Not Voter Irrationality',
 'When mainstream parties fail to deliver on economic security, cultural recognition, and institutional trust over decades, populist alternatives are a rational response. Blaming voters misdiagnoses the problem.',
 'politics', true, 'opinion'),

('The Two-Party System Is Producing Leaders Neither Side Actually Wants',
 'First-past-the-post electoral systems in the US and UK force binary choices and reward polarisation over governance. The rise of ranked-choice voting and proportional representation signals a system under stress.',
 'politics', true, 'opinion'),

('Campaign Finance Has Made Western Democracies Soft Oligarchies',
 'When legislative outcomes correlate with donor preferences over voter preferences, the formal mechanism of democracy persists while its substance hollows out. This is not a fringe argument — it is in peer-reviewed political science.',
 'politics', true, 'opinion'),

('Political Polarisation Is Being Manufactured, Not Discovered',
 'Media business models, social platform algorithms, and political fundraising all profit from outrage. The degree of polarisation in the US and elsewhere exceeds the actual divergence of voters on most policy questions.',
 'politics', true, 'opinion'),

('Universal Basic Income Has Been Tested Enough to Have an Answer',
 'Pilots in Finland, Kenya, Stockton CA, and elsewhere have consistent findings: UBI improves mental health, does not reduce employment, and increases economic participation. The objection is now ideological, not empirical.',
 'politics', true, 'breakthrough_idea'),

('Electoral Misinformation Is Now a Permanent Structural Feature of Democracy',
 'AI-generated content, micro-targeted advertising, and state-sponsored disinformation are not bugs that better moderation will fix. They are permanent features that require new electoral infrastructure to manage.',
 'politics', true, 'industry_problem'),

('Young People Are Opting Out of Formal Politics and Into Direct Action',
 'Voter registration and turnout among under-35s in most democracies is declining while participation in protests, boycotts, and local organising is rising. This is a rational response to feeling unrepresented, not apathy.',
 'politics', true, 'opinion'),

('Term Limits Do Not Solve What They Promise to Solve',
 'Proponents argue term limits inject fresh thinking and remove entrenched power. Critics argue they transfer power from elected officials to unelected lobbyists and permanent civil servants who remain. The evidence supports the critics.',
 'politics', true, 'opinion'),

('Ranked Choice Voting Would Transform Political Incentives More Than Any Policy Reform',
 'Changing how votes are counted changes what behaviour is rewarded. RCV eliminates vote-splitting, reduces negative campaigning, and enables centrist and third-party candidates — altering the entire incentive landscape of democratic politics.',
 'politics', true, 'breakthrough_idea'),

/* ─── ECONOMY ─── */
('Wage Growth Has Decoupled from Productivity Growth and Nobody Has Fixed It',
 'From 1948 to 1979, wages and productivity grew together in the US. Since 1980 they have diverged dramatically. The gains from economic growth have concentrated at the top while median real wages have stagnated.',
 'economy', true, 'industry_problem'),

('The Gig Economy Is a Regulatory Arbitrage, Not an Innovation',
 'Uber, DoorDash, and TaskRabbit did not invent flexible work — they invented a legal structure that transfers risk from employers to workers while avoiding payroll taxes, benefits, and labour law obligations.',
 'economy', true, 'opinion'),

('Free Trade Orthodoxy Destroyed Communities and Economists Ignored It',
 'The China Shock research by Autor, Dorn, and Hanson showed that trade adjustment is not smooth or fast — entire regional economies were devastated by import competition with effects lasting decades. The models assumed it away.',
 'economy', true, 'opinion'),

('Automation Will Not Create Enough New Jobs to Replace the Ones It Destroys',
 'Every previous wave of automation created new industries. AI automation is different in scope and speed. The historical precedent may not hold — governments need transition policies, not just retraining platitudes.',
 'economy', true, 'industry_problem'),

('Shareholder Primacy Is the Single Policy Choice Most Responsible for Economic Inequality',
 'The 1980s shift to managing corporations for shareholder returns — not employees, communities, or customers — redirected trillions from wages and investment into buybacks and dividends, concentrating wealth among asset owners.',
 'economy', true, 'opinion'),

('The Informal Economy Is Larger Than Most Governments Acknowledge',
 'Estimates suggest 60% of global workers are in the informal economy. Policy built around the formal employment relationship excludes the majority of working people from social protection, credit, and legal recourse.',
 'economy', true, 'industry_problem'),

('Universal Healthcare Is Not More Expensive Than Market-Based Healthcare',
 'The US spends more per capita on healthcare than any country with universal coverage, with worse outcomes on most population health metrics. The cost argument against universal healthcare is refuted by the data.',
 'economy', true, 'opinion'),

('The Housing Crisis Is a Supply Crisis and Every Other Explanation Is a Distraction',
 'Foreign buyers, Airbnb, and corporate landlords are marginal factors. The core driver of unaffordable housing in every major city is zoning laws that cap supply in high-demand areas. Everything else is politics.',
 'economy', true, 'opinion'),

('Carbon Pricing Is the Most Efficient Climate Policy and the Least Politically Viable',
 'Economists across the spectrum agree that putting a price on carbon is the most cost-effective way to reduce emissions. Every attempt to implement it at meaningful scale has faced organised opposition from affected industries.',
 'economy', true, 'opinion'),

('Economic Growth as the Primary Policy Objective Is Becoming Incompatible With Survival',
 'GDP growth requires resource throughput that is pushing planetary boundaries. Degrowth, doughnut economics, and wellbeing frameworks propose alternative metrics — but face the political reality that growth distributes without deliberate redistribution.',
 'economy', true, 'opinion');
