/*
  # Fix PostgREST Schema Cache Issue

  1. Problem
    - PostgREST has cached the old schema with 'title' column
    - Need to reload the schema cache to pick up column removal

  2. Solution
    - Send NOTIFY to reload PostgREST schema cache
    - This forces PostgREST to re-read the database schema
*/

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
