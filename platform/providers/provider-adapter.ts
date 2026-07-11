// Generic provider execution contract, one level more abstract than
// verification/providers/provider-interface.ts's VerificationProviderAdapter
// (which this generalizes, and does not replace -- see docs/ARCHITECTURE_V2.md §5).
// A capability adapter (domains/capabilities/adapters/*) implements this by
// wrapping an EXISTING domain service (e.g. VerificationService); it is not a
// second path to an external provider.
import type { Actor, CapabilityRunInputRef } from "@/contracts/capability";

export interface CapabilityAdapterResult {
  /** Present only when the run succeeded and produced a conclusion (§8). */
  artifactPayload?: unknown;
  summary?: string;
  providerKey: string;
  producerVersion?: string;
  status: "succeeded" | "failed" | "timed_out" | "cancelled";
  errorCode?: string;
  errorMessage?: string;
  /** Bridge id into a legacy per-capability table (e.g. verification_tasks.id), if any. */
  legacyTaskId?: string;
  evidence?: { kind: string; payload: unknown; isPublic: boolean }[];
}

export interface CapabilityAdapter {
  readonly capabilityKey: string;
  run(actor: Actor, inputs: CapabilityRunInputRef[], configuration: Record<string, unknown>, signal?: AbortSignal): Promise<CapabilityAdapterResult>;
}
