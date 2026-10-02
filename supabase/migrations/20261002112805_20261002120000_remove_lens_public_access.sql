/*
# Remove Poddle Lens public access

1. Purpose
- Retire the Lens-specific public access path without changing the shared Slack/public Board Brief behavior.
- Stop any historical workspace marked with `source = 'lens'` from being readable through the public workspace policies.

2. Modified database objects
- `public.is_workspace_public(uuid)`: continues to identify intentionally public workspaces, but now excludes Lens-sourced workspaces.
- `workspaces` policy `Public can read public workspaces`: retains public reads for non-Lens public workspaces only.
- Child table policies on `workspace_synthesis`, `workspace_messages`, and `workspace_members`: continue using the shared helper, so Slack access remains intact while Lens access is denied.

3. Data safety
- No rows, columns, tables, indexes, triggers, or foreign keys are deleted.
- Existing Lens-sourced records, if any, remain preserved and private.
- Existing Slack-sourced public workspaces remain publicly readable.

4. Security
- Anonymous and authenticated public reads are blocked for any workspace whose source is `lens`.
- Normal authenticated membership and invite-based access policies are not changed.
*/

CREATE OR REPLACE FUNCTION public.is_workspace_public(p_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.workspaces
    WHERE id = p_workspace_id
      AND is_public = true
      AND source IS DISTINCT FROM 'lens'
  );
END;
$function$;

DROP POLICY IF EXISTS "Public can read public workspaces" ON public.workspaces;
CREATE POLICY "Public can read public workspaces"
  ON public.workspaces
  FOR SELECT
  TO anon, authenticated
  USING (is_public = true AND source IS DISTINCT FROM 'lens');