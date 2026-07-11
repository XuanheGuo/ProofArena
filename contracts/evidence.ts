// Standardized capability result model. See docs/ARCHITECTURE_V2.md §8.
//
// Deliberately NOT a flat verified/failed enum: `conclusion` (the math
// outcome) and the run's infra lifecycle (contracts/capability.ts's
// CapabilityRunStatus) are different axes and must never be collapsed into
// one field -- doing so is exactly the bug docs/architecture/verification-semantics.md
// flags in the legacy `Solution.verification.status` field. No aggregate
// trust/confidence score is ever part of this contract, on purpose.

export const CONCLUSIONS = ["verified", "refuted", "inconclusive", "unsupported", "not_assessed"] as const;
export type Conclusion = (typeof CONCLUSIONS)[number];

export const EVIDENCE_LEVELS = ["machine_checked", "symbolic_spot_check", "editorial_claim"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export interface RunCoverage {
  checked: number;
  total: number;
  failedDeclarations: string[];
}

export interface RunAssumption {
  kind: string;
  detail: string;
}

/**
 * The payload stored in `artifacts.payload` for kind="verification_report"
 * (and, later, other conclusion-bearing artifact kinds). Only ever produced
 * for a capability_runs row with status="succeeded" -- an infra failure has
 * no conclusion to report, so it gets no artifact at all (see §8).
 */
export interface RunConclusion {
  conclusion: Conclusion;
  evidenceLevel: EvidenceLevel;
  coverage: RunCoverage;
  assumptions: RunAssumption[];
  claim: string;
  verifiedScope: string[];
  unverifiedScope: string[];
  missingConditions: string[];
}

export const EVIDENCE_KINDS = [
  "lean_proof",
  "symbolic_check",
  "numerical_counterexample",
  "manual_review",
  "provider_trace",
  "test_result",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export interface EvidenceRecord<TPayload = unknown> {
  id: string;
  artifactId: string;
  kind: EvidenceKind;
  payload: TPayload;
  /** A `provider_trace` can never be public -- enforced by a DB CHECK constraint too. */
  isPublic: boolean;
  createdAt: string;
}

export function assertProviderTraceStaysPrivate(kind: EvidenceKind, isPublic: boolean): void {
  if (kind === "provider_trace" && isPublic) {
    throw new Error("provider_trace evidence must never be marked public");
  }
}
