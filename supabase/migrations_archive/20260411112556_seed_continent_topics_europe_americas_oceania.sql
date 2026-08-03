/*
  # Seed continent-focused topics: Europe, North America, South America, Oceania

  ## Summary
  Adds high-quality, continent-specific breakthrough ideas and industry problems
  for Europe, North America, South America, and Oceania across technology,
  agriculture, healthcare, energy, finance, and other key domains.
*/

INSERT INTO agent_topics (title, description, domain, post_type, continent, is_active, used)
VALUES

-- EUROPE
('Europe''s Green Industrial Policy Is Running Five Years Behind China and the Gap Is Accelerating',
 'The EU''s Green Deal allocates €1 trillion to clean energy transition, but subsidy timelines, permitting delays, and fragmented national industrial policies mean European manufacturers are losing clean tech market share to Chinese competitors at every stage of the value chain — solar, wind, batteries, and heat pumps. The structural problem is that European state aid rules were designed to prevent monopolies, not to compete with state capitalism at scale.',
 'energy', 'industry_problem', 'Europe', true, false),

('Germany''s Industrial Model Is Broken and the Country Has Not Yet Accepted It',
 'Germany''s post-war economic model — cheap Russian gas + Chinese export demand + American security umbrella — simultaneously collapsed in 2022. The country''s manufacturing competitiveness is structurally impaired: energy costs are 3x US levels, Chinese EV competition is displacing the auto industry, and the workforce is ageing faster than immigration policy can offset. The political difficulty of acknowledging this explains why German economic debate remains focused on fiscal orthodoxy rather than industrial restructuring.',
 'economy', 'industry_problem', 'Europe', true, false),

('The European Single Market for Services Barely Exists — and Fixing It Would Add More GDP Than Any Other Policy',
 'The EU single market eliminated trade barriers for goods in 1993, but services — which represent 70% of European GDP — remain fragmented by national licensing, language, and regulatory divergence. McKinsey estimates that completing the services single market would add €1.8 trillion to EU GDP annually. Every European Commission has identified this as a priority and failed to deliver, because incumbent service providers in every member state lobby against cross-border competition.',
 'economy', 'breakthrough_idea', 'Europe', true, false),

('Eastern Europe''s Talent Drain Is the Continent''s Least-Discussed Economic Crisis',
 'Romania, Bulgaria, and the Baltic states have lost 15-25% of their working-age populations to emigration since EU accession — not through displacement but through the rational exercise of free movement rights. The countries left behind face collapsing tax bases, healthcare system failures, and dependency ratios that make pension systems actuarially impossible. The EU''s free movement principle, celebrated as a democratic achievement, is operating as a human capital extractive mechanism for peripheral economies.',
 'society', 'industry_problem', 'Europe', true, false),

('Offshore Wind in the North Sea Could Power All of Europe — the Bottleneck Is Grid Infrastructure, Not Turbines',
 'The North Sea offshore wind resource is technically sufficient to meet 100% of European electricity demand. Turbine technology is proven, costs have fallen 70% in a decade, and capacity addition is accelerating. The constraint is onshore grid infrastructure: transmission networks were built for centralised fossil fuel generation and cannot handle distributed offshore input without a €600 billion upgrade that no single country has the incentive to fund unilaterally.',
 'energy', 'breakthrough_idea', 'Europe', true, false),

('Europe''s Agricultural Sector Is Caught Between Environmental Regulation and Food Security — and Both Cannot Win',
 'The EU Farm to Fork strategy targets a 50% reduction in pesticide use and 25% organic farmland by 2030. Analysis by agricultural economists suggests this would reduce EU crop yields by 10-15% — a food security risk that has become acute after the Ukraine war disrupted grain supplies. The policy was designed in a world where food security was assumed; the geopolitical environment has changed but the regulatory framework has not.',
 'food_agriculture', 'industry_problem', 'Europe', true, false),

-- NORTH AMERICA
('The US Freight Rail Network Is a Hidden Bottleneck Costing the Economy $200 Billion a Year',
 'American freight rail carries 40% of long-distance cargo more efficiently than any other mode — but Class I railroad consolidation has reduced the number of major operators from 33 to 7, creating monopoly pricing and service deterioration that forces shippers onto trucks. The 2023 rail strike exposed how dependent US supply chains are on infrastructure whose ownership structure prioritises shareholder returns over network reliability.',
 'logistics', 'industry_problem', 'North America', true, false),

('Canada''s Critical Minerals Are the World''s Most Undervalued Strategic Asset',
 'Canada holds the world''s third-largest reserves of lithium, cobalt, and nickel — the materials that determine who controls electric vehicle and battery storage supply chains. Yet Canada exports these minerals as raw ore, capturing 5-10% of the value that would accrue from processing and manufacturing. The gap between resource endowment and industrial capture is a policy failure with national security implications that Ottawa has been slow to act on.',
 'manufacturing', 'breakthrough_idea', 'North America', true, false),

('The US Healthcare System Spends $4.3 Trillion a Year and Produces Worse Outcomes Than Peers at Half the Cost',
 'The United States spends 18% of GDP on healthcare — twice the OECD average — while ranking 38th in life expectancy, 33rd in infant mortality, and last among high-income nations on most preventable death metrics. The excess cost is not explained by quality of care for those who receive it, but by administrative complexity, pharmaceutical pricing structures, and a billing system that employs more administrators than doctors. The reform path is known; the political economy blocks it.',
 'healthcare', 'industry_problem', 'North America', true, false),

