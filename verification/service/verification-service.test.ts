import assert from "node:assert/strict";
import test from "node:test";
import { VerificationError, ProviderAdapterError } from "../domain/errors";
import type { VerificationActor, VerificationResult, VerificationTaskDto } from "../domain/types";
import { LeanEngine } from "../engines/lean/lean-engine";
import type { LeanVerificationRequest } from "../engines/lean/types";
import type { VerificationProviderAdapter } from "../providers/provider-interface";
import type { CreateTaskInput, VerificationRepository } from "../repositories/types";
import type { VerificationConfig } from "./config";
import { VerificationService } from "./verification-service";

const actor: VerificationActor = { userId: "user-1", role: "user" };
const config: VerificationConfig = {
  leanEnabled: true, leanProvider: "axle", axleApiKey: "key", axleBaseUrl: "https://example.test",
  allowedEnvironments: ["lean-4.28.0"], defaultEnvironment: "lean-4.28.0", timeoutSeconds: 120, maxSourceBytes: 64 * 1024,
};

class MemoryRepository implements VerificationRepository {
  tasks: VerificationTaskDto[] = [];
  denied = false;
  recent = 0;
  running = 0;
  transitions: string[] = [];
  createErrors: unknown[] = [];
  findActiveQueue: (VerificationTaskDto | null)[] = [];
  finishFailures = 0;
  async authorize() { if (this.denied) throw new VerificationError("forbidden", "forbidden", "invalid_request", 403); }
  async countRecent() { return this.recent; }
  async countRunning() { return this.running; }
  async recoverStale() {}
  async findCache(hash: string) { return this.tasks.find((task) => task.sourceHash === hash && task.status === "completed" && ["accepted", "rejected"].includes(task.verdict)) ?? null; }
  async findActive(hash: string) {
    if (this.findActiveQueue.length) return this.findActiveQueue.shift() ?? null;
    return this.tasks.find((task) => task.sourceHash === hash && ["queued", "running"].includes(task.status)) ?? null;
  }
  async create(input: CreateTaskInput) {
    if (this.createErrors.length) throw this.createErrors.shift();
    const task = this.make(input, { status: "queued", verdict: "provider_error", cached: false });
    this.tasks.push(task); this.transitions.push("queued"); return task;
  }
  async createCached(input: CreateTaskInput, source: VerificationTaskDto) {
    const task = this.make(input, { ...source, id: `task-${this.tasks.length + 1}`, userId: input.actor.userId, cached: true, status: "completed", createdAt: new Date().toISOString() });
    this.tasks.push(task); this.transitions.push("cached"); return task;
  }
  async markRunning(id: string) { const task = this.tasks.find((item) => item.id === id)!; task.status = "running"; this.transitions.push("running"); }
  async finish(id: string, status: VerificationTaskDto["status"], result: VerificationResult) {
    if (this.finishFailures > 0) { this.finishFailures -= 1; throw new Error("transient write failure"); }
    const task = this.tasks.find((item) => item.id === id)!;
    Object.assign(task, result, { status, completedAt: new Date().toISOString() }); this.transitions.push(status); return task;
  }
  async getById(id: string) { return this.tasks.find((task) => task.id === id) ?? null; }
  async list() { return this.tasks; }
  private make(input: CreateTaskInput, extra: Partial<VerificationTaskDto>): VerificationTaskDto {
    return {
      id: `task-${this.tasks.length + 1}`, userId: input.actor.userId, status: "queued", verdict: "provider_error", valid: false,
      engine: "lean", provider: "axle", environment: input.environment, messages: [], failedDeclarations: [],
      sourceHash: input.sourceHash, cached: false, createdAt: new Date().toISOString(), ...extra,
    };
  }
}

class FakeProvider implements VerificationProviderAdapter<LeanVerificationRequest, VerificationResult> {
  readonly provider = "axle" as const;
  readonly engine = "lean" as const;
  calls = 0;
  error?: Error;
  result: VerificationResult = { valid: true, compiles: true, verdict: "accepted", engine: "lean", provider: "axle", messages: [], failedDeclarations: [], sourceHash: "", cached: false };
  async verify() { this.calls += 1; if (this.error) throw this.error; return this.result; }
}

