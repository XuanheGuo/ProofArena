import assert from "node:assert/strict";
import test from "node:test";
import { AxleProvider } from "./axle-provider";
import { ProviderAdapterError } from "../../domain/errors";
import type { LeanVerificationRequest } from "../../engines/lean/types";

const request: LeanVerificationRequest = {
  engine: "lean", source: "theorem ok : 1 = 1 := rfl", environment: "lean-4.28.0",
  options: { ignoreImports: true, mathlibOptions: false, timeoutSeconds: 120 },
};

function provider(fetchImpl: typeof fetch, apiKey = "test-key", timeoutSeconds = 120) {
  return new AxleProvider({ apiKey, baseUrl: "https://example.test", timeoutSeconds, fetchImpl });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("accepts only complete successful AXLE checks and sends documented fields", async () => {
  let sent: RequestInit | undefined;
  const result = await provider(async (_url, init) => {
    sent = init;
    return json({ okay: true, lean_messages: { errors: [], warnings: [], infos: [] }, tool_messages: { errors: [], warnings: [], infos: [] }, failed_declarations: [], timings: { total_ms: 42 } });
  }).verify(request);
  assert.equal(result.verdict, "accepted");
  assert.equal(result.valid, true);
  assert.equal(result.durationMs, 42);
  assert.equal((sent?.headers as Record<string, string>).Authorization, "Bearer test-key");
  assert.deepEqual(JSON.parse(sent?.body as string), {
    content: request.source, environment: request.environment, mathlib_options: false,
    ignore_imports: true, timeout_seconds: 120,
  });
});

test("rejects compile errors and normalizes positions", async () => {
  const result = await provider(async () => json({
    okay: false,
    lean_messages: { errors: [{ message: "type mismatch", line: 2, column: 4 }], warnings: [], infos: [] },
    tool_messages: {}, failed_declarations: ["bad"],
  })).verify(request);
  assert.equal(result.verdict, "rejected");
  assert.equal(result.compiles, false);
  assert.deepEqual(result.failedDeclarations, ["bad"]);
  assert.equal(result.messages[0].line, 2);
});

test("does not accept HTTP success when failed declarations are non-empty", async () => {
  const result = await provider(async () => json({ okay: true, lean_messages: {}, tool_messages: { warnings: ["declaration uses sorry"] }, failed_declarations: ["unfinished"] })).verify(request);
  assert.equal(result.valid, false);
  assert.equal(result.verdict, "rejected");
});

test("fails closed when okay:true but diagnostic fields are entirely missing", async () => {
  await assert.rejects(() => provider(async () => json({ okay: true })).verify(request),
    (error: unknown) => error instanceof ProviderAdapterError && error.providerErrorCode === "incomplete_response");
  await assert.rejects(() => provider(async () => json({ okay: true, lean_messages: {}, tool_messages: {} })).verify(request),
    (error: unknown) => error instanceof ProviderAdapterError && error.providerErrorCode === "incomplete_response");
});

test("fails closed when okay:true but failed_declarations contains non-string entries", async () => {
  await assert.rejects(() => provider(async () => json({
    okay: true, lean_messages: {}, tool_messages: {}, failed_declarations: [{ name: "my_theorem" }],
  })).verify(request), (error: unknown) => error instanceof ProviderAdapterError && error.providerErrorCode === "incomplete_response");
});

test("tolerates missing diagnostic fields when okay:false (already rejecting)", async () => {
  const result = await provider(async () => json({ okay: false })).verify(request);
  assert.equal(result.valid, false);
  assert.equal(result.verdict, "rejected");
});

for (const [status, verdict, code] of [
  [400, "invalid_request", "http_400"], [422, "invalid_request", "http_422"],
  [401, "provider_error", "auth_401"], [403, "provider_error", "auth_403"],
  [429, "rate_limited", "http_429"], [500, "provider_error", "http_500"],
] as const) {
  test(`maps HTTP ${status}`, async () => {
    await assert.rejects(() => provider(async () => json({}, status)).verify(request),
      (error: unknown) => error instanceof ProviderAdapterError && error.verdict === verdict && error.providerErrorCode === code);
  });
}

test("maps network errors", async () => {
  await assert.rejects(() => provider(async () => { throw new Error("secret network detail"); }).verify(request),
    (error: unknown) => error instanceof ProviderAdapterError && error.providerErrorCode === "network_error" && !error.message.includes("secret"));
});

test("rejects non-JSON and missing fields", async () => {
  await assert.rejects(() => provider(async () => new Response("not json")).verify(request),
    (error: unknown) => error instanceof ProviderAdapterError && error.providerErrorCode === "invalid_json");
  await assert.rejects(() => provider(async () => json({ failed_declarations: [] })).verify(request),
    (error: unknown) => error instanceof ProviderAdapterError && error.providerErrorCode === "invalid_response");
});

test("fails clearly when API key is missing", async () => {
  await assert.rejects(() => provider(async () => json({}), "").verify(request),
    (error: unknown) => error instanceof ProviderAdapterError && error.providerErrorCode === "missing_api_key");
});

test("distinguishes timeout and caller cancellation", async () => {
  const waitingFetch = async (_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });
  await assert.rejects(() => provider(waitingFetch, "key", 0.001).verify({ ...request, options: { ...request.options, timeoutSeconds: 0.001 } }),
    (error: unknown) => error instanceof ProviderAdapterError && error.verdict === "timeout");
  const controller = new AbortController();
  const promise = provider(waitingFetch).verify(request, controller.signal);
  controller.abort();
  await assert.rejects(() => promise, (error: unknown) => error instanceof ProviderAdapterError && error.verdict === "cancelled");
});
