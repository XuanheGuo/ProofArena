export const VERIFICATION_ENGINES = ["lean", "cas", "numerical", "z3"] as const;
export type VerificationEngine = (typeof VERIFICATION_ENGINES)[number];

export const VERIFICATION_PROVIDERS = ["axle", "kimina", "sympy", "sage", "internal"] as const;
export type VerificationProvider = (typeof VERIFICATION_PROVIDERS)[number];

export const VERIFICATION_STATUSES = ["queued", "running", "completed", "failed", "cancelled"] as const;
export type VerificationTaskStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_VERDICTS = [
  "accepted", "rejected", "invalid_request", "timeout", "rate_limited",
  "resource_limit", "provider_error", "cancelled",
] as const;
export type VerificationVerdict = (typeof VERIFICATION_VERDICTS)[number];

export interface VerificationMessage {
  severity: "error" | "warning" | "info";
  code?: string;
  message: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  source: "lean" | "provider" | "proofarena";
}

export interface VerificationRequest {
  engine: VerificationEngine;
  source: string;
  problemId?: string;
  solutionId?: string;
  submissionId?: string;
  environment?: string;
  metadata?: Record<string, unknown>;
}

export interface VerificationResult {
  valid: boolean;
  compiles?: boolean;
  verdict: VerificationVerdict;
  engine: VerificationEngine;
  provider: VerificationProvider;
  environment?: string;
  messages: VerificationMessage[];
  failedDeclarations?: string[];
  durationMs?: number;
  sourceHash: string;
  cached: boolean;
  providerRequestId?: string;
  providerErrorCode?: string;
  resultMetadata?: Record<string, unknown>;
}

export interface VerificationTaskDto extends VerificationResult {
  id: string;
  userId?: string;
  status: VerificationTaskStatus;
  problemId?: string;
  solutionId?: string;
  submissionId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface VerificationActor {
  userId: string;
  email?: string;
  role?: string;
}

/** Reserved for the future server-side statement + proof-body workflow. */
export interface LeanStatementBinding {
  problemId: string;
  statement: string;
  statementVersion: number;
  enabled: boolean;
}
