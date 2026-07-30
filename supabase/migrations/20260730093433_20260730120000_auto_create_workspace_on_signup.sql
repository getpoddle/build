/*
# Auto-create workspace on signup + seed AI Collaboration thread

## Summary
When a new user signs up, automatically create a private workspace for them
(named "{first_name}'s Workspace" or "My Workspace"), add them as the owner,
and pre-seed the AI Collaboration chat with an example thread containing
sample Risk Analyst and Market Analyst responses. This removes the manual
workspace setup/skip screen from onboarding.

## Changes

### 1. New Table: `workspace_seed_threads`
A small config table holding 2-3 canned example threads. Each row stores:
- `id` (uuid PK)
- `prompt` (text) — the example user question, e.g. "Should we raise prices 10% next quarter?"
- `responses` (jsonb) — array of {agent_name, agent_role, content} objects
- `created_at` (timestamptz)

### 2. Seed Data
Insert 3 example threads covering pricing, hiring, and market expansion.

### 3. Modify `handle_new_user()` trigger function
After creating the profile row, also:
- Create a workspace (name from first_name or "My Workspace", plan='pro',
  subscription_status='trialing', trial expires end of month)
- Add the new user as owner in workspace_members
- Pick a random seed thread and insert its prompt + responses as
  workspace_messages rows (role='user' for the prompt, role='assistant'
  for each agent response)
- Mark the profile as onboarded=true (since onboarding step is removed)

### 4. RLS
- `workspace_seed_threads` is read-only config; no client access needed.
  RLS enabled with no policies (locked to service role only).
- The trigger runs as SECURITY DEFINER, bypassing RLS, so it can insert
  into workspaces, workspace_members, and workspace_messages freely.

### 5. Important Notes
- The trigger fires on auth.users INSERT (signup). It runs in the same
  transaction as profile creation.
- Seed messages have role='assistant' and user_id=NULL, which is valid
  per the workspace_messages schema (user_id is nullable for AI messages).
- The notify_admins_on_ai_chat trigger only fires for role='user' messages,
  so seed assistant messages won't generate spurious notifications.
- Existing users are unaffected — the trigger only fires on new signups.
*/

-- ── 1. Create seed threads config table ──
CREATE TABLE IF NOT EXISTS workspace_seed_threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt      text NOT NULL,
  responses   jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workspace_seed_threads ENABLE ROW LEVEL SECURITY;

-- ── 2. Seed 3 example threads ──
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

-- ── 3. Modify handle_new_user() to auto-create workspace + seed thread ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name text;
  v_workspace_name text;
  v_workspace_id uuid;
  v_seed_prompt text;
  v_seed_responses jsonb;
  v_trial_expires timestamptz;
  v_now timestamptz := now();
BEGIN
  -- Create the profile row (original behavior)
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    first_name,
    last_name,
    username,
    onboarded,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NEW.email
    ),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    true,
    v_now,
    v_now
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── Auto-create workspace ──
  v_first_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), '');

  IF v_first_name IS NOT NULL THEN
    v_workspace_name := v_first_name || '''s Workspace';
  ELSE
    v_workspace_name := 'My Workspace';
  END IF;

  -- Trial expires at end of current month
  v_trial_expires := date_trunc('month', v_now) + interval '1 month' - interval '1 second';

  INSERT INTO public.workspaces (
    name,
    description,
    domain,
    owner_id,
    workspace_type,
    is_encrypted,
    plan,
    seats,
    subscription_status,
    trial_workspace_expires_at,
    source,
    created_at,
    updated_at
  ) VALUES (
    v_workspace_name,
    '',
    'general',
    NEW.id,
    'encrypted',
    true,
    'pro',
    3,
    'trialing',
    v_trial_expires,
    'app',
    v_now,
    v_now
  )
  RETURNING id INTO v_workspace_id;

  -- Add the new user as owner
  INSERT INTO public.workspace_members (
    workspace_id,
    user_id,
    role,
    joined_at
  ) VALUES (
    v_workspace_id,
    NEW.id,
    'owner',
    v_now
  );

  -- ── Seed an example AI Collaboration thread ──
  -- Pick a random seed thread
  SELECT prompt, responses INTO v_seed_prompt, v_seed_responses
  FROM public.workspace_seed_threads
  ORDER BY random()
  LIMIT 1;

  IF v_seed_prompt IS NOT NULL AND v_workspace_id IS NOT NULL THEN
    -- Insert the seed prompt as a user message (authored by the new user)
    INSERT INTO public.workspace_messages (
      workspace_id,
      user_id,
      role,
      content,
      created_at
    ) VALUES (
      v_workspace_id,
      NEW.id,
      'user',
      v_seed_prompt,
      v_now
    );

    -- Insert each canned agent response as an assistant message
    INSERT INTO public.workspace_messages (
      workspace_id,
      user_id,
      role,
      content,
      agent_name,
      agent_role,
      created_at
    )
    SELECT
      v_workspace_id,
      NULL,
      'assistant',
      elem->>'content',
      elem->>'agent_name',
      elem->>'agent_role',
      v_now + (interval '1 second' * row_number() OVER ())
    FROM jsonb_array_elements(v_seed_responses) AS elem;
  END IF;

  RETURN NEW;
END;
$$;
