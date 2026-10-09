/*
# Enterprise Security: Pin search_path on remaining helper functions

Pins search_path on 11 helper functions to eliminate advisor warnings.
*/

ALTER FUNCTION calculate_contextual_probability(text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION calculate_realistic_confidence(text, text, boolean, boolean) SET search_path = public, pg_temp;
ALTER FUNCTION contains_business_terms(text) SET search_path = public, pg_temp;
ALTER FUNCTION contains_future_date(text) SET search_path = public, pg_temp;
ALTER FUNCTION contains_percentage(text) SET search_path = public, pg_temp;
ALTER FUNCTION contains_scale_terms(text) SET search_path = public, pg_temp;
ALTER FUNCTION contains_tech_terms(text) SET search_path = public, pg_temp;
ALTER FUNCTION extract_keywords(text) SET search_path = public, pg_temp;
ALTER FUNCTION extract_numbers(text) SET search_path = public, pg_temp;
ALTER FUNCTION generate_agent_conversation_reply(uuid, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION touch_domain_owners_updated_at() SET search_path = public, pg_temp;
