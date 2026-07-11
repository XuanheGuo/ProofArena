import type { CapabilityDefinition, CapabilityKey } from "@/contracts/capability";
import type { CapabilityAdapter } from "@/platform/providers/provider-adapter";

interface RegisteredCapability {
  definition: CapabilityDefinition;
  adapter: CapabilityAdapter;
}

/**
 * Code-based capability registry (§5: "prefer a code registry in Phase 1,
 * don't build a database CMS yet"). A fresh Map per registry instance so
 * tests can register fakes without mutating global state.
 */
export class CapabilityRegistry {
  private readonly entries = new Map<CapabilityKey, RegisteredCapability>();

  register(definition: CapabilityDefinition, adapter: CapabilityAdapter): void {
    if (definition.key !== adapter.capabilityKey) {
      throw new Error(`capability definition key "${definition.key}" does not match adapter key "${adapter.capabilityKey}"`);
    }
    this.entries.set(definition.key, { definition, adapter });
  }

  get(key: CapabilityKey): RegisteredCapability | undefined {
    return this.entries.get(key);
  }

  has(key: CapabilityKey): boolean {
    return this.entries.has(key);
  }

  keys(): CapabilityKey[] {
    return Array.from(this.entries.keys());
  }
}

let defaultRegistry: CapabilityRegistry | null = null;

/** Lazily builds the process-wide registry so importing this module never has import-order side effects. */
export function getDefaultCapabilityRegistry(build: () => CapabilityRegistry): CapabilityRegistry {
  if (!defaultRegistry) defaultRegistry = build();
  return defaultRegistry;
}
