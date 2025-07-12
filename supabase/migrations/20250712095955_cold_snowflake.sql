/*
  # Remove Daily Limit Feature

  1. Changes
    - Drop daily_limit column from users table
    - Remove all daily limit related functionality

  2. Security
    - Maintain existing RLS policies
    - No impact on other features
*/

-- Remove daily_limit column from users table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'daily_limit'
  ) THEN
    ALTER TABLE users DROP COLUMN daily_limit;
  END IF;
END $$;