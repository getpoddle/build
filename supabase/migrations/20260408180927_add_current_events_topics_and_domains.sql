/*
  # Add Current Events Topics and New Domains

  ## Summary
  Expands the agent discussion system with new topic domains and current-events topics
  across geopolitics, strategy, consulting, and emerging global issues.

  ## Changes
  1. New Topics Added - 40+ new discussion topics covering:
     - Geopolitics: US-China tensions, NATO, Middle East, BRICS, Taiwan, Arctic sovereignty
     - Strategy & Consulting: Corporate strategy failures, McKinsey model, zero-based budgeting, PE
     - Economy: Stagflation, de-dollarisation, debt ceilings, central bank credibility
     - Emerging Issues: Sovereign AI, digital currencies, rare earths, food security

  ## Domain Field Updates
  - New domain values: 'geopolitics', 'strategy', 'consulting', 'macro'
  - These map to new agent weighting profiles in the edge function

  ## Notes
  - All new topics inserted as active (is_active = true)
  - Existing topics and table structure are not modified
*/

INSERT INTO agent_topics (title, description, domain, is_active) VALUES

-- GEOPOLITICS
('US-China Decoupling Will Reshape the World Order',
 'The strategic competition between Washington and Beijing is forcing countries to pick sides, fragmenting supply chains and financial systems that underpinned globalisation for 30 years.',
 'geopolitics', true),

('NATO''s Eastern Expansion Has Made Europe Less Safe',
 'NATO enlargement to Russia''s borders provoked the Ukraine war, and continued expansion risks escalating conflicts rather than deterring them.',
 'geopolitics', true),

('The BRICS Expansion Is a Genuine Challenge to Western Dominance',
 'With Saudi Arabia, UAE, Ethiopia and others joining, BRICS now represents a majority of the world''s population and could fundamentally alter global governance and financial architecture.',
 'geopolitics', true),

('Taiwan Is the Most Dangerous Flashpoint in the World Right Now',
 'A Chinese military move on Taiwan would trigger a US response, collapse global semiconductor supply, and potentially start the first great-power war since 1945.',
 'geopolitics', true),

('Sanctions Have Failed as a Foreign Policy Tool',
 'Russia''s economy has adapted, Iran continues its nuclear programme, and sanctioned countries are building alternative financial rails. Sanctions hurt ordinary people without changing regimes.',
 'geopolitics', true),

('The Middle East Is Being Restructured for the First Time Since Sykes-Picot',
 'The Abraham Accords, the Gaza conflict, Iran''s regional ambitions, and Saudi Arabia''s Vision 2030 are redrawing alliances and power structures across the region.',
 'geopolitics', true),

('Africa Will Be the Defining Geopolitical Arena of the 21st Century',
 'With 60% of the world''s uncultivated arable land, vast mineral wealth, and a population that will double by 2050, control over Africa''s resources and alignment is the new great game.',
 'geopolitics', true),

('The Age of American Unipolarity Is Over',
 'The US withdrawal from Afghanistan, the Ukraine war''s stalemate, and China''s rise signal that US-led liberal world order is fragmenting into a multipolar system with unpredictable rules.',
 'geopolitics', true),

('Sovereign AI Is the Next Arms Race',
 'Countries that fail to develop domestic AI capabilities will be strategically dependent on the US or China, making AI sovereignty as critical as nuclear capability was in the 20th century.',
 'geopolitics', true),

('The Global South Is Asserting Itself in Ways the West Hasn''t Processed',
 'India, Brazil, Indonesia and others refuse to align with Western positions on Russia, climate, trade, and global institutions — signalling a new era of strategic autonomy.',
 'geopolitics', true),

-- STRATEGY & CONSULTING
('McKinsey-Style Consulting Is in Terminal Decline',
 'After scandals in South Africa, opioids, and Saudi Arabia, plus AI disrupting slide-deck work, the traditional consulting model of junior analysts repackaging frameworks is obsolete.',
 'strategy', true),

('Most Corporate Strategy Is Theatre, Not Reality',
 'Annual planning cycles, SWOT analyses, and 5-year roadmaps are largely performative. Real competitive advantage comes from operational excellence and fast iteration, not strategy documents.',
 'strategy', true),

('Private Equity Is Hollowing Out the Economy',
 'PE firms loading companies with debt, cutting costs, and flipping them within 5 years creates short-term returns for investors but destroys long-term value, jobs, and institutional quality.',
 'strategy', true),

('The ESG Movement Has Failed on Its Own Terms',
 'Despite trillions in ESG-labelled assets, carbon emissions keep rising, governance scandals continue, and social outcomes haven''t improved. ESG has become compliance theatre.',
 'strategy', true),

('Zero-Based Budgeting Destroys More Value Than It Creates',
 'Forcing companies to justify every expense each year kills institutional knowledge, demoralises teams, and optimises for short-term cost reduction over long-term capability building.',
 'strategy', true),

('The Platform Model Is Running Out of Growth',
 'Amazon, Google, Meta, and Uber have extracted most of the value from their network effects. Future growth requires entering adjacent markets or raising prices — both face serious limits.',
 'strategy', true),

('Vertical Integration Is Back as a Winning Strategy',
 'After decades of outsourcing and asset-light models, Apple, Tesla, and Amazon have shown that controlling your supply chain and distribution creates durable competitive moats.',
 'strategy', true),

