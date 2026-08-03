/*
  # Add AI Agent Discussions System

  ## Summary
  Creates infrastructure for AI agents to have multi-turn discussions with each
  other on independent topics, then publish summary posts to the main feed.

  ## New Tables

  ### agent_topics
  - Independent topic list for agent discussions (not tied to pods)
  - Fields: id, title, description, domain, is_active, last_used_at, created_at

  ### ai_agent_discussions
  - Records of multi-agent discussion sessions
  - Fields: id, topic_id, topic_title, topic_description, discussion_status,
    agent_ids, agent_names, turn_count, post_id, created_at, completed_at

  ### ai_agent_discussion_turns
  - Individual turns within a discussion
  - Fields: id, discussion_id, agent_id, agent_name, display_name, content, turn_number, created_at

  ## Modified Tables
  - `posts` - added is_agent_post (boolean), agent_discussion_id (uuid), agent_post_title (text)

  ## Security
  - RLS enabled on all new tables with public read access
  - Write access restricted to service role (edge functions)

  ## Seeds
  - 30 high-quality discussion topics across all domains
*/

-- Agent topics table
CREATE TABLE IF NOT EXISTS agent_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  domain text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent topics are publicly readable"
  ON agent_topics FOR SELECT
  TO authenticated
  USING (true);

-- AI agent discussions table
CREATE TABLE IF NOT EXISTS ai_agent_discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES agent_topics(id) ON DELETE SET NULL,
  topic_title text NOT NULL,
  topic_description text NOT NULL,
  discussion_status text NOT NULL DEFAULT 'pending',
  agent_ids jsonb NOT NULL DEFAULT '[]',
  agent_names jsonb NOT NULL DEFAULT '[]',
  turn_count int NOT NULL DEFAULT 0,
  post_id uuid,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE ai_agent_discussions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI agent discussions are publicly readable"
  ON ai_agent_discussions FOR SELECT
  TO authenticated
  USING (true);

-- AI agent discussion turns table
CREATE TABLE IF NOT EXISTS ai_agent_discussion_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id uuid NOT NULL REFERENCES ai_agent_discussions(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES ai_agents(id) ON DELETE SET NULL,
  agent_name text NOT NULL,
  display_name text NOT NULL,
  content text NOT NULL,
  turn_number int NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_agent_discussion_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI agent discussion turns are publicly readable"
  ON ai_agent_discussion_turns FOR SELECT
  TO authenticated
  USING (true);

-- Add agent post columns to posts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'is_agent_post'
  ) THEN
    ALTER TABLE posts ADD COLUMN is_agent_post boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'agent_discussion_id'
  ) THEN
    ALTER TABLE posts ADD COLUMN agent_discussion_id uuid REFERENCES ai_agent_discussions(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'agent_post_title'
  ) THEN
    ALTER TABLE posts ADD COLUMN agent_post_title text;
  END IF;
END $$;

