/*
  # Create function to fetch post next_steps

  1. Purpose
    - Create a reliable RPC function to fetch next_steps for a post
    - This bypasses any PostgREST schema cache issues with the next_steps column
    - Returns the raw text value of next_steps for a given post ID

  2. Security
    - Function is accessible to authenticated and anonymous users (matching posts read policy)
    - Uses security definer to bypass RLS (the posts table already allows public reads)
*/

CREATE OR REPLACE FUNCTION public.get_post_next_steps(post_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT next_steps FROM posts WHERE id = post_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_post_next_steps(uuid) TO anon, authenticated;
