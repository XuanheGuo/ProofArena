// Orchestrator service that ties together the capability registry, adapter
// execution, and repository persistence. This is the entry point for executing
// a capability run end-to-end. See docs/ARCHITECTURE_V2.md §5, §6.
import { createHash } from "node:crypto";
import type { Actor, CapabilityKey, CapabilityRunRecord, CapabilityRunRequest } from "@/contracts/capability";
import type { ArtifactRecord } from "@/contracts/artifact";
import type { EvidenceKind } from "@/contracts/evidence";
import { canonicalize } from "@/domains/content/versioning/content-hash";
import type { CapabilityRegistry } from "./registry";
import type { CapabilityRunRepository } from "./capability-run-repository";
import type { ArtifactRepository } from "@/domains/artifacts/artifact-repository";

export interface CapabilityServiceDeps {
  registry: CapabilityRegistry;
  runRepository: CapabilityRunRepository;
  artifactRepository: ArtifactRepository;
}

function computeInputHash(inputs: CapabilityRunRequest["inputs"]): string {
  const canonical = canonicalize(inputs);
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

export class CapabilityService {
  constructor(private readonly deps: CapabilityServiceDeps) {}

  /**
   * Execute a capability run end-to-end:
   * 1. Check idempotency (if key provided)
   * 2. Validate inputs against capability definition
   * 3. Check permission policy
   * 4. Create run record (status=queued)
   * 5. Execute adapter (status=running → terminal)
   * 6. If succeeded: persist artifact + evidence
   * 7. Return run record
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

    const invalidInputs = request.inputs.filter((inp) => !definition.acceptedInputTypes.includes(inp.objectType));
    if (invalidInputs.length > 0) {
      throw new Error(`Invalid input types for ${request.capabilityKey}: ${invalidInputs.map((i) => i.objectType).join(", ")}`);
    }

    const inputHash = computeInputHash(request.inputs);

    if (request.idempotencyKey) {
      const existing = await this.deps.runRepository.findByIdempotencyKey(
        actor.userId,
        request.capabilityKey,
        request.idempotencyKey
      );
      if (existing) {
        return existing;
      }
    }

    let run = await this.deps.runRepository.create({
      capabilityKey: request.capabilityKey,
      providerKey: definition.providerKey,
      requestedBy: actor.userId,
      configuration: request.configuration ?? {},
      inputHash,
      idempotencyKey: request.idempotencyKey ?? null,
      inputs: request.inputs,
    });

    try {
      await this.deps.runRepository.markRunning(run.id);

      const result = await adapter.run(actor, request.inputs, request.configuration ?? {}, signal);

      run = await this.deps.runRepository.finish(run.id, {
        status: result.status,
        errorCode: result.errorCode ?? null,
        errorMessage: result.errorMessage ?? null,
        legacyVerificationTaskId: result.legacyTaskId ?? null,
      });

      if (result.status === "succeeded" && result.artifactPayload) {
        const artifact = await this.deps.artifactRepository.create({
          kind: definition.outputArtifactKind,
          schemaVersion: definition.version,
          runId: run.id,
          providerKey: result.providerKey,
          producerVersion: result.producerVersion ?? null,
          status: "published",
          payload: result.artifactPayload,
          summary: result.summary ?? "",
          isPublic: true,
          createdBy: actor.userId,
        });

        if (result.evidence) {
          for (const ev of result.evidence) {
            await this.deps.artifactRepository.createEvidence({
              artifactId: artifact.id,
              kind: ev.kind as EvidenceKind,
              payload: ev.payload,
              isPublic: ev.isPublic,
            });
          }
        }
      }

      return run;
    } catch (error) {
      if (signal?.aborted) {
        await this.deps.runRepository.finish(run.id, {
          status: "cancelled",
          errorCode: null,
          errorMessage: "Cancelled by user",
          legacyVerificationTaskId: null,
        });
        throw error;
      }

      await this.deps.runRepository.finish(run.id, {
        status: "failed",
        errorCode: "SERVICE_ERROR",
        errorMessage: error instanceof Error ? error.message : String(error),
        legacyVerificationTaskId: null,
      });

      throw error;
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
