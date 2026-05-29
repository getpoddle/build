/*
  # Add Decision Paths table

  ## Summary
  Adds a `decision_paths` table to store structured decision options within a decision thread.
  Each path represents a strategic option (e.g., "AI-Augmented Consulting") with:
  - A title/label
  - A focus description (what the option centres on)
  - A risk level (low / medium / high)
  - An upside description (the potential gain)
  - An optional detail/notes field
  - A `is_recommended` flag so the thread owner can mark one path as the panel recommendation
  - Ordering support via `sort_order`

  ## New Tables
  - `decision_paths`
    - `id` (uuid, pk)
    - `thread_id` (uuid, fk → decision_threads.id)
    - `title` (text) — short label, e.g. "Option 1 — AI-Augmented Consulting"
    - `focus` (text) — e.g. "Integrate AI into services"
    - `risk_level` (text) — 'low' | 'medium' | 'high'
    - `upside` (text) — e.g. "Sustainable differentiation"
    - `notes` (text, nullable) — optional longer description
    - `is_recommended` (boolean, default false)
    - `sort_order` (integer, default 0)
    - `created_by` (uuid, fk → profiles.id)
    - `created_at`, `updated_at` (timestamptz)

  ## Security
  - RLS enabled; only thread pod members can insert/update/delete; any authenticated user can read.
*/

CREATE TABLE IF NOT EXISTS decision_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES decision_threads(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  focus text NOT NULL DEFAULT '',
  risk_level text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  upside text NOT NULL DEFAULT '',
  notes text,
  is_recommended boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_paths_thread_id ON decision_paths(thread_id);
CREATE INDEX IF NOT EXISTS idx_decision_paths_created_by ON decision_paths(created_by);

ALTER TABLE decision_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view decision paths"
  ON decision_paths FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Thread creators can insert decision paths"
  ON decision_paths FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Path creators can update their paths"
  ON decision_paths FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Path creators can delete their paths"
  ON decision_paths FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);
