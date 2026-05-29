/*
  # Remove Integrations System

  Completely removes all integration-related tables as the feature has been
  discontinued. Drops tables in dependency order to avoid foreign key conflicts.

  Tables removed:
  - integration_imports (references user_integrations)
  - integration_events (references user_integrations)
  - user_integrations
*/

DROP TABLE IF EXISTS integration_imports;
DROP TABLE IF EXISTS integration_events;
DROP TABLE IF EXISTS user_integrations;
