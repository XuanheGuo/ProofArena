// Runtime test for capability registry construction. This test actually executes
// buildDefaultRegistry() to ensure adapter keys match definition keys.
import { describe, it } from "node:test";
import assert from "node:assert";
import { buildDefaultRegistry } from "./default-registry";

describe("Capability Registry Runtime", () => {
  it("buildDefaultRegistry() constructs without throwing", () => {
    assert.doesNotThrow(() => {
      const registry = buildDefaultRegistry();
      assert.ok(registry, "registry should exist");
    });
  });

  it("registry has verify.lean capability", () => {
    const registry = buildDefaultRegistry();
    assert.strictEqual(registry.has("verify.lean"), true, "registry should have verify.lean");
  });

  it("registry adapter key matches definition key", () => {
    const registry = buildDefaultRegistry();
    const registered = registry.get("verify.lean");

    assert.ok(registered, "verify.lean should be registered");
    assert.strictEqual(registered.definition.key, "verify.lean");
    assert.strictEqual(registered.adapter.capabilityKey, "verify.lean");
  });

  it("registry returns all registered keys", () => {
    const registry = buildDefaultRegistry();
    const keys = registry.keys();

    assert.ok(Array.isArray(keys), "keys() should return array");
    assert.ok(keys.includes("verify.lean"), "keys should include verify.lean");
  });
});
