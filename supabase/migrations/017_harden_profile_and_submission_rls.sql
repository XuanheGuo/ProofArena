-- Security hardening pass.
--
-- 1. user_profiles: "Users can update own profile" only checked
--    auth.uid() = id, so any authenticated user could UPDATE their own row
--    with an arbitrary `role` (e.g. 'admin') or `reputation`. RLS alone
--    can't diff NEW vs OLD per-column, so the real fix is a BEFORE UPDATE
--    trigger that resets role/reputation back to their stored value unless
--    the actor is already an admin, the hardcoded owner account, or the
--    service-role key (server scripts, Studio SQL editor). Moderators are
--    deliberately NOT in this list: a moderator promoting themselves to
--    admin via a self-update is exactly the same class of privilege
--    escalation this trigger exists to stop, so only admin (and above)
--    can change role/reputation. The policy itself is left as an
--    ownership check; the trigger is the actual field-level guard.
--
-- 2. submissions: "Users can create submissions" only checked
--    auth.uid() = user_id, so a client could INSERT a row with
--    status = 'approved' (or pre-filled moderator_notes) and have it
--    show up as already-published. The fix requires normal inserts to
--    set status = 'pending' and moderator_notes = NULL, both in the RLS
--    WITH CHECK and, as defense in depth, in a BEFORE INSERT trigger.
--
-- Everything here is re-runnable: every CREATE POLICY / CREATE TRIGGER is
-- preceded by a DROP ... IF EXISTS, matching the convention established in
-- 012_problem_vault.sql.

-- ============================================================================
-- user_profiles
-- ============================================================================

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.protect_user_profile_privileged_fields()
RETURNS TRIGGER AS $$
DECLARE
  actor_is_privileged BOOLEAN;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.reputation IS DISTINCT FROM OLD.reputation THEN
    actor_is_privileged := (
      auth.role() = 'service_role'
      OR auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
      OR EXISTS (
        SELECT 1 FROM public.user_profiles AS actor
        WHERE actor.id = auth.uid()
          AND actor.role = 'admin'
      )
    );

    -- Silently keep the stored value rather than raising: a future profile
    -- form that round-trips the whole row (role/reputation included,
    -- unchanged) should still succeed for the fields it's actually meant
    -- to edit (username/display_name/avatar_url/bio).
    IF NOT actor_is_privileged THEN
      NEW.role := OLD.role;
      NEW.reputation := OLD.reputation;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS protect_user_profile_privileged_fields_before_write ON user_profiles;

CREATE TRIGGER protect_user_profile_privileged_fields_before_write
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_profile_privileged_fields();

-- ============================================================================
-- submissions
-- ============================================================================

DROP POLICY IF EXISTS "Users can create submissions" ON submissions;

CREATE POLICY "Users can create submissions"
  ON submissions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND moderator_notes IS NULL
  );

CREATE OR REPLACE FUNCTION public.enforce_pending_submission_status()
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
    NEW.moderator_notes := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_pending_submission_status_before_insert ON submissions;

CREATE TRIGGER enforce_pending_submission_status_before_insert
  BEFORE INSERT ON submissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pending_submission_status();

NOTIFY pgrst, 'reload schema';
