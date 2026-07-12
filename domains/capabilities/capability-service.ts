// Orchestrator for capability runs: resolve inputs server-side, dedupe via a
// server-computed idempotency key, create run+inputs atomically, execute the
// adapter once, project the result into an artifact bundle atomically, and —
// when the projection write fails after a successful provider execution —
// leave the run repairable instead of lying about what happened.
// See docs/ARCHITECTURE_V2.md §5, §6, §8.
import { createHash } from "node:crypto";
import type { Actor, CapabilityKey, CapabilityRunRecord, CapabilityRunRequest, ResolvedCapabilityInput } from "@/contracts/capability";
import type { ArtifactRecord } from "@/contracts/artifact";
import type { EvidenceKind } from "@/contracts/evidence";
import type { ArtifactRelationInput } from "@/contracts/references";
import { canonicalize } from "@/domains/content/versioning/content-hash";
import type { CapabilityRegistry } from "./registry";
import type { CapabilityAdapterResult } from "@/platform/providers/provider-adapter";
import { DuplicateRunError, type CapabilityRunRepository, type StoredRunInput } from "./capability-run-repository";
import { ArtifactAlreadyProjectedError, type ArtifactRepository } from "@/domains/artifacts/artifact-repository";
import type { CapabilityInputResolver } from "./input-resolver";

export interface CapabilityServiceDeps {
  registry: CapabilityRegistry;
  runRepository: CapabilityRunRepository;
  artifactRepository: ArtifactRepository;
  inputResolver: CapabilityInputResolver;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Hash over the RESOLVED inputs (canonical content hashes, not raw request
 * bodies), so two requests that resolve to the same content dedupe even if
 * the clients formatted their JSON differently. */
function computeInputHash(inputs: ResolvedCapabilityInput[]): string {
  const canonical = canonicalize(
    inputs.map((inp) => ({
      objectType: inp.objectType,
      objectId: inp.objectId,
      versionId: inp.versionId,
      role: inp.role,
      contentHash: inp.contentHash,
    })),
  );
  return sha256(JSON.stringify(canonical));
}

/**
 * Default idempotency is server-computed, never optional: capability key +
 * definition version + provider + canonical configuration + canonical input
 * hash. Scoped per-user by the unique index (requested_by is a column of it),
 * so one user's run never masks another's. A client-supplied key substitutes
 * for the default but is namespaced so it can't collide with computed keys.
 */
function computeIdempotencyKey(
  capabilityKey: string,
  definitionVersion: number,
  providerKey: string,
  configuration: Record<string, unknown>,
  inputHash: string,
  clientKey: string | undefined,
): string {
  if (clientKey) return `client:${clientKey}`;
  const configHash = sha256(JSON.stringify(canonicalize(configuration)));
  return `auto:${sha256(`${capabilityKey}:v${definitionVersion}:${providerKey}:${configHash}:${inputHash}`)}`;
}

export class IdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_INPUT";
  constructor(idempotencyKey: string) {
    super(`idempotency key "${idempotencyKey}" was already used with different inputs or configuration`);
    this.name = "IdempotencyConflictError";
  }
}

export class CapabilityService {
  constructor(private readonly deps: CapabilityServiceDeps) {}

