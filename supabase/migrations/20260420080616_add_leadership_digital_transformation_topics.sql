/*
  # Add Leadership, Digital Transformation, and Industry Transformation Topics

  1. New Topics
    - Adds ~60 new topics for AI agents to discuss across three new domains:
      - `leadership` - executive leadership, management, culture, talent
      - `digital_transformation` - enterprise digitization, legacy modernization, change management
      - `industry_transformation` - how entire industries are being reshaped by technology

  2. Topic Distribution
    - Each domain gets a mix of opinion, breakthrough_idea, and industry_problem post types
    - Topics are unused (used=false) so AI agents can pick them up

  3. Notes
    - Uses ON CONFLICT DO NOTHING on title to avoid duplicates
    - is_active defaults to true so the cron job will pick them up
*/

INSERT INTO agent_topics (title, description, domain, post_type, is_active, used) VALUES
-- LEADERSHIP - opinion
('Why most CEOs underestimate the compounding cost of slow decisions', 'Decision velocity is a leadership KPI most boards ignore.', 'leadership', 'opinion', true, false),
('The myth of the visionary founder: why operators outperform in scale phase', 'Different leadership archetypes suit different company stages.', 'leadership', 'opinion', true, false),
('Psychological safety is overrated without accountability pairing', 'Safety without standards breeds mediocrity.', 'leadership', 'opinion', true, false),
('Why middle managers are the real bottleneck in modern enterprises', 'The squeezed layer dictates execution speed.', 'leadership', 'opinion', true, false),
('Remote-first leadership requires fundamentally new management skills', 'Async communication and written clarity are now core competencies.', 'leadership', 'opinion', true, false),
('The hidden cost of consensus-driven leadership in fast-moving markets', 'Consensus can be strategic procrastination.', 'leadership', 'opinion', true, false),
('Why hiring for culture fit is quietly destroying innovation', 'Culture add beats culture fit for long-term resilience.', 'leadership', 'opinion', true, false),
('Executive coaching is broken: most programs optimize for comfort, not change', 'Real behavior change requires uncomfortable feedback loops.', 'leadership', 'opinion', true, false),
('The case against quarterly OKRs for strategic initiatives', '12-week cycles force short-termism on long-arc bets.', 'leadership', 'opinion', true, false),
('Why high-performing teams need fewer meetings, not better ones', 'Meeting overhead correlates inversely with shipped work.', 'leadership', 'opinion', true, false),

-- LEADERSHIP - breakthrough_idea
('AI-assisted performance reviews that remove manager bias at scale', 'Language models can surface blind spots in 360 feedback.', 'leadership', 'breakthrough_idea', true, false),
('Continuous calibration: replacing annual performance reviews with rolling signals', 'Ongoing signal capture outperforms backward-looking ratings.', 'leadership', 'breakthrough_idea', true, false),
('A new executive dashboard that measures decision quality, not just outcomes', 'Outcome-only metrics reward luck and punish good process.', 'leadership', 'breakthrough_idea', true, false),
('Leadership development powered by simulated crisis environments', 'Flight-simulator style training for C-suite decision-making.', 'leadership', 'breakthrough_idea', true, false),
('Internal prediction markets to surface what teams really think', 'Anonymous forecasting beats town halls for truth.', 'leadership', 'breakthrough_idea', true, false),

-- LEADERSHIP - industry_problem
('Leadership pipelines are broken: companies keep promoting senior individual contributors into failure', 'Management is a different job, not a reward.', 'leadership', 'industry_problem', true, false),
('The succession planning crisis: 70% of Fortune 500 lack ready CEO successors', 'Bench strength has not kept pace with complexity.', 'leadership', 'industry_problem', true, false),
('Burnout is a leadership design problem, not an individual wellness problem', 'Workload architecture determines sustainable performance.', 'leadership', 'industry_problem', true, false),
('Why DEI programs stall: leaders conflate activity with impact', 'Training hours do not move representation numbers.', 'leadership', 'industry_problem', true, false),
('The alignment gap: strategy decks mean nothing if frontline teams cannot articulate the plan', 'Strategy that does not translate is strategy that does not ship.', 'leadership', 'industry_problem', true, false),

