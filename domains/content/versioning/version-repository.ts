import type { ContentVersionRecord, CreateVersionInput, VersionDedupResult } from "@/contracts/content";

export interface VersionRepository<TContent = unknown> {
  getLatest(entityId: string): Promise<ContentVersionRecord<TContent> | null>;
  getById(versionId: string): Promise<ContentVersionRecord<TContent> | null>;
  /** Creates a new version, or returns the existing latest one unchanged if its content_hash already matches. */
  createVersion(input: CreateVersionInput<TContent>): Promise<VersionDedupResult<TContent>>;
  setCurrentVersion(entityId: string, versionId: string): Promise<void>;
}
