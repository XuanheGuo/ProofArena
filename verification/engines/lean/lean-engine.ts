import type { VerificationProviderAdapter } from "../../providers/provider-interface";
import type { VerificationResult } from "../../domain/types";
import type { LeanVerificationRequest } from "./types";

export class LeanEngine {
  readonly engine = "lean" as const;
  constructor(private readonly provider: VerificationProviderAdapter<LeanVerificationRequest, VerificationResult>) {}
  verify(request: LeanVerificationRequest, signal?: AbortSignal) {
    return this.provider.verify(request, signal);
  }
}
