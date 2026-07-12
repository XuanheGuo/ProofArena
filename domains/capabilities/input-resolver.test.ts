// Unit tests for the server-side input resolver — the boundary that makes a
// version-bound artifact's `verifies` claim honest. Exercises every branch
// with an in-memory VersionReader; no Supabase required.
import { describe, it } from "node:test";
import assert from "node:assert";
import { createHash } from "node:crypto";
import {
  CapabilityInputResolver,
  InputResolutionError,
  MAX_AD_HOC_SOURCE_LENGTH,
  extractLeanSource,
  type SolutionVersionRow,
  type VersionReader,
} from "./input-resolver";
import type { Actor, CapabilityRunInputRef } from "@/contracts/capability";

const LEAN = "theorem t : 1 + 1 = 2 := rfl";
const VERSION_ID = "11111111-2222-4333-8444-555555555555";
const OTHER_VERSION_ID = "99999999-8888-4777-8666-555555555555";

const owner: Actor = { userId: "user-owner" };
const stranger: Actor = { userId: "user-stranger" };
const moderator: Actor = { userId: "user-mod", role: "moderator" };

function versionRow(overrides: Partial<SolutionVersionRow> = {}): SolutionVersionRow {
  return {
    id: VERSION_ID,
    solutionId: "sol-1",
    content: { formalProofs: { lean: { source: LEAN } } },
    contentHash: "a".repeat(64),
    publishedAt: "2026-07-01T00:00:00Z",
    createdBy: "user-owner",
    ...overrides,
  };
}

function readerWith(rows: SolutionVersionRow[]): VersionReader {
  return {
    async getSolutionVersion(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
  };
}

function versionBoundInput(overrides: Partial<CapabilityRunInputRef> = {}): CapabilityRunInputRef {
  return { objectType: "solution_version", objectId: "sol-1", versionId: VERSION_ID, role: "proof_source", ...overrides };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof InputResolutionError, `expected InputResolutionError, got ${String(err)}`);
    assert.strictEqual(err.code, code);
    return true;
  });
}

describe("extractLeanSource", () => {
  it("reads formalProofs.lean.source and nothing else", () => {
    assert.strictEqual(extractLeanSource({ formalProofs: { lean: { source: LEAN } } }), LEAN);
    assert.strictEqual(extractLeanSource({ leanSource: LEAN }), null);
    assert.strictEqual(extractLeanSource({ proof: LEAN }), null);
    assert.strictEqual(extractLeanSource({ formalProofs: { lean: { source: "   " } } }), null);
    assert.strictEqual(extractLeanSource(null), null);
    assert.strictEqual(extractLeanSource("theorem"), null);
  });
});

describe("version-bound resolution", () => {
  it("resolves the stored version's Lean source, never client text", async () => {
    const resolver = new CapabilityInputResolver(readerWith([versionRow()]));
    const [resolved] = await resolver.resolve(owner, [versionBoundInput()]);

    assert.strictEqual(resolved.objectType, "solution_version");
    assert.strictEqual(resolved.objectId, "sol-1");
    assert.strictEqual(resolved.versionId, VERSION_ID);
    assert.strictEqual(resolved.source, LEAN);
    assert.strictEqual(resolved.contentHash, createHash("sha256").update(LEAN, "utf8").digest("hex"));
    assert.strictEqual(resolved.snapshot.mode, "version_bound");
    assert.strictEqual(resolved.snapshot.source, LEAN);
  });

  it("rejects client-supplied value on a version-bound input (forgery vector)", async () => {
    const resolver = new CapabilityInputResolver(readerWith([versionRow()]));
    await expectCode(resolver.resolve(owner, [versionBoundInput({ value: "theorem forged : False := sorry" })]), "CLIENT_CONTENT_REJECTED");
    await expectCode(resolver.resolve(owner, [versionBoundInput({ contentHash: "b".repeat(64) })]), "CLIENT_CONTENT_REJECTED");
    await expectCode(resolver.resolve(owner, [versionBoundInput({ snapshot: { fake: true } })]), "CLIENT_CONTENT_REJECTED");
  });

  it("requires objectId and a UUID versionId", async () => {
    const resolver = new CapabilityInputResolver(readerWith([versionRow()]));
    await expectCode(resolver.resolve(owner, [versionBoundInput({ objectId: undefined })]), "MISSING_OBJECT_ID");
    await expectCode(resolver.resolve(owner, [versionBoundInput({ versionId: undefined })]), "MISSING_VERSION_ID");
    await expectCode(resolver.resolve(owner, [versionBoundInput({ versionId: "not-a-uuid" })]), "INVALID_VERSION_ID");
  });

  it("rejects a version that does not exist", async () => {
    const resolver = new CapabilityInputResolver(readerWith([]));
    await expectCode(resolver.resolve(owner, [versionBoundInput()]), "VERSION_NOT_FOUND");
  });

  it("rejects a version that belongs to a different solution", async () => {
    const resolver = new CapabilityInputResolver(readerWith([versionRow({ solutionId: "sol-other" })]));
    await expectCode(resolver.resolve(owner, [versionBoundInput()]), "VERSION_MISMATCH");
  });

  it("hides an unpublished version from non-owners as NOT_FOUND (no existence leak)", async () => {
    const resolver = new CapabilityInputResolver(readerWith([versionRow({ publishedAt: null })]));
    await expectCode(resolver.resolve(stranger, [versionBoundInput()]), "VERSION_NOT_FOUND");
  });

  it("lets the creator and moderators use an unpublished version", async () => {
    const resolver = new CapabilityInputResolver(readerWith([versionRow({ publishedAt: null })]));
    const [asOwner] = await resolver.resolve(owner, [versionBoundInput()]);
    assert.strictEqual(asOwner.source, LEAN);
    const [asMod] = await resolver.resolve(moderator, [versionBoundInput()]);
    assert.strictEqual(asMod.source, LEAN);
  });

  it("returns VERSION_HAS_NO_LEAN_SOURCE for a version without a formal proof", async () => {
    const resolver = new CapabilityInputResolver(readerWith([versionRow({ content: { proof: "informal words" } })]));
    await expectCode(resolver.resolve(owner, [versionBoundInput()]), "VERSION_HAS_NO_LEAN_SOURCE");
  });
});

