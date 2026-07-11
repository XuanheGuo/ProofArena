import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentVersionRecord, CreateVersionInput, VersionDedupResult } from "@/contracts/content";
import { computeContentHash } from "./content-hash";
import type { VersionRepository } from "./version-repository";

type Row = Record<string, unknown>;

export interface VersionTableConfig {
  versionTable: "problem_versions" | "solution_versions";
  entityTable: "problems" | "solutions";
  entityIdColumn: "problem_id" | "solution_id";
}

function mapRow<TContent>(row: Row): ContentVersionRecord<TContent> {
  return {
    id: row.id as string,
    entityId: (row.problem_id ?? row.solution_id) as string,
    versionNumber: row.version_number as number,
    parentVersionId: (row.parent_version_id as string | null) ?? null,
    content: row.content as TContent,
    contentHash: row.content_hash as string,
    changeSummary: (row.change_summary as string) ?? "",
    sourceSubmissionId: (row.source_submission_id as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    publishedAt: (row.published_at as string | null) ?? null,
  };
}

/**
 * Generic Supabase-backed VersionRepository, parametrized over the
 * problem_versions/solution_versions table pair so the two entities share
 * one tested implementation instead of two near-duplicates. Always writes
 * through the service-role client (platform/database/service-client.ts) --
 * these tables have no client-writable RLS policy, matching
 * verification_tasks' convention (see docs/ARCHITECTURE_V2.md §10).
 */
export class SupabaseVersionRepository<TContent = unknown> implements VersionRepository<TContent> {
  constructor(
    private readonly db: SupabaseClient,
    private readonly config: VersionTableConfig,
  ) {}

  async getLatest(entityId: string): Promise<ContentVersionRecord<TContent> | null> {
    const { data, error } = await this.db
      .from(this.config.versionTable)
      .select("*")
      .eq(this.config.entityIdColumn, entityId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRow<TContent>(data as Row) : null;
  }

  async getById(versionId: string): Promise<ContentVersionRecord<TContent> | null> {
    const { data, error } = await this.db.from(this.config.versionTable).select("*").eq("id", versionId).maybeSingle();
    if (error) throw error;
    return data ? mapRow<TContent>(data as Row) : null;
  }

  async createVersion(input: CreateVersionInput<TContent>): Promise<VersionDedupResult<TContent>> {
    const contentHash = computeContentHash(input.content);
    const latest = await this.getLatest(input.entityId);
    if (latest && latest.contentHash === contentHash) {
      return { created: false, version: latest, reason: "no_op_same_hash" };
    }

    const now = new Date().toISOString();
    // Concurrent creators racing for the same next version_number are rejected
    // by the UNIQUE(entity_id, version_number) constraint rather than silently
    // overwriting one another; Phase 1 has no concurrent-writer caller (backfill
    // script runs once, sequentially), so the caller surfacing that error is
    // an acceptable, explicit failure mode rather than added retry complexity.
    const { data, error } = await this.db
      .from(this.config.versionTable)
      .insert({
        [this.config.entityIdColumn]: input.entityId,
        version_number: (latest?.versionNumber ?? 0) + 1,
        parent_version_id: latest?.id ?? null,
        content: input.content,
        content_hash: contentHash,
        change_summary: input.changeSummary ?? "",
        source_submission_id: input.sourceSubmissionId ?? null,
        created_by: input.createdBy,
        created_at: now,
        published_at: input.publish ? now : null,
      })
      .select("*")
      .single();
    if (error) throw error;
    const version = mapRow<TContent>(data as Row);
    if (input.publish) await this.setCurrentVersion(input.entityId, version.id);
    return { created: true, version, reason: "created" };
  }

  async setCurrentVersion(entityId: string, versionId: string): Promise<void> {
    const { error } = await this.db
      .from(this.config.entityTable)
      .update({ current_version_id: versionId })
      .eq("id", entityId);
    if (error) throw error;
  }
}
