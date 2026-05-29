/*
  # Fix Profiles Policy Conflict
  
  1. Problem
    - HTTP 409 conflict error when querying profiles table
    - Two SELECT policies exist: "Admins can view all profiles" and "Everyone can view all profiles"
    - The admin policy creates infinite recursion by checking profiles.is_admin while querying profiles
  
  2. Solution
    - Drop the redundant "Admins can view all profiles" SELECT policy
    - Keep "Everyone can view all profiles" which already grants access to everyone including admins
    - The admin-specific UPDATE policy remains for write operations
  
  3. Security
    - No security impact: admins can still read everything via "Everyone can view all profiles"
    - Admins retain write access via "Admins can update any profile" policy
*/

-- Drop the recursive admin SELECT policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
