/*
  # Seed continent-focused topics: Africa and Asia

  ## Summary
  Adds high-quality, continent-specific breakthrough ideas and industry problems
  for Africa and Asia across technology, agriculture, healthcare, energy, finance,
  and other key domains.

  Each topic is tagged with its continent for filtering in the Ideas Archive.
*/

INSERT INTO agent_topics (title, description, domain, post_type, continent, is_active, used)
VALUES

-- AFRICA - Technology
('Africa''s Mobile-First Internet Is Leapfrogging Fixed Infrastructure in Ways the West Cannot Replicate',
 'Sub-Saharan Africa never built landline internet at scale, creating a forced-innovation pressure that is now producing mobile payment, health, and logistics platforms structurally impossible to build on top of legacy wired networks. The continent''s 600 million mobile money users represent a real-time experiment in post-desktop computing. What the rest of the world calls "emerging" is actually ahead on several dimensions.',
 'technology', 'breakthrough_idea', 'Africa', true, false),

('Africa''s Fragmented Agricultural Data Problem Is Costing Smallholders $50 Billion a Year in Preventable Losses',
 'Over 70% of African farmers operate without accurate soil data, weather forecasts tuned to their micro-climate, or reliable price signals — not because the technology doesn''t exist, but because the data infrastructure is fragmented across 54 nations and dozens of competing platforms. The result is systematic under-investment in inputs and chronic post-harvest losses. A unified open-data layer for African agriculture would be the highest-ROI infrastructure investment on the continent.',
 'food_agriculture', 'industry_problem', 'Africa', true, false),

('The Off-Grid Solar Revolution in East Africa Is Building a New Energy Financing Model the World Will Copy',
 'Pay-as-you-go solar companies in Kenya, Tanzania, and Ethiopia have created a credit scoring system for 200 million people who have no bank history, using energy payment behaviour as the primary signal. This is not a charity model — it is a profitable, scalable approach to rural energy access that is now being replicated in South Asia and Latin America. The real breakthrough is the data asset, not the hardware.',
 'energy', 'breakthrough_idea', 'Africa', true, false),

('Africa''s Healthcare Worker Shortage Cannot Be Solved by Training More Doctors — The Model Needs to Change',
 'The WHO estimates a shortfall of 6 million health workers in Africa by 2030. Medical school pipelines cannot close this gap in time, and the brain drain of trained clinicians to Europe and North America makes the problem self-reinforcing. The only viable path is a radical redistribution of clinical tasks to community health workers equipped with AI-assisted diagnostic tools — but this requires regulatory reform that health ministries are structurally resistant to.',
 'healthcare', 'industry_problem', 'Africa', true, false),

('Pan-African Payment Infrastructure Is Finally Viable and It Will Reshape Trade Across 1.4 Billion People',
 'The African Continental Free Trade Area (AfCFTA) eliminates tariffs for 90% of goods, but intra-African trade is still only 15% of total trade versus 68% in Europe — largely because cross-border payments are routed through New York or London, adding cost and days of delay. New real-time interoperability between M-Pesa, MTN Money, and central bank digital currency pilots is building the rails for a payment system that could make intra-African commerce as frictionless as domestic transfers.',
 'finance', 'breakthrough_idea', 'Africa', true, false),

('West Africa''s Logistics Infrastructure Gap Is a Bigger Barrier to Industrialisation Than Capital or Skills',
 'Manufacturing in West Africa costs 30-50% more than in comparable Asian economies not because of labour or capital, but because of port congestion, unreliable road networks, and the absence of cold chain logistics. Investors consistently cite logistics as the primary deterrent to factory investment — yet infrastructure spending continues to prioritise prestige projects over the last-mile connectivity that actually determines industrial viability.',
 'logistics', 'industry_problem', 'Africa', true, false),

('Africa''s Young Population Dividend Will Only Pay Off If Education Systems Stop Teaching for Exams That Don''t Exist',
 'By 2050, Africa will have the world''s largest working-age population — but current education systems in Nigeria, DRC, and Ethiopia are still structured around rote learning designed for civil service employment in economies that no longer exist. The mismatch between what schools teach and what markets reward is creating a youth unemployment crisis inside a demographic boom. Vocational and entrepreneurial education reform is not a development priority — it is the most urgent economic policy question on the continent.',
 'education', 'industry_problem', 'Africa', true, false),

-- ASIA - Technology
('India''s UPI Payment Stack Is the Most Underappreciated Infrastructure Export of the 21st Century',
 'India''s Unified Payments Interface processed $2.2 trillion in transactions in 2023 — more volume than Visa and Mastercard combined in the country. The government is now exporting the architecture to Southeast Asia, the Middle East, and Africa at near-zero cost. This is not a fintech story; it is a story about state-built digital public infrastructure displacing private intermediaries in ways that would have been politically impossible in Western economies.',
 'technology', 'breakthrough_idea', 'Asia', true, false),

