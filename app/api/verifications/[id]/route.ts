import { NextRequest, NextResponse } from "next/server";
import { createVerificationService } from "@/verification";
import { getVerificationActor, taskResponse, verificationApiError } from "@/verification/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getVerificationActor();
    if (!actor) return NextResponse.json({ error: { code: "unauthenticated", message: "需要登录后才能查看验证记录。" } }, { status: 401 });
    const { id } = await context.params;
    const task = await createVerificationService().get(id, actor);
    if (!task) return NextResponse.json({ error: { code: "not_found", message: "验证记录不存在或无权查看。" } }, { status: 404 });
    return NextResponse.json(taskResponse(task, actor));
  } catch (error) { return verificationApiError(error); }
}
