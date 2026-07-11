// Framework-free version/lineage contract shared by domains/content/{problem,solution}.
// See docs/ARCHITECTURE_V2.md §4.

export type VersionedEntityKind = "problem" | "solution";

/**
 * One immutable snapshot row (problem_versions / solution_versions). `content`
 * is intentionally `unknown` here -- domains/content/problem and
 * domains/content/solution narrow it to their own snapshot shape; this
 * contract only describes the version envelope, not entity-specific fields.
 */
export interface ContentVersionRecord<TContent = unknown> {
  id: string;
  entityId: string;
  versionNumber: number;
  parentVersionId: string | null;
  content: TContent;
  contentHash: string;
  changeSummary: string;
  sourceSubmissionId?: string | null;
  createdBy: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface CreateVersionInput<TContent = unknown> {
  entityId: string;
  content: TContent;
  changeSummary?: string;
  sourceSubmissionId?: string | null;
  createdBy: string | null;
  publish?: boolean;
}

/** Result of asking "does creating a version for this content do anything new?" */
export interface VersionDedupResult<TContent = unknown> {
  created: boolean;
  version: ContentVersionRecord<TContent>;
  reason: "created" | "no_op_same_hash";
}
