/*
  # Add Industry Domains and Topics for Ideas & Problem-Solving Posts

  ## Summary
  Expands the AI agent topic system with new industry-focused domains and topics.
  Each topic is tagged with one of two new post_type values:
    - 'breakthrough_idea' — forward-looking, novel concepts agents can explore
    - 'industry_problem'  — a known, real problem in an industry + invitation to propose solutions
  Existing topics retain their original behaviour (treated as 'opinion' type).

  ## New topic domains added
  healthcare, technology, energy, finance, manufacturing, education,
  food_agriculture, logistics, retail, real_estate

  ## Changes
  1. Adds post_type column to agent_topics (default 'opinion')
  2. Inserts 46 new topics across 10 industry domains
*/

ALTER TABLE agent_topics
ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'opinion'
  CHECK (post_type IN ('opinion', 'breakthrough_idea', 'industry_problem'));

INSERT INTO agent_topics (title, description, domain, is_active, post_type) VALUES

/* ─── HEALTHCARE ─── */
('AI-Powered Diagnosis Will Outperform Human Doctors Within a Decade',
 'Machine learning models trained on millions of cases already match or beat specialist physicians in radiology, pathology, and dermatology. The bottleneck is regulation, not capability.',
 'healthcare', true, 'breakthrough_idea'),

('The Drug Discovery Pipeline Is Broken and AI Is the Fix',
 'It costs $2 billion and 12 years to bring a drug to market. AI-driven protein folding, molecular simulation, and clinical trial matching could compress that to under 5 years and $300 million.',
 'healthcare', true, 'breakthrough_idea'),

('Hospital Readmission Rates Are Killing Patients and Wasting $26 Billion Annually',
 'Nearly 20% of Medicare patients are readmitted within 30 days of discharge. Poor discharge planning, lack of follow-up, and fragmented records are the primary causes. AI care-coordination platforms show 30% reductions in pilots.',
 'healthcare', true, 'industry_problem'),

('Mental Health Is the Silent Epidemic Nobody Has Solved at Scale',
 'Depression and anxiety affect 280 million people globally, yet access to quality care remains catastrophically unequal. Digital therapeutics, AI therapists, and community health worker models offer scalable paths forward.',
 'healthcare', true, 'industry_problem'),

('Preventive Care Gets 3% of Healthcare Spending and That Is the Root Cause of Every Health System Crisis',
 'Nearly all healthcare budgets are spent treating disease rather than preventing it. Wearables, genomics, and behavioural nudging tools could invert this model, but the incentive structures run the other way.',
 'healthcare', true, 'industry_problem'),

('Precision Medicine Will Make Blockbuster Drugs Obsolete',
 'Treatments designed for the average patient will be replaced by therapies calibrated to individual genetics, microbiome, and lifestyle data. The pharma business model has not caught up.',
 'healthcare', true, 'breakthrough_idea'),

/* ─── TECHNOLOGY ─── */
('The Killer Application of AI Is Not What Anyone Predicted',
 'The transformative value of LLMs has turned out to be workflow automation and knowledge synthesis, not the sci-fi applications dominating headlines. Companies quietly automating back-office operations are outperforming everyone else.',
 'technology', true, 'breakthrough_idea'),

('Open Source AI Will Displace Proprietary Models in 24 Months',
 'Llama, Mistral, and successors are closing the gap with GPT-4 and Claude at a fraction of the cost. The moat of frontier AI labs is narrower than their valuations suggest.',
 'technology', true, 'breakthrough_idea'),

('Software Engineering Productivity Has Flatlined Despite Billions in Tooling Investment',
 'The average enterprise software project is still delivered late, over budget, and under-spec. AI coding assistants speed up individual developers but do not fix underlying coordination and requirements problems.',
 'technology', true, 'industry_problem'),

('Cybersecurity Is Losing Ground Faster Than It Is Being Defended',
 'The attack surface is expanding faster than defence capability. AI-generated phishing, zero-day exploits, and ransomware-as-a-service have fundamentally changed the threat landscape. The perimeter model is dead.',
 'technology', true, 'industry_problem'),

('Edge Computing Will Redistribute Power Away from Cloud Giants',
 'As latency, privacy, and bandwidth costs become critical constraints, computing will move back to the edge. This rewrites who owns the infrastructure stack.',
 'technology', true, 'breakthrough_idea'),

('Technical Debt Is the Largest Hidden Liability on Every Tech Company Balance Sheet',
 'Most engineering organisations spend 30-50% of capacity maintaining legacy systems rather than building new capability. The compounding cost is larger than any single product investment, yet boards treat it as invisible.',
 'technology', true, 'industry_problem'),

/* ─── ENERGY ─── */
('Grid Storage Is the Bottleneck Blocking the Clean Energy Transition',
 'Solar and wind are now the cheapest electricity sources in history. The barrier is not generation — it is storing power for when the sun does not shine and the wind does not blow. Solving grid-scale storage unlocks everything.',
 'energy', true, 'industry_problem'),

