// GET /api/artifacts/[id] — get an artifact by ID.
// Visibility is enforced by RLS (migration 028): public artifacts are
// readable anonymously; drafts only by the run owner or a moderator. The
// repository reads through the caller's cookie client (anon role when there
// is no session), and 404 covers both non-existent and non-visible — no
// existence leak. The response is the row RLS returned; private evidence and
// input snapshots live in other tables and are never joined in here.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { buildCapabilityService } from "@/domains/capabilities/build-capability-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const service = buildCapabilityService(supabase);
  try {
    const artifact = await service.getArtifactById(id, {
      userId: user?.id ?? "anon",
      email: user?.email,
      role: user?.role,
    });
    if (!artifact) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }
    return NextResponse.json({ artifact });
  } catch (error) {
    console.error("artifact read failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