function setup(overrides: Partial<VerificationConfig> = {}) {
  const repository = new MemoryRepository();
  const provider = new FakeProvider();
  const service = new VerificationService(repository, { ...config, ...overrides }, new LeanEngine(provider));
  return { repository, provider, service };
}

const validRequest = { engine: "lean" as const, source: "import Mathlib\ntheorem ok : 1 = 1 := rfl", problemId: "p1" };

test("enforces feature, authentication, engine, environment, permission, and size", async () => {
  await assert.rejects(() => setup({ leanEnabled: false }).service.create(actor, validRequest), (e: unknown) => e instanceof VerificationError && e.code === "feature_disabled");
  await assert.rejects(() => setup().service.create(null, validRequest), (e: unknown) => e instanceof VerificationError && e.code === "unauthenticated");
  await assert.rejects(() => setup().service.create(actor, { ...validRequest, engine: "cas" }), (e: unknown) => e instanceof VerificationError && e.code === "unsupported_engine");
  await assert.rejects(() => setup().service.create(actor, { ...validRequest, environment: "evil" }), (e: unknown) => e instanceof VerificationError && e.code === "invalid_environment");
  const denied = setup(); denied.repository.denied = true;
  await assert.rejects(() => denied.service.create(actor, validRequest), (e: unknown) => e instanceof VerificationError && e.code === "forbidden");
  await assert.rejects(() => setup({ maxSourceBytes: 4 }).service.create(actor, validRequest), (e: unknown) => e instanceof VerificationError && e.code === "source_too_large");
});

test("moves queued to running to completed for accepted and rejected results", async () => {
  const accepted = setup();
  const task = await accepted.service.create(actor, validRequest);
  assert.equal(task.verdict, "accepted");
  assert.deepEqual(accepted.repository.transitions, ["queued", "running", "completed"]);
  const rejected = setup(); rejected.provider.result = { ...rejected.provider.result, valid: false, verdict: "rejected", failedDeclarations: ["bad"] };
  assert.equal((await rejected.service.create(actor, validRequest)).verdict, "rejected");
});

test("caches accepted and rejected but not provider failures", async () => {
  for (const verdict of ["accepted", "rejected"] as const) {
    const ctx = setup(); ctx.provider.result = { ...ctx.provider.result, valid: verdict === "accepted", verdict };
    await ctx.service.create(actor, validRequest);
    const second = await ctx.service.create(actor, validRequest);
    assert.equal(second.cached, true); assert.equal(ctx.provider.calls, 1);
  }
  const failed = setup(); failed.provider.error = new ProviderAdapterError("down", "provider_error", "network_error");
  await failed.service.create(actor, validRequest);
  await failed.service.create(actor, validRequest);
  assert.equal(failed.provider.calls, 2);
});

test("deduplicates an active hash", async () => {
  const ctx = setup();
  const input = { actor, request: validRequest, provider: "axle", environment: "lean-4.28.0", sourceHash: "placeholder", sourceSize: 1 };
  const first = await ctx.repository.create(input);
  // Discover the real deterministic hash from a completed dry run in a separate context.
  const dry = setup(); const completed = await dry.service.create(actor, validRequest);
  first.sourceHash = completed.sourceHash;
  const found = await ctx.service.create(actor, validRequest);
  assert.equal(found.id, first.id); assert.equal(ctx.provider.calls, 0);
});

