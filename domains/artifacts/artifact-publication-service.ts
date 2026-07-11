// Controlled artifact publication service. Artifacts are created as private drafts
// by default. Publication requires explicit validation and authorization.
// See PHASE_1_1_AUDIT.md P0-4 for rationale.

import type { Actor } from "@/contracts/capability";
import type { ArtifactRecord } from "@/contracts/artifact";
import { isModerator } from "@/lib/is-moderator";
import type { ArtifactRepository } from "./artifact-repository";

export interface PublishArtifactRequest {
  artifactId: string;
  actor: Actor;
}

export interface PublishArtifactResult {
  success: boolean;
  artifact?: ArtifactRecord;
  error?: string;
}

export class ArtifactPublicationService {
  constructor(private readonly artifactRepository: ArtifactRepository) {}

  async publish(request: PublishArtifactRequest): Promise<PublishArtifactResult> {
    const { artifactId, actor } = request;

    // 1. Fetch artifact
    const artifact = await this.artifactRepository.findById(artifactId, actor);

    if (!artifact) {
      return { success: false, error: "Artifact not found" };
    }

    // 2. Authorization: only owner or moderator can publish
    const isMod = isModerator({ role: actor.role, email: actor.email });
    const isOwner = artifact.createdBy === actor.userId;

    if (!isMod && !isOwner) {
      return { success: false, error: "Not authorized to publish this artifact" };
    }

    // 3. Validate current state
    if (artifact.status === "published") {
      return { success: true, artifact }; // Already published, idempotent
    }

    if (artifact.status !== "draft") {
      return { success: false, error: `Cannot publish artifact with status: ${artifact.status}` };
    }

    // 4. Validate payload integrity
    // TODO: Add schema validation when phase 2 implements schema validators
    if (!artifact.payload || typeof artifact.payload !== "object") {
      return { success: false, error: "Artifact payload is invalid" };
    }

    // 5. Validate evidence (provider_trace must stay private)
    const evidence = await this.artifactRepository.findEvidenceByArtifactId(artifactId, actor);
    const publicProviderTrace = evidence.find((ev) => ev.kind === "provider_trace" && ev.isPublic);

    if (publicProviderTrace) {
      return { success: false, error: "Cannot publish: provider_trace evidence is marked public" };
    }

    // 6. Publication implementation
    // NOTE: This is a placeholder. Actual implementation needs direct DB update
    // via service-role client, which requires extending ArtifactRepository interface.
    // For Phase 1.1, we document the requirement but defer full implementation.

    return {
      success: false,
      error: "Publication not yet implemented - requires repository.updateStatus() method",
    };
  }
}
