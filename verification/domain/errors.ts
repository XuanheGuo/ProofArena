import type { VerificationVerdict } from "./types";

export class VerificationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly verdict: VerificationVerdict,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "VerificationError";
  }
}

export class ProviderAdapterError extends Error {
  constructor(
    message: string,
    public readonly verdict: Extract<VerificationVerdict, "timeout" | "rate_limited" | "provider_error" | "cancelled" | "invalid_request">,
    public readonly providerErrorCode?: string,
  ) {
    super(message);
    this.name = "ProviderAdapterError";
  }
}
