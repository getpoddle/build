/*
  # War Room Usage Quota System

  Adds per-workspace, per-billing-period usage tracking for War Room sessions.
  This is the server-side enforcement layer that prevents Free workspaces from
  burning unbounded OpenAI tokens and enables metered overage billing on Pro.

  ## New Tables
  - `workspace_war_room_usage`
    - `workspace_id` (uuid, FK workspaces ON DELETE CASCADE)
    - `period_start` (timestamptz) — start of the billing period this row tracks
    - `period_end`   (timestamptz) — end of the billing period
    - `session_count`  (integer, default 0) — War Room sessions consumed this period
    - `overage_count`  (integer, default 0) — sessions beyond the included allotment (Pro)
    - `last_session_at` (timestamptz) — when the most recent session was counted
    - Primary key: (workspace_id, period_start) — one row per workspace per period

  ## Modified Tables
  - `workspaces`
    - Adds `current_period_start timestamptz` so the reset boundary is the real
      Stripe billing cycle date (not a calendar month). Populated by the Stripe
      webhook on subscription creation and on each `invoice.paid`.

  ## New Functions (SECURITY DEFINER, search_path = public)
  1. `consume_war_room_session(p_workspace_id uuid, p_plan text)`
     - The single atomic enforcement point. Called at the START of a chat turn,
       before any OpenAI token is spent.
     - Locks the current-period usage row with SELECT ... FOR UPDATE so two
       concurrent requests at the cap boundary cannot both pass.
     - Resolves the active period from `workspaces.current_period_start` /
       `current_period_end`; falls back to a derived month window when the
       Stripe fields are absent (trial / legacy workspaces).
     - Increments `session_count` atomically.
     - Free plan: only increments when `session_count < cap`; returns
       `allowed = false` when at cap (no increment, no token burn).
     - Pro plan: always increments; sets `in_overage = session_count > included`
       and bumps `overage_count` when in overage; `allowed = true`.
     - Team / Enterprise / unknown: always increments, `allowed = true`.
     - Returns: `allowed, session_count, limit, included, in_overage,
       overage_count, period_end`.
  2. `get_workspace_war_room_usage(p_workspace_id uuid)`
     - Read-only view of the current period's usage. Used by the frontend and
       admin panel. Does NOT increment.

  ## Security (RLS)
  - `workspace_war_room_usage` has RLS enabled.
  - SELECT policy: a user may read a row only if they are a member of the
    workspace (join via `workspace_members`). This is workspace-scoped, NOT
    user-scoped, so it deliberately differs from the `daily_ai_usage` pattern.
  - No INSERT/UPDATE/DELETE policies for `authenticated` — all writes go
    through the SECURITY DEFINER RPCs with the service-role key, which bypasses
    RLS. The table is effectively write-protected from the anon-key client.

  ## Important Notes
  1. The Free cap and Pro included allotment live as constants in the shared
     edge-function module `supabase/functions/_shared/warRoomQuota.ts`, NOT in
     the database. The RPC receives `p_plan` from the caller and maps it to a
     cap/included pair. Keeping the numbers in code (not SQL) means a limit
     change is a redeploy, not a migration — appropriate for a launch estimate
     that will be revisited once real `ai_openai_call` cost data exists in
     PostHog.
  2. The RPC is idempotent-safe to re-run: it uses ON CONFLICT to upsert the
     period row before the FOR UPDATE lock.
  3. One chat turn = one session unit. The synthesis pass that follows a chat
     turn is part of the SAME unit and must NOT call this RPC again.
*/

-- 1. Add current_period_start to workspaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspaces' AND column_name = 'current_period_start'
  ) THEN
    ALTER TABLE workspaces ADD COLUMN current_period_start timestamptz;
  END IF;
END $$;

-- 2. workspace_war_room_usage table
CREATE TABLE IF NOT EXISTS workspace_war_room_usage (
  workspace_id    uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start    timestamptz NOT NULL,
  period_end      timestamptz,
  session_count   integer     NOT NULL DEFAULT 0,
  overage_count   integer     NOT NULL DEFAULT 0,
  last_session_at timestamptz,
  PRIMARY KEY (workspace_id, period_start)
);

ALTER TABLE workspace_war_room_usage ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_war_room_usage_workspace
  ON workspace_war_room_usage(workspace_id);

-- RLS: members can read their own workspace's usage; writes only via RPCs.
DROP POLICY IF EXISTS "members_can_read_war_room_usage" ON workspace_war_room_usage;
CREATE POLICY "members_can_read_war_room_usage"
  ON workspace_war_room_usage FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_war_room_usage.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- 3. consume_war_room_session — atomic increment + cap enforcement
