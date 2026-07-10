import assert from "node:assert/strict";
import test from "node:test";
import { createSourceHash, leanStaticPrecheck, stableStringify } from "./normalization";

test("stableStringify and source hash are deterministic", () => {
  assert.equal(stableStringify({ b: 1, a: { d: 2, c: 3 } }), stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
  const base = { source: "theorem x : True := trivial", engine: "lean" as const, provider: "axle" as const, environment: "lean-4.28.0" };
  assert.equal(createSourceHash(base), createSourceHash(base));
  assert.notEqual(createSourceHash(base), createSourceHash({ ...base, environment: "lean-4.27.0" }));
});

test("precheck catches forbidden Lean tokens with positions", () => {
  const result = leanStaticPrecheck("theorem x : True := by\n  sorry\naxiom bad : False");
  assert.deepEqual(result.map((item) => item.code), ["LEAN_POLICY_SORRY", "LEAN_POLICY_AXIOM"]);
  assert.equal(result[0].line, 2);
});

test("precheck ignores comments, nested comments, and strings", () => {
  assert.deepEqual(leanStaticPrecheck('-- sorry\n/- axiom /- unsafe -/ admit -/\ndef label := "sorry axiom"'), []);
});
