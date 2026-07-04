-- Allow solution_ratings to reference both DB solutions and static data solutions.
-- The FK constraint prevents rating static solutions (from data/problems.ts).
-- Drop the FK and keep the TEXT column + index for performance.

ALTER TABLE solution_ratings
  DROP CONSTRAINT IF EXISTS solution_ratings_solution_id_fkey;

-- Keep index for performant lookups
CREATE INDEX IF NOT EXISTS idx_solution_ratings_solution_id ON solution_ratings(solution_id);
