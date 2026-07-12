// Controlled artifact publication. Artifacts are always created as private
// drafts (create_artifact_bundle hardcodes draft/is_public=false); this
// service is the only application path to draft -> published.
//
// Authorization policy (Phase 1.1): moderator/admin only. An owner keeps
// private drafts but cannot self-publish — a published artifact is a
// platform-level trust statement, so it goes through the same gate as
// publishing a submission. Enforced by the caller via requireModerator();
// re-asserted here so the service is safe even if a new call site forgets.
//
// The row-level validations that must hold atomically with the flip (input
// versions themselves published, provider_trace private, idempotent replay)
// live in the publish_artifact SQL function (migration 030) — this service
// adds the authorization and the not-found masking.
import type { Actor } from "@/contracts/capability";
import type { ArtifactRecord } from "@/contracts/artifact";
import { isModerator } from "@/domains/identity/actor";
import type { ArtifactRepository } from "./artifact-repository";

export type PublishArtifactResult =
  | { ok: true; artifact: ArtifactRecord }
  | { ok: false; reason: "not_found" | "forbidden" | "invalid"; error: string };

export class ArtifactPublicationService {
  constructor(private readonly artifacts: ArtifactRepository) {}

  async publish(artifactId: string, actor: Actor): Promise<PublishArtifactResult> {
    if (!isModerator({ role: actor.role, email: actor.email })) {
      // Same response as not-found so a non-moderator cannot probe which
      // private artifact ids exist.
      return { ok: false, reason: "not_found", error: "Artifact not found" };
    }

    const artifact = await this.artifacts.getByIdInternal(artifactId);
    if (!artifact) {
      return { ok: false, reason: "not_found", error: "Artifact not found" };
    }
    if (artifact.status === "published") {
      return { ok: true, artifact }; // idempotent
    }

    try {
      const published = await this.artifacts.publish(artifactId, actor.userId);
      return { ok: true, artifact: published };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, reason: "invalid", error: message };
    }
  }
}
