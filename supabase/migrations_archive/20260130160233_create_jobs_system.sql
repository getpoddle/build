/*
  # Create Jobs System

  ## Overview
  This migration creates a comprehensive job board system that allows users to post and search for job opportunities on the platform.

  ## 1. New Tables
    - `jobs`
      - `id` (uuid, primary key) - Unique identifier for each job
      - `poster_id` (uuid, foreign key to profiles) - User who posted the job
      - `title` (text) - Job title
      - `company` (text) - Company name
      - `location` (text) - Job location (remote/hybrid/onsite with location)
      - `job_type` (text) - Type of employment (full-time, part-time, contract, freelance)
      - `description` (text) - Detailed job description
      - `requirements` (text) - Job requirements and qualifications
      - `salary_range` (text, nullable) - Optional salary range
      - `application_url` (text, nullable) - External application link
      - `application_email` (text, nullable) - Email for applications
      - `category` (text) - Job category/industry
      - `experience_level` (text) - Required experience level (entry, mid, senior, lead)
      - `status` (text) - Job posting status (active, closed, filled)
      - `view_count` (integer) - Number of times job was viewed
      - `application_count` (integer) - Number of applications received
      - `created_at` (timestamptz) - When job was posted
      - `updated_at` (timestamptz) - Last update time
      - `expires_at` (timestamptz, nullable) - Optional expiration date

  ## 2. Security
    - Enable RLS on `jobs` table
    - Add policy for all authenticated users to view active jobs
    - Add policy for authenticated users to create jobs
    - Add policy for job posters to update/delete their own jobs
    - Add policy for job posters to view all their jobs regardless of status

  ## 3. Indexes
    - Index on `poster_id` for filtering by poster
    - Index on `status` for filtering active jobs
    - Index on `category` for filtering by category
    - Index on `created_at` for sorting by date
    - Composite index on `status, created_at` for efficient querying of active jobs
*/

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  company text NOT NULL,
  location text NOT NULL,
  job_type text NOT NULL CHECK (job_type IN ('full-time', 'part-time', 'contract', 'freelance', 'internship')),
  description text NOT NULL,
  requirements text NOT NULL,
  salary_range text,
  application_url text,
  application_email text,
  category text NOT NULL,
  experience_level text NOT NULL CHECK (experience_level IN ('entry', 'mid', 'senior', 'lead', 'any')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'filled')),
  view_count integer DEFAULT 0,
  application_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_jobs_poster_id ON jobs(poster_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at ON jobs(status, created_at DESC);

-- Enable RLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view active jobs
CREATE POLICY "Authenticated users can view active jobs"
  ON jobs
  FOR SELECT
  TO authenticated
  USING (status = 'active');

-- Policy: Job posters can view all their own jobs regardless of status
CREATE POLICY "Job posters can view their own jobs"
  ON jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = poster_id);

-- Policy: Authenticated users can create jobs
CREATE POLICY "Authenticated users can create jobs"
  ON jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = poster_id);

-- Policy: Job posters can update their own jobs
CREATE POLICY "Job posters can update their own jobs"
  ON jobs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = poster_id)
  WITH CHECK (auth.uid() = poster_id);

-- Policy: Job posters can delete their own jobs
CREATE POLICY "Job posters can delete their own jobs"
  ON jobs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = poster_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_jobs_updated_at();