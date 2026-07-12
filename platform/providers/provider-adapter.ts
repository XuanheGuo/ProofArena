// Generic provider execution contract, one level more abstract than
// verification/providers/provider-interface.ts's VerificationProviderAdapter
// (which this generalizes, and does not replace -- see docs/ARCHITECTURE_V2.md §5).
// A capability adapter (domains/capabilities/adapters/*) implements this by
// wrapping an EXISTING domain service (e.g. VerificationService); it is not a
// second path to an external provider.
//
// Adapters receive ResolvedCapabilityInputs — content already resolved and
// snapshotted by the server-side input resolver — never raw client input.
import type { Actor, CapabilityRunRecord, ResolvedCapabilityInput } from "@/contracts/capability";

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
  run(actor: Actor, inputs: ResolvedCapabilityInput[], configuration: Record<string, unknown>, signal?: AbortSignal): Promise<CapabilityAdapterResult>;
  /**
   * Rebuild the adapter result for an already-succeeded run from durable state
   * (e.g. the verification_tasks row named by run.legacyVerificationTaskId)
   * WITHOUT re-executing the provider. Used by projection repair when the
   * artifact bundle write failed after a successful execution.
   */
  reproject?(run: CapabilityRunRecord): Promise<CapabilityAdapterResult | null>;
}
