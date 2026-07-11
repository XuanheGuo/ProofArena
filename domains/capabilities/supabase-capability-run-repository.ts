import type { SupabaseClient } from "@supabase/supabase-js";
import type { Actor, CapabilityRunRecord, CapabilityRunStatus } from "@/contracts/capability";
import { isModerator } from "@/domains/identity/actor";
import type { CapabilityRunRepository, CreateRunInput, CreateRunWithInputsInput, FinishRunInput } from "./capability-run-repository";
import type { ResolvedInput, ObjectType } from "./input-resolver";

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
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Every write in this class goes through the service-role client: neither
 * capability_runs nor capability_run_inputs has a client-writable RLS policy
 * (migration 026), matching the verification_tasks convention -- see
 * docs/ARCHITECTURE_V2.md §10.
 */
export class SupabaseCapabilityRunRepository implements CapabilityRunRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByIdempotencyKey(requestedBy: string, capabilityKey: string, idempotencyKey: string): Promise<CapabilityRunRecord | null> {
    const { data, error } = await this.db
      .from("capability_runs")
      .select("*")
      .eq("requested_by", requestedBy)
      .eq("capability_key", capabilityKey)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRun(data as Row) : null;
  }

  async findByLegacyVerificationTaskId(taskId: string): Promise<CapabilityRunRecord | null> {
    const { data, error } = await this.db.from("capability_runs").select("*").eq("legacy_verification_task_id", taskId).maybeSingle();
    if (error) throw error;
    return data ? mapRun(data as Row) : null;
  }

  async create(input: CreateRunInput): Promise<CapabilityRunRecord> {
    const { data, error } = await this.db
      .from("capability_runs")
      .insert({
        capability_key: input.capabilityKey,
        provider_key: input.providerKey,
        requested_by: input.requestedBy,
        configuration: input.configuration,
        input_hash: input.inputHash,
        idempotency_key: input.idempotencyKey,
      })
      .select("*")
      .single();
    if (error) throw error;
    const run = mapRun(data as Row);

    if (input.inputs.length > 0) {
      const { error: inputsError } = await this.db.from("capability_run_inputs").insert(
        input.inputs.map((ref) => ({
          run_id: run.id,
          object_type: ref.objectType,
          object_id: ref.objectId,
          version_id: ref.versionId ?? null,
          role: ref.role,
          content_hash: ref.contentHash ?? null,
          snapshot: ref.snapshot ?? null,
        })),
      );
      if (inputsError) throw inputsError;
    }
    return run;
  }

  async markRunning(id: string): Promise<void> {
    const { error } = await this.db.from("capability_runs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  }

  async finish(id: string, result: FinishRunInput): Promise<CapabilityRunRecord> {
    const { data, error } = await this.db
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

  async getById(id: string, actor: Actor): Promise<CapabilityRunRecord | null> {
    let query = this.db.from("capability_runs").select("*").eq("id", id);
    if (!isModerator(actor)) query = query.eq("requested_by", actor.userId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? mapRun(data as Row) : null;
  }

  async list(actor: Actor, filters: { capabilityKey?: string; status?: CapabilityRunStatus; limit?: number } = {}): Promise<CapabilityRunRecord[]> {
    let query = this.db.from("capability_runs").select("*").order("created_at", { ascending: false }).limit(Math.min(filters.limit ?? 20, 100));
    if (!isModerator(actor)) query = query.eq("requested_by", actor.userId);
    if (filters.capabilityKey) query = query.eq("capability_key", filters.capabilityKey);
    if (filters.status) query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => mapRun(row as Row));
  }

  // Phase 1.1: Atomic run+inputs creation via RPC
  async createWithInputs(input: CreateRunWithInputsInput): Promise<CapabilityRunRecord> {
    const { data: runId, error } = await this.db.rpc("create_capability_run_with_inputs", {
      p_capability_key: input.capabilityKey,
      p_provider_key: input.providerKey,
      p_requested_by: input.requestedBy,
      p_configuration: input.configuration,
      p_input_hash: input.inputHash,
      p_idempotency_key: input.idempotencyKey,
      p_inputs: input.resolvedInputs.map((inp) => ({
        object_type: inp.objectType,
        object_id: inp.objectId,
        version_id: inp.versionId,
        role: inp.role,
        content_hash: inp.contentHash,
        snapshot: inp.snapshot,
      })),
    });

    if (error) throw error;

    // Fetch the created run
    const { data: runData, error: fetchError } = await this.db
      .from("capability_runs")
      .select("*")
      .eq("id", runId)
      .single();

    if (fetchError) throw fetchError;
    return mapRun(runData as Row);
  }

  // Phase 1.1: Mark projection complete
  async markProjectionComplete(id: string): Promise<void> {
    const { error } = await this.db
      .from("capability_runs")
      .update({ projection_status: "completed", projection_error: null })
      .eq("id", id);
    if (error) throw error;
  }

  // Phase 1.1: Mark projection failed
  async markProjectionFailed(id: string, errorMsg: string): Promise<void> {
    const { error } = await this.db
      .from("capability_runs")
      .update({ projection_status: "failed", projection_error: errorMsg })
      .eq("id", id);
    if (error) throw error;
  }

  // Phase 1.1: Get inputs for projection repair
  async getInputs(runId: string): Promise<ResolvedInput[]> {
    const { data, error } = await this.db
      .from("capability_run_inputs")
      .select("*")
      .eq("run_id", runId);

    if (error) throw error;
    if (!data) return [];

    return data.map((row) => ({
      objectType: row.object_type as ObjectType,
      objectId: row.object_id,
      versionId: row.version_id,
      role: row.role,
      inputKey: "recovered", // Historic data may not have inputKey
      canonicalSource: "", // Can't recover from snapshot, only hash available
      contentHash: row.content_hash,
      snapshot: row.snapshot as any,
    }));
  }
}
