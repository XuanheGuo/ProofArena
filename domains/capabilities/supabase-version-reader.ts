// Supabase-backed VersionReader for the input resolver. Uses the service-role
// client because the read happens inside a server-only code path and the
// resolver applies the same visibility rule as the RLS policies itself
// (CapabilityInputResolver.canRead) — an unpublished version is only usable
// by its creator or a moderator, exactly like migration 029's SELECT policies.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SolutionVersionRow, VersionReader } from "./input-resolver";

export class SupabaseVersionReader implements VersionReader {
  constructor(private readonly db: SupabaseClient) {}

  async getSolutionVersion(versionId: string): Promise<SolutionVersionRow | null> {
    const { data, error } = await this.db
      .from("solution_versions")
      .select("id, solution_id, content, content_hash, published_at, created_by")
      .eq("id", versionId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id as string,
      solutionId: data.solution_id as string,
      content: data.content,
      contentHash: data.content_hash as string,
      publishedAt: (data.published_at as string | null) ?? null,
      createdBy: (data.created_by as string | null) ?? null,
    };
  }
}
