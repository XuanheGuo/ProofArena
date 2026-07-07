-- 004_contest_arena_mvp.sql gave contest_problems a UNIQUE(contest_id,
-- day_index) constraint, back when every contest (first-arena) only ever
-- scheduled one problem per day. The weekly contest format
-- (docs/WEEKLY_CONTEST_FORMAT.md) needs several problems on the same day —
-- 3 daily + 3 sprint problems per day, plus challenge/major problems sharing
-- a day with those — so that constraint now rejects a correct schedule
-- outright. Drop it; contest_problems are disambiguated by their own `id`
-- (and, for admin sync purposes, by (day_index, problem_phase, title) — see
-- AdminContestsView's syncSeedContest), not by (contest_id, day_index).
--
-- UNIQUE(contest_id, problem_id) is untouched: a public catalog problem
-- still can't be scheduled twice in the same contest, which is an
-- orthogonal rule this migration has no reason to touch.
ALTER TABLE contest_problems
  DROP CONSTRAINT IF EXISTS contest_problems_contest_id_day_index_key;

-- No new index needed: idx_contest_problems_contest (from
-- 004_contest_arena_mvp.sql) already covers (contest_id, day_index) as a
-- plain, non-unique btree index and is untouched by dropping the constraint
-- above (Postgres only drops the constraint's own backing index, not this
-- separately-created one) — so lookups like "all contest_problems for a
-- contest, ordered/filtered by day_index" stay just as fast as before.

NOTIFY pgrst, 'reload schema';