test("cross-user dedup creates an independent cached audit row", async () => {
  const ctx = setup();
  const dry = setup(); const completed = await dry.service.create(actor, validRequest);
  const shared = await ctx.repository.create({
    actor: { userId: "other-user" }, request: validRequest, provider: "axle",
    environment: "lean-4.28.0", sourceHash: completed.sourceHash, sourceSize: 1,
  });
  shared.status = "running";
  setTimeout(() => Object.assign(shared, {
    status: "completed", verdict: "accepted", valid: true, failedDeclarations: [], completedAt: new Date().toISOString(),
  }), 20);
  const result = await ctx.service.create(actor, validRequest);
  assert.notEqual(result.id, shared.id);
  assert.equal(result.userId, actor.userId);
  assert.equal(result.cached, true);
  assert.equal(ctx.provider.calls, 0);
});

test("static policy blocks sorry without calling provider", async () => {
  const ctx = setup();
  const task = await ctx.service.create(actor, { ...validRequest, source: "theorem bad : True := by sorry" });
  assert.equal(task.verdict, "invalid_request"); assert.equal(task.status, "completed"); assert.equal(ctx.provider.calls, 0);
});

test("maps timeout and provider errors and never leaves running", async () => {
  for (const verdict of ["timeout", "provider_error"] as const) {
    const ctx = setup(); ctx.provider.error = new ProviderAdapterError("safe", verdict, "detail_code");
    const task = await ctx.service.create(actor, validRequest);
    assert.equal(task.status, "failed"); assert.equal(task.verdict, verdict);
    assert.equal(ctx.repository.tasks.some((item) => item.status === "running"), false);
  }
});

test("enforces frequency and concurrency limits", async () => {
  const frequent = setup(); frequent.repository.recent = 10;
  await assert.rejects(() => frequent.service.create(actor, validRequest), (e: unknown) => e instanceof VerificationError && e.code === "rate_limited");
  const concurrent = setup(); concurrent.repository.running = 2;
  await assert.rejects(() => concurrent.service.create(actor, validRequest), (e: unknown) => e instanceof VerificationError && e.code === "concurrency_limit");
});

test("rate limit blocks even an already-cached source (no bypass via the cache fast path)", async () => {
  const ctx = setup();
  await ctx.service.create(actor, validRequest);
  ctx.repository.recent = 10;
  await assert.rejects(() => ctx.service.create(actor, validRequest), (e: unknown) => e instanceof VerificationError && e.code === "rate_limited");
  assert.equal(ctx.provider.calls, 1);
});

test("a non-unique-violation create() error is rethrown, not treated as a race", async () => {
  const ctx = setup();
  ctx.repository.createErrors = [{ code: "23503", message: "fk violation" }];
  await assert.rejects(() => ctx.service.create(actor, validRequest), (e: unknown) => (e as { code?: string })?.code === "23503");
});

test("a repeated unique-hash conflict after the shared wait resolves yields a clean 409, not a raw DB error", async () => {
  const ctx = setup();
  const dry = setup(); const completed = await dry.service.create(actor, validRequest);
  const racer: VerificationTaskDto = {
    id: "racer", userId: "other-user", status: "running", verdict: "provider_error", valid: false,
    engine: "lean", provider: "axle", environment: "lean-4.28.0", messages: [], failedDeclarations: [],
    sourceHash: completed.sourceHash, cached: false, createdAt: new Date().toISOString(),
  };
  ctx.repository.createErrors = [{ code: "23505" }, { code: "23505" }];
  ctx.repository.findActiveQueue = [null, racer, null];
  await assert.rejects(
    () => ctx.service.create(actor, validRequest),
    (e: unknown) => e instanceof VerificationError && e.code === "concurrent_task_conflict" && e.httpStatus === 409,
  );
});

test("a transient persistence failure after a successful provider result is retried, not silently replaced with provider_error", async () => {
  const ctx = setup();
  ctx.repository.finishFailures = 1;
  const task = await ctx.service.create(actor, validRequest);
  assert.equal(task.verdict, "accepted");
  assert.equal(task.status, "completed");
});

test("if the retried persistence write also fails, the error propagates and the row is left running rather than mislabeled", async () => {
  const ctx = setup();
  ctx.repository.finishFailures = 2;
  await assert.rejects(() => ctx.service.create(actor, validRequest));
  assert.equal(ctx.repository.tasks.at(-1)?.status, "running");
});
