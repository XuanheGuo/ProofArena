// GET /api/artifacts/[id] — get an artifact by ID with visibility enforcement
// (public=everyone, owner+moderator only otherwise)
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

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = getServiceClient();
  const registry = getDefaultCapabilityRegistry(buildDefaultRegistry);
  const service = new CapabilityService({
    registry,
    runRepository: new SupabaseCapabilityRunRepository(serviceClient),
    artifactRepository: new SupabaseArtifactRepository(serviceClient),
  });

  try {
    const artifact = await service.getArtifactById(id, {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    if (!artifact) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }

    return NextResponse.json({ artifact });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Internal server error", details: message }, { status: 500 });
  }
}
