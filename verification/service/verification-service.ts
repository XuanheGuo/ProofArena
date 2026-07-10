import { ProviderAdapterError, VerificationError } from "../domain/errors";
import {
  MAX_CONCURRENT_TASKS, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_MINUTES,
} from "../domain/policies";
import type {
  VerificationActor, VerificationMessage, VerificationRequest, VerificationResult, VerificationTaskDto, VerificationTaskStatus,
} from "../domain/types";
import { LeanEngine } from "../engines/lean/lean-engine";
import type { VerificationRepository } from "../repositories/types";
import type { VerificationConfig } from "./config";
import { createSourceHash, leanStaticPrecheck } from "./normalization";

// The only unique constraint on verification_tasks is the partial index on
// (source_hash) WHERE status IN ('queued','running'); any other error (network
// blip, FK violation, etc.) must not be silently reinterpreted as a race.
function isActiveHashConflict(error: unknown): boolean {
  return Boolean(error) && typeof error === "object" && (error as { code?: unknown }).code === "23505";
}

export class VerificationService {
  constructor(
    private readonly repository: VerificationRepository,
    private readonly config: VerificationConfig,
    private readonly leanEngine?: LeanEngine,
  ) {}

  async create(actor: VerificationActor | null, request: VerificationRequest, signal?: AbortSignal): Promise<VerificationTaskDto> {
    if (!actor) throw new VerificationError("需要登录后才能创建验证任务。", "unauthenticated", "invalid_request", 401);
    if (request.engine !== "lean") throw new VerificationError("当前尚未启用该验证引擎。", "unsupported_engine", "invalid_request", 400);
    if (!this.config.leanEnabled) throw new VerificationError("形式化验证暂时不可用。", "feature_disabled", "provider_error", 503);
    if (this.config.leanProvider !== "axle" || !this.leanEngine) throw new VerificationError("配置的 Lean Provider 尚未实现。", "unsupported_provider", "provider_error", 503);
    const environment = request.environment || this.config.defaultEnvironment;
    if (!environment || !this.config.allowedEnvironments.includes(environment)) {
      throw new VerificationError("验证环境未配置或不在允许列表中。", "invalid_environment", "invalid_request", 400);
    }
    const sourceSize = Buffer.byteLength(request.source, "utf8");
    if (!request.source.trim()) throw new VerificationError("Lean 源码不能为空。", "empty_source", "invalid_request", 400);
    if (sourceSize > this.config.maxSourceBytes) throw new VerificationError("Lean 源码超过允许的大小。", "source_too_large", "resource_limit", 413);
    await this.repository.authorize(actor, request);

    // Rate-limit before any cache/active lookup so repeatedly requesting an
    // already-cached source cannot bypass the per-user request budget (each
    // hit still inserts a full audit row via createCached below).
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
    if (await this.repository.countRecent(actor.userId, since) >= RATE_LIMIT_REQUESTS) {
      throw new VerificationError("验证请求过于频繁，请稍后重试。", "rate_limited", "rate_limited", 429);
    }

    const normalizedRequest = { ...request, environment };
    const options = { ignoreImports: true, mathlibOptions: false, timeoutSeconds: this.config.timeoutSeconds };
    const sourceHash = createSourceHash({
      source: request.source, engine: "lean", provider: "axle", environment, options,
    });
    const input = { actor, request: normalizedRequest, provider: "axle", environment, sourceHash, sourceSize };
    const cached = await this.repository.findCache(sourceHash);
    if (cached) return this.repository.createCached(input, cached);
    await this.repository.recoverStale(new Date(Date.now() - (this.config.timeoutSeconds + 60) * 1000).toISOString());
    const active = await this.repository.findActive(sourceHash);
    if (active) {
      if (active.userId === actor.userId) return active;
      const shared = await this.waitForSharedResult(sourceHash, signal);
      if (shared) return this.repository.createCached(input, shared);
    }
    if (await this.repository.countRunning(actor.userId) >= MAX_CONCURRENT_TASKS) {
      throw new VerificationError("当前运行中的验证任务过多。", "concurrency_limit", "rate_limited", 429);
    }

    let task: VerificationTaskDto;
    try { task = await this.repository.create(input); }
    catch (error) {
      if (!isActiveHashConflict(error)) throw error;
      const raced = await this.repository.findActive(sourceHash);
      if (raced?.userId === actor.userId) return raced;
      if (!raced) throw error;
      const shared = await this.waitForSharedResult(sourceHash, signal);
      if (shared) return this.repository.createCached(input, shared);
      try {
        task = await this.repository.create(input);
      } catch (retryError) {
        if (!isActiveHashConflict(retryError)) throw retryError;
        throw new VerificationError("与你相同的验证请求正在处理中，请稍后重试。", "concurrent_task_conflict", "rate_limited", 409);
      }
    }

    const precheck = leanStaticPrecheck(request.source);
    if (precheck.length) {
      return this.finishWithRetry(task.id, "completed", {
        valid: false, compiles: undefined, verdict: "invalid_request", engine: "lean", provider: "axle",
        environment, messages: precheck, failedDeclarations: [], sourceHash, cached: false,
      });
    }

    await this.repository.markRunning(task.id);
    let result: VerificationResult;
    try {
      result = await this.leanEngine.verify({
        ...normalizedRequest, engine: "lean", environment, options,
      }, signal);
    } catch (error) {
      const normalized = this.normalizeFailure(error, sourceHash, environment);
      const status = normalized.verdict === "cancelled" ? "cancelled" : "failed";
      return this.finishWithRetry(task.id, status, normalized);
    }
    // A persistence failure here must never be reinterpreted as a provider
    // failure -- doing so would silently discard a real accepted/rejected
    // result. Retry the same write once; if it still fails, let the error
    // propagate so the row is left "running" for recoverStale() to reconcile
    // later rather than being overwritten with a fabricated verdict.
    return this.finishWithRetry(task.id, "completed", { ...result, sourceHash, cached: false });
  }

