/*
# Enterprise Security: Fix Storage Policies and Scope Per-User SELECT Policies

## Summary
1. Storage bucket 'marketplace-files' had INSERT/UPDATE/DELETE open to all
   authenticated users (not scoped by owner). Fixed to require owner folder
   match.
2. Storage bucket 'post-attachments' had SELECT open to all authenticated
   (not scoped by owner). Scoped SELECT to owner folder; INSERT/UPDATE/DELETE
   already scoped but tightened.
3. Storage bucket 'avatars' SELECT was open to all authenticated — this is
   acceptable for public profile photos, left as-is.
4. Per-user tables (user_challenges, user_interests, user_skills) had
   SELECT USING(true) for authenticated — exposing all users' data to any
   signed-in user. Scoped to owner-only.

## Storage policy changes
- marketplace-files: SELECT kept public (public marketplace), INSERT/UPDATE/DELETE
  scoped to owner folder (storage.foldername(name)[1] = auth.uid()::text)
- post-attachments: SELECT scoped to owner folder, INSERT already scoped, tightened

## RLS policy changes
- user_challenges: SELECT scoped to auth.uid() = user_id
- user_interests: SELECT scoped to auth.uid() = user_id
- user_skills: SELECT scoped to auth.uid() = user_id
*/

-- ============================================================
-- PART 1: Fix storage policies for marketplace-files
-- ============================================================

DROP POLICY IF EXISTS "marketplace_files_select_public" ON storage.objects;
DROP POLICY IF EXISTS "marketplace_files_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "marketplace_files_update_auth" ON storage.objects;
DROP POLICY IF EXISTS "marketplace_files_delete_auth" ON storage.objects;

-- Public read for marketplace files (they are public marketplace content)
CREATE POLICY "marketplace_files_select_public" ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'marketplace-files');

-- Only owner can write/update/delete their own marketplace files
CREATE POLICY "marketplace_files_insert_own_folder" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'marketplace-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "marketplace_files_update_own_folder" ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'marketplace-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'marketplace-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "marketplace_files_delete_own_folder" ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'marketplace-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- PART 2: Fix storage policies for post-attachments
-- ============================================================

DROP POLICY IF EXISTS "post_attachments_select_auth" ON storage.objects;
DROP POLICY IF EXISTS "post_attachments_select_all" ON storage.objects;
DROP POLICY IF EXISTS "post_attachments_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "post_attachments_update_own" ON storage.objects;
DROP POLICY IF EXISTS "post_attachments_delete_own" ON storage.objects;

-- Only owner can read their own attachments (private files)
CREATE POLICY "post_attachments_select_own_folder" ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'post-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "post_attachments_insert_own_folder" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "post_attachments_update_own_folder" ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'post-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'post-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "post_attachments_delete_own_folder" ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'post-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- PART 3: Scope per-user SELECT policies
-- ============================================================

-- user_challenges: scope SELECT to owner only
DROP POLICY IF EXISTS "Authenticated users can view all challenges" ON user_challenges;
CREATE POLICY "users_select_own_challenges" ON user_challenges FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- user_interests: scope SELECT to owner only
DROP POLICY IF EXISTS "Authenticated users can view all interests" ON user_interests;
CREATE POLICY "users_select_own_interests" ON user_interests FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- user_skills: scope SELECT to owner only
DROP POLICY IF EXISTS "Authenticated users can view all skills" ON user_skills;
CREATE POLICY "users_select_own_skills" ON user_skills FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
