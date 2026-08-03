/*
  # Create Function to Insert Assumptions

  1. Purpose
    - Bypass PostgREST schema cache issues by using RPC function
    - Directly insert into pod_assumptions table

  2. Function
    - insert_pod_assumption: Insert a new assumption and return it
*/

CREATE OR REPLACE FUNCTION insert_pod_assumption(
  p_pod_id uuid,
  p_content text,
  p_description text DEFAULT '',
  p_category text DEFAULT 'General',
  p_reference_url text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  pod_id uuid,
  content text,
  description text,
  category text,
  reference_url text,
  created_by uuid,
  created_at timestamptz,
  challenge_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO pod_assumptions (pod_id, created_by, content, description, category, reference_url)
  VALUES (p_pod_id, auth.uid(), p_content, p_description, p_category, p_reference_url)
  RETURNING 
    pod_assumptions.id,
    pod_assumptions.pod_id,
    pod_assumptions.content,
    pod_assumptions.description,
    pod_assumptions.category,
    pod_assumptions.reference_url,
    pod_assumptions.created_by,
    pod_assumptions.created_at,
    pod_assumptions.challenge_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION insert_pod_assumption TO authenticated;
