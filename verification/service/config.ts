import {
  ABSOLUTE_MAX_SOURCE_BYTES,
  DEFAULT_MAX_SOURCE_BYTES,
  DEFAULT_TIMEOUT_SECONDS,
  MAX_TIMEOUT_SECONDS,
} from "../domain/policies";
import type { VerificationProvider } from "../domain/types";

function parseBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function parseBoundedInteger(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

export interface VerificationConfig {
  leanEnabled: boolean;
  leanProvider: VerificationProvider;
  axleApiKey?: string;
  axleBaseUrl: string;
  allowedEnvironments: string[];
  defaultEnvironment?: string;
  timeoutSeconds: number;
  maxSourceBytes: number;
}

export function getVerificationConfig(env: NodeJS.ProcessEnv = process.env): VerificationConfig {
  const environments = (env.AXLE_ENVIRONMENT ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const provider = (env.LEAN_VERIFICATION_PROVIDER || "axle") as VerificationProvider;

  return {
    leanEnabled: parseBoolean(env.LEAN_VERIFICATION_ENABLED),
    leanProvider: provider,
    axleApiKey: env.AXLE_API_KEY || undefined,
    axleBaseUrl: (env.AXLE_BASE_URL || "https://axle.axiommath.ai").replace(/\/$/, ""),
    allowedEnvironments: environments,
    defaultEnvironment: environments[0],
    timeoutSeconds: parseBoundedInteger(env.AXLE_TIMEOUT_SECONDS, DEFAULT_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS),
    maxSourceBytes: parseBoundedInteger(env.LEAN_MAX_SOURCE_BYTES, DEFAULT_MAX_SOURCE_BYTES, ABSOLUTE_MAX_SOURCE_BYTES),
  };
}
