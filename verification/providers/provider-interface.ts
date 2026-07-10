import type { VerificationEngine, VerificationProvider, VerificationRequest, VerificationResult } from "../domain/types";

export interface VerificationProviderAdapter<TRequest = VerificationRequest, TResult = VerificationResult> {
  readonly provider: VerificationProvider;
  readonly engine: VerificationEngine;
  verify(request: TRequest, signal?: AbortSignal): Promise<TResult>;
  healthCheck?(): Promise<{ healthy: boolean; latencyMs?: number; message?: string }>;
}
