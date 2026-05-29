/*
  # Remove Strategic Forecasting System

  1. Tables to Drop
    - `assumption_scenarios` - Scenario planning for assumptions
    - `assumption_risks` - Risk tracking for assumptions
    - `assumption_forecasts` - Forecast data for assumptions
    - `assumptions` - Core assumptions table

  2. Changes
    - Drop all strategic forecasting related tables
    - Drop related triggers and functions
    - Clean up notification system references

  3. Notes
    - Uses CASCADE to handle dependencies
    - Preserves all other pod functionality
*/

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS assumption_scenarios CASCADE;
DROP TABLE IF EXISTS assumption_risks CASCADE;
DROP TABLE IF EXISTS assumption_forecasts CASCADE;
DROP TABLE IF EXISTS assumptions CASCADE;

-- Drop any related notification types (optional, won't error if they don't exist)
DO $$
BEGIN
  -- Remove assumption-related notification types if they exist
  DELETE FROM notifications WHERE type IN ('assumption_forecast', 'assumption_risk', 'assumption_scenario');
END $$;