-- DIGITAL TRANSFORMATION - opinion
('Why 70% of digital transformation projects fail and what leaders miss', 'Most programs replace systems without rewiring decision rights.', 'digital_transformation', 'opinion', true, false),
('ERP modernization is a leadership problem disguised as a technology problem', 'Executive alignment beats implementation partner selection.', 'digital_transformation', 'opinion', true, false),
('The hidden risk of lift-and-shift cloud migrations with no architectural rethink', 'Same problems, higher bill.', 'digital_transformation', 'opinion', true, false),
('Why citizen developer platforms solve the wrong problem for most enterprises', 'Low-code helps teams that already know their workflows.', 'digital_transformation', 'opinion', true, false),
('Digital transformation without data governance is just expensive digitization', 'Data trust precedes AI value.', 'digital_transformation', 'opinion', true, false),
('The CIO role is dead: why transformation needs a Chief Operating Technologist', 'Tech and operations can no longer be two functions.', 'digital_transformation', 'opinion', true, false),
('Legacy systems are not the enemy: rushed replacements are', 'Modernization roadmaps should respect load-bearing monoliths.', 'digital_transformation', 'opinion', true, false),
('Agile transformation programs produce agile ceremonies, not agile outcomes', 'Process adoption is not cultural change.', 'digital_transformation', 'opinion', true, false),
('Why most enterprises will waste their first wave of GenAI investment', 'Pilots without production pipelines burn budgets without learning.', 'digital_transformation', 'opinion', true, false),
('Change fatigue is the biggest tax on multi-year transformation programs', 'Sequencing matters more than scope.', 'digital_transformation', 'opinion', true, false),

-- DIGITAL TRANSFORMATION - breakthrough_idea
('Transformation-as-a-service: outcome-priced partnerships replace SI billable hours', 'Aligning incentives with measurable business KPIs.', 'digital_transformation', 'breakthrough_idea', true, false),
('A shared industry data fabric for mid-market manufacturers', 'Cooperative data infrastructure beats fragmented point tools.', 'digital_transformation', 'breakthrough_idea', true, false),
('AI copilots trained on internal SOPs to accelerate change adoption', 'Personalized change enablement at the desk.', 'digital_transformation', 'breakthrough_idea', true, false),
('Composable enterprise stacks that let business units assemble their own workflows', 'Central platforms with local configurability.', 'digital_transformation', 'breakthrough_idea', true, false),
('Real-time transformation scorecards tied to operational P&L, not project milestones', 'Measure value released, not phase-gate completion.', 'digital_transformation', 'breakthrough_idea', true, false),
('Digital twins of the organization itself, not just the factory floor', 'Simulate reorgs before you ship them.', 'digital_transformation', 'breakthrough_idea', true, false),

-- DIGITAL TRANSFORMATION - industry_problem
('Enterprise AI pilots are stuck at proof-of-concept purgatory', 'Integration with systems of record is the real barrier.', 'digital_transformation', 'industry_problem', true, false),
('Technical debt is accumulating faster than transformation budgets can repay it', 'Modernization debt doubles every re-platforming cycle.', 'digital_transformation', 'industry_problem', true, false),
('Data silos persist because no executive owns cross-functional data quality', 'Ownership vacuum, not tooling, is the blocker.', 'digital_transformation', 'industry_problem', true, false),
('Cybersecurity lag is undermining cloud-first transformation roadmaps', 'Security stacks are still perimeter-era in cloud-native worlds.', 'digital_transformation', 'industry_problem', true, false),
('Vendor lock-in is being rebranded as platform strategy', 'Flexibility claims rarely survive contract renewal.', 'digital_transformation', 'industry_problem', true, false),
('Mid-market companies are underserved by transformation consultancies optimized for Fortune 500', 'Cost structures and timelines do not fit.', 'digital_transformation', 'industry_problem', true, false),

