// Tests for the capability orchestrator: server-computed idempotency,
// concurrent dedup (the adapter must run exactly once), verifies-relation
// construction, projection-failure isolation, and no-reexecution repair.
// All in-memory fakes; the fake run repository reproduces the unique-index
// semantics of migration 030 so races are exercised for real.
import { describe, it } from "node:test";
import assert from "node:assert";
import { CapabilityService, IdempotencyConflictError } from "./capability-service";
import { CapabilityRegistry } from "./registry";
import { CapabilityInputResolver, type SolutionVersionRow, type VersionReader } from "./input-resolver";
import {
  DuplicateRunError,
  type CapabilityRunRepository,
  type CreateRunWithInputsInput,
  type FinishRunInput,
  type StoredRunInput,
} from "./capability-run-repository";
import {
  ArtifactAlreadyProjectedError,
  type ArtifactRepository,
  type CreateArtifactBundleInput,
} from "@/domains/artifacts/artifact-repository";
import type { Actor, CapabilityDefinition, CapabilityRunRecord, ProjectionStatus } from "@/contracts/capability";
import type { ArtifactKind, ArtifactRecord } from "@/contracts/artifact";
import type { CapabilityAdapter, CapabilityAdapterResult } from "@/platform/providers/provider-adapter";

const LEAN = "theorem t : 1 + 1 = 2 := rfl";
const VERSION_ID = "11111111-2222-4333-8444-555555555555";
const actor: Actor = { userId: "user-1" };

// ── In-memory repositories reproducing the DB invariants ────────────────────

class FakeRunRepository implements CapabilityRunRepository {
  runs = new Map<string, CapabilityRunRecord>();
  inputsByRun = new Map<string, StoredRunInput[]>();
  private seq = 0;

  async createWithInputs(input: CreateRunWithInputsInput): Promise<CapabilityRunRecord> {
    // Unique index semantics: (requested_by, capability_key, idempotency_key)
    for (const run of this.runs.values()) {
      if (run.requestedBy === input.requestedBy && run.capabilityKey === input.capabilityKey && run.idempotencyKey === input.idempotencyKey) {
        throw new DuplicateRunError(input.idempotencyKey);
      }
    }
    const run: CapabilityRunRecord = {
      id: `run-${++this.seq}`,
      capabilityKey: input.capabilityKey,
      providerKey: input.providerKey,
      requestedBy: input.requestedBy,
      status: "queued",
      configuration: input.configuration,
      inputHash: input.inputHash,
      idempotencyKey: input.idempotencyKey,
      legacyVerificationTaskId: null,
      errorCode: null,
      errorMessage: null,
      costMetadata: {},
      projectionStatus: "pending",
      projectionError: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.runs.set(run.id, run);
    this.inputsByRun.set(
      run.id,
      input.inputs.map((inp) => ({
        objectType: inp.objectType,
        objectId: inp.objectId ?? "",
        versionId: inp.versionId,
        role: inp.role,
        contentHash: inp.contentHash,
      })),
    );
    return { ...run };
  }

  async findByIdempotencyKey(requestedBy: string, capabilityKey: string, idempotencyKey: string) {
    for (const run of this.runs.values()) {
      if (run.requestedBy === requestedBy && run.capabilityKey === capabilityKey && run.idempotencyKey === idempotencyKey) {
        return { ...run };
      }
    }
    return null;
  }

  async markRunning(id: string) {
    const run = this.runs.get(id)!;
    run.status = "running";
    run.startedAt = new Date().toISOString();
  }

  async finish(id: string, result: FinishRunInput) {
    const run = this.runs.get(id)!;
    run.status = result.status;
    run.errorCode = result.errorCode ?? null;
    run.errorMessage = result.errorMessage ?? null;
    run.legacyVerificationTaskId = result.legacyVerificationTaskId ?? null;
    run.completedAt = new Date().toISOString();
    return { ...run };
  }

  async setProjectionStatus(id: string, status: ProjectionStatus, error?: string | null) {
    const run = this.runs.get(id)!;
    run.projectionStatus = status;
    run.projectionError = error ?? null;
  }

  async getInputs(runId: string) {
    return this.inputsByRun.get(runId) ?? [];
  }

  async getById(id: string) {
    const run = this.runs.get(id);
    return run ? { ...run } : null;
  }

  async list() {
    return Array.from(this.runs.values()).map((r) => ({ ...r }));
  }
}

interface StoredBundle {
  artifact: ArtifactRecord;
  relations: CreateArtifactBundleInput["relations"];
  evidence: CreateArtifactBundleInput["evidence"];
}

class FakeArtifactRepository implements ArtifactRepository {
  bundles: StoredBundle[] = [];
  failNextCreates = 0;
  private seq = 0;

