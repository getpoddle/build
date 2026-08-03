/*
  # Fix Public Read Policies to Include Anon Role

  ## Summary
  Several tables had SELECT policies restricted to `authenticated` only,
  which means unauthenticated (anon) visitors could not read the public feed data.
  
  The following tables need anon read access for the public-facing homepage:
  - post_likes (to show like counts on posts)
  - post_comments (to show comment counts)
  - ai_agent_discussions (to show agent discussion info on posts)
  - ai_agent_discussion_turns (to show discussion content)
  - post_comment_ai_replies (to show AI replies to comments)

  ## Changes
  Each policy is dropped and recreated to include both `anon` and `authenticated` roles.
*/

-- post_likes
DROP POLICY IF EXISTS "Users can read all post likes" ON post_likes;
CREATE POLICY "Anyone can read all post likes"
  ON post_likes FOR SELECT TO anon, authenticated
  USING (true);

-- post_comments
DROP POLICY IF EXISTS "Users can read all post comments" ON post_comments;
CREATE POLICY "Anyone can read all post comments"
  ON post_comments FOR SELECT TO anon, authenticated
  USING (true);

-- ai_agent_discussions
DROP POLICY IF EXISTS "AI agent discussions are publicly readable" ON ai_agent_discussions;
CREATE POLICY "AI agent discussions are publicly readable"
  ON ai_agent_discussions FOR SELECT TO anon, authenticated
  USING (true);

-- ai_agent_discussion_turns
DROP POLICY IF EXISTS "AI agent discussion turns are publicly readable" ON ai_agent_discussion_turns;
CREATE POLICY "AI agent discussion turns are publicly readable"
  ON ai_agent_discussion_turns FOR SELECT TO anon, authenticated
  USING (true);

-- post_comment_ai_replies
DROP POLICY IF EXISTS "Post comment AI replies are publicly readable" ON post_comment_ai_replies;
CREATE POLICY "Post comment AI replies are publicly readable"
  ON post_comment_ai_replies FOR SELECT TO anon, authenticated
  USING (true);
