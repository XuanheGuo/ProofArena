// Tests for evidence and artifact contract assertions (provider_trace privacy,
// published-before-public constraint).
import { describe, it } from "node:test";
import assert from "node:assert";
import { assertProviderTraceStaysPrivate } from "@/contracts/evidence";
import { assertPublishedBeforePublic } from "@/contracts/artifact";

describe("assertProviderTraceStaysPrivate", () => {
  it("throws when provider_trace is marked public", () => {
    assert.throws(
      () => assertProviderTraceStaysPrivate("provider_trace", true),
      /provider_trace evidence must never be marked public/
    );
  });

  it("allows provider_trace when isPublic=false", () => {
    assert.doesNotThrow(() => assertProviderTraceStaysPrivate("provider_trace", false));
  });

  it("allows other evidence kinds to be public", () => {
    assert.doesNotThrow(() => assertProviderTraceStaysPrivate("lean_proof", true));
    assert.doesNotThrow(() => assertProviderTraceStaysPrivate("symbolic_check", true));
    assert.doesNotThrow(() => assertProviderTraceStaysPrivate("numerical_counterexample", true));
  });

  it("allows other evidence kinds to be private", () => {
    assert.doesNotThrow(() => assertProviderTraceStaysPrivate("lean_proof", false));
    assert.doesNotThrow(() => assertProviderTraceStaysPrivate("manual_review", false));
  });
});

describe("assertPublishedBeforePublic", () => {
  it("throws when artifact is public but status is draft", () => {
    assert.throws(
      () => assertPublishedBeforePublic("draft", true),
      /an artifact must be status=published before it can be is_public/
    );
  });

  it("allows public artifact when status is published", () => {
    assert.doesNotThrow(() => assertPublishedBeforePublic("published", true));
  });

  it("allows draft artifact when isPublic=false", () => {
    assert.doesNotThrow(() => assertPublishedBeforePublic("draft", false));
  });

  it("allows published artifact when isPublic=false", () => {
    assert.doesNotThrow(() => assertPublishedBeforePublic("published", false));
  });
});