('Most Mergers and Acquisitions Destroy Shareholder Value',
 'Study after study shows 70-80% of M&A deals fail to create value. Yet the M&A industry continues to boom — because the incentives for bankers, consultants, and CEOs are misaligned.',
 'strategy', true),

('The Talent War Has Fundamentally Changed Corporate Strategy',
 'In an era where top engineers, designers, and operators can work anywhere globally, talent retention and culture have become primary strategic differentiators, not capital or technology.',
 'strategy', true),

('Founder-Led Companies Consistently Outperform Manager-Led Ones',
 'Amazon, Apple, Nvidia, and Meta demonstrate that founders with long-term vision and equity alignment produce better outcomes than professional managers optimising quarterly earnings.',
 'strategy', true),

-- MACRO ECONOMY
('The Era of Cheap Money Is Over Forever',
 'Structural inflation from demographics, deglobalisation, and the green transition means interest rates will stay higher for longer than markets expect — repricing every asset class.',
 'macro', true),

('Central Banks Have Permanently Lost Credibility',
 'After printing trillions then aggressively hiking, the Fed and ECB have shown they will always prioritise short-term stability over long-term price discipline — inflation expectations are becoming unanchored.',
 'macro', true),

('The US Debt Trajectory Is Unsustainable and Markets Are Starting to Notice',
 'With the US running $2 trillion annual deficits at full employment, the bond market''s patience is finite. A fiscal crisis is a question of when, not if.',
 'macro', true),

('De-Dollarisation Is Happening Slowly, Then It Will Happen All at Once',
 'Saudi oil in yuan, BRICS payment systems, US weaponisation of the dollar through sanctions — the conditions for dollar hegemony are eroding even if the timeline is uncertain.',
 'macro', true),

('A Global Recession in 2025-2026 Is More Likely Than Markets Are Pricing',
 'Lagged effects of the sharpest rate-hiking cycle in 40 years, commercial real estate stress, and slowing Chinese demand point to a harder landing than the soft-landing consensus suggests.',
 'macro', true),

('Deglobalisation Will Cause Permanent Structural Inflation',
 'Reshoring, friend-shoring, and supply chain diversification are inherently inflationary. The deflationary tailwind from globalisation is reversing — and central banks lack the tools to respond.',
 'macro', true),

('Japan''s Economic Model Is the Future for Ageing Democracies',
 'Low growth, low inflation, stagnant wages, and high debt are not failures — they are the equilibrium outcome for societies that prioritise stability and social cohesion over dynamism.',
 'macro', true),

('The Housing Affordability Crisis Will Define the Politics of the Next Decade',
 'In every major city, housing costs have become the primary economic grievance. Governments that fail to solve it will face rising populism, declining birth rates, and generational political realignment.',
 'macro', true),

-- CONSULTING & PROFESSIONAL SERVICES
('AI Will Eliminate 50% of Consulting Jobs Within 5 Years',
 'Strategy decks, market sizing, benchmarking, and first-draft recommendations can already be produced by AI in hours, not weeks. The business case for $500/hour junior consultants is collapsing.',
 'consulting', true),

('The Billable Hour Model Is a Structural Flaw in Professional Services',
 'Law firms, consultancies, and accountants billing by the hour have no incentive to be efficient. AI-driven competitors charging fixed fees for outcomes will displace time-based billing models.',
 'consulting', true),

('Big 4 Accounting Firms Are a Systemic Risk to Financial Markets',
 'With four firms auditing nearly all major public companies globally, conflicts of interest, regulatory capture, and concentration risk create a single-point-of-failure in financial reporting.',
 'consulting', true),

('In-House Strategy Teams Are Replacing External Consultants',
 'Companies that built strong internal strategy capabilities — like Amazon, Google, and Netflix — consistently outperform those dependent on external advisors for competitive thinking.',
 'consulting', true),

-- ADDITIONAL CURRENT AFFAIRS
('Rare Earth Dominance Is China''s Most Underappreciated Strategic Weapon',
 'China controls 60%+ of rare earth mining and 85%+ of processing. Electric vehicles, wind turbines, missiles, and semiconductors all depend on materials Beijing can cut off overnight.',
 'geopolitics', true),

('Food Security Will Become the Dominant National Security Issue of the 2030s',
 'Climate disruption, water scarcity, and fertiliser concentration in a handful of countries mean that food supply chains are more fragile than energy supply chains — and far less discussed.',
 'geopolitics', true),

('The Global Fertility Collapse Is More Consequential Than Climate Change',
 'South Korea at 0.72, Italy at 1.2, China''s collapsing birth rate — demographic implosion in developed economies will reshape pension systems, immigration politics, and geopolitical power within a generation.',
 'macro', true),

('Industrial Policy Is Back and Capitalism Will Never Look the Same',
 'The US CHIPS Act, EU Green Deal subsidies, and China''s state-directed tech policy signal the end of free-market orthodoxy. Governments are picking winners — and private capital must adapt.',
 'strategy', true),

('The Geopolitics of AI Infrastructure Will Be as Consequential as Nuclear Geography',
 'Whoever controls data centres, undersea cables, chip fabrication, and AI talent concentrations will have structural strategic advantages that compound over decades.',
 'geopolitics', true);
