import type { Actor, CapabilityRunRecord, CapabilityRunStatus, ProjectionStatus, ResolvedCapabilityInput } from "@/contracts/capability";

/**
 * Run + all inputs are created in ONE database transaction
 * (create_capability_run_with_inputs, migration 030): if any input row is
 * invalid the run row rolls back with it. `idempotencyKey` is always present —
 * when the client doesn't supply one, CapabilityService computes a
 * deterministic server-side key, so concurrent identical requests collide on
 * the unique index instead of creating duplicate runs.
 */
export interface CreateRunWithInputsInput {
  capabilityKey: string;
  providerKey: string;
  requestedBy: string;
  configuration: Record<string, unknown>;
  inputHash: string;
  idempotencyKey: string;
  inputs: ResolvedCapabilityInput[];
}

export interface FinishRunInput {
  status: CapabilityRunStatus;
  legacyVerificationTaskId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  costMetadata?: Record<string, unknown>;
}

/** A stored input row, as needed to rebuild artifact relations during projection repair. */
export interface StoredRunInput {
  objectType: string;
  objectId: string;
  versionId: string | null;
  role: string;
  contentHash: string | null;
}

/** Thrown by createWithInputs when the idempotency unique index fires — the
 * caller re-reads the existing run instead of surfacing an error. */
export class DuplicateRunError extends Error {
  constructor(readonly idempotencyKey: string) {
    super(`a run with idempotency key "${idempotencyKey}" already exists`);
    this.name = "DuplicateRunError";
  }
}

export interface CapabilityRunRepository {
  /** Atomic run+inputs creation. Throws DuplicateRunError on an idempotency collision. */
  createWithInputs(input: CreateRunWithInputsInput): Promise<CapabilityRunRecord>;
  /** Internal (service-role) lookup used for idempotent replay — scoped to the requesting user. */
  findByIdempotencyKey(requestedBy: string, capabilityKey: string, idempotencyKey: string): Promise<CapabilityRunRecord | null>;
  markRunning(id: string): Promise<void>;
  finish(id: string, result: FinishRunInput): Promise<CapabilityRunRecord>;
  setProjectionStatus(id: string, status: ProjectionStatus, error?: string | null): Promise<void>;
  /** Internal (service-role) read of a run's stored inputs, for projection repair. */
  getInputs(runId: string): Promise<StoredRunInput[]>;
  /** User-facing reads: MUST go through an RLS-enforcing client, not the service role. */
  getById(id: string, actor: Actor): Promise<CapabilityRunRecord | null>;
  list(actor: Actor, filters?: { capabilityKey?: string; status?: CapabilityRunStatus; limit?: number }): Promise<CapabilityRunRecord[]>;
}
