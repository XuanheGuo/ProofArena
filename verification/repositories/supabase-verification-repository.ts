import type { SupabaseClient } from "@supabase/supabase-js";
import { VerificationError } from "../domain/errors";
import { CACHEABLE_VERDICTS } from "../domain/policies";
import type {
  VerificationActor, VerificationMessage, VerificationRequest, VerificationResult,
  VerificationTaskDto, VerificationTaskStatus, VerificationVerdict,
} from "../domain/types";
import type { CreateTaskInput, VerificationRepository } from "./types";

type Row = Record<string, unknown>;

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function messages(value: unknown): VerificationMessage[] {
  return Array.isArray(value) ? value.filter((item): item is VerificationMessage => Boolean(item && typeof item === "object" && typeof (item as Row).message === "string")) : [];
}

function mapTask(row: Row): VerificationTaskDto {
  return {
    id: row.id as string,
    userId: row.user_id as string | undefined,
    status: row.status as VerificationTaskStatus,
    verdict: (row.verdict ?? "provider_error") as VerificationVerdict,
    valid: Boolean(row.valid),
    compiles: typeof row.compiles === "boolean" ? row.compiles : undefined,
    engine: row.engine as VerificationTaskDto["engine"],
    provider: row.provider as VerificationTaskDto["provider"],
    environment: row.environment as string,
    messages: messages(row.messages),
    failedDeclarations: strings(row.failed_declarations),
    durationMs: typeof row.duration_ms === "number" ? row.duration_ms : undefined,
    sourceHash: row.source_hash as string,
    cached: Boolean(row.cached),
    providerRequestId: row.provider_request_id as string | undefined,
    providerErrorCode: row.provider_error_code as string | undefined,
    resultMetadata: row.result_metadata as Record<string, unknown> | undefined,
    problemId: row.problem_id as string | undefined,
    solutionId: row.solution_id as string | undefined,
    submissionId: row.submission_id as string | undefined,
    createdAt: row.created_at as string,
    startedAt: row.started_at as string | undefined,
    completedAt: row.completed_at as string | undefined,
  };
}

function isPrivileged(actor: VerificationActor): boolean {
  return actor.email === "xuanheguo@icloud.com" || ["moderator", "admin"].includes(actor.role ?? "");
}

export class SupabaseVerificationRepository implements VerificationRepository {
  constructor(private readonly db: SupabaseClient) {}

  async authorize(actor: VerificationActor, request: VerificationRequest): Promise<void> {
    const privileged = isPrivileged(actor);
    if (request.problemId) {
      const { data } = await this.db.from("problems").select("id").eq("id", request.problemId).maybeSingle();
      if (!data) throw new VerificationError("关联题目不存在。", "problem_not_found", "invalid_request", 404);
    }
    if (request.submissionId) {
      const { data } = await this.db.from("submissions").select("id,user_id,problem_id").eq("id", request.submissionId).maybeSingle();
      if (!data) throw new VerificationError("关联投稿不存在。", "submission_not_found", "invalid_request", 404);
      if (!privileged && data.user_id !== actor.userId) throw new VerificationError("无权验证此投稿。", "forbidden", "invalid_request", 403);
      if (request.problemId && data.problem_id && data.problem_id !== request.problemId) throw new VerificationError("关联对象不一致。", "relation_mismatch", "invalid_request", 400);
    }
    if (request.solutionId) {
      const { data } = await this.db.from("solutions").select("id,problem_id,author_id,source_submission_id").eq("id", request.solutionId).maybeSingle();
      if (!data) throw new VerificationError("关联解法不存在。", "solution_not_found", "invalid_request", 404);
      let ownsSource = data.author_id === actor.userId;
      if (!ownsSource && data.source_submission_id) {
        const { data: source } = await this.db.from("submissions").select("user_id").eq("id", data.source_submission_id).maybeSingle();
        ownsSource = source?.user_id === actor.userId;
      }
      if (!privileged && !ownsSource) throw new VerificationError("无权验证此解法。", "forbidden", "invalid_request", 403);
      if (request.problemId && data.problem_id !== request.problemId) throw new VerificationError("关联对象不一致。", "relation_mismatch", "invalid_request", 400);
    }
  }

  async countRecent(userId: string, sinceIso: string): Promise<number> {
    const { count, error } = await this.db.from("verification_tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", sinceIso);
    if (error) throw error;
    return count ?? 0;
  }

