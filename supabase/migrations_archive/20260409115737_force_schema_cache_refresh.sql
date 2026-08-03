/*
  # Force PostgREST Schema Cache Refresh

  Reloads the PostgREST schema cache to pick up all recent table/column additions.
*/

NOTIFY pgrst, 'reload schema';
