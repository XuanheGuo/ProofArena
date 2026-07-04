-- Contest thought arena: attachments, per-problem windows, discussion period,
-- and lightweight ratings for contest submissions before they become solutions.

ALTER TABLE contests
  ADD COLUMN IF NOT EXISTS discussion_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discussion_end_at TIMESTAMPTZ;

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS attachment_urls TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE submissions
  DROP CONSTRAINT IF EXISTS submissions_attachment_count_check,
  ADD CONSTRAINT submissions_attachment_count_check
    CHECK (COALESCE(array_length(attachment_urls, 1), 0) <= 4),
  DROP CONSTRAINT IF EXISTS submissions_title_length_check,
  ADD CONSTRAINT submissions_title_length_check
    CHECK (char_length(title) <= 120),
  DROP CONSTRAINT IF EXISTS submissions_contest_thought_length_check,
  ADD CONSTRAINT submissions_contest_thought_length_check
    CHECK (
      contest_slug IS NULL
      OR char_length(COALESCE(content ->> 'thought', content ->> 'approach', '')) <= 4000
    );

ALTER TABLE comments
  DROP CONSTRAINT IF EXISTS comments_content_length_check,
  ADD CONSTRAINT comments_content_length_check
    CHECK (char_length(content) BETWEEN 1 AND 1200),
  DROP CONSTRAINT IF EXISTS comments_target_id_length_check,
  ADD CONSTRAINT comments_target_id_length_check
    CHECK (char_length(target_id) <= 120 AND target_id ~ '^[A-Za-z0-9_-]+$');

ALTER TABLE solution_ratings
  DROP CONSTRAINT IF EXISTS solution_ratings_solution_id_shape_check,
  ADD CONSTRAINT solution_ratings_solution_id_shape_check
    CHECK (char_length(solution_id) <= 120 AND solution_id ~ '^[A-Za-z0-9_-]+$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_solutions_source_submission_unique
  ON solutions(source_submission_id)
  WHERE source_submission_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS contest_submission_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  clarity NUMERIC NOT NULL CHECK (clarity >= 1 AND clarity <= 5),
  insight NUMERIC NOT NULL CHECK (insight >= 1 AND insight <= 5),
  potential NUMERIC NOT NULL CHECK (potential >= 1 AND potential <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(submission_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_contest_submission_ratings_submission
  ON contest_submission_ratings(submission_id);

ALTER TABLE contest_submission_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contest thought ratings are viewable by everyone" ON contest_submission_ratings;
CREATE POLICY "Contest thought ratings are viewable by everyone"
  ON contest_submission_ratings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can rate contest thoughts" ON contest_submission_ratings;
CREATE POLICY "Users can rate contest thoughts"
  ON contest_submission_ratings FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM submissions
      JOIN contests ON contests.slug = submissions.contest_slug
      WHERE submissions.id = submission_id
        AND submissions.contest_slug IS NOT NULL
        AND submissions.status = 'approved'
        AND submissions.user_id <> auth.uid()
        AND (
          contests.status IN ('judging', 'finished')
          OR (
            contests.discussion_start_at IS NOT NULL
            AND contests.discussion_end_at IS NOT NULL
            AND NOW() BETWEEN contests.discussion_start_at AND contests.discussion_end_at
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can update own contest thought ratings" ON contest_submission_ratings;
CREATE POLICY "Users can update own contest thought ratings"
  ON contest_submission_ratings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM submissions
      JOIN contests ON contests.slug = submissions.contest_slug
      WHERE submissions.id = submission_id
        AND submissions.contest_slug IS NOT NULL
        AND submissions.status = 'approved'
        AND submissions.user_id <> auth.uid()
        AND (
          contests.status IN ('judging', 'finished')
          OR (
            contests.discussion_start_at IS NOT NULL
            AND contests.discussion_end_at IS NOT NULL
            AND NOW() BETWEEN contests.discussion_start_at AND contests.discussion_end_at
          )
        )
    )
  );

DROP TRIGGER IF EXISTS update_contest_submission_ratings_updated_at ON contest_submission_ratings;

CREATE TRIGGER update_contest_submission_ratings_updated_at BEFORE UPDATE ON contest_submission_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP POLICY IF EXISTS "Users can rate public solutions" ON solution_ratings;
CREATE POLICY "Users can rate public solutions"
  ON solution_ratings FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND char_length(solution_id) <= 120
    AND solution_id ~ '^[A-Za-z0-9_-]+$'
    AND NOT EXISTS (
      SELECT 1 FROM solutions
      WHERE solutions.id = solution_id
        AND solutions.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own solution ratings" ON solution_ratings;
CREATE POLICY "Users can update own solution ratings"
  ON solution_ratings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND char_length(solution_id) <= 120
    AND solution_id ~ '^[A-Za-z0-9_-]+$'
  );

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
    AND contest_problems.problem_id = NEW.problem_id
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
  BEFORE INSERT OR UPDATE OF contest_id, contest_slug, contest_problem_id, contest_problem_key, is_post_contest
  ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_contest_submission_window();

CREATE OR REPLACE FUNCTION public.enforce_submission_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.submissions
    WHERE user_id = NEW.user_id
      AND created_at > NOW() - INTERVAL '1 hour'
  ) >= 20 THEN
    RAISE EXCEPTION 'Too many submissions. Please try again later.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_submission_rate_limit_before_insert ON submissions;

CREATE TRIGGER enforce_submission_rate_limit_before_insert
  BEFORE INSERT ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_submission_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_comment_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.comments
    WHERE user_id = NEW.user_id
      AND created_at > NOW() - INTERVAL '1 hour'
  ) >= 60 THEN
    RAISE EXCEPTION 'Too many comments. Please try again later.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_comment_rate_limit_before_insert ON comments;

CREATE TRIGGER enforce_comment_rate_limit_before_insert
  BEFORE INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_comment_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_rating_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.solution_ratings
    WHERE user_id = NEW.user_id
      AND created_at > NOW() - INTERVAL '1 hour'
  ) >= 120 THEN
    RAISE EXCEPTION 'Too many ratings. Please try again later.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_solution_rating_rate_limit_before_insert ON solution_ratings;

