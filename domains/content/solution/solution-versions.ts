import { getServiceClient } from "@/platform/database/service-client";
import { SupabaseVersionRepository } from "../versioning/supabase-version-repository";

/** Snapshot shape for a solution_versions.content row. Narrower than the full `Solution` type on purpose (§4). */
export interface SolutionVersionContent {
  title: string;
  content: string;
  kind: string;
}

export function createSolutionVersionRepository() {
  return new SupabaseVersionRepository<SolutionVersionContent>(getServiceClient(), {
    versionTable: "solution_versions",
    entityTable: "solutions",
    entityIdColumn: "solution_id",
  });
}

export async function getCurrentSolutionVersion(solutionId: string) {
  return createSolutionVersionRepository().getLatest(solutionId);
}
