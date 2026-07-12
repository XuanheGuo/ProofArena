// Composition root for the capability vertical slice, shared by all API
// routes so the two-client wiring (service-role writer + caller's
// RLS-enforcing reader) cannot drift between call sites. Server-only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/platform/database/service-client";
import { CapabilityService } from "./capability-service";
import { getDefaultCapabilityRegistry } from "./registry";
import { buildDefaultRegistry } from "./default-registry";
import { CapabilityInputResolver } from "./input-resolver";
import { SupabaseVersionReader } from "./supabase-version-reader";
import { SupabaseCapabilityRunRepository } from "./supabase-capability-run-repository";
import { SupabaseArtifactRepository } from "@/domains/artifacts/supabase-artifact-repository";

/**
 * @param reader The CALLER's Supabase client (cookie client). All user-facing
 * reads run through it so RLS decides visibility; with no session it acts as
 * the anon role, which is exactly the public-read surface.
 */
export function buildCapabilityService(reader: SupabaseClient): CapabilityService {
  const writer = getServiceClient();
  return new CapabilityService({
    registry: getDefaultCapabilityRegistry(buildDefaultRegistry),
    runRepository: new SupabaseCapabilityRunRepository(writer, reader),
    artifactRepository: new SupabaseArtifactRepository(writer, reader),
    // The version reader uses the service client, but the resolver applies the
    // same visibility rule as the RLS policies (canRead) before using a row.
    inputResolver: new CapabilityInputResolver(new SupabaseVersionReader(writer)),
  });
}
