import type { Actor, CapabilityRunInputRef, CapabilityRunRecord, CapabilityRunStatus } from "@/contracts/capability";

export interface CreateRunInput {
  capabilityKey: string;
  providerKey: string;
  requestedBy: string;
  configuration: Record<string, unknown>;
  inputHash: string;
  idempotencyKey: string | null;
  inputs: CapabilityRunInputRef[];
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
  markRunning(id: string): Promise<void>;
  finish(id: string, result: FinishRunInput): Promise<CapabilityRunRecord>;
  getById(id: string, actor: Actor): Promise<CapabilityRunRecord | null>;
  list(actor: Actor, filters?: { capabilityKey?: string; status?: CapabilityRunStatus; limit?: number }): Promise<CapabilityRunRecord[]>;
}
