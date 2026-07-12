// POST /api/artifacts/[id]/publish — flip a draft artifact to published.
// Moderator/admin only, through the same requireModerator() gate as every
// other moderator action (CLAUDE.md: never re-implement the check inline).
// Row-level publish validations (input versions published, provider_trace
// private, idempotency) run atomically inside the publish_artifact SQL
// function; failures surface as 422 with the database's reason.
import { NextRequest, NextResponse } from "next/server";
import { requireModerator } from "@/lib/require-moderator";
import { getServiceClient } from "@/platform/database/service-client";
import { ArtifactPublicationService } from "@/domains/artifacts/artifact-publication-service";
import { SupabaseArtifactRepository } from "@/domains/artifacts/supabase-artifact-repository";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await requireModerator();
  if (!gate.ok) {
    // Non-moderators get 404, not 403 — a private artifact id must not be
    // probeable through this endpoint.
    const status = gate.reason === "unauthenticated" ? 401 : 404;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Artifact not found" }, { status });
  }

  const writer = getServiceClient();
  // The gate already proved moderator; moderators can read every artifact, so
  // the service-role client doubles as the reader here without widening access.
  const repository = new SupabaseArtifactRepository(writer, writer);
  const service = new ArtifactPublicationService(repository);

  try {
    const result = await service.publish(id, { userId: gate.userId, email: gate.email, role: "moderator" });
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
      }
      return NextResponse.json({ error: result.error, code: "PUBLICATION_REJECTED" }, { status: 422 });
    }
    return NextResponse.json({ artifact: result.artifact });
  } catch (error) {
    console.error("artifact publish failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
