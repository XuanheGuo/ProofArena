// Framework-free reference/relation vocabulary shared by capability runs and
// artifacts. See docs/ARCHITECTURE_V2.md §5, §7. No Supabase/Next.js imports —
// safe for any domain, client component, or test to import.

export const OBJECT_TYPES = [
  "problem",
  "solution",
  "problem_version",
  "solution_version",
  "submission",
] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

/**
 * A reference precise enough to survive a Solution being edited after the
 * fact: `versionId` (when known) pins the exact immutable snapshot, so a
 * consumer never has to guess whether `objectId`'s current content is what
 * was actually used.
 */
export interface VersionedRef {
  objectType: ObjectType;
  objectId: string;
  versionId?: string;
}

export const ARTIFACT_RELATION_TYPES = [
  "derived_from",
  "verifies",
  "formalizes",
  "refutes",
  "compares",
  "supersedes",
  "explains",
  "visualizes",
] as const;
export type ArtifactRelationType = (typeof ARTIFACT_RELATION_TYPES)[number];

export const ARTIFACT_RELATION_TARGET_TYPES = ["problem_version", "solution_version", "artifact"] as const;
export type ArtifactRelationTargetType = (typeof ARTIFACT_RELATION_TARGET_TYPES)[number];

export interface ArtifactRelationInput {
  relation: ArtifactRelationType;
  targetType: ArtifactRelationTargetType;
  targetId: string;
}
