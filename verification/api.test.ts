import assert from "node:assert/strict";
import test from "node:test";
import { parseCreateBody, taskResponse } from "./api";
import { VerificationError } from "./domain/errors";
import type { VerificationTaskDto } from "./domain/types";

test("API parser accepts only Lean and server-controlled provider/environment", () => {
  const parsed = parseCreateBody({ engine: "lean", source: "#check Nat", problemId: "p", provider: "evil", environment: "evil" });
  assert.deepEqual(parsed, { engine: "lean", source: "#check Nat", problemId: "p", solutionId: undefined, submissionId: undefined });
  assert.throws(() => parseCreateBody({ engine: "z3", source: "x" }), (e: unknown) => e instanceof VerificationError && e.code === "unsupported_engine");
  assert.throws(() => parseCreateBody({ engine: "lean", source: 1 }), VerificationError);
});

test("ordinary API DTO never exposes provider diagnostics", () => {
  const task: VerificationTaskDto = {
    id: "1", userId: "u", status: "failed", verdict: "provider_error", valid: false, engine: "lean", provider: "axle",
    messages: [], sourceHash: "hash", cached: false, createdAt: "now", providerErrorCode: "auth_401",
    resultMetadata: { raw: "secret" },
  };
  const safe = taskResponse(task, { userId: "u", role: "user" });
  assert.equal("providerErrorCode" in safe, false);
  assert.equal("resultMetadata" in safe, false);
  assert.equal("userId" in safe, false);
  assert.equal((taskResponse(task, { userId: "a", role: "admin" }) as VerificationTaskDto).providerErrorCode, "auth_401");
});
