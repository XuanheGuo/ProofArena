// Wraps the existing VerificationService (verification/index.ts) as a
// CapabilityAdapter for capability_key="lean_verification". This is the
// vertical slice that makes capability_runs + artifacts an honest projection
// of verification_tasks (not a competing parallel implementation).
//
// Key constraints (see docs/ARCHITECTURE_V2.md §6):
// - Calls createVerificationService().create() ONCE (no double-execution)
// - All dedup/cache/rate-limit logic stays in the existing service (unchanged)
// - Never talks to AXLE directly (that's VerificationService's job)
// - Maps VerificationTaskDto → CapabilityAdapterResult with RunConclusion payload

import type { Actor, CapabilityRunInputRef } from "@/contracts/capability";
import type { CapabilityAdapter, CapabilityAdapterResult } from "@/platform/providers/provider-adapter";
import type { RunConclusion } from "@/contracts/evidence";
import type { VerificationTaskDto, VerificationVerdict } from "@/verification/domain/types";
import { createVerificationService } from "@/verification";

export class LeanVerificationAdapter implements CapabilityAdapter {
  readonly capabilityKey = "lean_verification";

  async run(
    actor: Actor,
    inputs: CapabilityRunInputRef[],
    configuration: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<CapabilityAdapterResult> {
    const sourceInput = inputs.find((inp) => inp.inputKey === "proof_source");
    if (!sourceInput || typeof sourceInput.value !== "string") {
      return {
        status: "failed",
        providerKey: "none",
        errorCode: "INVALID_INPUT",
        errorMessage: "lean_verification requires proof_source input (string)",
      };
    }

    const problemIdInput = inputs.find((inp) => inp.inputKey === "problem_id");
    const solutionIdInput = inputs.find((inp) => inp.inputKey === "solution_id");

    const verificationService = createVerificationService();

    try {
      const taskDto: VerificationTaskDto = await verificationService.create(
        {
          userId: actor.userId,
          email: actor.email,
          role: actor.role,
        },
        {
          engine: "lean",
          source: sourceInput.value,
          problemId: problemIdInput?.value as string | undefined,
          solutionId: solutionIdInput?.value as string | undefined,
          environment: (configuration.environment as string | undefined),
          metadata: configuration,
        },
        signal
      );

      const status = mapVerificationStatusToAdapterStatus(taskDto.status, taskDto.verdict);

      if (status !== "succeeded") {
        return {
          status,
          providerKey: taskDto.provider,
          producerVersion: undefined,
          errorCode: taskDto.providerErrorCode,
          errorMessage: taskDto.messages.filter((m) => m.severity === "error").map((m) => m.message).join("; "),
          legacyTaskId: taskDto.id,
        };
      }

      const runConclusion = mapVerificationTaskToRunConclusion(taskDto);
      const evidence = buildEvidence(taskDto);

      return {
        status: "succeeded",
        providerKey: taskDto.provider,
        producerVersion: undefined,
        artifactPayload: runConclusion,
        summary: buildSummary(taskDto),
        legacyTaskId: taskDto.id,
        evidence,
      };
    } catch (error) {
      if (signal?.aborted) {
        return {
          status: "cancelled",
          providerKey: "axle",
          errorMessage: "Verification cancelled by user",
        };
      }

      return {
        status: "failed",
        providerKey: "axle",
        errorCode: "ADAPTER_ERROR",
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

function mapVerificationStatusToAdapterStatus(
  status: string,
  verdict: VerificationVerdict
): "succeeded" | "failed" | "timed_out" | "cancelled" {
  if (status === "cancelled") return "cancelled";
  if (verdict === "timeout") return "timed_out";
  if (status === "completed" && (verdict === "accepted" || verdict === "rejected")) return "succeeded";
  return "failed";
}

function mapVerificationTaskToRunConclusion(task: VerificationTaskDto): RunConclusion {
  let conclusion: RunConclusion["conclusion"];
  let evidenceLevel: RunConclusion["evidenceLevel"];

  if (task.verdict === "accepted") {
    conclusion = "verified";
    evidenceLevel = "machine_checked";
  } else if (task.verdict === "rejected") {
    conclusion = "refuted";
    evidenceLevel = "machine_checked";
  } else if (task.verdict === "invalid_request") {
    conclusion = "unsupported";
    evidenceLevel = "machine_checked";
  } else {
    conclusion = "inconclusive";
    evidenceLevel = "machine_checked";
  }

  const errorMessages = task.messages.filter((m) => m.severity === "error");
  const failedDeclarations = task.failedDeclarations ?? [];

  return {
    conclusion,
    evidenceLevel,
    coverage: {
      checked: failedDeclarations.length === 0 ? 1 : 0,
      total: 1,
      failedDeclarations,
    },
    assumptions: [],
    claim: task.problemId
      ? `Solution for problem ${task.problemId} is machine-checkable`
      : "Lean proof compiles and passes verification",
    verifiedScope: task.verdict === "accepted" ? ["lean_proof"] : [],
    unverifiedScope: task.verdict === "accepted" ? [] : ["lean_proof"],
    missingConditions: errorMessages.map((m) => m.message),
  };
}

function buildEvidence(task: VerificationTaskDto): { kind: string; payload: unknown; isPublic: boolean }[] {
  const evidence: { kind: string; payload: unknown; isPublic: boolean }[] = [];

  evidence.push({
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
  });

  if (task.verdict === "accepted") {
    evidence.push({
      kind: "lean_proof",
      payload: {
        source: "(stored in capability_run_inputs)",
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
  if (task.verdict === "accepted") {
    return "Lean proof accepted";
  }
  if (task.verdict === "rejected") {
    const failed = task.failedDeclarations?.length ?? 0;
    return failed > 0 ? `${failed} declaration(s) failed` : "Proof rejected";
  }
  return `Verification ${task.verdict}`;
}
