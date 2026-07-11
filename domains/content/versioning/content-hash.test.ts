// Tests for content hash stability and canonicalization. Ensures that the
// same semantic content always produces the same hash regardless of key order
// or undefined values.
import { describe, it } from "node:test";
import assert from "node:assert";
import { canonicalize, computeContentHash } from "./content-hash";

describe("canonicalize", () => {
  it("sorts object keys", () => {
    const input = { z: 1, a: 2, m: 3 };
    const result = canonicalize(input);
    assert.deepStrictEqual(Object.keys(result as object), ["a", "m", "z"]);
  });

  it("removes undefined values", () => {
    const input = { a: 1, b: undefined, c: 3 };
    const result = canonicalize(input) as Record<string, unknown>;
    assert.strictEqual("b" in result, false);
    assert.strictEqual(result.a, 1);
    assert.strictEqual(result.c, 3);
  });

  it("preserves array order", () => {
    const input = [3, 1, 2];
    const result = canonicalize(input);
    assert.deepStrictEqual(result, [3, 1, 2]);
  });

  it("recursively canonicalizes nested objects", () => {
    const input = { z: { b: 2, a: 1 }, a: { y: 3, x: 2 } };
    const result = canonicalize(input) as Record<string, unknown>;
    assert.deepStrictEqual(Object.keys(result), ["a", "z"]);
    assert.deepStrictEqual(Object.keys(result.a as object), ["x", "y"]);
    assert.deepStrictEqual(Object.keys(result.z as object), ["a", "b"]);
  });

  it("handles arrays containing objects", () => {
    const input = [{ z: 1, a: 2 }, { b: 3, a: 4 }];
    const result = canonicalize(input) as Array<Record<string, unknown>>;
    assert.deepStrictEqual(Object.keys(result[0]), ["a", "z"]);
    assert.deepStrictEqual(Object.keys(result[1]), ["a", "b"]);
  });

  it("preserves null", () => {
    const input = { a: null };
    const result = canonicalize(input);
    assert.deepStrictEqual(result, { a: null });
  });

  it("handles primitives", () => {
    assert.strictEqual(canonicalize(42), 42);
    assert.strictEqual(canonicalize("hello"), "hello");
    assert.strictEqual(canonicalize(true), true);
    assert.strictEqual(canonicalize(null), null);
  });
});

describe("computeContentHash", () => {
  it("produces same hash for semantically identical objects with different key orders", () => {
    const obj1 = { title: "Test", tags: ["math"], answer: "42" };
    const obj2 = { answer: "42", title: "Test", tags: ["math"] };
    const hash1 = computeContentHash(obj1);
    const hash2 = computeContentHash(obj2);
    assert.strictEqual(hash1, hash2);
  });

  it("produces different hashes for different content", () => {
    const obj1 = { title: "Test A" };
    const obj2 = { title: "Test B" };
    const hash1 = computeContentHash(obj1);
    const hash2 = computeContentHash(obj2);
    assert.notStrictEqual(hash1, hash2);
  });

  it("treats undefined-absent and undefined-present keys identically", () => {
    const obj1 = { title: "Test" };
    const obj2 = { title: "Test", extra: undefined };
    const hash1 = computeContentHash(obj1);
    const hash2 = computeContentHash(obj2);
    assert.strictEqual(hash1, hash2);
  });

  it("produces stable hashes across multiple calls", () => {
    const obj = { a: 1, b: [2, 3], c: { d: 4 } };
    const hash1 = computeContentHash(obj);
    const hash2 = computeContentHash(obj);
    const hash3 = computeContentHash(JSON.parse(JSON.stringify(obj)));
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1, hash3);
  });

  it("returns a 64-character hex string (SHA-256)", () => {
    const hash = computeContentHash({ test: true });
    assert.strictEqual(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it("handles arrays with different elements producing different hashes", () => {
    const obj1 = { tags: ["math", "proof"] };
    const obj2 = { tags: ["proof", "math"] };
    const hash1 = computeContentHash(obj1);
    const hash2 = computeContentHash(obj2);
    assert.notStrictEqual(hash1, hash2);
  });
});
