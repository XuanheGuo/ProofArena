// Wraps the existing VerificationService (verification/index.ts) as a
// CapabilityAdapter for capability_key="verify.lean". This is the vertical
// slice that makes capability_runs + artifacts an honest projection of
// verification_tasks (not a competing parallel implementation).
//
// Key constraints (see docs/ARCHITECTURE_V2.md §6):
// - Calls createVerificationService().create() ONCE (no double-execution);
//   all dedup/cache/rate-limit logic stays in the existing service, unchanged
// - Never talks to AXLE directly (that's VerificationService's job)
// - Receives ResolvedCapabilityInputs: the source it executes is exactly what
//   the input resolver snapshotted, never raw client text
// - reproject() rebuilds the result from the stored verification_tasks row
//   for projection repair — a read, never a re-execution
import type { Actor, CapabilityRunRecord, ResolvedCapabilityInput } from "@/contracts/capability";
import type { CapabilityAdapter, CapabilityAdapterResult } from "@/platform/providers/provider-adapter";
import type { RunConclusion } from "@/contracts/evidence";
import type { VerificationTaskDto, VerificationVerdict } from "@/verification/domain/types";
import { createVerificationService } from "@/verification";

export class LeanVerificationAdapter implements CapabilityAdapter {
  readonly capabilityKey = "verify.lean";

  async run(
    actor: Actor,
    inputs: ResolvedCapabilityInput[],
    configuration: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<CapabilityAdapterResult> {
    const sourceInput = inputs.find((inp) => inp.role === "proof_source") ?? inputs[0];
    if (!sourceInput) {
      return {
        status: "failed",
        providerKey: "none",
        errorCode: "INVALID_INPUT",
        errorMessage: "verify.lean requires one proof_source input",
      };
    }

    const verificationService = createVerificationService();
    try {
      const task: VerificationTaskDto = await verificationService.create(
        { userId: actor.userId, email: actor.email, role: actor.role },
        {
          engine: "lean",
          source: sourceInput.source,
          solutionId: sourceInput.objectType === "solution_version" ? (sourceInput.objectId ?? undefined) : undefined,
          environment: configuration.environment as string | undefined,
          metadata: configuration,
        },
        signal,
      );
      return mapTaskToAdapterResult(task);
    } catch (error) {
      if (signal?.aborted) {
        return { status: "cancelled", providerKey: "axle", errorMessage: "Verification cancelled by user" };
      }
      return {
        status: "failed",
        providerKey: "axle",
        errorCode: "ADAPTER_ERROR",
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async reproject(run: CapabilityRunRecord): Promise<CapabilityAdapterResult | null> {
    if (!run.legacyVerificationTaskId) return null;
    const verificationService = createVerificationService();
    // Read as the run's owner: the same scoping the original execution had.
    const task = await verificationService.get(run.legacyVerificationTaskId, { userId: run.requestedBy });
    if (!task) return null;
    return mapTaskToAdapterResult(task);
  }
}

function mapTaskToAdapterResult(task: VerificationTaskDto): CapabilityAdapterResult {
  const status = mapVerificationStatusToAdapterStatus(task.status, task.verdict);
  if (status !== "succeeded") {
    return {
      status,
      providerKey: task.provider,
      errorCode: task.providerErrorCode,
      errorMessage: task.messages.filter((m) => m.severity === "error").map((m) => m.message).join("; "),
      legacyTaskId: task.id,
    };
  }
  return {
    status: "succeeded",
    providerKey: task.provider,
    artifactPayload: mapVerificationTaskToRunConclusion(task),
    summary: buildSummary(task),
    legacyTaskId: task.id,
    evidence: buildEvidence(task),
  };
}

function mapVerificationStatusToAdapterStatus(
  status: string,
  verdict: VerificationVerdict,
): "succeeded" | "failed" | "timed_out" | "cancelled" {
  if (status === "cancelled") return "cancelled";
  if (verdict === "timeout") return "timed_out";
  if (status === "completed" && (verdict === "accepted" || verdict === "rejected")) return "succeeded";
  return "failed";
}

export function mapVerificationTaskToRunConclusion(task: VerificationTaskDto): RunConclusion {
  let conclusion: RunConclusion["conclusion"];

  if (task.verdict === "accepted") {
    conclusion = "verified";
  } else if (task.verdict === "rejected") {
    // A rejected Lean proof means "this proof attempt failed to check", NOT
    // "the statement is false". Only a verified counterexample or negation
    // proof may ever produce "refuted" — see docs/architecture/verification-semantics.md.
    conclusion = "inconclusive";
  } else if (task.verdict === "invalid_request") {
    conclusion = "unsupported";
  } else {
    conclusion = "inconclusive";
  }

  const errorMessages = task.messages.filter((m) => m.severity === "error");
  const failedDeclarations = task.failedDeclarations ?? [];

  return {
    conclusion,
    evidenceLevel: "machine_checked",
    coverage: {
      checked: failedDeclarations.length === 0 ? 1 : 0,
      total: 1,
      failedDeclarations,
    },
    assumptions: [],
    claim: task.solutionId
      ? `The Lean source stored in the referenced version of solution ${task.solutionId} was machine-checked in the specified environment`
      : "The submitted ad-hoc Lean source was machine-checked in the specified environment",
    verifiedScope: task.verdict === "accepted" ? ["lean_proof"] : [],
    unverifiedScope: task.verdict === "accepted" ? [] : ["lean_proof"],
    missingConditions: errorMessages.map((m) => m.message),
  };
}

function buildEvidence(task: VerificationTaskDto): { kind: string; payload: unknown; isPublic: boolean }[] {
  const evidence: { kind: string; payload: unknown; isPublic: boolean }[] = [
    {
      kind: "provider_trace",
      payload: {
        providerRequestId: task.providerRequestId,
        provider: task.provider,
        engine: task.engine,
        environment: task.environment,
        durationMs: task.durationMs,
        cached: task.cached,
        sourceHash: task.sourceHash,
        messages: task.messages,
        resultMetadata: task.resultMetadata,
      },
      isPublic: false,
    },
  ];

  if (task.verdict === "accepted") {
    // Public evidence carries the verdict and source hash, never the source
    // itself — the full source lives in the private input snapshot.
    evidence.push({
      kind: "lean_proof",
      payload: {
        sourceHash: task.sourceHash,
        compiles: task.compiles,
        verdict: task.verdict,
        failedDeclarations: task.failedDeclarations ?? [],
      },
      isPublic: true,
    });
  }
  return evidence;
}

function buildSummary(task: VerificationTaskDto): string {
  if (task.verdict === "accepted") return "Lean proof accepted";
  if (task.verdict === "rejected") {
    const failed = task.failedDeclarations?.length ?? 0;
    return failed > 0 ? `${failed} declaration(s) failed` : "Proof rejected";
  }
  return `Verification ${task.verdict}`;
}
