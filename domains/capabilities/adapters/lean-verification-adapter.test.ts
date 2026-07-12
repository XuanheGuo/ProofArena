// Tests the REAL exported VerificationTaskDto -> RunConclusion mapping (the
// mathematical-semantics contract), not a local copy of it: a rejected Lean
// proof is inconclusive-about-the-statement, never refuted.
import { describe, it } from "node:test";
import assert from "node:assert";
import type { VerificationTaskDto } from "@/verification/domain/types";
import { mapVerificationTaskToRunConclusion } from "./lean-verification-adapter";

function task(overrides: Partial<VerificationTaskDto>): VerificationTaskDto {
  return {
    id: "task_1",
    status: "completed",
    verdict: "accepted",
    valid: true,
    engine: "lean",
    provider: "axle",
    messages: [],
    sourceHash: "abc123",
    cached: false,
    createdAt: "2026-07-11T00:00:00Z",
    ...overrides,
  };
}

describe("Lean verdict → RunConclusion mapping", () => {
  it("accepted → verified, full coverage, lean_proof in verifiedScope", () => {
    const result = mapVerificationTaskToRunConclusion(task({ verdict: "accepted", compiles: true }));
    assert.strictEqual(result.conclusion, "verified");
    assert.strictEqual(result.evidenceLevel, "machine_checked");
    assert.strictEqual(result.coverage.checked, 1);
    assert.strictEqual(result.coverage.total, 1);
    assert.deepStrictEqual(result.verifiedScope, ["lean_proof"]);
    assert.deepStrictEqual(result.unverifiedScope, []);
  });

  it("rejected → inconclusive (NEVER refuted): a failed proof attempt says nothing about the statement", () => {
    const result = mapVerificationTaskToRunConclusion(task({
      verdict: "rejected",
      valid: false,
      messages: [{ severity: "error", message: "type mismatch", source: "lean" }],
      failedDeclarations: ["theorem_main"],
    }));
    assert.strictEqual(result.conclusion, "inconclusive");
    assert.notStrictEqual(result.conclusion, "refuted");
    assert.strictEqual(result.coverage.checked, 0);
    assert.deepStrictEqual(result.coverage.failedDeclarations, ["theorem_main"]);
    assert.deepStrictEqual(result.verifiedScope, []);
    assert.deepStrictEqual(result.unverifiedScope, ["lean_proof"]);
    assert.deepStrictEqual(result.missingConditions, ["type mismatch"]);
  });

  it("invalid_request → unsupported", () => {
    const result = mapVerificationTaskToRunConclusion(task({
      verdict: "invalid_request",
      valid: false,
      messages: [{ severity: "error", message: "malformed Lean code", source: "proofarena" }],
    }));
    assert.strictEqual(result.conclusion, "unsupported");
    assert.deepStrictEqual(result.missingConditions, ["malformed Lean code"]);
  });

  it("timeout and provider_error → inconclusive", () => {
    assert.strictEqual(mapVerificationTaskToRunConclusion(task({ verdict: "timeout", valid: false })).conclusion, "inconclusive");
    assert.strictEqual(
      mapVerificationTaskToRunConclusion(task({ verdict: "provider_error", valid: false, status: "failed" })).conclusion,
      "inconclusive",
    );
  });

  it("version-bound claim names the solution; ad-hoc claim explicitly says ad-hoc", () => {
    const bound = mapVerificationTaskToRunConclusion(task({ solutionId: "sol_42" }));
    assert.match(bound.claim, /sol_42/);
    const adHoc = mapVerificationTaskToRunConclusion(task({}));
    assert.match(adHoc.claim, /ad-hoc/);
    assert.doesNotMatch(adHoc.claim, /solution /);
  });

  it("multiple failed declarations are all reported", () => {
    const result = mapVerificationTaskToRunConclusion(task({
      verdict: "rejected",
      valid: false,
      failedDeclarations: ["lemma_a", "lemma_b", "theorem_main"],
    }));
    assert.strictEqual(result.coverage.checked, 0);
    assert.deepStrictEqual(result.coverage.failedDeclarations, ["lemma_a", "lemma_b", "theorem_main"]);
  });
});