  async createBundle<K extends ArtifactKind>(input: CreateArtifactBundleInput<K>): Promise<ArtifactRecord<K>> {
    if (this.failNextCreates > 0) {
      this.failNextCreates--;
      throw new Error("simulated bundle write failure");
    }
    // Unique index semantics: one artifact per (run, kind, schema_version)
    if (this.bundles.some((b) => b.artifact.runId === input.runId && b.artifact.kind === input.kind && b.artifact.schemaVersion === input.schemaVersion)) {
      throw new ArtifactAlreadyProjectedError(input.runId);
    }
    // Ad-hoc honesty rule from create_artifact_bundle SQL
    for (const rel of input.relations) {
      if (rel.relation === "verifies" && !rel.targetId) {
        throw new Error("verifies relation without target");
      }
    }
    const artifact: ArtifactRecord<K> = {
      id: `artifact-${++this.seq}`,
      kind: input.kind,
      schemaVersion: input.schemaVersion,
      runId: input.runId,
      providerKey: input.providerKey,
      producerVersion: input.producerVersion ?? null,
      status: "draft",
      payload: input.payload as ArtifactRecord<K>["payload"],
      summary: input.summary,
      isPublic: false,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
      publishedAt: null,
      publishedBy: null,
    };
    this.bundles.push({ artifact, relations: input.relations, evidence: input.evidence });
    return artifact;
  }

  async publish(artifactId: string, publishedBy: string): Promise<ArtifactRecord> {
    const bundle = this.bundles.find((b) => b.artifact.id === artifactId);
    if (!bundle) throw new Error("artifact not found");
    bundle.artifact = { ...bundle.artifact, status: "published", isPublic: true, publishedAt: new Date().toISOString(), publishedBy };
    return bundle.artifact;
  }

  async findById(id: string) {
    return this.bundles.find((b) => b.artifact.id === id)?.artifact ?? null;
  }

  async findByRunId(runId: string) {
    return this.bundles.filter((b) => b.artifact.runId === runId).map((b) => b.artifact);
  }

  async findEvidenceByArtifactId() {
    return [];
  }

  async getByIdInternal(id: string) {
    return this.findById(id);
  }
}

class CountingAdapter implements CapabilityAdapter {
  readonly capabilityKey = "verify.lean";
  runCalls = 0;
  reprojectCalls = 0;
  result: CapabilityAdapterResult = {
    status: "succeeded",
    providerKey: "axle",
    artifactPayload: { conclusion: "verified" },
    summary: "Lean proof accepted",
    legacyTaskId: "task-1",
    evidence: [{ kind: "provider_trace", payload: { secret: true }, isPublic: false }],
  };
  /** Optional gate so a test can hold ALL concurrent calls inside run(). */
  gate: Promise<void> | null = null;

  async run(): Promise<CapabilityAdapterResult> {
    this.runCalls++;
    if (this.gate) await this.gate;
    return this.result;
  }

