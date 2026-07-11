import type { Actor, CapabilityRunInputRef, CapabilityRunRecord, CapabilityRunStatus } from "@/contracts/capability";
import type { ResolvedInput } from "./input-resolver";

export interface CreateRunInput {
  capabilityKey: string;
  providerKey: string;
  requestedBy: string;
  configuration: Record<string, unknown>;
  inputHash: string;
  idempotencyKey: string | null;
  inputs: CapabilityRunInputRef[];
}

// Phase 1.1: Atomic run+inputs creation with resolved inputs
export interface CreateRunWithInputsInput {
  capabilityKey: string;
  providerKey: string;
  requestedBy: string;
  configuration: Record<string, unknown>;
  inputHash: string;
  idempotencyKey: string | null;
  resolvedInputs: ResolvedInput[];
}

export interface FinishRunInput {
  status: CapabilityRunStatus;
  legacyVerificationTaskId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  costMetadata?: Record<string, unknown>;
}

export interface CapabilityRunRepository {
  findByIdempotencyKey(requestedBy: string, capabilityKey: string, idempotencyKey: string): Promise<CapabilityRunRecord | null>;
  findByLegacyVerificationTaskId(taskId: string): Promise<CapabilityRunRecord | null>;
  create(input: CreateRunInput): Promise<CapabilityRunRecord>;

  // Phase 1.1: Atomic run+inputs creation
  createWithInputs(input: CreateRunWithInputsInput): Promise<CapabilityRunRecord>;

  markRunning(id: string): Promise<void>;
  finish(id: string, result: FinishRunInput): Promise<CapabilityRunRecord>;
  getById(id: string, actor: Actor): Promise<CapabilityRunRecord | null>;
  list(actor: Actor, filters?: { capabilityKey?: string; status?: CapabilityRunStatus; limit?: number }): Promise<CapabilityRunRecord[]>;

  // Phase 1.1: Projection status tracking
  markProjectionComplete(id: string): Promise<void>;
  markProjectionFailed(id: string, error: string): Promise<void>;

  // Phase 1.1: For projection repair
  getInputs(runId: string): Promise<ResolvedInput[]>;
}