  /**
   * Execute a capability run end-to-end:
   * 1. Registry/permission/configuration checks
   * 2. Server-side input resolution (version-bound content fetch, ad-hoc validation)
   * 3. Idempotent replay: same key + same inputs → the existing run, no provider call
   * 4. Atomic run+inputs creation (unique index absorbs concurrent duplicates)
   * 5. Adapter executes the RESOLVED sources exactly once
   * 6. Atomic artifact bundle projection; projection failure never rewrites run status
   */
  async execute(actor: Actor, request: CapabilityRunRequest, signal?: AbortSignal): Promise<CapabilityRunRecord> {
    const registered = this.deps.registry.get(request.capabilityKey);
    if (!registered) {
      throw new Error(`Unknown capability: ${request.capabilityKey}`);
    }
    const { definition, adapter } = registered;

    if (!definition.permissionPolicy(actor)) {
      throw new Error(`Permission denied for capability ${request.capabilityKey}`);
    }
    if (definition.validateConfiguration) {
      const errors = definition.validateConfiguration(request.configuration ?? {});
      if (errors.length > 0) {
        throw new Error(`Invalid configuration: ${errors.join("; ")}`);
      }
    }

    const configuration = request.configuration ?? {};
    const resolved = await this.deps.inputResolver.resolve(actor, request.inputs);

    const unsupported = resolved.filter((inp) => !definition.acceptedInputTypes.includes(inp.objectType));
    if (unsupported.length > 0) {
      throw new Error(`Invalid input types for ${request.capabilityKey}: ${unsupported.map((i) => i.objectType).join(", ")}`);
    }

    const inputHash = computeInputHash(resolved);
    const idempotencyKey = computeIdempotencyKey(
      request.capabilityKey, definition.version, definition.providerKey,
      configuration, inputHash, request.idempotencyKey,
    );

    const existing = await this.deps.runRepository.findByIdempotencyKey(actor.userId, request.capabilityKey, idempotencyKey);
    if (existing) {
      // A client-supplied key must not be replayed against different content —
      // that would return a result for inputs the caller didn't send.
      if (existing.inputHash !== inputHash) throw new IdempotencyConflictError(idempotencyKey);
      return existing;
    }

    let run: CapabilityRunRecord;
    try {
      run = await this.deps.runRepository.createWithInputs({
        capabilityKey: request.capabilityKey,
        providerKey: definition.providerKey,
        requestedBy: actor.userId,
        configuration,
        inputHash,
        idempotencyKey,
        inputs: resolved,
      });
    } catch (error) {
      if (error instanceof DuplicateRunError) {
        // Concurrent identical request won the race: return ITS run.
        const winner = await this.deps.runRepository.findByIdempotencyKey(actor.userId, request.capabilityKey, idempotencyKey);
        if (winner) {
          if (winner.inputHash !== inputHash) throw new IdempotencyConflictError(idempotencyKey);
          return winner;
        }
      }
      throw error;
    }

    let finished = false;
    try {
      await this.deps.runRepository.markRunning(run.id);
      const result = await adapter.run(actor, resolved, configuration, signal);

      run = await this.deps.runRepository.finish(run.id, {
        status: result.status,
        errorCode: result.errorCode ?? null,
        errorMessage: result.errorMessage ?? null,
        legacyVerificationTaskId: result.legacyTaskId ?? null,
      });
      finished = true;

      if (result.status === "succeeded" && result.artifactPayload !== undefined) {
        await this.projectArtifact(run, resolved, result);
      } else {
        await this.deps.runRepository.setProjectionStatus(run.id, "not_applicable");
        run = { ...run, projectionStatus: "not_applicable" };
      }
      return run;
    } catch (error) {
      // Only rewrite the run's status if it never reached a terminal state.
      // Once finish() recorded the provider's real outcome, a later
      // bookkeeping error must not overwrite it with a fabricated failure.
      if (!finished) {
        const cancelled = signal?.aborted === true;
        await this.deps.runRepository.finish(run.id, {
          status: cancelled ? "cancelled" : "failed",
          errorCode: cancelled ? null : "SERVICE_ERROR",
          errorMessage: cancelled ? "Cancelled by user" : error instanceof Error ? error.message : String(error),
          legacyVerificationTaskId: null,
        });
      }
      throw error;
    }
  }