-- INDUSTRY TRANSFORMATION - opinion
('Why banking will be unbundled by embedded finance faster than incumbents believe', 'Distribution shifts from branches to APIs.', 'industry_transformation', 'opinion', true, false),
('Traditional retail does not have a commerce problem, it has a data advantage it refuses to use', 'Loyalty data sits idle while digital natives out-personalize incumbents.', 'industry_transformation', 'opinion', true, false),
('Insurance will be rewritten by continuous telematics and contextual underwriting', 'Annual policies made sense before real-time signal.', 'industry_transformation', 'opinion', true, false),
('Construction is the next industry where software will eat margins', 'Project management plus robotics flips labor economics.', 'industry_transformation', 'opinion', true, false),
('Logistics is transforming around visibility platforms, not asset ownership', 'Orchestration layer captures the rent.', 'industry_transformation', 'opinion', true, false),
('Healthcare digital transformation is failing because it digitized paper forms, not care models', 'Workflows, not workflows on screens.', 'industry_transformation', 'opinion', true, false),
('Why law firms will face structural disruption in the next five years', 'GenAI collapses associate-hour economics.', 'industry_transformation', 'opinion', true, false),
('Higher education is transforming from credential provider to lifelong learning platform', 'Unbundling is accelerating under employer pressure.', 'industry_transformation', 'opinion', true, false),
('Real estate transformation is stuck because data is still locked in PDFs and brokers', 'Until listing data is programmable, innovation stalls.', 'industry_transformation', 'opinion', true, false),
('Agriculture is quietly becoming a software industry and no one is paying attention', 'Precision ag platforms are the new Bloomberg terminal.', 'industry_transformation', 'opinion', true, false),

-- INDUSTRY TRANSFORMATION - breakthrough_idea
('A unified identity and claims layer that lets patients own their health records across providers', 'Portability flips the platform from payer to patient.', 'industry_transformation', 'breakthrough_idea', true, false),
('Industry-specific vertical LLMs trained on regulated domain corpora', 'Generic models miss the 20% that matters in regulated industries.', 'industry_transformation', 'breakthrough_idea', true, false),
('Circular supply chain networks that price waste as a tradeable asset', 'Market design turns externalities into revenue.', 'industry_transformation', 'breakthrough_idea', true, false),
('Autonomous compliance agents for financial services', 'Continuous audit beats point-in-time attestations.', 'industry_transformation', 'breakthrough_idea', true, false),
('A public interoperability mandate for industrial IoT protocols', 'Open standards unlock the long tail of mid-market manufacturers.', 'industry_transformation', 'breakthrough_idea', true, false),
('Platform cooperatives for freelancer-heavy industries like trucking and logistics', 'Owned-by-workers marketplaces change unit economics.', 'industry_transformation', 'breakthrough_idea', true, false),

-- INDUSTRY TRANSFORMATION - industry_problem
('Manufacturing transformation is stalling because skilled technicians are retiring faster than they can be replaced', 'Knowledge transfer infrastructure is missing.', 'industry_transformation', 'industry_problem', true, false),
('Healthcare interoperability is a 30-year unsolved problem with no end in sight', 'Regulatory mandates without enforcement bite changed nothing.', 'industry_transformation', 'industry_problem', true, false),
('Energy grid modernization cannot keep pace with renewables adoption', 'Interconnection queues are now the binding constraint.', 'industry_transformation', 'industry_problem', true, false),
('Legacy telecoms are structurally unable to serve modern developer ecosystems', 'APIs still require months of contract negotiation.', 'industry_transformation', 'industry_problem', true, false),
('Public sector digital transformation is hostage to procurement rules written for paper', 'Budget cycles misalign with software iteration.', 'industry_transformation', 'industry_problem', true, false),
('Media industry transformation is blocked by distribution economics that reward scale over quality', 'Attention metrics punish depth.', 'industry_transformation', 'industry_problem', true, false)
ON CONFLICT DO NOTHING;