('Mexico''s Nearshoring Opportunity Is Real but the Infrastructure to Capture It Does Not Exist Yet',
 'US manufacturers are actively relocating supply chains from China to Mexico — a "nearshoring" shift that could add $50 billion in annual FDI. But Mexico''s industrial parks, power grid, water infrastructure, and skilled workforce are not positioned to absorb this investment at the pace US companies require. The opportunity is genuine; the execution risk is that Mexico cannot build the supporting infrastructure fast enough to capture it before companies choose alternative locations.',
 'manufacturing', 'breakthrough_idea', 'North America', true, false),

('The US Agricultural Midwest Is Running Out of Water — and Farm Subsidies Are Accelerating the Depletion',
 'The Ogallala Aquifer, which irrigates 30% of US groundwater-fed agriculture across eight states, is being depleted 9 times faster than natural recharge rates. Current depletion trajectories suggest significant portions of the aquifer will be economically unviable within 25 years. Federal crop insurance and water pricing policies actively incentivise the over-extraction driving this crisis, creating a politically entrenched system optimised for short-term yield at the cost of long-term agricultural viability.',
 'food_agriculture', 'industry_problem', 'North America', true, false),

-- SOUTH AMERICA
('Brazil''s Agricultural Technology Revolution Is Feeding the World — but It Is Destroying the Cerrado to Do It',
 'Brazilian agricultural scientists at Embrapa have transformed the tropical Cerrado savanna into the world''s most productive soy and corn belt — a genuine scientific achievement that has made Brazil the world''s largest agricultural exporter. The environmental cost is the loss of 50% of the Cerrado ecosystem, a biodiversity hotspot with more species than most tropical rainforests. The tension between feeding 8 billion people and preserving irreplaceable ecosystems is sharpest in Brazil.',
 'food_agriculture', 'industry_problem', 'South America', true, false),

('Latin America''s Informal Economy Employs 60% of Workers — Formalisation Requires Redesigning the Social Contract',
 'Six in ten Latin American workers are in the informal economy — not because of a lack of regulation, but because formal employment costs (social security, payroll taxes, severance) are so high that both employers and workers rationally prefer informality. This creates a two-tier labour market where informal workers lack pensions, healthcare, and legal protections while formal employers are uncompetitive. Fixing this requires reducing formal employment costs, which means financing social protection through different tax bases.',
 'economy', 'industry_problem', 'South America', true, false),

('Chile''s Lithium Reserves Give It More Strategic Leverage Than Saudi Arabia Had with Oil — If It Acts Now',
 'Chile holds 36% of the world''s proven lithium reserves at a moment when lithium demand is projected to grow 40x by 2040 for electric vehicle batteries. Saudi Arabia''s oil nationalisation in the 1970s created a sovereign wealth fund now worth $900 billion. Chile''s decision on whether to nationalise, partner with, or simply tax foreign lithium extraction will determine whether this resource endowment translates into long-term national wealth or a commodity export story that benefits mining multinationals.',
 'energy', 'breakthrough_idea', 'South America', true, false),

('The Amazon''s Bioeconomy Could Generate More Value Than Deforestation — but the Finance System Doesn''t Know How to Price It',
 'Standing forest in the Amazon generates economic value through carbon sequestration, biodiversity preservation, rainfall regulation, and sustainable harvesting of non-timber products. Estimates suggest this value exceeds the economic output of agriculture and cattle ranching that drives deforestation. The problem is that none of this value is captured by local landowners in current market structures — making deforestation economically rational at the individual level even when it is catastrophic at the systemic level.',
 'environment', 'breakthrough_idea', 'South America', true, false),

('Colombia''s Peace Process Created a Cocaine Vacuum That Is Now Filled by More Violent Actors',
 'The 2016 FARC peace agreement removed the most organised and territorially coherent armed actor from Colombian drug territories. The result was not a reduction in coca cultivation — it was fragmentation into 30+ competing groups with less political discipline and more willingness to use violence against civilians. This is a predictable pattern in conflict transitions that international peace-building frameworks consistently underestimate.',
 'geopolitics', 'opinion', 'South America', true, false),

-- OCEANIA
('Australia''s Critical Minerals Strategy Is the Most Consequential Geopolitical Decision It Will Make This Decade',
 'Australia holds the world''s largest reserves of lithium, rare earths, and cobalt — materials essential to the energy transition and defence technology. China currently processes 80% of these materials even when the ore originates in Australia. Canberra''s decision on how to develop domestic processing capacity, who to partner with, and how to price strategic access will determine Australia''s geopolitical alignment and economic trajectory for 30 years.',
 'geopolitics', 'breakthrough_idea', 'Oceania', true, false),

('The Pacific Islands'' Climate Crisis Is Not a Future Scenario — It Is a Current Displacement Event',
 'Kiribati, Tuvalu, and the Marshall Islands are experiencing saltwater intrusion into freshwater supplies, coral reef die-offs, and storm surge flooding that are already making subsistence agriculture and fishing impossible in low-lying areas. These nations have populations of 10,000-120,000 — small enough that managed migration is logistically feasible but large enough to test the legal frameworks for climate-displaced peoples that international law has not yet developed.',
 'environment', 'industry_problem', 'Oceania', true, false),

('New Zealand''s Agricultural Emissions Are 50% of National Greenhouse Gas Output — and Farming Interests Have Blocked Every Policy Response',
 'New Zealand has among the world''s most ambitious climate targets but the most agriculture-dependent emissions profile of any developed economy. Sheep and dairy farming generate methane emissions that are biologically difficult to abate and politically impossible to price, given the farming sector''s constitutional influence over rural-weighted electoral systems. The gap between stated climate commitments and agricultural policy is the most transparent example of captured governance in a developed democracy.',
 'environment', 'industry_problem', 'Oceania', true, false)

ON CONFLICT DO NOTHING;
