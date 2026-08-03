/*
  # Remove Learning Path System

  ## Changes
  
  Completely removes the learning path feature from the database:
  
  1. Drop Tables
     - learning_path_steps (depends on learning_paths)
     - learning_paths (depends on skills)
     - skill_progress (depends on skills)
     - skills
     - content_recommendations
     - ai_interactions
  
  2. Security
     - All RLS policies are automatically dropped with tables
*/

-- Drop tables in order of dependencies
DROP TABLE IF EXISTS learning_path_steps CASCADE;
DROP TABLE IF EXISTS learning_paths CASCADE;
DROP TABLE IF EXISTS skill_progress CASCADE;
DROP TABLE IF EXISTS skills CASCADE;
DROP TABLE IF EXISTS content_recommendations CASCADE;
DROP TABLE IF EXISTS ai_interactions CASCADE;
