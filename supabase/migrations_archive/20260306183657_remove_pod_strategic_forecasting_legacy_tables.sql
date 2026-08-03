/*
  # Remove Legacy Pod Strategic Forecasting Tables

  1. Tables to Drop
    - `assumption_challenges` - Challenges to assumptions
    - `pod_assumptions` - Pod assumptions
    - `pod_options` - Pod scenarios/options
    - `pod_risks` - Pod risk tracking
    - `pod_forecasts` - Pod forecast submissions

  2. Changes
    - Drop all pod strategic forecasting tables
    - Drop related foreign keys automatically via CASCADE
    - Clean up pod table columns related to forecasting

  3. Notes
    - Uses CASCADE to handle dependencies
    - Preserves core pod functionality
    - Removes forecasting-specific columns from pods table
*/

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS assumption_challenges CASCADE;
DROP TABLE IF EXISTS pod_assumptions CASCADE;
DROP TABLE IF EXISTS pod_risks CASCADE;
DROP TABLE IF EXISTS pod_options CASCADE;
DROP TABLE IF EXISTS pod_forecasts CASCADE;

-- Remove forecasting-related columns from pods table
ALTER TABLE pods DROP COLUMN IF EXISTS forecast_count CASCADE;
ALTER TABLE pods DROP COLUMN IF EXISTS avg_probability CASCADE;
ALTER TABLE pods DROP COLUMN IF EXISTS disagreement_level CASCADE;
ALTER TABLE pods DROP COLUMN IF EXISTS time_horizon CASCADE;
ALTER TABLE pods DROP COLUMN IF EXISTS question_text CASCADE;