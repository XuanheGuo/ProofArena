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
  objectId: string;
  versionId?: string;
  role: string;
  inputKey?: string;
  value?: unknown;
  contentHash?: string;
  snapshot?: unknown;
}

export interface CapabilityRunRequest {
  capabilityKey: CapabilityKey;
  configuration?: Record<string, unknown>;
  inputs: CapabilityRunInputRef[];
  idempotencyKey?: string;
}

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
