-- Contest access control, part 1: schema only.
--
-- Adds an access_mode to contests (open / approval / invite) and a
-- visibility flag (public / private — modeled now, not yet enforced by any
-- page), plus a new contest_registrations table tracking per-user
-- participation state. This migration is intentionally inert: every
-- existing contest row is explicitly backfilled to access_mode = 'open',
-- which is today's actual behavior (any authenticated user can submit), so
-- running this against production changes nothing observable — including
-- for a contest that is currently live. Only contests created *after* this
-- migration default to 'approval', matching the recommended default for
-- real contests going forward. Submission enforcement itself is added in
-- 021_contest_submission_registration_gate.sql, not here.
--
-- contest_registrations deliberately does not reuse
-- contest_participant_profiles (013_weekly_contest_scoring.sql): that table
-- is scoring-only (challenge_score/multiplier/penalty_points), written
-- exclusively by moderators, with no self-serve insert path. Registration
-- needs a user-initiated "request to join" write path that scoring never
-- has, so it gets its own table rather than overloading that one.
--
-- Same two-layer defense as 017_harden_profile_and_submission_rls.sql /
-- 019_submission_author_revision.sql: an INSERT policy for the coarse
-- row-level gate, plus a BEFORE INSERT trigger for column-level enforcement
-- RLS can't express on its own.

ALTER TABLE contests
  ADD COLUMN IF NOT EXISTS access_mode TEXT NOT NULL DEFAULT 'approval'
    CHECK (access_mode IN ('open', 'approval', 'invite')),
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private'));

-- Explicit backfill: every contest that already exists keeps today's
-- behavior (open submission to any authenticated user) regardless of the
-- column default above.
UPDATE contests SET access_mode = 'open';

CREATE TABLE IF NOT EXISTS contest_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('invited', 'pending', 'approved', 'rejected', 'removed', 'suspended')),
  role TEXT NOT NULL DEFAULT 'participant'
    CHECK (role IN ('participant', 'reviewer', 'admin')),
  note TEXT NOT NULL DEFAULT '',
  invited_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contest_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_contest_registrations_contest ON contest_registrations(contest_id, status);
CREATE INDEX IF NOT EXISTS idx_contest_registrations_user ON contest_registrations(user_id);

ALTER TABLE contest_registrations ENABLE ROW LEVEL SECURITY;

-- Not "viewable by everyone" like contests/contest_problems: a list of who
-- applied/was invited (and by whom) is not meant to be public, unlike
-- aggregate participant counts (already exposed via getContestStats).
DROP POLICY IF EXISTS "Users can view own contest registration" ON contest_registrations;

CREATE POLICY "Users can view own contest registration"
  ON contest_registrations FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
    OR auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
  );

-- Self-serve registration request: only when the contest is in 'approval'
-- mode, and only a bare pending/participant row — no pre-approving
-- yourself, no self-inviting, no assigning yourself a reviewer/admin role.
DROP POLICY IF EXISTS "Users can request contest registration" ON contest_registrations;

CREATE POLICY "Users can request contest registration"
  ON contest_registrations FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND role = 'participant'
    AND invited_by IS NULL
    AND approved_by IS NULL
    AND EXISTS (
      SELECT 1 FROM contests
      WHERE contests.id = contest_id
        AND contests.access_mode = 'approval'
    )
  );

DROP POLICY IF EXISTS "Moderators can manage contest registrations" ON contest_registrations;

CREATE POLICY "Moderators can manage contest registrations"
  ON contest_registrations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
    OR auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
    OR auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
  );

CREATE OR REPLACE FUNCTION public.enforce_contest_registration_request()
RETURNS TRIGGER AS $$
DECLARE
  actor_is_privileged BOOLEAN;
BEGIN
  actor_is_privileged := (
    auth.role() = 'service_role'
    OR auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
    OR EXISTS (
      SELECT 1 FROM public.user_profiles AS actor
      WHERE actor.id = auth.uid()
        AND actor.role IN ('moderator', 'admin')
    )
  );

  IF NOT actor_is_privileged THEN
    NEW.status := 'pending';
    NEW.role := 'participant';
    NEW.invited_by := NULL;
    NEW.approved_by := NULL;
    NEW.note := '';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_contest_registration_request_before_insert ON contest_registrations;

CREATE TRIGGER enforce_contest_registration_request_before_insert
  BEFORE INSERT ON contest_registrations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_contest_registration_request();

DROP TRIGGER IF EXISTS update_contest_registrations_updated_at ON contest_registrations;

CREATE TRIGGER update_contest_registrations_updated_at BEFORE UPDATE ON contest_registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

NOTIFY pgrst, 'reload schema';