  get(id: string, actor: VerificationActor) { return this.repository.getById(id, actor); }
  list(actor: VerificationActor, filters?: Parameters<VerificationRepository["list"]>[1]) { return this.repository.list(actor, filters); }

  private async finishWithRetry(id: string, status: VerificationTaskStatus, result: VerificationResult): Promise<VerificationTaskDto> {
    try {
      return await this.repository.finish(id, status, result);
    } catch {
      return this.repository.finish(id, status, result);
    }
  }

  private async waitForSharedResult(sourceHash: string, signal?: AbortSignal): Promise<VerificationTaskDto | null> {
    const deadline = Date.now() + (this.config.timeoutSeconds + 30) * 1000;
    while (Date.now() < deadline) {
      if (signal?.aborted) throw new VerificationError("验证请求已取消。", "cancelled", "cancelled", 499);
      await new Promise((resolve) => setTimeout(resolve, 250));
      const cached = await this.repository.findCache(sourceHash);
      if (cached) return cached;
      if (!await this.repository.findActive(sourceHash)) return null;
    }
    return null;
  }

  private normalizeFailure(error: unknown, sourceHash: string, environment: string): VerificationResult {
    const known = error instanceof ProviderAdapterError ? error : null;
    const verdict = known?.verdict ?? "provider_error";
    const message: VerificationMessage = {
      severity: "error", source: known ? "provider" : "proofarena",
      code: verdict === "timeout" ? "TIMEOUT" : verdict === "rate_limited" ? "RATE_LIMITED" : verdict === "cancelled" ? "CANCELLED" : "PROVIDER_UNAVAILABLE",
      message: known?.message ?? "验证服务发生内部错误，请稍后重试。",
    };
    return {
      valid: false, verdict, engine: "lean", provider: "axle", environment,
      messages: [message], failedDeclarations: [], sourceHash, cached: false,
      providerErrorCode: known?.providerErrorCode ?? "internal_error",
    };
  }
}