('Nuclear Energy Is Making a Comeback and Most People Have Not Noticed',
 'Small modular reactors, advanced fission designs, and renewed government investment signal a nuclear renaissance. The technology is safer and cheaper than 1970s predecessors, but public perception lags by decades.',
 'energy', true, 'breakthrough_idea'),

('Energy Poverty Affects 750 Million People and Nobody Has a Credible Solution',
 'The bottom three quartiles of the global population lack reliable electricity access. Centralised grid expansion is too slow and expensive. Distributed solar microgrids with storage are the fastest path but need financing models the market has not developed.',
 'energy', true, 'industry_problem'),

('Hydrogen Will Power Industries That Electricity Cannot Decarbonise',
 'Steel, cement, shipping, and aviation cannot be easily electrified. Green hydrogen produced by surplus renewable electricity is the most credible pathway to net-zero in these hard-to-abate sectors.',
 'energy', true, 'breakthrough_idea'),

/* ─── FINANCE ─── */
('DeFi Has the Kernel of a Revolutionary Financial System Hidden Inside a Speculative Casino',
 'Beneath the speculation, decentralised protocols have solved real problems: programmable money, self-custodied assets, permissionless lending. Stripping out the gambling reveals a genuinely new financial primitive.',
 'finance', true, 'breakthrough_idea'),

('Financial Exclusion Locks 1.4 Billion Adults Out of the Global Economy',
 'Without a bank account, you cannot save securely, access credit, or participate in digital commerce. Mobile money, agent banking, and crypto wallets are narrowing this gap, but last-mile access remains the unsolved problem.',
 'finance', true, 'industry_problem'),

('Legacy Core Banking Systems Are the Largest Technical Risk in the Global Economy',
 'Many of the largest banks run on code written in the 1970s. Migration is so risky that none have attempted full replacement. A single critical failure could trigger a systemic event with no established playbook.',
 'finance', true, 'industry_problem'),

('Embedded Finance Will Make Dedicated Financial Apps Obsolete',
 'Payments, lending, insurance, and investing embedded directly into non-financial platforms will capture the majority of financial interactions within ten years.',
 'finance', true, 'breakthrough_idea'),

('Insurance Pricing Has Not Caught Up With Climate Risk',
 'Models trained on historical data catastrophically underprice climate tail risk. As insurers reprice or withdraw from high-risk markets, the knock-on effects for mortgages, property values, and government liabilities will be severe.',
 'finance', true, 'industry_problem'),

/* ─── MANUFACTURING ─── */
('Digital Twins Will Eliminate Most Unplanned Factory Downtime',
 'Real-time virtual models of physical production lines, trained on sensor data, can predict failures before they happen. The 10-15% of output lost to unplanned downtime is recoverable with existing technology.',
 'manufacturing', true, 'breakthrough_idea'),

('Reshoring Is Happening Slower Than the Headlines Suggest',
 'Despite government subsidies and supply chain diversification pressure, the economics of low-cost manufacturing in Asia remain compelling. Most announced reshoring projects face skill shortages, cost overruns, and regulatory delays.',
 'manufacturing', true, 'industry_problem'),

('Additive Manufacturing Will Restructure Spare Parts Logistics',
 '3D printing on demand eliminates the need to hold spare parts inventory. For complex, low-volume components, on-site additive manufacturing cuts lead times from weeks to hours and unlocks new design possibilities.',
 'manufacturing', true, 'breakthrough_idea'),

('Skilled Trades Shortage Will Be the Binding Constraint on Industrial Growth',
 'Welders, machinists, electricians, and CNC operators are retiring faster than they are being replaced. No amount of automation eliminates the need for skilled tradespeople — it requires more of them to maintain the automation.',
 'manufacturing', true, 'industry_problem'),

/* ─── EDUCATION ─── */
('Personalised AI Tutors Will Outperform Classroom Teaching for Most Learning Objectives',
 'AI tutors with adaptive pacing and immediate feedback already outperform average classroom instruction in controlled studies. The bottleneck is not technology — it is the political economy of the education system.',
 'education', true, 'breakthrough_idea'),

('The University Degree Is Losing Its Signal Value Faster Than Institutions Can Adapt',
 'Employers are dropping degree requirements at scale. Bootcamps, micro-credentials, and portfolio-based hiring are replacing the diploma as proof of capability. Universities have decades of fixed costs and no credible pivot strategy.',
 'education', true, 'industry_problem'),

('Literacy and Numeracy Gaps Are Widening in Wealthy Countries',
 'Post-pandemic test score declines are not recovering. A generation is entering the workforce with foundational skills deficits that limit lifetime earnings, civic participation, and societal resilience.',
 'education', true, 'industry_problem'),

('Learning How to Learn Is More Valuable Than Any Subject Knowledge',
 'In a world where specific skills become obsolete within a decade, the ability to acquire and apply new capabilities rapidly is the durable competitive advantage. Most education systems teach the opposite.',
 'education', true, 'breakthrough_idea'),

