// See docs/ARCHITECTURE_V2.md §5, §8.
import type { RunConclusion } from "./evidence";

export const ARTIFACT_KINDS = [
  "verification_report",
  "formalization",
  "counterexample",
  "reasoning_graph",
  "method_comparison",
  "geometry_construction",
  "cas_derivation",
  "diagnostic_report",
] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export const ARTIFACT_STATUSES = ["draft", "published"] as const;
export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];

/** Only `verification_report`'s payload shape is implemented in Phase 1. */
export type ArtifactPayloadFor<K extends ArtifactKind> = K extends "verification_report" ? RunConclusion : unknown;

export interface ArtifactRecord<K extends ArtifactKind = ArtifactKind> {
  id: string;
  kind: K;
  schemaVersion: number;
  runId: string;
  providerKey: string;
  producerVersion: string | null;
  status: ArtifactStatus;
  payload: ArtifactPayloadFor<K>;
  summary: string;
  isPublic: boolean;
  createdBy: string | null;
  createdAt: string;
}

export function assertPublishedBeforePublic(status: ArtifactStatus, isPublic: boolean): void {
  if (isPublic && status !== "published") {
    throw new Error("an artifact must be status=published before it can be is_public");
  }
}
