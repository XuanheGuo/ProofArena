import { ProviderAdapterError } from "../../domain/errors";
import type { VerificationMessage, VerificationResult } from "../../domain/types";
import type { LeanVerificationRequest } from "../../engines/lean/types";
import type { VerificationProviderAdapter } from "../provider-interface";

type FetchLike = typeof fetch;
type MessageBucket = { errors?: unknown; warnings?: unknown; infos?: unknown };
type AxleResponse = {
  okay?: unknown; lean_messages?: MessageBucket; tool_messages?: MessageBucket;
  failed_declarations?: unknown; timings?: unknown; request_id?: unknown;
};

function position(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  const found = (value as Record<string, unknown>)[key];
  return typeof found === "number" ? found : undefined;
}

function isMessageBucket(value: unknown): value is MessageBucket {
  return Boolean(value) && typeof value === "object";
}

function normalizeBucket(bucket: MessageBucket | undefined, source: "lean" | "provider"): VerificationMessage[] {
  const output: VerificationMessage[] = [];
  for (const [key, severity] of [["errors", "error"], ["warnings", "warning"], ["infos", "info"]] as const) {
    const entries = Array.isArray(bucket?.[key]) ? bucket[key] as unknown[] : [];
    for (const entry of entries) {
      const record = entry && typeof entry === "object" ? entry as Record<string, unknown> : null;
      const message = typeof entry === "string" ? entry : typeof record?.message === "string" ? record.message : JSON.stringify(entry);
      output.push({
        severity, message, source,
        code: typeof record?.code === "string" ? record.code : undefined,
        line: position(entry, "line"), column: position(entry, "column"),
        endLine: position(entry, "end_line"), endColumn: position(entry, "end_column"),
      });
    }
  }
  return output;
}

export class AxleProvider implements VerificationProviderAdapter<LeanVerificationRequest, VerificationResult> {
  readonly provider = "axle" as const;
  readonly engine = "lean" as const;

  constructor(private readonly config: {
    apiKey?: string; baseUrl: string; timeoutSeconds: number; defaultEnvironment?: string; fetchImpl?: FetchLike;
  }) {}

  async verify(request: LeanVerificationRequest, signal?: AbortSignal): Promise<VerificationResult> {
    if (!this.config.apiKey) throw new ProviderAdapterError("Lean 验证服务尚未完成配置。", "provider_error", "missing_api_key");
    const controller = new AbortController();
    const timeoutMs = Math.min(request.options.timeoutSeconds, this.config.timeoutSeconds) * 1000;
    const timer = setTimeout(() => controller.abort(new Error("provider timeout")), timeoutMs);
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    const started = Date.now();
    try {
      const response = await (this.config.fetchImpl ?? fetch)(`${this.config.baseUrl}/api/v1/check`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          content: request.source,
          environment: request.environment,
          mathlib_options: request.options.mathlibOptions,
          ignore_imports: request.options.ignoreImports,
          timeout_seconds: request.options.timeoutSeconds,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 400 || response.status === 422) throw new ProviderAdapterError("Lean 验证请求无效。", "invalid_request", `http_${response.status}`);
        if (response.status === 429) throw new ProviderAdapterError("Lean 验证请求过于频繁，请稍后重试。", "rate_limited", "http_429");
        if (response.status === 401 || response.status === 403) throw new ProviderAdapterError("Lean 验证服务暂时不可用。", "provider_error", `auth_${response.status}`);
        throw new ProviderAdapterError("Lean 验证服务暂时不可用。", "provider_error", `http_${response.status}`);
      }
      let raw: AxleResponse;
      try { raw = await response.json() as AxleResponse; }
      catch { throw new ProviderAdapterError("Lean 验证服务返回了无法识别的结果。", "provider_error", "invalid_json"); }
      if (typeof raw.okay !== "boolean") throw new ProviderAdapterError("Lean 验证服务返回字段不完整。", "provider_error", "invalid_response");
      // A successful-looking response must actually carry the fields that back that
      // conclusion. An "okay:true" with missing/malformed diagnostic fields is a
      // truncated or malformed response, not evidence of a clean proof -- fail closed
      // rather than silently treating "field absent" the same as "field present and empty".
      if (raw.okay) {
        const hasMessageBuckets = isMessageBucket(raw.lean_messages) && isMessageBucket(raw.tool_messages);
        const declarations = raw.failed_declarations;
        const hasValidDeclarationsShape = Array.isArray(declarations) && declarations.every((item) => typeof item === "string");
        if (!hasMessageBuckets || !hasValidDeclarationsShape) {
          throw new ProviderAdapterError("Lean 验证服务返回字段不完整。", "provider_error", "incomplete_response");
        }
      }
      const messages = [
        ...normalizeBucket(raw.lean_messages, "lean"),
        ...normalizeBucket(raw.tool_messages, "provider"),
      ];
      const failedDeclarations = Array.isArray(raw.failed_declarations)
        ? raw.failed_declarations.filter((item): item is string => typeof item === "string") : [];
      const hasErrors = messages.some((message) => message.severity === "error");
      const valid = raw.okay && !hasErrors && failedDeclarations.length === 0;
      const timing = raw.timings && typeof raw.timings === "object" && typeof (raw.timings as Record<string, unknown>).total_ms === "number"
        ? (raw.timings as Record<string, number>).total_ms : Date.now() - started;
      return {
        valid, compiles: raw.okay, verdict: valid ? "accepted" : "rejected",
        engine: "lean", provider: "axle", environment: request.environment,
        messages, failedDeclarations, durationMs: timing, sourceHash: "", cached: false,
        providerRequestId: typeof raw.request_id === "string" ? raw.request_id : undefined,
      };
    } catch (error) {
      if (error instanceof ProviderAdapterError) throw error;
      if (controller.signal.aborted) {
        if (signal?.aborted) throw new ProviderAdapterError("验证已取消。", "cancelled", "cancelled");
        throw new ProviderAdapterError("Lean 验证请求超时。", "timeout", "timeout");
      }
      throw new ProviderAdapterError("无法连接 Lean 验证服务。", "provider_error", "network_error");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }

  async healthCheck() {
    const started = Date.now();
    if (!this.config.apiKey) return { healthy: false, message: "AXLE API Key 未配置" };
    if (!this.config.defaultEnvironment) return { healthy: false, message: "AXLE environment 未配置" };
    try {
      const result = await this.verify({
        engine: "lean", source: "theorem proofarena_health : True := trivial",
        environment: this.config.defaultEnvironment,
        options: { ignoreImports: true, mathlibOptions: false, timeoutSeconds: Math.min(15, this.config.timeoutSeconds) },
      });
      return { healthy: result.valid, latencyMs: Date.now() - started, message: result.valid ? undefined : "Provider 健康检查证明未通过" };
    } catch (error) {
      return { healthy: false, latencyMs: Date.now() - started, message: error instanceof ProviderAdapterError ? error.message : "无法连接 Provider" };
    }
  }
}
