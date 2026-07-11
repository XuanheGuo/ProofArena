// Supabase implementation of ArtifactRepository. RLS policies match the
// capability_runs pattern: owner/moderator SELECT, service-role-only writes.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isModerator } from "@/lib/is-moderator";
import type { Actor } from "@/contracts/capability";
import type { ArtifactKind, ArtifactRecord } from "@/contracts/artifact";
import type { EvidenceKind, EvidenceRecord } from "@/contracts/evidence";
import { assertProviderTraceStaysPrivate } from "@/contracts/evidence";
import { assertPublishedBeforePublic } from "@/contracts/artifact";
import type { ArtifactRepository, CreateArtifactInput, CreateEvidenceInput } from "./artifact-repository";

type Row = Record<string, unknown>;

function mapArtifact(row: Row): ArtifactRecord {
  return {
    id: row.id as string,
    kind: row.kind as ArtifactKind,
    schemaVersion: row.schema_version as number,
    runId: row.run_id as string,
    providerKey: row.provider_key as string,
    producerVersion: row.producer_version as string | null,
    status: row.status as ArtifactRecord["status"],
    payload: row.payload as unknown,
    summary: row.summary as string,
    isPublic: Boolean(row.is_public),
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
  };
}

function mapEvidence(row: Row): EvidenceRecord {
  return {
    id: row.id as string,
    artifactId: row.artifact_id as string,
    kind: row.kind as EvidenceKind,
    payload: row.payload as unknown,
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at as string,
  };
}

export class SupabaseArtifactRepository implements ArtifactRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create<K extends ArtifactKind>(input: CreateArtifactInput<K>): Promise<ArtifactRecord<K>> {
    assertPublishedBeforePublic(input.status, input.isPublic);

    const { data, error } = await this.db
      .from("artifacts")
      .insert({
        kind: input.kind,
        schema_version: input.schemaVersion,
        run_id: input.runId,
        provider_key: input.providerKey,
        producer_version: input.producerVersion ?? null,
        status: input.status,
        payload: input.payload,
        summary: input.summary,
        is_public: input.isPublic,
        created_by: input.createdBy,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create artifact: ${error.message}`);
    }

    return mapArtifact(data) as ArtifactRecord<K>;
  }

  async findById(id: string, actor: Actor): Promise<ArtifactRecord | null> {
    let query = this.db.from("artifacts").select("*").eq("id", id);

    // Moderators can see all
    const isMod = isModerator({ role: actor.role, email: actor.email });

    if (!isMod) {
      // Anonymous or non-moderator users
      if (actor.userId === "anon" || !actor.userId) {
        // Anon: only public artifacts
        query = query.eq("is_public", true);
      } else {
        // Authenticated non-moderator: own artifacts + public
        query = query.or(`created_by.eq.${actor.userId},is_public.eq.true`);
      }
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch artifact: ${error.message}`);
    }

    return data ? mapArtifact(data) : null;
  }

  async findByRunId(runId: string, actor: Actor): Promise<ArtifactRecord[]> {
    let query = this.db.from("artifacts").select("*").eq("run_id", runId);

    const isMod = isModerator({ role: actor.role, email: actor.email });

    if (!isMod) {
      if (actor.userId === "anon" || !actor.userId) {
        query = query.eq("is_public", true);
      } else {
        query = query.or(`created_by.eq.${actor.userId},is_public.eq.true`);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch artifacts by run_id: ${error.message}`);
    }

    return (data ?? []).map(mapArtifact);
  }

  async createEvidence(input: CreateEvidenceInput): Promise<EvidenceRecord> {
    assertProviderTraceStaysPrivate(input.kind as EvidenceKind, input.isPublic);

    const { data, error } = await this.db
      .from("evidence")
      .insert({
        artifact_id: input.artifactId,
        kind: input.kind,
        payload: input.payload,
        is_public: input.isPublic,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create evidence: ${error.message}`);
    }

    return mapEvidence(data);
  }

  async findEvidenceByArtifactId(artifactId: string, actor: Actor): Promise<EvidenceRecord[]> {
    const artifact = await this.findById(artifactId, actor);
    if (!artifact) {
      return [];
    }

    let query = this.db.from("evidence").select("*").eq("artifact_id", artifactId);

    const isMod = isModerator({ role: actor.role, email: actor.email });
    const isOwner = artifact.createdBy === actor.userId;

    // Moderators and owners can see all evidence
    // Others can only see public evidence on public artifacts
    if (!isMod && !isOwner) {
      query = query.eq("is_public", true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch evidence: ${error.message}`);
    }

    return (data ?? []).map(mapEvidence);
  }
}
