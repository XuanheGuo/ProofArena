// GET /api/artifacts/[id] — get an artifact by ID with visibility enforcement
// Public artifacts: accessible to anonymous users
// Private artifacts: owner + moderator only (404 for others to prevent existence leak)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getServiceClient } from "@/platform/database/service-client";
import { CapabilityService } from "@/domains/capabilities/capability-service";
import { getDefaultCapabilityRegistry } from "@/domains/capabilities/registry";
import { buildDefaultRegistry } from "@/domains/capabilities/default-registry";
import { SupabaseCapabilityRunRepository } from "@/domains/capabilities/supabase-capability-run-repository";
import { SupabaseArtifactRepository } from "@/domains/artifacts/supabase-artifact-repository";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const serviceClient = getServiceClient();
  const registry = getDefaultCapabilityRegistry(buildDefaultRegistry);
  const service = new CapabilityService({
    registry,
    runRepository: new SupabaseCapabilityRunRepository(serviceClient),
    artifactRepository: new SupabaseArtifactRepository(serviceClient),
  });

  try {
    const artifact = await service.getArtifactById(id, {
      userId: user?.id ?? "anon",
      email: user?.email,
      role: user?.role,
    });

    if (!artifact) {
      // Return 404 for both non-existent and unauthorized artifacts
      // (prevents existence leak for private artifacts)
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }

    return NextResponse.json({ artifact });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Internal server error", details: message }, { status: 500 });
  }
}
