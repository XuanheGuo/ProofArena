// Default capability registry configuration. Imports are lazy (via the builder
// function) so this module can be imported without side effects.
import { CapabilityRegistry } from "./registry";
import { LeanVerificationAdapter } from "./adapters/lean-verification-adapter";
import type { CapabilityDefinition } from "@/contracts/capability";

const LEAN_VERIFICATION_DEFINITION: CapabilityDefinition = {
  key: "verify.lean",
  version: 1,
  acceptedInputTypes: ["solution", "solution_version"],
  outputArtifactKind: "verification_report",
  providerKey: "axle",
  permissionPolicy: () => true,
  retryPolicy: { maxAttempts: 3 },
};

export function buildDefaultRegistry(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  registry.register(LEAN_VERIFICATION_DEFINITION, new LeanVerificationAdapter());
  return registry;
}
