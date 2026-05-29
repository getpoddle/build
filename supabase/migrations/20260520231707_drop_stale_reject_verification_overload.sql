/*
  # Drop stale reject_verification overload

  ## Problem
  There were two overloads of reject_verification:
  - (uuid, uuid)               — new, checks admins table correctly
  - (uuid, uuid, text)         — old, checks profiles.is_admin (stale/insecure)

  The old 3-argument overload was left over from a previous migration and still
  uses the profiles.is_admin column for its admin check, bypassing the unified
  admins table. Dropping it closes the authorization gap.
*/
DROP FUNCTION IF EXISTS reject_verification(uuid, uuid, text);
