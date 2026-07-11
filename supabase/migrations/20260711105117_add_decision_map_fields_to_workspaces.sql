-- Decision Map fields for organisational design view
-- decision_category: what domain this decision belongs to
-- decision_status: where in the decision lifecycle this workspace sits

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS decision_category text NOT NULL DEFAULT 'strategic'
    CHECK (decision_category IN ('strategic', 'operational', 'people', 'financial', 'product', 'other')),
  ADD COLUMN IF NOT EXISTS decision_status text NOT NULL DEFAULT 'exploring'
    CHECK (decision_status IN ('exploring', 'in_debate', 'committed', 'implemented', 'reviewed'));

CREATE INDEX IF NOT EXISTS idx_workspaces_decision_category ON workspaces(decision_category);
CREATE INDEX IF NOT EXISTS idx_workspaces_decision_status ON workspaces(decision_status);

-- Allow workspace owners and admins to update these fields via the anon key
-- (the existing update policy already covers owners; this broadens it to include
--  the new columns without changing the ownership check logic)
-- No new policy needed — the existing workspace owner/admin update policy covers all columns.
