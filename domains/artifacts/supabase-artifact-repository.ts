// Supabase implementation of ArtifactRepository. Same two-client split as
// SupabaseCapabilityRunRepository: writes go through service-role RPCs
// (SECURITY DEFINER, migration 030); user-facing reads go through the caller's
// RLS-enforcing client so the SELECT policies in migration 028 decide
// visibility (public / owner-via-run / moderator) instead of hand-rolled
// WHERE clauses.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Actor } from "@/contracts/capability";
import type { ArtifactKind, ArtifactRecord } from "@/contracts/artifact";
import type { EvidenceKind, EvidenceRecord } from "@/contracts/evidence";
import { assertProviderTraceStaysPrivate } from "@/contracts/evidence";
import {
  ArtifactAlreadyProjectedError,
  type ArtifactRepository,
  type CreateArtifactBundleInput,
} from "./artifact-repository";

type Row = Record<string, unknown>;

function mapArtifact(row: Row): ArtifactRecord {
  return {
    id: row.id as string,
    kind: row.kind as ArtifactKind,
    schemaVersion: row.schema_version as number,
    runId: row.run_id as string,
    providerKey: row.provider_key as string,
    producerVersion: (row.producer_version as string | null) ?? null,
    status: row.status as ArtifactRecord["status"],
    payload: row.payload,
    summary: (row.summary as string) ?? "",
    isPublic: Boolean(row.is_public),
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    publishedAt: (row.published_at as string | null) ?? null,
    publishedBy: (row.published_by as string | null) ?? null,
  };
}

function mapEvidence(row: Row): EvidenceRecord {
  return {
    id: row.id as string,
    artifactId: row.artifact_id as string,
    kind: row.kind as EvidenceKind,
    payload: row.payload,
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at as string,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

export class SupabaseArtifactRepository implements ArtifactRepository {
  constructor(
    private readonly writer: SupabaseClient,
    private readonly reader: SupabaseClient,
  ) {}

  async createBundle<K extends ArtifactKind>(input: CreateArtifactBundleInput<K>): Promise<ArtifactRecord<K>> {
    // The DB CHECK would also catch this, but failing before the network call
    // gives adapter bugs a precise error instead of a rolled-back bundle.
    for (const ev of input.evidence) {
      assertProviderTraceStaysPrivate(ev.kind, ev.isPublic);
    }

    const { data: artifactId, error } = await this.writer.rpc("create_artifact_bundle", {
      p_kind: input.kind,
      p_schema_version: input.schemaVersion,
      p_run_id: input.runId,
      p_provider_key: input.providerKey,
      p_producer_version: input.producerVersion ?? null,
      p_payload: input.payload,
      p_summary: input.summary,
      p_created_by: input.createdBy,
      p_relations: input.relations.map((rel) => ({
        relation: rel.relation,
        target_type: rel.targetType,
        target_id: rel.targetId,
      })),
      p_evidence: input.evidence.map((ev) => ({
        kind: ev.kind,
        payload: ev.payload,
        is_public: ev.isPublic,
      })),
    });
    if (error) {
      if (isUniqueViolation(error)) throw new ArtifactAlreadyProjectedError(input.runId);
      throw error;
    }

    const { data, error: fetchError } = await this.writer.from("artifacts").select("*").eq("id", artifactId).single();
    if (fetchError) throw fetchError;
    return mapArtifact(data as Row) as ArtifactRecord<K>;
  }

  async publish(artifactId: string, publishedBy: string): Promise<ArtifactRecord> {
    const { error } = await this.writer.rpc("publish_artifact", {
      p_artifact_id: artifactId,
      p_published_by: publishedBy,
    });
    if (error) throw error;

    const { data, error: fetchError } = await this.writer.from("artifacts").select("*").eq("id", artifactId).single();
    if (fetchError) throw fetchError;
    return mapArtifact(data as Row);
  }

  async findById(id: string, _actor: Actor): Promise<ArtifactRecord | null> {
    const { data, error } = await this.reader.from("artifacts").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapArtifact(data as Row) : null;
  }

  async findByRunId(runId: string, _actor: Actor): Promise<ArtifactRecord[]> {
    const { data, error } = await this.reader.from("artifacts").select("*").eq("run_id", runId);
    if (error) throw error;
    return (data ?? []).map((row) => mapArtifact(row as Row));
  }

  async findEvidenceByArtifactId(artifactId: string, _actor: Actor): Promise<EvidenceRecord[]> {
    const { data, error } = await this.reader.from("evidence").select("*").eq("artifact_id", artifactId);
    if (error) throw error;
    return (data ?? []).map((row) => mapEvidence(row as Row));
  }

  async getByIdInternal(id: string): Promise<ArtifactRecord | null> {
    const { data, error } = await this.writer.from("artifacts").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapArtifact(data as Row) : null;
  }
}