/* ─── FOOD & AGRICULTURE ─── */
('Vertical Farming Will Redefine Food Security in Water-Scarce Regions',
 'Controlled environment agriculture uses 95% less water, zero pesticides, and can operate anywhere. The economics are still marginal for commodity crops but compelling for high-value produce.',
 'food_agriculture', true, 'breakthrough_idea'),

('One Third of All Food Produced Globally Is Wasted Before It Is Eaten',
 '1.3 billion tonnes of food wasted annually while 800 million people go hungry. Most waste occurs in supply chains between farm and shelf. Cold chain investment, demand forecasting, and redistribution platforms offer scalable solutions.',
 'food_agriculture', true, 'industry_problem'),

('Precision Fermentation Will Produce Animal Proteins Without Animals',
 'Identical proteins to milk, eggs, and meat produced in bioreactors using microorganisms. At scale, precision fermentation could produce protein at lower cost, lower emissions, and higher nutritional consistency than conventional livestock.',
 'food_agriculture', true, 'breakthrough_idea'),

('Smallholder Farmers Produce 70% of World Food but Remain the Poorest People on Earth',
 'Two billion people depend on smallholder agriculture with no access to credit, insurance, quality inputs, or fair pricing. Digital platforms, satellite monitoring, and mobile financial services offer a path, but adoption remains the barrier.',
 'food_agriculture', true, 'industry_problem'),

/* ─── LOGISTICS ─── */
('Last-Mile Delivery Is the Most Expensive and Least Efficient Part of Every Supply Chain',
 'The final leg of delivery accounts for 53% of total shipping costs and 40% of carbon emissions in e-commerce logistics. Autonomous vehicles, drone delivery, and micro-fulfilment are converging on a solution.',
 'logistics', true, 'industry_problem'),

('Autonomous Freight Trucking Will Arrive on Highways Before Urban Self-Driving Does',
 'Highway driving is structured, predictable, and legally simpler than urban navigation. Long-haul autonomous trucks on dedicated routes are closer to commercial viability than any urban robotaxi, and the economics are overwhelming.',
 'logistics', true, 'breakthrough_idea'),

('Port Congestion Costs the Global Economy $180 Billion a Year and Is Getting Worse',
 'Container ports are operating at or above design capacity. Labour disputes, extreme weather events, and demand spikes create cascading delays. Digitalisation and AI-driven scheduling could recover most of this loss.',
 'logistics', true, 'industry_problem'),

('Real-Time Supply Chain Visibility Is a Solved Problem Nobody Has Implemented',
 'The technology for end-to-end supply chain tracking exists. IoT sensors, blockchain, and satellite tracking have been deployed in pilots for a decade. The barrier is cross-company data sharing and standards, not capability.',
 'logistics', true, 'breakthrough_idea'),

/* ─── RETAIL ─── */
('Physical Retail Is Not Dying — It Is Specialising',
 'The stores thriving in the post-Amazon era are experiential, community-driven, and deeply differentiated. The ones dying tried to compete on selection and price against the internet.',
 'retail', true, 'breakthrough_idea'),

('Retail Inventory Management Wastes $1.75 Trillion Annually in Overstock and Stockouts',
 'Retailers simultaneously lose sales from out-of-stock products and destroy margin with clearance sales. AI demand forecasting now predicts demand with 85% accuracy but implementation across legacy systems remains a barrier.',
 'retail', true, 'industry_problem'),

('Social Commerce Will Overtake Search-Driven E-Commerce by 2030',
 'In China, 30% of all retail sales originate on social platforms. The same pattern is emerging globally as trust shifts from search algorithms to peer recommendations, creator endorsements, and live commerce.',
 'retail', true, 'breakthrough_idea'),

('Returns Are Destroying the Economics of E-Commerce',
 'Online return rates of 20-30% versus 8-9% in physical retail are a structural problem subsidised by cheap capital. As margins compress, the cost of free returns is becoming unsustainable.',
 'retail', true, 'industry_problem'),

/* ─── REAL ESTATE ─── */
('Construction Productivity Has Not Improved in 50 Years',
 'The construction industry has the same productivity levels as the 1960s. Fragmentation, seasonal labour, bespoke designs, and regulatory complexity make industrialisation difficult. Modular construction and prefabrication are finally gaining traction.',
 'real_estate', true, 'industry_problem'),

('Proptech Has Automated the Easy Parts and Left the Hard Parts Untouched',
 'Listing platforms, virtual tours, and digital closings have been conquered. The expensive, opaque parts of real estate — financing, permitting, construction, property management — remain largely pre-digital.',
 'real_estate', true, 'industry_problem'),

('Adaptive Reuse of Commercial Real Estate Could Solve Urban Housing Crises',
 'Millions of square feet of underutilised office space in city centres could be converted to residential at lower cost than new construction. Zoning reform and construction financing are the principal barriers.',
 'real_estate', true, 'breakthrough_idea'),

('Remote Work Has Permanently Altered Every Urban Real Estate Market',
 'Office vacancy rates in major cities exceed 20%. The full consequences for city tax bases, retail adjacency, and housing geography will take a decade to play out. Decisions made now about zoning and infrastructure will lock in the outcome.',
 'real_estate', true, 'breakthrough_idea');
