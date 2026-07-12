// Repository interface for artifacts + evidence (the durable math results from
// capability runs). See docs/ARCHITECTURE_V2.md §5, §8.
import type { Actor } from "@/contracts/capability";
import type { ArtifactKind, ArtifactRecord } from "@/contracts/artifact";
import type { EvidenceKind, EvidenceRecord } from "@/contracts/evidence";
import type { ArtifactRelationInput } from "@/contracts/references";

/**
 * Artifact + relations + evidence are created in ONE database transaction
 * (create_artifact_bundle, migration 030). Always created as a private draft —
 * status/isPublic are not parameters on purpose; publication is a separate,
 * validated transition (publish below).
 */
export interface CreateArtifactBundleInput<K extends ArtifactKind = ArtifactKind> {
  kind: K;
  schemaVersion: number;
  runId: string;
  providerKey: string;
  producerVersion?: string | null;
  payload: unknown;
  summary: string;
  createdBy: string | null;
  relations: ArtifactRelationInput[];
  evidence: { kind: EvidenceKind; payload: unknown; isPublic: boolean }[];
}

/** Thrown by createBundle when this run already has an artifact of this
 * kind/schema (unique index in migration 030) — the projection already
 * happened, so callers treat it as success, not an error. */
export class ArtifactAlreadyProjectedError extends Error {
  constructor(readonly runId: string) {
    super(`run ${runId} already has an artifact of this kind`);
    this.name = "ArtifactAlreadyProjectedError";
  }
}

export interface ArtifactRepository {
  /** Atomic bundle write. Throws ArtifactAlreadyProjectedError if the run is already projected. */
  createBundle<K extends ArtifactKind>(input: CreateArtifactBundleInput<K>): Promise<ArtifactRecord<K>>;
  /** The only draft→published path; validates and flips atomically (publish_artifact RPC). Idempotent. */
  publish(artifactId: string, publishedBy: string): Promise<ArtifactRecord>;
  /** User-facing reads: MUST go through an RLS-enforcing client, not the service role. */
  findById(id: string, actor: Actor): Promise<ArtifactRecord | null>;
  findByRunId(runId: string, actor: Actor): Promise<ArtifactRecord[]>;
  findEvidenceByArtifactId(artifactId: string, actor: Actor): Promise<EvidenceRecord[]>;
  /** Internal (service-role) read for the publication service's pre-publish validation. */
  getByIdInternal(id: string): Promise<ArtifactRecord | null>;
}