  async reproject(): Promise<CapabilityAdapterResult | null> {
    this.reprojectCalls++;
    return this.result;
  }
}

const DEFINITION: CapabilityDefinition = {
  key: "verify.lean",
  version: 1,
  acceptedInputTypes: ["solution_version", "ad_hoc_source"],
  outputArtifactKind: "verification_report",
  providerKey: "axle",
  permissionPolicy: () => true,
  retryPolicy: { maxAttempts: 3 },
};

function publishedVersionReader(): VersionReader {
  const row: SolutionVersionRow = {
    id: VERSION_ID,
    solutionId: "sol-1",
    content: { formalProofs: { lean: { source: LEAN } } },
    contentHash: "a".repeat(64),
    publishedAt: "2026-07-01T00:00:00Z",
    createdBy: "user-1",
  };
  return { async getSolutionVersion(id) { return id === VERSION_ID ? row : null; } };
}

function build() {
  const runs = new FakeRunRepository();
  const artifacts = new FakeArtifactRepository();
  const adapter = new CountingAdapter();
  const registry = new CapabilityRegistry();
  registry.register(DEFINITION, adapter);
  const service = new CapabilityService({
    registry,
    runRepository: runs,
    artifactRepository: artifacts,
    inputResolver: new CapabilityInputResolver(publishedVersionReader()),
  });
  return { service, runs, artifacts, adapter };
}

const adHocRequest = {
  capabilityKey: "verify.lean",
  inputs: [{ objectType: "ad_hoc_source" as const, role: "proof_source", value: LEAN }],
};

const versionBoundRequest = {
  capabilityKey: "verify.lean",
  inputs: [{ objectType: "solution_version" as const, objectId: "sol-1", versionId: VERSION_ID, role: "proof_source" }],
};

describe("CapabilityService idempotency", () => {
  it("computes a server-side key: identical sequential requests share one run and one adapter call", async () => {
    const { service, adapter, runs } = build();
    const first = await service.execute(actor, adHocRequest);
    const second = await service.execute(actor, adHocRequest);
    assert.strictEqual(first.id, second.id);
    assert.strictEqual(adapter.runCalls, 1);
    assert.strictEqual(runs.runs.size, 1);
  });

  it("different sources produce different runs", async () => {
    const { service, adapter } = build();
    const first = await service.execute(actor, adHocRequest);
    const second = await service.execute(actor, {
      capabilityKey: "verify.lean",
      inputs: [{ objectType: "ad_hoc_source" as const, role: "proof_source", value: "theorem other : True := trivial" }],
    });
    assert.notStrictEqual(first.id, second.id);
    assert.strictEqual(adapter.runCalls, 2);
  });

  it("the same content under different users does NOT collide", async () => {
    const { service, adapter } = build();
    const first = await service.execute(actor, adHocRequest);
    const second = await service.execute({ userId: "user-2" }, adHocRequest);
    assert.notStrictEqual(first.id, second.id);
    assert.strictEqual(adapter.runCalls, 2);
  });

  it("a client key replayed with DIFFERENT inputs is a 409-style conflict, not a silent replay", async () => {
    const { service } = build();
    await service.execute(actor, { ...adHocRequest, idempotencyKey: "my-key" });
    await assert.rejects(
      service.execute(actor, {
        capabilityKey: "verify.lean",
        idempotencyKey: "my-key",
        inputs: [{ objectType: "ad_hoc_source" as const, role: "proof_source", value: "theorem different : True := trivial" }],
      }),
      IdempotencyConflictError,
    );
  });

  it("concurrent identical requests: one run, one adapter call, one artifact, same run returned to all", async () => {
    const { service, adapter, runs, artifacts } = build();
    let release!: () => void;
    adapter.gate = new Promise((resolve) => { release = resolve; });

    const attempts = [1, 2, 3, 4, 5].map(() => service.execute(actor, adHocRequest));
    // Let the first call reach the adapter, then release everyone.
    setTimeout(release, 20);
    const results = await Promise.all(attempts);

    const ids = new Set(results.map((r) => r.id));
    assert.strictEqual(ids.size, 1, "all callers must observe the same logical run");
    assert.strictEqual(adapter.runCalls, 1, "the provider must execute exactly once");
    assert.strictEqual(runs.runs.size, 1);
    assert.strictEqual(artifacts.bundles.length, 1);
  });
});

describe("CapabilityService relations", () => {
  it("version-bound run produces verifies -> solution_version on the exact version", async () => {
    const { service, artifacts } = build();
    await service.execute(actor, versionBoundRequest);
    assert.strictEqual(artifacts.bundles.length, 1);
    const relations = artifacts.bundles[0].relations;
    assert.deepStrictEqual(relations, [{ relation: "verifies", targetType: "solution_version", targetId: VERSION_ID }]);
  });

  it("ad-hoc run produces NO verifies relation", async () => {
    const { service, artifacts } = build();
    await service.execute(actor, adHocRequest);
    assert.strictEqual(artifacts.bundles.length, 1);
    assert.deepStrictEqual(artifacts.bundles[0].relations, []);
  });

  it("artifacts are always created as private drafts", async () => {
    const { service, artifacts } = build();
    await service.execute(actor, adHocRequest);
    const artifact = artifacts.bundles[0].artifact;
    assert.strictEqual(artifact.status, "draft");
    assert.strictEqual(artifact.isPublic, false);
  });
});

describe("CapabilityService projection failure and repair", () => {
  it("a failed bundle write leaves the run succeeded with projectionStatus=failed", async () => {
    const { service, artifacts, runs } = build();
    artifacts.failNextCreates = 1;
    const run = await service.execute(actor, adHocRequest);
    assert.strictEqual(run.status, "succeeded", "provider execution result must not be rewritten");
    assert.strictEqual(run.projectionStatus, "failed");
    assert.match(run.projectionError ?? "", /simulated bundle write failure/);
    assert.strictEqual(runs.runs.get(run.id)!.status, "succeeded");
  });

  it("repairProjection rebuilds the artifact WITHOUT re-executing the provider", async () => {
    const { service, artifacts, adapter } = build();
    artifacts.failNextCreates = 1;
    const broken = await service.execute(actor, adHocRequest);
    assert.strictEqual(artifacts.bundles.length, 0);

    const repaired = await service.repairProjection(broken.id, actor);
    assert.strictEqual(repaired.projectionStatus, "completed");
    assert.strictEqual(artifacts.bundles.length, 1);
    assert.strictEqual(adapter.runCalls, 1, "repair must NOT call the provider again");
    assert.strictEqual(adapter.reprojectCalls, 1);
  });

  it("repair rebuilds version-bound relations from the stored inputs", async () => {
    const { service, artifacts } = build();
    artifacts.failNextCreates = 1;
    const broken = await service.execute(actor, versionBoundRequest);
    await service.repairProjection(broken.id, actor);
    assert.deepStrictEqual(artifacts.bundles[0].relations, [
      { relation: "verifies", targetType: "solution_version", targetId: VERSION_ID },
    ]);
  });

  it("repeated repair is idempotent — no duplicate artifact", async () => {
    const { service, artifacts } = build();
    artifacts.failNextCreates = 1;
    const broken = await service.execute(actor, adHocRequest);
    await service.repairProjection(broken.id, actor);
    await service.repairProjection(broken.id, actor);
    assert.strictEqual(artifacts.bundles.length, 1);
  });

  it("repair refuses runs that did not succeed", async () => {
    const { service, adapter } = build();
    adapter.result = { status: "failed", providerKey: "axle", errorCode: "X", errorMessage: "boom" };
    const run = await service.execute(actor, adHocRequest);
    assert.strictEqual(run.status, "failed");
    await assert.rejects(service.repairProjection(run.id, actor), /Cannot repair/);
  });
});

describe("CapabilityService non-success paths", () => {
  it("a non-succeeded adapter result produces no artifact and projectionStatus=not_applicable", async () => {
    const { service, artifacts, adapter } = build();
    adapter.result = { status: "timed_out", providerKey: "axle", errorMessage: "deadline" };
    const run = await service.execute(actor, adHocRequest);
    assert.strictEqual(run.status, "timed_out");
    assert.strictEqual(run.projectionStatus, "not_applicable");
    assert.strictEqual(artifacts.bundles.length, 0);
  });

  it("rejects input types the capability does not accept", async () => {
    const { service } = build();
    await assert.rejects(
      service.execute(actor, {
        capabilityKey: "verify.lean",
        inputs: [{ objectType: "solution" as const, objectId: "sol-1", role: "proof_source", value: LEAN }],
      }),
      /UNSUPPORTED_OBJECT_TYPE|not accepted/,
    );
  });
});
