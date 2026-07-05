-- 011_proof_graph_mvp.sql
-- Add proof_graph column to problems table.
--
-- Stores the official per-problem ProofGraphV1 object:
--   { observations, branches, transformations, verificationSteps,
--     methodBoundaries, challengeEdges }
--
-- This is approved public content rendered by ProblemDetailExperience.
-- It is distinct from solution.thinking_cues.proofGraphDraft, which is a
-- solution-level editorial draft awaiting future assembly into this column.
--
-- No automatic merge from solution drafts is performed here.
-- Editorial promotion to this column is a deliberate moderator action.

ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS proof_graph JSONB;

COMMENT ON COLUMN problems.proof_graph IS
  'Approved public ProofGraphV1 data for this problem. '
  'Populated by editorial workflow; not auto-generated from solution drafts.';
