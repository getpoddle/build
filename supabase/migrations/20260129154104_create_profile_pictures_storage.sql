/*
  # Create Profile Pictures Storage Bucket

  1. Storage Bucket
    - Create `avatars` bucket for storing user profile pictures
    - Enable public access for viewing profile pictures
  
  2. Storage Policies
    - Allow authenticated users to upload their own profile pictures
    - Allow public read access to all profile pictures
    - Allow users to update/delete their own profile pictures
*/

-- =====================================================
-- 1. Create Storage Bucket
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. Storage Policies for Avatars Bucket
-- =====================================================

-- Allow authenticated users to upload their own avatar (folder structure: user_id/filename)
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Allow public read access to all avatars
CREATE POLICY "Public can view avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Allow users to update their own avatar
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = (select auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Allow users to delete their own avatar
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = (select auth.uid())::text
  );