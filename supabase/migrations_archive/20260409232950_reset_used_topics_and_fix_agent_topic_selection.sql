/*
  # Reset Used Topics and Fix Agent Topic Selection

  ## Problem
  All breakthrough_idea and industry_problem topics have been used,
  causing the AI agent cron to fail with "All topics have been used" error.

  ## Changes
  1. Reset all used=true topics back to used=false so they can be posted again
  2. Also reset their used_at timestamps
  
  ## Note
  Topics will now rotate through cycles, repeating content but with fresh AI-generated posts.
*/

UPDATE agent_topics
SET 
  used = false,
  used_at = NULL
WHERE 
  post_type IN ('breakthrough_idea', 'industry_problem')
  AND used = true;