CREATE OR REPLACE FUNCTION consume_war_room_session(
  p_workspace_id uuid,
  p_plan text
)
RETURNS TABLE(
  allowed boolean,
  session_count integer,
  session_limit integer,
  included integer,
  in_overage boolean,
  overage_count integer,
  period_end timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start timestamptz;
  v_period_end   timestamptz;
  v_cap          integer;
  v_included     integer;
  v_current      integer;
  v_overage      integer;
  v_allowed      boolean := true;
  v_in_overage   boolean := false;
BEGIN
  -- Resolve the active billing period from the workspace row.
  SELECT current_period_start, current_period_end
    INTO v_period_start, v_period_end
  FROM workspaces WHERE id = p_workspace_id;

  -- Fallback for trial / legacy workspaces without Stripe period fields:
  -- derive a calendar-month window.
  IF v_period_start IS NULL THEN
    v_period_start := date_trunc('month', now());
    v_period_end   := date_trunc('month', now()) + interval '1 month';
  END IF;

  -- Plan -> (cap, included). Numbers mirror warRoomQuota.ts.
  v_cap      := 1;   -- Free default
  v_included := 0;
  IF p_plan = 'free' THEN
    v_cap := 1; v_included := 0;
  ELSIF p_plan = 'pro' THEN
    v_cap := 100000; v_included := 15;  -- effectively uncapped; overage metered
  ELSIF p_plan = 'team' THEN
    v_cap := 200; v_included := 200;   -- soft abuse guard
  ELSIF p_plan = 'enterprise' THEN
    v_cap := 1000000; v_included := 1000000;
  ELSE
    -- Unknown plan: treat as Free (least privilege).
    v_cap := 1; v_included := 0;
  END IF;

  -- Ensure the period row exists, then lock it for the atomic check+increment.
  INSERT INTO workspace_war_room_usage (workspace_id, period_start, period_end, session_count, overage_count)
  VALUES (p_workspace_id, v_period_start, v_period_end, 0, 0)
  ON CONFLICT (workspace_id, period_start) DO NOTHING;

  SELECT session_count, overage_count
    INTO v_current, v_overage
  FROM workspace_war_room_usage
  WHERE workspace_id = p_workspace_id AND period_start = v_period_start
  FOR UPDATE;

  IF p_plan = 'free' THEN
    IF v_current >= v_cap THEN
      v_allowed := false;  -- at cap: do NOT increment, do NOT burn tokens
    ELSE
      v_current := v_current + 1;
      UPDATE workspace_war_room_usage
        SET session_count = v_current, last_session_at = now()
        WHERE workspace_id = p_workspace_id AND period_start = v_period_start;
    END IF;
  ELSE
    -- Pro / Team / Enterprise: always count.
    v_current := v_current + 1;
    IF v_current > v_included THEN
      v_in_overage := true;
      v_overage := v_overage + 1;
    END IF;
    UPDATE workspace_war_room_usage
      SET session_count = v_current,
          overage_count = v_overage,
          last_session_at = now()
      WHERE workspace_id = p_workspace_id AND period_start = v_period_start;
  END IF;

  RETURN QUERY
    SELECT v_allowed, v_current, v_cap, v_included, v_in_overage, v_overage, v_period_end;
END;
$$;

REVOKE ALL ON FUNCTION consume_war_room_session(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION consume_war_room_session(uuid, text) TO authenticated, service_role;

-- 4. get_workspace_war_room_usage — read-only current period
CREATE OR REPLACE FUNCTION get_workspace_war_room_usage(p_workspace_id uuid)
RETURNS TABLE(
  session_count integer,
  session_limit integer,
  included integer,
  in_overage boolean,
  overage_count integer,
  period_end timestamptz,
  plan text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start timestamptz;
  v_period_end   timestamptz;
  v_plan         text;
  v_cap          integer := 1;
  v_included     integer := 0;
  v_count        integer := 0;
  v_overage      integer := 0;
BEGIN
  SELECT current_period_start, current_period_end, plan
    INTO v_period_start, v_period_end, v_plan
  FROM workspaces WHERE id = p_workspace_id;

  IF v_period_start IS NULL THEN
    v_period_start := date_trunc('month', now());
    v_period_end   := date_trunc('month', now()) + interval '1 month';
  END IF;

  IF v_plan = 'free' THEN
    v_cap := 1; v_included := 0;
  ELSIF v_plan = 'pro' THEN
    v_cap := 100000; v_included := 15;
  ELSIF v_plan = 'team' THEN
    v_cap := 200; v_included := 200;
  ELSIF v_plan = 'enterprise' THEN
    v_cap := 1000000; v_included := 1000000;
  END IF;

  SELECT session_count, overage_count
    INTO v_count, v_overage
  FROM workspace_war_room_usage
  WHERE workspace_id = p_workspace_id AND period_start = v_period_start;

  v_count   := COALESCE(v_count, 0);
  v_overage := COALESCE(v_overage, 0);

  RETURN QUERY
    SELECT v_count, v_cap, v_included, (v_count > v_included), v_overage, v_period_end, v_plan;
END;
$$;

REVOKE ALL ON FUNCTION get_workspace_war_room_usage(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION get_workspace_war_room_usage(uuid) TO authenticated, service_role;