('China''s Dominance in Electric Vehicle Supply Chains Is Not a Trade War Issue — It Is a Decade-Long Industrial Policy Execution',
 'China controls 80% of the global lithium battery supply chain because of decisions made in 2010, not 2020. Western auto manufacturers are now paying for a decade of under-investment in battery chemistry, mining rights, and cathode manufacturing — and cannot close the gap in less than ten years regardless of tariff policy. The lesson is not about protectionism; it is about the timescale on which industrial strategy must be evaluated.',
 'manufacturing', 'breakthrough_idea', 'Asia', true, false),

('Southeast Asia''s Informal Economy Is Being Formalised by Super-Apps — and the Tax Implications Are Enormous',
 'Grab, Gojek, and their regional competitors have inadvertently created the largest formalisation of informal labour in history, with 20 million drivers, couriers, and merchants now generating digital transaction records that governments can tax. Indonesia and Vietnam are only beginning to build the regulatory frameworks to capture this revenue. The fiscal implications for public services in middle-income Southeast Asian economies are transformative.',
 'economy', 'breakthrough_idea', 'Asia', true, false),

('Japan''s Demographic Collapse Is a Preview of the Crisis Every Ageing Economy Will Face — and Nobody Is Learning from It',
 'Japan has had the world''s oldest population for 30 years and has tried every conventional policy response: immigration reform, female workforce participation, and robot-assisted eldercare. None have worked at scale. The country is a real-time experiment in managing economic contraction that Germany, South Korea, and eventually China are running a generation behind. The failure to learn from Japan''s experience is one of the most expensive policy blind spots in modern economics.',
 'macro', 'industry_problem', 'Asia', true, false),

('Bangladesh''s Garment Industry Is About to Be Automated Out of Existence — and No Alternative Employer Exists',
 'Robotic sewing technology developed by SoftWear Automation can now produce a T-shirt in 26 seconds with no human labour. Bangladesh''s 4 million garment workers, who generate 80% of the country''s export earnings, face displacement on a timescale of 10-15 years with no industrial alternative ready to absorb them. This is not a future risk — it is an unfolding structural crisis that international development institutions are not treating with appropriate urgency.',
 'manufacturing', 'industry_problem', 'Asia', true, false),

('Vietnam Is Becoming the World''s Second Electronics Manufacturing Hub — and the West Is Barely Noticing',
 'Apple, Samsung, and Intel have collectively moved over $50 billion in manufacturing capacity to Vietnam in the past five years. The country now exports more electronics than all of Africa combined. The geopolitical and supply chain implications of this shift are as significant as China''s WTO accession in 2001 — but the strategic analysis in Western policy circles remains focused on China-plus-one diversification rather than the emergence of a new industrial power.',
 'manufacturing', 'breakthrough_idea', 'Asia', true, false),

('India''s Water Crisis Is the Most Under-Priced Risk in Its Economic Growth Story',
 '21 Indian cities, including Delhi and Bangalore, are projected to run out of groundwater by 2030. Agriculture consumes 90% of India''s freshwater at near-zero cost due to political pricing decisions, creating a tragedy of the commons that GDP growth narratives consistently ignore. Water stress is already reducing agricultural yields in Maharashtra and Gujarat — and will constrain manufacturing growth in water-intensive sectors long before any other resource bottleneck becomes visible.',
 'environment', 'industry_problem', 'Asia', true, false),

('South Korea''s Semiconductor Dominance Is Built on a Workforce Model That Is Structurally Unsustainable',
 'TSMC and Samsung''s competitive advantage in advanced chip manufacturing depends on engineers working 70-hour weeks as a cultural norm — a workforce model that is collapsing under generational attitude shifts and a 50% decline in engineering enrolment in South Korea. The talent pipeline crisis in East Asian semiconductor manufacturing is the most underdiscussed supply chain risk in the global technology sector.',
 'technology', 'industry_problem', 'Asia', true, false),

-- ASIA - Agriculture
('Precision Fermentation Will Displace 30% of Asia''s Agricultural Land Use Within 20 Years — Planners Are Not Ready',
 'Microbial fermentation of proteins, fats, and carbohydrates is advancing faster than solar energy did in 2010. The land-use implications for rice paddy agriculture in Asia — which feeds 3 billion people but occupies 200 million hectares — are existential for rural economies built around smallholder farming. No Asian government has a policy framework for managing this transition, and the window to build one is narrowing.',
 'food_agriculture', 'breakthrough_idea', 'Asia', true, false)

ON CONFLICT DO NOTHING;
