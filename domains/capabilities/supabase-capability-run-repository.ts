import type { SupabaseClient } from "@supabase/supabase-js";
import type { Actor, CapabilityRunRecord, CapabilityRunStatus, ProjectionStatus } from "@/contracts/capability";
import {
  DuplicateRunError,
  type CapabilityRunRepository,
  type CreateRunWithInputsInput,
  type FinishRunInput,
  type StoredRunInput,
} from "./capability-run-repository";

type Row = Record<string, unknown>;

function mapRun(row: Row): CapabilityRunRecord {
  return {
    id: row.id as string,
    capabilityKey: row.capability_key as string,
    providerKey: row.provider_key as string,
    requestedBy: row.requested_by as string,
    status: row.status as CapabilityRunStatus,
    configuration: (row.configuration as Record<string, unknown>) ?? {},
    inputHash: row.input_hash as string,
    idempotencyKey: (row.idempotency_key as string | null) ?? null,
    legacyVerificationTaskId: (row.legacy_verification_task_id as string | null) ?? null,
    errorCode: (row.error_code as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    costMetadata: (row.cost_metadata as Record<string, unknown>) ?? {},
    projectionStatus: ((row.projection_status as string | null) ?? "pending") as ProjectionStatus,
    projectionError: (row.projection_error as string | null) ?? null,
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

/**
 * Two clients, two trust levels (docs/ARCHITECTURE_V2.md §10):
 *   writer — service-role. Used for every write (all via SECURITY DEFINER
 *     RPCs or service-role updates; no client role has any write policy) and
 *     for the two internal reads that back idempotent replay and projection
 *     repair (both are pre-scoped by requested_by / run id, never fanned out
 *     to another user's data).
 *   reader — the CALLER's RLS-enforcing client (cookie client). Every
 *     user-facing read goes through it, so visibility is decided by the
 *     SELECT policies in migration 028 (owner / moderator), not re-implemented
 *     as manual WHERE clauses here.
 */
export class SupabaseCapabilityRunRepository implements CapabilityRunRepository {
  constructor(
    private readonly writer: SupabaseClient,
    private readonly reader: SupabaseClient,
  ) {}

  async createWithInputs(input: CreateRunWithInputsInput): Promise<CapabilityRunRecord> {
    const { data: runId, error } = await this.writer.rpc("create_capability_run_with_inputs", {
      p_capability_key: input.capabilityKey,
      p_provider_key: input.providerKey,
      p_requested_by: input.requestedBy,
      p_configuration: input.configuration,
      p_input_hash: input.inputHash,
      p_idempotency_key: input.idempotencyKey,
      p_inputs: input.inputs.map((inp) => ({
        object_type: inp.objectType,
        object_id: inp.objectId ?? "",
        version_id: inp.versionId,
        role: inp.role,
        content_hash: inp.contentHash,
        snapshot: inp.snapshot,
      })),
    });
    if (error) {
      if (isUniqueViolation(error)) throw new DuplicateRunError(input.idempotencyKey);
      throw error;
    }

    const { data, error: fetchError } = await this.writer.from("capability_runs").select("*").eq("id", runId).single();
    if (fetchError) throw fetchError;
    return mapRun(data as Row);
  }

  async findByIdempotencyKey(requestedBy: string, capabilityKey: string, idempotencyKey: string): Promise<CapabilityRunRecord | null> {
    const { data, error } = await this.writer
      .from("capability_runs")
      .select("*")
      .eq("requested_by", requestedBy)
      .eq("capability_key", capabilityKey)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRun(data as Row) : null;
  }

  async markRunning(id: string): Promise<void> {
    const { error } = await this.writer
      .from("capability_runs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  async finish(id: string, result: FinishRunInput): Promise<CapabilityRunRecord> {
    const { data, error } = await this.writer
      .from("capability_runs")
      .update({
        status: result.status,
        legacy_verification_task_id: result.legacyVerificationTaskId ?? null,
        error_code: result.errorCode ?? null,
        error_message: result.errorMessage ?? null,
        cost_metadata: result.costMetadata ?? {},
        completed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return mapRun(data as Row);
  }

  async setProjectionStatus(id: string, status: ProjectionStatus, error?: string | null): Promise<void> {
    const { error: updateError } = await this.writer
      .from("capability_runs")
      .update({ projection_status: status, projection_error: error ?? null })
      .eq("id", id);
    if (updateError) throw updateError;
  }

  async getInputs(runId: string): Promise<StoredRunInput[]> {
    const { data, error } = await this.writer
      .from("capability_run_inputs")
      .select("object_type, object_id, version_id, role, content_hash")
      .eq("run_id", runId);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      objectType: row.object_type as string,
      objectId: row.object_id as string,
      versionId: (row.version_id as string | null) ?? null,
      role: row.role as string,
      contentHash: (row.content_hash as string | null) ?? null,
    }));
  }

  async getById(id: string, _actor: Actor): Promise<CapabilityRunRecord | null> {
    const { data, error } = await this.reader.from("capability_runs").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapRun(data as Row) : null;
  }

  async list(_actor: Actor, filters: { capabilityKey?: string; status?: CapabilityRunStatus; limit?: number } = {}): Promise<CapabilityRunRecord[]> {
    let query = this.reader
      .from("capability_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(filters.limit ?? 20, 100));
    if (filters.capabilityKey) query = query.eq("capability_key", filters.capabilityKey);
    if (filters.status) query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => mapRun(row as Row));
  }
}
