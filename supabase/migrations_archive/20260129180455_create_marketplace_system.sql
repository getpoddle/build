/*
  # Create Marketplace System

  ## Overview
  Creates a marketplace where users can upload and sell strategy templates (PDF, SVG, Word documents).
  Payment functionality is built in but disabled for now.

  ## New Tables
  
  ### `marketplace_items`
  - `id` (uuid, primary key) - Unique identifier for each marketplace item
  - `seller_id` (uuid, foreign key) - References profiles.id of the seller
  - `title` (text) - Title of the strategy template
  - `description` (text) - Detailed description of the template
  - `category` (text) - Category/type of strategy template
  - `price` (numeric) - Price in dollars (for future payment integration)
  - `file_url` (text) - URL to the uploaded file in storage
  - `file_name` (text) - Original filename
  - `file_type` (text) - MIME type (application/pdf, image/svg+xml, etc.)
  - `file_size` (integer) - File size in bytes
  - `preview_image_url` (text, nullable) - Optional preview image URL
  - `status` (text) - 'active' or 'inactive' (for soft deletion)
  - `download_count` (integer) - Number of times downloaded
  - `view_count` (integer) - Number of times viewed
  - `created_at` (timestamptz) - When the item was created
  - `updated_at` (timestamptz) - When the item was last updated

  ## Storage
  
  ### `marketplace-files` bucket
  - Public read access for file previews
  - Authenticated users can upload files
  - Only file owners can delete their files

  ## Security
  
  ### RLS Policies
  - Anyone can view active marketplace items
  - Only authenticated users can create items
  - Only item owners can update or delete their items
  - Sellers can view their own inactive items

  ## Indexes
  - Index on seller_id for fast seller queries
  - Index on status for filtering active items
  - Index on category for filtering by category
  - Index on created_at for sorting by newest

  ## Important Notes
  1. Payment processing is built into the schema but disabled in the UI
  2. Files are stored in Supabase Storage with proper access controls
  3. All items have view and download counters for analytics
  4. Status field allows soft deletion (inactive items not shown publicly)
*/

-- Create marketplace_items table
CREATE TABLE IF NOT EXISTS marketplace_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  price numeric(10, 2) NOT NULL DEFAULT 0,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  preview_image_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  download_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_marketplace_items_seller_id ON marketplace_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_items_status ON marketplace_items(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_items_category ON marketplace_items(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_items_created_at ON marketplace_items(created_at DESC);

-- Enable RLS
ALTER TABLE marketplace_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for marketplace_items

-- Anyone can view active marketplace items
CREATE POLICY "Anyone can view active marketplace items"
  ON marketplace_items
  FOR SELECT
  USING (status = 'active');

-- Sellers can view all their own items (including inactive)
CREATE POLICY "Sellers can view own items"
  ON marketplace_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = seller_id);

-- Authenticated users can create marketplace items
CREATE POLICY "Authenticated users can create items"
  ON marketplace_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

-- Sellers can update their own items
CREATE POLICY "Sellers can update own items"
  ON marketplace_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Sellers can delete their own items
CREATE POLICY "Sellers can delete own items"
  ON marketplace_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);

-- Create storage bucket for marketplace files
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketplace-files', 'marketplace-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for marketplace-files bucket

-- Anyone can view files (public bucket)
CREATE POLICY "Anyone can view marketplace files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'marketplace-files');

-- Authenticated users can upload files
CREATE POLICY "Authenticated users can upload marketplace files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'marketplace-files');

-- Users can update their own files
CREATE POLICY "Users can update own marketplace files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'marketplace-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own files
CREATE POLICY "Users can delete own marketplace files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'marketplace-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_marketplace_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS marketplace_items_updated_at ON marketplace_items;
CREATE TRIGGER marketplace_items_updated_at
  BEFORE UPDATE ON marketplace_items
  FOR EACH ROW
  EXECUTE FUNCTION update_marketplace_items_updated_at();