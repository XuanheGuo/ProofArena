// GET /api/capabilities/runs/[id] — get a specific capability run by ID.
// Visibility is enforced by RLS (migration 028: owner or moderator), because
// the repository reads through the caller's cookie client. 404 for both
// non-existent and non-visible runs — no existence leak.
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
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = buildCapabilityService(supabase);
  try {
    const run = await service.getRunById(id, { userId: user.id, email: user.email, role: user.role });
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    return NextResponse.json({ run });
  } catch (error) {
    console.error("capability run read failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
