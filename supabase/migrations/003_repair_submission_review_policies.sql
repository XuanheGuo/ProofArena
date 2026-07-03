-- Repair review permissions for projects that were initialized before the
-- moderator submission review workflow was added.

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Moderators can view submissions" ON submissions;
CREATE POLICY "Moderators can view submissions"
  ON submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
    OR auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
  );

DROP POLICY IF EXISTS "Moderators can update submissions" ON submissions;
CREATE POLICY "Moderators can update submissions"
  ON submissions FOR UPDATE
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

NOTIFY pgrst, 'reload schema';
