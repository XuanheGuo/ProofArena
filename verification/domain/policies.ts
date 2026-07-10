export const VERIFICATION_POLICY_VERSION = 1;
export const DEFAULT_MAX_SOURCE_BYTES = 64 * 1024;
export const ABSOLUTE_MAX_SOURCE_BYTES = 256 * 1024;
export const DEFAULT_TIMEOUT_SECONDS = 120;
export const MAX_TIMEOUT_SECONDS = 300;
export const RATE_LIMIT_WINDOW_MINUTES = 10;
export const RATE_LIMIT_REQUESTS = 10;
export const MAX_CONCURRENT_TASKS = 2;

export const CACHEABLE_VERDICTS = new Set(["accepted", "rejected"]);

export function isStrictlyLeanVerified(input: {
  status: string;
  verdict?: string | null;
  valid: boolean;
  failedDeclarations?: string[];
}): boolean {
  return input.status === "completed"
    && input.verdict === "accepted"
    && input.valid
    && (input.failedDeclarations?.length ?? 0) === 0;
}
