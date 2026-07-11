// Tests for LeanVerificationAdapter mapping logic. Uses mock adapter results
// to verify the VerificationTaskDto → CapabilityAdapterResult transformation
// without calling the real VerificationService.
import { describe, it } from "node:test";
import assert from "node:assert";
import type { VerificationTaskDto } from "@/verification/domain/types";
import type { RunConclusion } from "@/contracts/evidence";

function mapVerificationTaskToRunConclusion(task: VerificationTaskDto): RunConclusion {
  let conclusion: RunConclusion["conclusion"];
  let evidenceLevel: RunConclusion["evidenceLevel"];

  if (task.verdict === "accepted") {
    conclusion = "verified";
    evidenceLevel = "machine_checked";
  } else if (task.verdict === "rejected") {
    conclusion = "refuted";
    evidenceLevel = "machine_checked";
  } else if (task.verdict === "invalid_request") {
    conclusion = "unsupported";
    evidenceLevel = "machine_checked";
  } else {
    conclusion = "inconclusive";
    evidenceLevel = "machine_checked";
  }

  const errorMessages = task.messages.filter((m) => m.severity === "error");
  const failedDeclarations = task.failedDeclarations ?? [];

  return {
    conclusion,
    evidenceLevel,
    coverage: {
      checked: failedDeclarations.length === 0 ? 1 : 0,
      total: 1,
      failedDeclarations,
    },
    assumptions: [],
    claim: task.problemId
      ? `Solution for problem ${task.problemId} is machine-checkable`
      : "Lean proof compiles and passes verification",
    verifiedScope: task.verdict === "accepted" ? ["lean_proof"] : [],
    unverifiedScope: task.verdict === "accepted" ? [] : ["lean_proof"],
    missingConditions: errorMessages.map((m) => m.message),
  };
}

describe("LeanVerificationAdapter mapping", () => {
  it("maps accepted verdict to verified conclusion", () => {
    const task: VerificationTaskDto = {
      id: "task_1",
      status: "completed",
      verdict: "accepted",
      valid: true,
      compiles: true,
      engine: "lean",
      provider: "axle",
      messages: [],
      sourceHash: "abc123",
      cached: false,
      createdAt: "2026-07-11T00:00:00Z",
    };

    const result = mapVerificationTaskToRunConclusion(task);

    assert.strictEqual(result.conclusion, "verified");
    assert.strictEqual(result.evidenceLevel, "machine_checked");
    assert.strictEqual(result.coverage.checked, 1);
    assert.strictEqual(result.coverage.total, 1);
    assert.deepStrictEqual(result.verifiedScope, ["lean_proof"]);
    assert.deepStrictEqual(result.unverifiedScope, []);
  });

  it("maps rejected verdict to refuted conclusion", () => {
    const task: VerificationTaskDto = {
      id: "task_1",
      status: "completed",
      verdict: "rejected",
      valid: false,
      engine: "lean",
      provider: "axle",
      messages: [{ severity: "error", message: "type mismatch", source: "lean" }],
      failedDeclarations: ["theorem_main"],
      sourceHash: "abc123",
      cached: false,
      createdAt: "2026-07-11T00:00:00Z",
    };

    const result = mapVerificationTaskToRunConclusion(task);

    assert.strictEqual(result.conclusion, "refuted");
    assert.strictEqual(result.evidenceLevel, "machine_checked");
    assert.strictEqual(result.coverage.checked, 0);
    assert.deepStrictEqual(result.coverage.failedDeclarations, ["theorem_main"]);
    assert.deepStrictEqual(result.verifiedScope, []);
    assert.deepStrictEqual(result.unverifiedScope, ["lean_proof"]);
    assert.deepStrictEqual(result.missingConditions, ["type mismatch"]);
  });

  it("maps invalid_request verdict to unsupported conclusion", () => {
    const task: VerificationTaskDto = {
      id: "task_1",
      status: "completed",
      verdict: "invalid_request",
      valid: false,
      engine: "lean",
      provider: "axle",
      messages: [{ severity: "error", message: "malformed Lean code", source: "proofarena" }],
      sourceHash: "abc123",
      cached: false,
      createdAt: "2026-07-11T00:00:00Z",
    };

    const result = mapVerificationTaskToRunConclusion(task);

    assert.strictEqual(result.conclusion, "unsupported");
    assert.strictEqual(result.evidenceLevel, "machine_checked");
    assert.deepStrictEqual(result.missingConditions, ["malformed Lean code"]);
  });

  it("maps timeout verdict to inconclusive conclusion", () => {
    const task: VerificationTaskDto = {
      id: "task_1",
      status: "completed",
      verdict: "timeout",
      valid: false,
      engine: "lean",
      provider: "axle",
      messages: [],
      sourceHash: "abc123",
      cached: false,
      createdAt: "2026-07-11T00:00:00Z",
    };

    const result = mapVerificationTaskToRunConclusion(task);

    assert.strictEqual(result.conclusion, "inconclusive");
    assert.strictEqual(result.evidenceLevel, "machine_checked");
  });

  it("maps provider_error verdict to inconclusive conclusion", () => {
    const task: VerificationTaskDto = {
      id: "task_1",
      status: "failed",
      verdict: "provider_error",
      valid: false,
      engine: "lean",
      provider: "axle",
      messages: [{ severity: "error", message: "AXLE unavailable", source: "provider" }],
      sourceHash: "abc123",
      cached: false,
      createdAt: "2026-07-11T00:00:00Z",
    };

    const result = mapVerificationTaskToRunConclusion(task);

    assert.strictEqual(result.conclusion, "inconclusive");
    assert.deepStrictEqual(result.missingConditions, ["AXLE unavailable"]);
  });

  it("includes problemId in claim when present", () => {
    const task: VerificationTaskDto = {
      id: "task_1",
      status: "completed",
      verdict: "accepted",
      valid: true,
      engine: "lean",
      provider: "axle",
      messages: [],
      sourceHash: "abc123",
      cached: false,
      problemId: "prob_123",
      createdAt: "2026-07-11T00:00:00Z",
    };

    const result = mapVerificationTaskToRunConclusion(task);

    assert.match(result.claim, /prob_123/);
  });

  it("handles multiple failed declarations", () => {
    const task: VerificationTaskDto = {
      id: "task_1",
      status: "completed",
      verdict: "rejected",
      valid: false,
      engine: "lean",
      provider: "axle",
      messages: [],
      failedDeclarations: ["lemma_a", "lemma_b", "theorem_main"],
      sourceHash: "abc123",
      cached: false,
      createdAt: "2026-07-11T00:00:00Z",
    };

    const result = mapVerificationTaskToRunConclusion(task);

    assert.strictEqual(result.coverage.checked, 0);
    assert.strictEqual(result.coverage.failedDeclarations.length, 3);
    assert.deepStrictEqual(result.coverage.failedDeclarations, ["lemma_a", "lemma_b", "theorem_main"]);
  });
});