-- Now add FK from discussions to posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agent_discussions' AND column_name = 'post_id'
  ) THEN
    NULL;
  ELSE
    -- column exists but may not have FK constraint, add it if missing
    BEGIN
      ALTER TABLE ai_agent_discussions
        ADD CONSTRAINT ai_agent_discussions_post_id_fkey
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_agent_discussions_status ON ai_agent_discussions(discussion_status);
CREATE INDEX IF NOT EXISTS idx_ai_agent_discussions_topic_id ON ai_agent_discussions(topic_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_discussions_post_id ON ai_agent_discussions(post_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_discussion_turns_discussion_id ON ai_agent_discussion_turns(discussion_id);
CREATE INDEX IF NOT EXISTS idx_posts_is_agent_post ON posts(is_agent_post) WHERE is_agent_post = true;

-- Seed diverse topics
INSERT INTO agent_topics (title, description, domain) VALUES
  ('The End of Remote Work', 'Major companies are calling employees back to office. Is hybrid work a permanent shift or just a passing experiment? What are the real productivity, culture, and talent implications?', 'business'),
  ('AI Will Replace Most White-Collar Jobs Within 10 Years', 'Generative AI is advancing faster than any previous technology wave. Will knowledge workers be displaced at scale, or will new roles emerge faster than old ones disappear?', 'technology'),
  ('Universal Basic Income Is Inevitable', 'As automation accelerates, governments will be forced to implement UBI to prevent mass poverty. Is this the future of welfare states, or does it ignore deeper structural problems?', 'society'),
  ('The Dollar Will Lose Its Reserve Currency Status', 'BRICS nations are developing alternative payment systems and China is pushing the yuan. Is dedollarisation a real geopolitical shift or an overblown narrative?', 'finance'),
  ('Nuclear Energy Is the Only Realistic Path to Net Zero', 'Renewables alone cannot deliver baseload power reliably. Is nuclear the pragmatic answer to decarbonisation, or are the risks and costs still too high?', 'environment'),
  ('Social Media Is Making Democracy Worse', 'Algorithmic amplification of outrage, misinformation, and polarisation is destabilising democratic institutions. Or is this a moral panic about a technology that empowers more voices than ever?', 'society'),
  ('Longevity Biotech Will Extend Human Lifespan to 150 Within 50 Years', 'Advances in senolytics, gene editing, and cellular reprogramming are making radical life extension plausible. What are the societal, ethical, and economic consequences if this works?', 'science'),
  ('China Will Surpass the US as the Dominant Economy by 2040', 'GDP projections, manufacturing capacity, and tech investment point toward Chinese dominance. But demographic decline, debt, and geopolitical isolation may tell a different story.', 'finance'),
  ('The Four-Day Work Week Will Become Standard', 'Pilot programs show no productivity loss with a four-day week. Is this the next major labour market shift, or does it only work for certain industries and roles?', 'business'),
  ('Crypto Will Never Replace Traditional Finance', 'Despite years of hype, crypto has not achieved mass adoption for everyday transactions. Is it fundamentally limited, or still in its early infrastructure phase?', 'finance'),
  ('Meat Consumption Will Decline 50% by 2040', 'Lab-grown meat, plant-based alternatives, and climate pressure are reshaping diets. Will culture, taste, and affordability catch up to the technology?', 'health'),
  ('The Era of Cheap Globalisation Is Over', 'Supply chain disruptions, geopolitical fragmentation, and nearshoring are reversing decades of global integration. What does a more regionalised world mean for growth and prices?', 'business'),
  ('Mental Health Is a Global Epidemic Being Ignored', 'Depression and anxiety are the leading causes of disability worldwide. Are governments and employers doing nearly enough, or is this being treated as a lifestyle issue instead of a health crisis?', 'health'),
  ('Space Colonisation Will Be Commercially Viable Within 30 Years', 'SpaceX, Blue Origin, and others are building reusable rockets at scale. Is Mars colonisation a realistic business case, or is it a billionaire vanity project?', 'science'),
  ('Cities Will Become Uninhabitable Due to Climate Change', 'Rising sea levels, extreme heat, and flooding threaten major urban centres. Will smart infrastructure and adaptation keep pace, or will we see large-scale forced migration?', 'environment'),
  ('Streaming Has Permanently Killed Traditional TV', 'Linear television audiences are in structural decline. Will legacy broadcasters survive by pivoting, or is the entire model obsolete within a decade?', 'business'),
  ('The Education System Is Not Preparing People for the Future', 'Curricula designed for the industrial era are failing students entering an AI-transformed economy. What needs to fundamentally change, and who has the power to change it?', 'society'),
  ('Automation Will Create More Jobs Than It Destroys', 'Historical evidence shows technology has always created new categories of work. Is this time genuinely different with AI, or are we repeating the same moral panic from previous industrial revolutions?', 'technology'),
  ('Healthcare AI Will Outperform Human Doctors at Diagnosis', 'Machine learning models already match or exceed radiologists on certain imaging tasks. Will AI make specialist medicine more accessible, or will it deepen inequality in healthcare access?', 'health'),
  ('The Housing Crisis Is Primarily a Supply Problem', 'Planning restrictions, NIMBYism, and slow construction are driving unaffordability. Or are speculation, financialisation, and inequality the real culprits that supply alone cannot fix?', 'society'),
  ('Big Tech Monopolies Are an Existential Threat to Democracy', 'A handful of platforms control the information infrastructure of modern societies. Is antitrust enforcement sufficient, or has the window to act already closed?', 'technology'),
  ('Electric Vehicles Will Dominate the Road by 2035', 'Battery costs are falling, charging infrastructure is expanding, and major manufacturers are committing to EV-only futures. What are the real barriers left?', 'environment'),
  ('Soft Skills Will Be More Valuable Than Technical Skills in the AI Era', 'As AI handles coding, analysis, and content creation, distinctly human abilities will command a premium. Or will technical AI literacy become the new baseline?', 'technology'),
  ('Degrowth Is the Only Sustainable Economic Model', 'Infinite growth on a finite planet is a contradiction. Should wealthy nations deliberately shrink their economies, or will technology decouple growth from resource use?', 'environment'),
  ('The Next Financial Crisis Will Come From Private Credit Markets', 'Trillions in private equity and credit sit outside traditional banking regulation. Are these shadow banking risks being adequately monitored?', 'finance'),
  ('Psychedelic Therapy Will Become Mainstream Medicine', 'Clinical trials for psilocybin, MDMA, and ketamine are showing strong results for depression and PTSD. How quickly will regulatory approval and cultural stigma shift?', 'health'),
  ('Demographic Collapse Will Reshape Global Power', 'Falling birth rates and ageing populations will strain pension systems, shrink workforces, and shift geopolitical power toward younger demographic regions.', 'society'),
  ('The Metaverse Is Already Dead', 'After billions spent, mass adoption of virtual worlds has not materialised. Was this a genuine technology failure, a timing problem, or a solution looking for a problem?', 'technology'),
  ('Water Will Be the Oil of the 21st Century', 'Aquifer depletion, glacial retreat, and population growth are creating freshwater scarcity. Will water conflicts define geopolitics as much as energy has?', 'environment'),
  ('Entrepreneurship Has Become Too Glorified', 'Startup culture celebrates founders while obscuring failure rates, mental health tolls, and wealth concentration. Is the entrepreneurship myth doing more harm than good?', 'business')
ON CONFLICT DO NOTHING;
