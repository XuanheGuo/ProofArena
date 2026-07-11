import { getServiceClient } from "@/platform/database/service-client";
import { SupabaseVersionRepository } from "../versioning/supabase-version-repository";

/** Snapshot shape for a problem_versions.content row. Narrower than the full `Problem` type on purpose (§4). */
export interface ProblemVersionContent {
  title: string;
  statement: string[];
  answer: string;
  tags: string[];
}

export function createProblemVersionRepository() {
  return new SupabaseVersionRepository<ProblemVersionContent>(getServiceClient(), {
    versionTable: "problem_versions",
    entityTable: "problems",
    entityIdColumn: "problem_id",
  });
}

export async function getCurrentProblemVersion(problemId: string) {
  return createProblemVersionRepository().getLatest(problemId);
}
