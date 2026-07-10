import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { createVerificationService } from "@/verification";
import { getVerificationActor, isVerificationAdmin, taskResponse, verificationApiError } from "@/verification/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Retrying synchronously awaits a full AXLE round-trip (create() -> LeanEngine
// -> AxleProvider), same as POST /api/verifications; match its budget so this
// route isn't killed by the platform's default duration before AXLE responds.
export const maxDuration = 300;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getVerificationActor();
    if (!actor || !isVerificationAdmin(actor)) return NextResponse.json({ error: { code: "forbidden", message: "无权重新验证。" } }, { status: 403 });
    const { id } = await context.params;
    const { data } = await createServiceClient().from("verification_tasks")
      .select("engine,source_snapshot,problem_id,solution_id,submission_id,verdict,environment")
      .eq("id", id).maybeSingle();
    if (!data || !["provider_error", "timeout"].includes(data.verdict as string) || typeof data.source_snapshot !== "string") {
      return NextResponse.json({ error: { code: "not_retryable", message: "该任务不可重新验证。" } }, { status: 400 });
    }
    const task = await createVerificationService().create(actor, {
      engine: "lean", source: data.source_snapshot,
      problemId: data.problem_id ?? undefined, solutionId: data.solution_id ?? undefined,
      submissionId: data.submission_id ?? undefined, environment: data.environment ?? undefined,
    });
    return NextResponse.json(taskResponse(task, actor), { status: 201 });
  } catch (error) { return verificationApiError(error); }
}