describe("ad-hoc resolution", () => {
  it("accepts a plain source and produces hash + snapshot with no version claim", async () => {
    const resolver = new CapabilityInputResolver(readerWith([]));
    const [resolved] = await resolver.resolve(stranger, [
      { objectType: "ad_hoc_source", role: "proof_source", value: LEAN },
    ]);
    assert.strictEqual(resolved.objectType, "ad_hoc_source");
    assert.strictEqual(resolved.objectId, null);
    assert.strictEqual(resolved.versionId, null);
    assert.strictEqual(resolved.source, LEAN);
    assert.strictEqual(resolved.contentHash, createHash("sha256").update(LEAN, "utf8").digest("hex"));
    assert.strictEqual(resolved.snapshot.mode, "ad_hoc");
  });

  it("rejects an ad-hoc input that claims an objectId or versionId", async () => {
    const resolver = new CapabilityInputResolver(readerWith([]));
    await expectCode(
      resolver.resolve(stranger, [{ objectType: "ad_hoc_source", objectId: "sol-1", role: "proof_source", value: LEAN }]),
      "AD_HOC_MUST_NOT_REFERENCE",
    );
    await expectCode(
      resolver.resolve(stranger, [{ objectType: "ad_hoc_source", versionId: OTHER_VERSION_ID, role: "proof_source", value: LEAN }]),
      "AD_HOC_MUST_NOT_REFERENCE",
    );
  });

  it("rejects missing, empty, and oversized sources", async () => {
    const resolver = new CapabilityInputResolver(readerWith([]));
    await expectCode(resolver.resolve(stranger, [{ objectType: "ad_hoc_source", role: "proof_source" }]), "MISSING_SOURCE");
    await expectCode(resolver.resolve(stranger, [{ objectType: "ad_hoc_source", role: "proof_source", value: "   " }]), "MISSING_SOURCE");
    await expectCode(
      resolver.resolve(stranger, [{ objectType: "ad_hoc_source", role: "proof_source", value: "x".repeat(MAX_AD_HOC_SOURCE_LENGTH + 1) }]),
      "SOURCE_TOO_LARGE",
    );
  });
});

describe("mode boundary", () => {
  it("rejects the legacy vague objectType shapes entirely", async () => {
    const resolver = new CapabilityInputResolver(readerWith([versionRow()]));
    for (const objectType of ["solution", "problem", "submission", "problem_version"] as const) {
      await expectCode(
        resolver.resolve(owner, [{ objectType, objectId: "sol-1", role: "proof_source", value: LEAN }]),
        "UNSUPPORTED_OBJECT_TYPE",
      );
    }
  });

  it("caps the number of inputs per run", async () => {
    const resolver = new CapabilityInputResolver(readerWith([]));
    const many = Array.from({ length: 9 }, () => ({ objectType: "ad_hoc_source" as const, role: "proof_source", value: LEAN }));
    await expectCode(resolver.resolve(stranger, many), "TOO_MANY_INPUTS");
  });
});
