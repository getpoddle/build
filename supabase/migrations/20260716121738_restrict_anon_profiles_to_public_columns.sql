-- Restrict anon access to the profiles table to only public-display columns.
--
-- Previously the "Everyone can view all profiles" RLS policy (USING (true),
-- TO anon, authenticated) gave unauthenticated requests read access to EVERY
-- column — including location, education, job_experience, linkedin_url,
-- about_me, country — not just public-display fields.
--
-- The only confirmed legitimate anon use case is src/pages/PublicPost.tsx,
-- which queries: full_name, first_name, last_name, username, avatar_url, verified
-- for a post's author. That page already selects exactly these 7 columns.
--
-- Approach: revoke the table-level SELECT from anon, then grant column-scoped
-- SELECT back for only the 7 public columns. The existing RLS policy stays as-is
-- (USING (true) for anon) — the column grant now restricts what columns are
-- actually returned. authenticated access is left untouched.
--
-- After this migration:
--   - anon querying profiles for location/about_me/etc. → those columns
--     return null (PostgREST silently drops columns the role lacks SELECT on)
--   - anon querying profiles for the 7 public columns → works as before
--   - authenticated querying profiles → unchanged (full access via existing grants)

-- 1. Revoke all table-level SELECT from anon
REVOKE SELECT ON public.profiles FROM anon;

-- 2. Grant column-scoped SELECT back to anon for only public-display fields
GRANT SELECT (id, full_name, first_name, last_name, username, avatar_url, verified)
  ON public.profiles TO anon;
