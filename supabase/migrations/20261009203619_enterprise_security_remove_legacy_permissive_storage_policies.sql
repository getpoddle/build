/*
# Enterprise Security: Remove Legacy Permissive Storage Policies

## Summary
The previous migration added owner-scoped storage policies for marketplace-files
and post-attachments. However, the old permissive policies were NOT dropped.
PostgreSQL combines permissive RLS policies with OR, meaning the old policies
override the new owner-scoped restrictions.

## Critical issue
- "Authenticated users can upload marketplace files" (INSERT, no owner check)
  OR-combines with "marketplace_files_insert_own_folder" → any authenticated
  user can upload to any path in marketplace-files
- "Anyone can view post attachments" (SELECT, no owner check) OR-combines with
  "post_attachments_select_own_folder" → any authenticated user can read any
  attachment
- "Users can update own marketplace files" (UPDATE, no owner check) → any
  authenticated user can update any marketplace file
- "Users can delete own marketplace files" (DELETE, no owner check) → any
  authenticated user can delete any marketplace file
- "Public can upload to templates folder" (INSERT, public) → unauthenticated
  uploads to marketplace-files

## Fix
Drop ALL old permissive policies that lack owner-scoping. Keep only the new
owner-scoped policies and the public SELECT for marketplace-files (which is
intentionally public content).

## Policies dropped
- "Anyone can view marketplace files" (replaced by marketplace_files_select_public)
- "Anyone can view post attachments" (replaced by post_attachments_select_own_folder)
- "Authenticated users can upload marketplace files" (replaced by marketplace_files_insert_own_folder)
- "Authenticated users can upload post attachments" (replaced by post_attachments_insert_own_folder)
- "Public can upload to templates folder" (security risk — public uploads)
- "Users can update own marketplace files" (replaced by marketplace_files_update_own_folder)
- "Users can delete own marketplace files" (replaced by marketplace_files_delete_own_folder)
- "Users can delete their own attachments" (replaced by post_attachments_delete_own_folder)
*/

DROP POLICY IF EXISTS "Anyone can view marketplace files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view post attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload marketplace files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload post attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload to templates folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own marketplace files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own marketplace files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
