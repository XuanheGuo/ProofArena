// See docs/ARCHITECTURE_V2.md §5. Framework-free: no Supabase/Next.js imports.
import type { ArtifactKind } from "./artifact";
import type { ObjectType } from "./references";

export const CAPABILITY_RUN_STATUSES = ["queued", "running", "succeeded", "failed", "timed_out", "cancelled"] as const;
export type CapabilityRunStatus = (typeof CAPABILITY_RUN_STATUSES)[number];

export const TERMINAL_RUN_STATUSES: readonly CapabilityRunStatus[] = ["succeeded", "failed", "timed_out", "cancelled"];

/** Known capability keys. Phase 1 registers exactly one ("verify.lean"). */
export const CAPABILITY_KEYS = ["verify.lean"] as const;
export type KnownCapabilityKey = (typeof CAPABILITY_KEYS)[number];
/** The registry accepts any string key so future capabilities don't require editing this contract. */
export type CapabilityKey = KnownCapabilityKey | (string & {});

export interface Actor {
  id?: string;
  userId: string;
  email?: string;
  role?: string;
}

export interface CapabilityRunInputRef {
  objectType: ObjectType;
  /** Required for version-bound inputs; forbidden for ad_hoc_source. */
  objectId?: string;
  versionId?: string;
  role: string;
  inputKey?: string;
  value?: unknown;
  contentHash?: string;
  snapshot?: unknown;
}

/**
 * An input AFTER server-side resolution (domains/capabilities/input-resolver.ts):
 * the content in `source` is what the adapter actually executes and what
 * capability_run_inputs.snapshot records. Adapters receive these, never raw
 * client-supplied CapabilityRunInputRefs — that indirection is what makes a
 * version-bound artifact's `verifies` claim honest.
 */
export interface ResolvedCapabilityInput {
  objectType: "solution_version" | "ad_hoc_source";
  objectId: string | null;
  versionId: string | null;
  role: string;
  /** Canonical source to execute. Private — never included in public payloads. */
  source: string;
  /** sha256 hex of `source`. */
  contentHash: string;
  /** Persisted verbatim to capability_run_inputs.snapshot (private). */
  snapshot: Record<string, unknown>;
}

export interface CapabilityRunRequest {
  capabilityKey: CapabilityKey;
  configuration?: Record<string, unknown>;
  inputs: CapabilityRunInputRef[];
  idempotencyKey?: string;
}

/**
 * Whether the durable projection (artifact + relations + evidence) of a
 * succeeded run has been written. Deliberately a separate axis from `status`:
 * a run whose provider execution succeeded but whose artifact write failed is
 * still status="succeeded" (the math happened) with projectionStatus="failed"
 * (the bookkeeping didn't), and is repairable without re-calling the provider.
 */
export const PROJECTION_STATUSES = ["pending", "completed", "failed", "not_applicable"] as const;
export type ProjectionStatus = (typeof PROJECTION_STATUSES)[number];

export interface CapabilityRunRecord {
  id: string;
  capabilityKey: CapabilityKey;
  providerKey: string;
  requestedBy: string;
  status: CapabilityRunStatus;
  configuration: Record<string, unknown>;
  inputHash: string;
  idempotencyKey: string | null;
  legacyVerificationTaskId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  costMetadata: Record<string, unknown>;
  projectionStatus: ProjectionStatus;
  projectionError: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A validation function returns a list of human-readable errors (empty =
 * valid). Deliberately not Zod -- see docs/ARCHITECTURE_V2.md §3 and
 * verification/api.ts's parseCreateBody for the existing hand-written
 * validator convention this project already follows.
 */
export type ConfigurationValidator = (configuration: Record<string, unknown>) => string[];

export interface CapabilityDefinition {
  key: CapabilityKey;
  version: number;
  acceptedInputTypes: ObjectType[];
  outputArtifactKind: ArtifactKind;
  providerKey: string;
  validateConfiguration?: ConfigurationValidator;
  permissionPolicy: (actor: Actor) => boolean;
  retryPolicy: { maxAttempts: number };
}