CREATE TRIGGER enforce_solution_rating_rate_limit_before_insert
  BEFORE INSERT ON solution_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_rating_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_contest_rating_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.contest_submission_ratings
    WHERE user_id = NEW.user_id
      AND created_at > NOW() - INTERVAL '1 hour'
  ) >= 120 THEN
    RAISE EXCEPTION 'Too many ratings. Please try again later.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_contest_rating_rate_limit_before_insert ON contest_submission_ratings;

CREATE TRIGGER enforce_contest_rating_rate_limit_before_insert
  BEFORE INSERT ON contest_submission_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_contest_rating_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_rating_update_cooldown()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.updated_at > NOW() - INTERVAL '5 seconds' THEN
    RAISE EXCEPTION 'Please wait before updating this rating again.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_solution_rating_update_cooldown_before_update ON solution_ratings;

CREATE TRIGGER enforce_solution_rating_update_cooldown_before_update
  BEFORE UPDATE ON solution_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_rating_update_cooldown();

DROP TRIGGER IF EXISTS enforce_contest_rating_update_cooldown_before_update ON contest_submission_ratings;

CREATE TRIGGER enforce_contest_rating_update_cooldown_before_update
  BEFORE UPDATE ON contest_submission_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_rating_update_cooldown();

INSERT INTO storage.buckets (id, name, public)
VALUES ('submission-images', 'submission-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 3145728,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'submission-images';

DROP POLICY IF EXISTS "Submission images are publicly readable" ON storage.objects;
CREATE POLICY "Submission images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'submission-images');

DROP POLICY IF EXISTS "Users can upload submission images" ON storage.objects;
CREATE POLICY "Users can upload submission images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'submission-images'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
    AND lower(name) ~ '\.(jpg|jpeg|png|webp|gif)$'
    AND COALESCE(metadata ->> 'mimetype', '') IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
  );

DROP POLICY IF EXISTS "Users can update own submission images" ON storage.objects;
CREATE POLICY "Users can update own submission images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'submission-images'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'submission-images'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
    AND lower(name) ~ '\.(jpg|jpeg|png|webp|gif)$'
    AND COALESCE(metadata ->> 'mimetype', '') IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
  );

DROP POLICY IF EXISTS "Users can comment" ON comments;
CREATE POLICY "Users can comment"
  ON comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND char_length(content) BETWEEN 1 AND 1200
    AND (
      target_type IN ('problem', 'solution')
      OR (
        target_type = 'submission'
        AND EXISTS (
          SELECT 1
          FROM submissions
          JOIN contests ON contests.slug = submissions.contest_slug
          WHERE submissions.id::TEXT = target_id
            AND submissions.contest_slug IS NOT NULL
            AND submissions.status = 'approved'
            AND (
              contests.status IN ('judging', 'finished')
              OR (
                contests.discussion_start_at IS NOT NULL
                AND contests.discussion_end_at IS NOT NULL
                AND NOW() BETWEEN contests.discussion_start_at AND contests.discussion_end_at
              )
            )
        )
      )
    )
  );

NOTIFY pgrst, 'reload schema';
