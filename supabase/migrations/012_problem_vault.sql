-- Problem Vault: unpublished problems used for brand-new contest problems,
-- problems still being built out with a Proof Graph, or problems awaiting an
-- official solution before public release.
--
-- Unlike `problems`, this table is readable and writable only by
-- admin/moderator via RLS — there is deliberately no "viewable by everyone"
-- policy. Public-facing code (getProblems, getProblem, getProblemSummaries,
-- related problems) must never query this table. Revealing a draft's title
-- and statement to contest participants (once its contest problem unlocks)
-- happens through a trusted, server-only read using the service role key —
-- see lib/problem-drafts.ts — not by loosening this table's RLS.
--
-- Every CREATE TRIGGER / CREATE POLICY in this file is preceded by a
-- DROP ... IF EXISTS so the whole migration can be re-run from scratch
-- without erroring on "already exists" (Postgres has no CREATE TRIGGER /
-- CREATE POLICY IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS problem_drafts (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('天津卷', '北京卷', '新高考 I 卷', '新高考 II 卷', '清华强基', '北大强基')),
  paper TEXT NOT NULL DEFAULT '',
  number TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT '中档' CHECK (difficulty IN ('基础', '中档', '压轴')),
  question_type TEXT NOT NULL DEFAULT '解答' CHECK (question_type IN ('单选', '多选', '填空', '解答')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  title TEXT NOT NULL,
  statement TEXT[] NOT NULL DEFAULT '{}',
  answer TEXT NOT NULL DEFAULT '',
  source_pdf TEXT,
  source_page INTEGER,
  answer_pdf TEXT,
  learning_guide JSONB,
  solution_tree JSONB,
  proof_graph JSONB,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'drafting' CHECK (status IN ('drafting', 'promoted')),
  promoted_problem_id TEXT REFERENCES problems(id) ON DELETE SET NULL,
  promoted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problem_drafts_status ON problem_drafts(status);

DROP TRIGGER IF EXISTS update_problem_drafts_updated_at ON problem_drafts;

CREATE TRIGGER update_problem_drafts_updated_at BEFORE UPDATE ON problem_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE problem_drafts ENABLE ROW LEVEL SECURITY;

-- No SELECT-for-everyone policy on purpose: default-deny for anon and for
-- regular authenticated users. Only admin/moderator get any access at all.
DROP POLICY IF EXISTS "Moderators can manage problem drafts" ON problem_drafts;

CREATE POLICY "Moderators can manage problem drafts"
  ON problem_drafts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
  );

-- contest_problems: allow linking to an unpublished vault entry instead of
-- (never as well as) a public problem.
ALTER TABLE contest_problems
  ADD COLUMN IF NOT EXISTS draft_problem_id TEXT REFERENCES problem_drafts(id) ON DELETE SET NULL;

ALTER TABLE contest_problems
  DROP CONSTRAINT IF EXISTS contest_problems_problem_xor_draft_check,
  ADD CONSTRAINT contest_problems_problem_xor_draft_check
    CHECK (problem_id IS NULL OR draft_problem_id IS NULL);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contest_problems_draft_problem
  ON contest_problems(contest_id, draft_problem_id)
  WHERE draft_problem_id IS NOT NULL;

-- problems: preserve the source relationship once a draft is promoted, so
-- "which vault entry did this public problem come from" stays answerable
-- (mirrors solutions.source_submission_id for solution submissions).
ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS source_draft_id TEXT REFERENCES problem_drafts(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_problems_source_draft_unique
  ON problems(source_draft_id)
  WHERE source_draft_id IS NOT NULL;

-- submissions: a contest solution submission targeting a still-unpublished
-- Problem Vault problem can't set `problem_id` (it would violate the FK to
-- `problems` — the whole point of the vault is that no such row exists
-- yet). `draft_problem_id` is the parallel target column, mutually
-- exclusive with `problem_id` just like on contest_problems. Once the
-- draft is promoted (lib/promote-problem-draft.ts), these rows get
-- relinked to the new public `problem_id` and `draft_problem_id` is
-- cleared — from then on they flow through the existing publish pipeline
-- exactly like any other contest submission.
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS draft_problem_id TEXT REFERENCES problem_drafts(id) ON DELETE SET NULL;

ALTER TABLE submissions
  DROP CONSTRAINT IF EXISTS submissions_problem_xor_draft_check,
  DROP CONSTRAINT IF EXISTS submissions_problem_contract,
  ADD CONSTRAINT submissions_problem_contract
    CHECK (
      (
        submission_type = 'solution'
        AND (
          (problem_id IS NOT NULL AND draft_problem_id IS NULL)
          OR
          (problem_id IS NULL AND draft_problem_id IS NOT NULL)
        )
      )
      OR
      (submission_type = 'problem' AND problem_id IS NULL AND draft_problem_id IS NULL AND problem_source IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS idx_submissions_draft_problem
  ON submissions(draft_problem_id)
  WHERE draft_problem_id IS NOT NULL;

-- Re-match contest submissions against contest_problems by EITHER
-- problem_id or draft_problem_id (exactly one will be set). Everything
-- else about this function is unchanged from 008_contest_thought_arena.sql.
CREATE OR REPLACE FUNCTION public.enforce_contest_submission_window()
RETURNS TRIGGER AS $$
DECLARE
  contest_row RECORD;
  contest_problem_row RECORD;
BEGIN
  IF NEW.submission_type <> 'solution' THEN
    RETURN NEW;
  END IF;

  IF NEW.contest_id IS NULL AND NULLIF(NEW.contest_slug, '') IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO contest_row
  FROM public.contests
  WHERE
    (NEW.contest_id IS NOT NULL AND id = NEW.contest_id)
    OR
    (NEW.contest_id IS NULL AND slug = NEW.contest_slug)
  LIMIT 1;

  IF contest_row.id IS NULL THEN
    RAISE EXCEPTION 'Contest not found for contest submission.';
  END IF;

  SELECT *
  INTO contest_problem_row
  FROM public.contest_problems
  WHERE contest_problems.contest_id = contest_row.id
    AND (
      (NEW.problem_id IS NOT NULL AND contest_problems.problem_id = NEW.problem_id)
      OR
      (NEW.draft_problem_id IS NOT NULL AND contest_problems.draft_problem_id = NEW.draft_problem_id)
    )
  LIMIT 1;

  IF contest_problem_row.id IS NULL THEN
    RAISE EXCEPTION 'Contest submissions must target a problem in the contest.';
  END IF;

  NEW.contest_id = contest_row.id;
  NEW.contest_slug = contest_row.slug;
  NEW.contest_problem_id = contest_problem_row.id;
  NEW.contest_problem_key = contest_problem_row.id::TEXT;

  IF contest_row.status = 'draft' THEN
    RAISE EXCEPTION 'Contest submissions are not allowed before the contest starts.';
  END IF;

  IF contest_row.status IN ('judging', 'finished') OR NOW() > contest_row.end_at THEN
    NEW.is_post_contest = TRUE;
    RETURN NEW;
  END IF;

  IF contest_row.status = 'active' THEN
    IF contest_problem_row.unlock_mode = 'auto_time' THEN
      IF NOW() < contest_problem_row.open_at THEN
        RAISE EXCEPTION 'This contest problem is not open yet.';
      END IF;
      IF NOW() >= contest_problem_row.close_at THEN
        RAISE EXCEPTION 'This contest problem is closed for official submissions.';
      END IF;
    ELSIF contest_problem_row.status <> 'open' THEN
      RAISE EXCEPTION 'This contest problem is not open for submissions.';
    END IF;

    NEW.is_post_contest = FALSE;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Contest submissions are not open for the current contest status.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_contest_submission_window_before_write ON submissions;

CREATE TRIGGER enforce_contest_submission_window_before_write
  BEFORE INSERT OR UPDATE OF contest_id, contest_slug, contest_problem_id, contest_problem_key, is_post_contest, problem_id, draft_problem_id, status
  ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_contest_submission_window();

NOTIFY pgrst, 'reload schema';
