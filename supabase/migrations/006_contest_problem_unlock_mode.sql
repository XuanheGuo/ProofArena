-- Add per-problem unlock mode: 'manual' (admin controls status) or 'auto_time' (uses open_at/close_at)
ALTER TABLE contest_problems
  ADD COLUMN IF NOT EXISTS unlock_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (unlock_mode IN ('manual', 'auto_time'));
