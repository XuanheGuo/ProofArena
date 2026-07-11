// Tests for version repository deduplication logic. Uses an in-memory fake
// repository to avoid Supabase test setup in Phase 1.
import { describe, it } from "node:test";
import assert from "node:assert";
import { computeContentHash } from "./content-hash";
import type { VersionRepository } from "./version-repository";
import type { ContentVersionRecord, CreateVersionInput, VersionDedupResult } from "@/contracts/content";

interface TestContent {
  title: string;
  value: number;
}

class InMemoryVersionRepository implements VersionRepository<TestContent> {
  private versions: ContentVersionRecord<TestContent>[] = [];
  private nextId = 1;

  async createVersion(input: CreateVersionInput<TestContent>): Promise<VersionDedupResult<TestContent>> {
    const contentHash = computeContentHash(input.content);
    const latest = await this.getLatest(input.entityId);

    if (latest && latest.contentHash === contentHash) {
      return { created: false, version: latest, reason: "no_op_same_hash" };
    }

    const versionNumber = (latest?.versionNumber ?? 0) + 1;
    const version: ContentVersionRecord<TestContent> = {
      id: `v${this.nextId++}`,
      entityId: input.entityId,
      versionNumber,
      parentVersionId: latest?.id ?? null,
      content: input.content,
      contentHash,
      changeSummary: input.changeSummary ?? "",
      sourceSubmissionId: input.sourceSubmissionId ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: new Date().toISOString(),
      publishedAt: null,
    };

    this.versions.push(version);
    return { created: true, version, reason: "created" };
  }

  async getById(versionId: string): Promise<ContentVersionRecord<TestContent> | null> {
    return this.versions.find((v) => v.id === versionId) ?? null;
  }

  async getLatest(entityId: string): Promise<ContentVersionRecord<TestContent> | null> {
    const matching = this.versions.filter((v) => v.entityId === entityId);
    if (matching.length === 0) return null;
    return matching.reduce((latest, current) => (current.versionNumber > latest.versionNumber ? current : latest));
  }

  async setCurrentVersion(entityId: string, versionId: string): Promise<void> {
    // No-op in this in-memory implementation
  }

  async listVersions(entityId: string): Promise<ContentVersionRecord<TestContent>[]> {
    return this.versions.filter((v) => v.entityId === entityId).sort((a, b) => b.versionNumber - a.versionNumber);
  }
}

describe("VersionRepository deduplication", () => {
  it("creates first version when entity has no versions", async () => {
    const repo = new InMemoryVersionRepository();
    const result = await repo.createVersion({
      entityId: "problem_1",
      content: { title: "Test", value: 42 },
      createdBy: "user_1",
    });

    assert.strictEqual(result.created, true);
    assert.strictEqual(result.version.versionNumber, 1);
    assert.strictEqual(result.version.entityId, "problem_1");
    assert.strictEqual(result.version.parentVersionId, null);
  });

  it("creates second version when content changes", async () => {
    const repo = new InMemoryVersionRepository();
    await repo.createVersion({
      entityId: "problem_1",
      content: { title: "Test", value: 42 },
      createdBy: "user_1",
    });

    const result = await repo.createVersion({
      entityId: "problem_1",
      content: { title: "Test Updated", value: 42 },
      createdBy: "user_1",
    });

    assert.strictEqual(result.created, true);
    assert.strictEqual(result.version.versionNumber, 2);
    assert.strictEqual(result.version.content.title, "Test Updated");
  });

  it("returns no-op when content hash matches latest version", async () => {
    const repo = new InMemoryVersionRepository();
    const first = await repo.createVersion({
      entityId: "problem_1",
      content: { title: "Test", value: 42 },
      createdBy: "user_1",
    });

    const result = await repo.createVersion({
      entityId: "problem_1",
      content: { title: "Test", value: 42 },
      createdBy: "user_1",
    });

    assert.strictEqual(result.created, false);
    assert.strictEqual(result.reason, "no_op_same_hash");
    assert.strictEqual(result.version.id, first.version.id);
  });

  it("detects semantic equivalence despite key reordering", async () => {
    const repo = new InMemoryVersionRepository();
    await repo.createVersion({
      entityId: "problem_1",
      content: { title: "Test", value: 42 },
      createdBy: "user_1",
    });

    const result = await repo.createVersion({
      entityId: "problem_1",
      content: { value: 42, title: "Test" },
      createdBy: "user_1",
    });

    assert.strictEqual(result.created, false);
    assert.strictEqual(result.reason, "no_op_same_hash");
  });

  it("chains parent_version_id correctly", async () => {
    const repo = new InMemoryVersionRepository();
    const v1 = await repo.createVersion({
      entityId: "problem_1",
      content: { title: "V1", value: 1 },
      createdBy: "user_1",
    });

    const v2 = await repo.createVersion({
      entityId: "problem_1",
      content: { title: "V2", value: 2 },
      createdBy: "user_1",
    });

    const v3 = await repo.createVersion({
      entityId: "problem_1",
      content: { title: "V3", value: 3 },
      createdBy: "user_1",
    });

    assert.strictEqual(v1.version.parentVersionId, null);
    assert.strictEqual(v2.version.parentVersionId, v1.version.id);
    assert.strictEqual(v3.version.parentVersionId, v2.version.id);
  });

  it("lists versions in descending version_number order", async () => {
    const repo = new InMemoryVersionRepository();
    await repo.createVersion({ entityId: "problem_1", content: { title: "V1", value: 1 }, createdBy: "user_1" });
    await repo.createVersion({ entityId: "problem_1", content: { title: "V2", value: 2 }, createdBy: "user_1" });
    await repo.createVersion({ entityId: "problem_1", content: { title: "V3", value: 3 }, createdBy: "user_1" });

    const versions = await repo.listVersions("problem_1");
    assert.strictEqual(versions.length, 3);
    assert.strictEqual(versions[0].versionNumber, 3);
    assert.strictEqual(versions[1].versionNumber, 2);
    assert.strictEqual(versions[2].versionNumber, 1);
  });
});
