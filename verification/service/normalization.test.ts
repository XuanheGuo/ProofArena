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

test("precheck ignores 'sorry' inside an identifier and still flags a namespaced axiom", () => {
  assert.deepEqual(leanStaticPrecheck("theorem sorryNotUsed : True := by\n  trivial"), []);
  const result = leanStaticPrecheck("namespace Foo\naxiom hidden : False\nend Foo");
  assert.deepEqual(result.map((item) => item.code), ["LEAN_POLICY_AXIOM"]);
});

test("an ordinary primed Mathlib-style identifier does not blind the scanner to a later sorry", () => {
  const source = "theorem mul_left_cancel' (a b c : Nat) (h : a * b = a * c) : b = c := by\n  sorry\n";
  const result = leanStaticPrecheck(source);
  assert.deepEqual(result.map((item) => item.code), ["LEAN_POLICY_SORRY"]);
});

test("multiple primed identifiers before a real sorry still detect it", () => {
  const source = [
    "theorem h' (n : Nat) : n = n := rfl",
    "theorem ne_of_gt' (a b : Nat) (h : a < b) : a ≠ b := by",
    "  sorry",
  ].join("\n");
  assert.deepEqual(leanStaticPrecheck(source).map((item) => item.code), ["LEAN_POLICY_SORRY"]);
});
