-- ============================================================
-- First sign-in onboarding: seed content table
-- ============================================================
-- Stores canned example prompts + agent responses that get
-- inserted into a new user's first workspace at first sign-in.

CREATE TABLE IF NOT EXISTS workspace_seed_threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt      text NOT NULL,
  responses   jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workspace_seed_threads ENABLE ROW LEVEL SECURITY;

-- Seed 3 example threads
INSERT INTO workspace_seed_threads (prompt, responses) VALUES
(
  'Should we raise prices 10% next quarter?',
  '[{"agent_name":"Risk Analyst","agent_role":"risk_analyst","content":"A 10% price increase carries meaningful downside risk if your demand is price-elastic. Before committing, model the churn impact: if even 15% of customers leave, you need the remaining 85% to cover the revenue gap. I would recommend a phased rollout — test on a single tier first, measure churn over 30 days, then decide whether to expand. The biggest risk is that competitors hold prices flat and use the gap to capture market share."},{"agent_name":"Market Analyst","agent_role":"market_analyst","content":"From a market positioning standpoint, a 10% increase signals confidence in product value — but only if your feature velocity justifies it. Look at your two nearest competitors: if they are at parity on core features, the increase may accelerate churn. However, if you have a defensible differentiation (exclusive integrations, superior support, or a sticky workflow), the increase can actually reinforce perceived premium value. I would pair the increase with a visible feature release to anchor the new price."}]'
),
(
  'Should we hire a senior engineer now or wait until after the next funding round?',
  '[{"agent_name":"Risk Analyst","agent_role":"risk_analyst","content":"Hiring before the round de-risks your roadmap — you ship faster, which strengthens the narrative for investors. But it also burns runway faster. If the round slips by two quarters, that extra salary compounds. I would model both scenarios: what does your runway look like at the current burn vs. with the new hire, and does the accelerated shipping meaningfully improve your raise valuation?"},{"agent_name":"Market Analyst","agent_role":"market_analyst","content":"The talent market matters here. Senior engineers are scarce; if you wait until post-raise, you may face a 3-6 month hiring cycle anyway. Hiring now means the engineer is productive by the time you raise, which is a stronger story. The counterargument: if you hire at a premium salary now and the round sets a lower valuation, your cap table gets squeezed. Consider a contract-to-hire arrangement to hedge."}]'
),
(
  'Should we expand into the EU market before we hit $2M ARR, or focus domestically first?',
  '[{"agent_name":"Risk Analyst","agent_role":"risk_analyst","content":"Early international expansion fragments focus at exactly the stage where concentration matters most. GDPR compliance, localized support, and a separate sales motion each add operational overhead. If your domestic growth is still accelerating, the opportunity cost of diverting the founding team''s attention is high. I would only expand early if a specific EU customer is pulling you in with committed revenue."},{"agent_name":"Market Analyst","agent_role":"market_analyst","content":"The EU market can validate your product in a different regulatory and cultural context, which is valuable signal for investors. But timing is everything. Before $2M ARR, your product-market fit signal is still noisy — expanding amplifies that noise. If you have a warm lead (a partner or early design partner in the EU), use it as a low-cost probe rather than a full launch. Otherwise, let domestic ARR compound."}]'
)
ON CONFLICT DO NOTHING;
