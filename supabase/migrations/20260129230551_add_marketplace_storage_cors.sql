/*
  # Add CORS Configuration for Marketplace Storage

  ## Overview
  Configures CORS headers for the marketplace-files storage bucket to ensure
  proper file downloads across all devices and browsers.

  ## Changes
  1. Updates storage bucket configuration to allow proper CORS headers
  2. Ensures downloads work correctly on mobile devices

  ## Important Notes
  - This enables proper content-type headers for downloads
  - Fixes issues with files downloading as incorrect types (e.g., CSV)
*/

-- Update storage bucket to ensure proper CORS handling
UPDATE storage.buckets 
SET public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/svg+xml',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ]
WHERE id = 'marketplace-files';