-- RLS Validation for Migration 029
-- Execute this in Supabase SQL Editor AFTER applying 029_math_hub_v2_hardening.sql
-- https://supabase.com/dashboard/project/<your-project-id>/sql

-- ============================================================================
-- Setup: Create test data
-- ============================================================================

-- Insert a published problem version
INSERT INTO problem_versions (
  id, problem_id, version_number, content, content_hash,
  published_at, created_by
) VALUES (
  gen_random_uuid(),
  gen_random_uuid(),
  1,
  '{"title": "Test Problem"}',
  'hash_published',
  now(),
  '00000000-0000-0000-0000-000000000001'::uuid
) RETURNING id AS published_version_id;

-- Insert an unpublished problem version (owner: test user)
INSERT INTO problem_versions (
  id, problem_id, version_number, content, content_hash,
  published_at, created_by
) VALUES (
  gen_random_uuid(),
  gen_random_uuid(),
  1,
  '{"title": "Draft Problem"}',
  'hash_draft',
  NULL,
  '00000000-0000-0000-0000-000000000002'::uuid
) RETURNING id AS draft_version_id;

-- ============================================================================
-- Test 1: Anonymous users can only read published versions
-- ============================================================================

SELECT 'Test 1: Anonymous read published' AS test_name;

SET ROLE anon;
SET request.jwt.claims TO '{}';

-- Should return 1 row (published version)
SELECT COUNT(*) AS published_count
FROM problem_versions
WHERE published_at IS NOT NULL;
-- Expected: 1

-- Should return 0 rows (no access to unpublished)
SELECT COUNT(*) AS unpublished_count
FROM problem_versions
WHERE published_at IS NULL;
-- Expected: 0

RESET ROLE;

-- ============================================================================
-- Test 2: Authenticated users can read their own unpublished versions
-- ============================================================================

SELECT 'Test 2: Authenticated read own draft' AS test_name;

SET ROLE authenticated;
SET request.jwt.claims.sub TO '00000000-0000-0000-0000-000000000002';

-- Should return 1 row (own draft)
SELECT COUNT(*) AS own_draft_count
FROM problem_versions
WHERE created_by = '00000000-0000-0000-0000-000000000002'::uuid
  AND published_at IS NULL;
-- Expected: 1

-- Should return 1 row (published version, accessible to all)
SELECT COUNT(*) AS published_count
FROM problem_versions
WHERE published_at IS NOT NULL;
-- Expected: 1

-- Should return 0 rows (cannot read other users' drafts)
SET request.jwt.claims.sub TO '00000000-0000-0000-0000-000000000003';
SELECT COUNT(*) AS others_draft_count
FROM problem_versions
WHERE created_by = '00000000-0000-0000-0000-000000000002'::uuid
  AND published_at IS NULL;
-- Expected: 0

RESET ROLE;

-- ============================================================================
-- Test 3: Moderators can read all versions
-- ============================================================================

SELECT 'Test 3: Moderator read all' AS test_name;

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "00000000-0000-0000-0000-000000000099", "email": "xuanheguo@icloud.com"}';

-- Should return ALL rows (published + unpublished)
SELECT COUNT(*) AS total_count
FROM problem_versions;
-- Expected: 2 (or more if other test data exists)

RESET ROLE;

-- ============================================================================
-- Test 4: Public views exclude sensitive columns
-- ============================================================================

SELECT 'Test 4: Public views security' AS test_name;

SET ROLE anon;

-- Should NOT have source_snapshot column in public view
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'public_problem_versions'
  AND column_name = 'source_snapshot';
-- Expected: 0 rows

-- Should be able to read from public view
SELECT COUNT(*) FROM public_problem_versions;
-- Expected: >= 1 (published versions only)

RESET ROLE;

-- ============================================================================
-- Cleanup: Remove test data
-- ============================================================================

DELETE FROM problem_versions WHERE content_hash IN ('hash_published', 'hash_draft');

-- ============================================================================
-- Expected Results Summary
-- ============================================================================

-- Test 1: Anonymous users
--   - Can read published: YES (1 row)
--   - Can read unpublished: NO (0 rows)

-- Test 2: Authenticated users
--   - Can read own draft: YES (1 row)
--   - Can read published: YES (1 row)
--   - Can read others' draft: NO (0 rows)

-- Test 3: Moderators
--   - Can read all: YES (all rows)

-- Test 4: Public views
--   - No source_snapshot column: CORRECT (0 rows)
--   - Can query public view: YES (>= 1 row)

-- ============================================================================
-- If any test fails, check:
-- 1. Migration 029 was applied successfully
-- 2. Old policies were dropped before new ones were created
-- 3. Role and JWT claims are set correctly
-- 4. Test user UUIDs match the ones in your database
-- ============================================================================
