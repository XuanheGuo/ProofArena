// Repository interface for artifacts + evidence (the durable math results from
// capability runs). See docs/ARCHITECTURE_V2.md §5, §8.
import type { Actor } from "@/contracts/capability";
import type { ArtifactKind, ArtifactRecord, ArtifactStatus } from "@/contracts/artifact";
import type { EvidenceKind, EvidenceRecord } from "@/contracts/evidence";

export interface CreateArtifactInput<K extends ArtifactKind = ArtifactKind> {
  kind: K;
  schemaVersion: number;
  runId: string;
  providerKey: string;
  producerVersion?: string | null;
  status: ArtifactStatus;
  payload: unknown;
  summary: string;
  isPublic: boolean;
  createdBy: string | null;
}

export interface CreateEvidenceInput {
  artifactId: string;
  kind: EvidenceKind;
  payload: unknown;
  isPublic: boolean;
}

// Phase 1.1: Atomic artifact bundle creation
export interface CreateArtifactBundleInput<K extends ArtifactKind = ArtifactKind> {
  kind: K;
  schemaVersion: number;
  runId: string;
  providerKey: string;
  producerVersion?: string | null;
  status: ArtifactStatus;
  payload: unknown;
  summary: string;
  isPublic: boolean;
  createdBy: string | null;
  relations: Array<{
    relation: string;
    targetType: string;
    targetId: string;
  }>;
  evidence: Array<{
    kind: EvidenceKind;
    payload: unknown;
    isPublic: boolean;
  }>;
}

export interface ArtifactRepository {
  create<K extends ArtifactKind>(input: CreateArtifactInput<K>): Promise<ArtifactRecord<K>>;

  // Phase 1.1: Atomic bundle creation
  createBundle<K extends ArtifactKind>(input: CreateArtifactBundleInput<K>): Promise<ArtifactRecord<K>>;

  findById(id: string, actor: Actor): Promise<ArtifactRecord | null>;
  findByRunId(runId: string, actor: Actor): Promise<ArtifactRecord[]>;

  createEvidence(input: CreateEvidenceInput): Promise<EvidenceRecord>;
  findEvidenceByArtifactId(artifactId: string, actor: Actor): Promise<EvidenceRecord[]>;

  // Phase 1.1: Publication
  publish(artifactId: string, publishedBy: string): Promise<ArtifactRecord>;
}
