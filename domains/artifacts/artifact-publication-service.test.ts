// Tests for the publication gate: moderator-only, existence-masking for
// non-moderators, idempotent replay, and validation failures surfaced as
// structured results instead of thrown errors.
import { describe, it } from "node:test";
import assert from "node:assert";
import { ArtifactPublicationService } from "./artifact-publication-service";
import type { ArtifactRepository } from "./artifact-repository";
import type { ArtifactRecord } from "@/contracts/artifact";
import type { Actor } from "@/contracts/capability";

const moderator: Actor = { userId: "mod-1", role: "moderator" };
const owner: Actor = { userId: "user-1", role: "authenticated" };

function draftArtifact(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
    id: "artifact-1",
    kind: "verification_report",
    schemaVersion: 1,
    runId: "run-1",
    providerKey: "axle",
    producerVersion: null,
    status: "draft",
    payload: { conclusion: "verified" },
    summary: "Lean proof accepted",
    isPublic: false,
    createdBy: "user-1",
    createdAt: "2026-07-11T00:00:00Z",
    publishedAt: null,
    publishedBy: null,
    ...overrides,
  } as ArtifactRecord;
}

class FakeRepo implements ArtifactRepository {
  constructor(
    private artifact: ArtifactRecord | null,
    private publishError: string | null = null,
  ) {}
  publishCalls = 0;

  async createBundle(): Promise<never> { throw new Error("not used"); }
  async findById() { return this.artifact; }
  async findByRunId() { return this.artifact ? [this.artifact] : []; }
  async findEvidenceByArtifactId() { return []; }
  async getByIdInternal() { return this.artifact; }
  async publish(_id: string, publishedBy: string): Promise<ArtifactRecord> {
    this.publishCalls++;
    if (this.publishError) throw new Error(this.publishError);
    this.artifact = { ...this.artifact!, status: "published", isPublic: true, publishedAt: new Date().toISOString(), publishedBy };
    return this.artifact;
  }
}

describe("ArtifactPublicationService", () => {
  it("a moderator publishes a draft: status/isPublic/publishedBy flip", async () => {
    const repo = new FakeRepo(draftArtifact());
    const service = new ArtifactPublicationService(repo);
    const result = await service.publish("artifact-1", moderator);
    assert.ok(result.ok);
    assert.strictEqual(result.artifact.status, "published");
    assert.strictEqual(result.artifact.isPublic, true);
    assert.strictEqual(result.artifact.publishedBy, "mod-1");
    assert.ok(result.artifact.publishedAt);
  });

  it("a non-moderator (even the owner) gets not_found — no probing, no publish call", async () => {
    const repo = new FakeRepo(draftArtifact());
    const service = new ArtifactPublicationService(repo);
    const result = await service.publish("artifact-1", owner);
    assert.ok(!result.ok);
    assert.strictEqual(result.reason, "not_found");
    assert.strictEqual(repo.publishCalls, 0);
  });

  it("a missing artifact is not_found for a moderator too", async () => {
    const service = new ArtifactPublicationService(new FakeRepo(null));
    const result = await service.publish("nope", moderator);
    assert.ok(!result.ok);
    assert.strictEqual(result.reason, "not_found");
  });

  it("publishing an already-published artifact is idempotent and does not re-publish", async () => {
    const repo = new FakeRepo(draftArtifact({ status: "published", isPublic: true, publishedAt: "2026-07-10T00:00:00Z", publishedBy: "mod-0" }));
    const service = new ArtifactPublicationService(repo);
    const result = await service.publish("artifact-1", moderator);
    assert.ok(result.ok);
    assert.strictEqual(result.artifact.publishedBy, "mod-0", "must keep the original publisher");
    assert.strictEqual(repo.publishCalls, 0);
  });

  it("database-side validation failure (e.g. unpublished input version) surfaces as invalid", async () => {
    const repo = new FakeRepo(draftArtifact(), "cannot publish: an input solution_version is not published");
    const service = new ArtifactPublicationService(repo);
    const result = await service.publish("artifact-1", moderator);
    assert.ok(!result.ok);
    assert.strictEqual(result.reason, "invalid");
    assert.match(result.error, /not published/);
  });
});
