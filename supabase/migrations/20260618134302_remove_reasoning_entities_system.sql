-- Drop reasoning entity tables in dependency order (children before parents)
DROP TABLE IF EXISTS entity_challenge_votes CASCADE;
DROP TABLE IF EXISTS entity_state_transitions CASCADE;
DROP TABLE IF EXISTS entity_links CASCADE;
DROP TABLE IF EXISTS entity_comments CASCADE;
DROP TABLE IF EXISTS entity_agent_responses CASCADE;
DROP TABLE IF EXISTS entity_consensus CASCADE;
DROP TABLE IF EXISTS entity_challenges CASCADE;
DROP TABLE IF EXISTS agent_predictions CASCADE;
DROP TABLE IF EXISTS problems CASCADE;
DROP TABLE IF EXISTS ideas CASCADE;
DROP TABLE IF EXISTS predictions CASCADE;

-- Drop associated functions and triggers
DROP TRIGGER IF EXISTS sync_post_to_entity_trigger ON posts;
DROP FUNCTION IF EXISTS sync_post_to_entity() CASCADE;
DROP FUNCTION IF EXISTS get_post_next_steps(uuid) CASCADE;