  async countRunning(userId: string): Promise<number> {
    const { count, error } = await this.db.from("verification_tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["queued", "running"]);
    if (error) throw error;
    return count ?? 0;
  }

  async recoverStale(beforeIso: string): Promise<void> {
    const { error } = await this.db.from("verification_tasks").update({
      status: "failed", verdict: "provider_error", valid: false,
      provider_error_code: "stale_running_task",
      messages: [{ severity: "error", source: "proofarena", code: "STALE_TASK", message: "验证任务异常中断，请重新提交。" }],
      completed_at: new Date().toISOString(),
    }).in("status", ["queued", "running"]).lt("updated_at", beforeIso);
    if (error) throw error;
  }

  async findCache(sourceHash: string): Promise<VerificationTaskDto | null> {
    const { data } = await this.db.from("verification_tasks").select("*").eq("source_hash", sourceHash).eq("status", "completed").in("verdict", Array.from(CACHEABLE_VERDICTS)).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data ? mapTask(data as Row) : null;
  }

  async findActive(sourceHash: string): Promise<VerificationTaskDto | null> {
    const { data } = await this.db.from("verification_tasks").select("*").eq("source_hash", sourceHash).in("status", ["queued", "running"]).order("created_at", { ascending: true }).limit(1).maybeSingle();
    return data ? mapTask(data as Row) : null;
  }

  private insertShape(input: CreateTaskInput) {
    return {
      user_id: input.actor.userId, problem_id: input.request.problemId ?? null,
      solution_id: input.request.solutionId ?? null, submission_id: input.request.submissionId ?? null,
      engine: input.request.engine, provider: input.provider, environment: input.environment,
      source_hash: input.sourceHash, source_snapshot: input.request.source, source_size: input.sourceSize,
    };
  }

  async create(input: CreateTaskInput): Promise<VerificationTaskDto> {
    const { data, error } = await this.db.from("verification_tasks").insert(this.insertShape(input)).select("*").single();
    if (error) throw error;
    return mapTask(data as Row);
  }

  async createCached(input: CreateTaskInput, source: VerificationTaskDto): Promise<VerificationTaskDto> {
    const { data, error } = await this.db.from("verification_tasks").insert({
      ...this.insertShape(input), status: "completed", verdict: source.verdict, valid: source.valid,
      compiles: source.compiles ?? null, messages: source.messages,
      failed_declarations: source.failedDeclarations ?? [], result_metadata: source.resultMetadata ?? {},
      cached: true, cache_source_id: source.id, provider_request_id: source.providerRequestId ?? null,
      duration_ms: source.durationMs ?? null, completed_at: new Date().toISOString(),
    }).select("*").single();
    if (error) throw error;
    return mapTask(data as Row);
  }

  async markRunning(id: string): Promise<void> {
    const { error } = await this.db.from("verification_tasks").update({ status: "running", started_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  }

  async finish(id: string, status: VerificationTaskStatus, result: VerificationResult): Promise<VerificationTaskDto> {
    const { data, error } = await this.db.from("verification_tasks").update({
      status, verdict: result.verdict, valid: result.valid, compiles: result.compiles ?? null,
      messages: result.messages, failed_declarations: result.failedDeclarations ?? [],
      result_metadata: result.resultMetadata ?? {}, provider_request_id: result.providerRequestId ?? null,
      provider_error_code: result.providerErrorCode ?? null, duration_ms: result.durationMs ?? null,
      completed_at: new Date().toISOString(),
    }).eq("id", id).select("*").single();
    if (error) throw error;
    return mapTask(data as Row);
  }

  async getById(id: string, actor: VerificationActor): Promise<VerificationTaskDto | null> {
    let query = this.db.from("verification_tasks").select("*").eq("id", id);
    if (!isPrivileged(actor)) query = query.eq("user_id", actor.userId);
    const { data } = await query.maybeSingle();
    return data ? mapTask(data as Row) : null;
  }

  async list(actor: VerificationActor, filters: { userId?: string; problemId?: string; engine?: string; provider?: string; status?: VerificationTaskStatus; verdict?: VerificationVerdict; limit?: number } = {}): Promise<VerificationTaskDto[]> {
    let query = this.db.from("verification_tasks").select("*").order("created_at", { ascending: false }).limit(Math.min(filters.limit ?? 20, 100));
    if (!isPrivileged(actor)) query = query.eq("user_id", actor.userId);
    else if (filters.userId) query = query.eq("user_id", filters.userId);
    if (filters.problemId) query = query.eq("problem_id", filters.problemId);
    if (filters.engine) query = query.eq("engine", filters.engine);
    if (filters.provider) query = query.eq("provider", filters.provider);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.verdict) query = query.eq("verdict", filters.verdict);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => mapTask(row as Row));
  }
}
