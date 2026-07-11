import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { ArtifactPublicationService } from "@/domains/artifacts/artifact-publication-service";
import { SupabaseArtifactRepository } from "@/domains/artifacts/supabase-artifact-repository";
import { isModerator } from "@/lib/is-moderator";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceRoleClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user role
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const actor = {
    userId: user.id,
    email: user.email ?? "",
    role: profile?.role || "user",
  };

  // Only moderators can publish (Phase 1.1 policy)
  if (!isModerator({ role: actor.role, email: actor.email })) {
    return NextResponse.json({ error: "Only moderators can publish artifacts" }, { status: 403 });
  }

  const repository = new SupabaseArtifactRepository(supabase);
  const service = new ArtifactPublicationService(repository);

  try {
    const result = await service.publish({
      artifactId: params.id,
      actor,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.artifact);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Publication failed" },
      { status: 500 }
    );
  }
}