  /**
   * Rebuild the artifact bundle for a succeeded run whose projection failed.
   * Reconstructs from the stored legacy verification task + stored run inputs;
   * NEVER re-executes the provider. Idempotent: an already-projected run (or a
   * concurrent repair losing the unique-index race) is simply marked complete.
   */
  async repairProjection(runId: string, actor: Actor): Promise<CapabilityRunRecord> {
    const run = await this.deps.runRepository.getById(runId, actor);
    if (!run) throw new Error("Run not found");
    if (run.status !== "succeeded") throw new Error(`Cannot repair projection of a run with status ${run.status}`);
    if (run.projectionStatus === "completed" || run.projectionStatus === "not_applicable") return run;

    const registered = this.deps.registry.get(run.capabilityKey);
    if (!registered) throw new Error(`Unknown capability: ${run.capabilityKey}`);
    if (!registered.adapter.reproject) {
      throw new Error(`Capability ${run.capabilityKey} does not support projection repair`);
    }

    // Rebuild the adapter result from durable state (the legacy verification
    // task row) — this is a read, not an execution.
    const result = await registered.adapter.reproject(run);
    if (!result || result.artifactPayload === undefined) {
      throw new Error("Could not reconstruct the artifact payload from the stored provider result");
    }

    const storedInputs = await this.deps.runRepository.getInputs(runId);
    const relations = buildRelations(storedInputs);
    try {
      await this.deps.artifactRepository.createBundle({
        kind: registered.definition.outputArtifactKind,
        schemaVersion: registered.definition.version,
        runId: run.id,
        providerKey: result.providerKey,
        producerVersion: result.producerVersion ?? null,
        payload: result.artifactPayload,
        summary: result.summary ?? "",
        createdBy: run.requestedBy,
        relations,
        evidence: (result.evidence ?? []).map((ev) => ({ kind: ev.kind as EvidenceKind, payload: ev.payload, isPublic: ev.isPublic })),
      });
    } catch (error) {
      if (!(error instanceof ArtifactAlreadyProjectedError)) throw error;
    }
    await this.deps.runRepository.setProjectionStatus(runId, "completed");
    return { ...run, projectionStatus: "completed", projectionError: null };
  }

  private async projectArtifact(
    run: CapabilityRunRecord,
    resolved: ResolvedCapabilityInput[],
    result: CapabilityAdapterResult,
  ): Promise<void> {
    try {
      await this.deps.artifactRepository.createBundle({
        kind: this.deps.registry.get(run.capabilityKey)!.definition.outputArtifactKind,
        schemaVersion: this.deps.registry.get(run.capabilityKey)!.definition.version,
        runId: run.id,
        providerKey: result.providerKey,
        producerVersion: result.producerVersion ?? null,
        payload: result.artifactPayload,
        summary: result.summary ?? "",
        createdBy: run.requestedBy,
        relations: buildRelations(resolved),
        evidence: (result.evidence ?? []).map((ev) => ({ kind: ev.kind as EvidenceKind, payload: ev.payload, isPublic: ev.isPublic })),
      });
      await this.deps.runRepository.setProjectionStatus(run.id, "completed");
      run.projectionStatus = "completed";
    } catch (error) {
      if (error instanceof ArtifactAlreadyProjectedError) {
        await this.deps.runRepository.setProjectionStatus(run.id, "completed");
        run.projectionStatus = "completed";
        return;
      }
      // The provider already executed and its result is durable in
      // verification_tasks; rewriting run.status to failed here would claim an
      // execution failure that never happened. Record the projection failure
      // and leave the run repairable (repairProjection).
      const message = error instanceof Error ? error.message : String(error);
      await this.deps.runRepository.setProjectionStatus(run.id, "failed", message);
      run.projectionStatus = "failed";
      run.projectionError = message;
    }
  }

  async getRunById(id: string, actor: Actor): Promise<CapabilityRunRecord | null> {
    return this.deps.runRepository.getById(id, actor);
  }

  async listRuns(actor: Actor, filters?: { capabilityKey?: CapabilityKey }): Promise<CapabilityRunRecord[]> {
    return this.deps.runRepository.list(actor, filters);
  }

  async getArtifactById(id: string, actor: Actor): Promise<ArtifactRecord | null> {
    return this.deps.artifactRepository.findById(id, actor);
  }

  async getArtifactsByRunId(runId: string, actor: Actor): Promise<ArtifactRecord[]> {
    return this.deps.artifactRepository.findByRunId(runId, actor);
  }
}

/**
 * verifies → only for version-bound inputs (the run's stored input rows are
 * the source of truth, and migration 030's create_artifact_bundle re-checks
 * this in SQL). Ad-hoc inputs contribute NO relation: an ad-hoc artifact's
 * provenance is its run's input snapshot, not a claim about stored content.
 */
function buildRelations(inputs: Array<Pick<StoredRunInput, "objectType" | "versionId">>): ArtifactRelationInput[] {
  const relations: ArtifactRelationInput[] = [];
  for (const input of inputs) {
    if (input.objectType === "solution_version" && input.versionId) {
      relations.push({ relation: "verifies", targetType: "solution_version", targetId: input.versionId });
    }
  }
  return relations;
}
