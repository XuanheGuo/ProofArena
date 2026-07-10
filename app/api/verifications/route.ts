import { NextRequest, NextResponse } from "next/server";
import { createVerificationService } from "@/verification";
import { getVerificationActor, isVerificationAdmin, parseCreateBody, taskResponse, verificationApiError } from "@/verification/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const actor = await getVerificationActor();
    if (!actor) return NextResponse.json({ error: { code: "unauthenticated", message: "需要登录后才能创建验证任务。", verdict: "invalid_request" } }, { status: 401 });
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 300 * 1024) return NextResponse.json({ error: { code: "body_too_large", message: "请求体过大。", verdict: "resource_limit" } }, { status: 413 });
    const body = parseCreateBody(await request.json().catch(() => null));
    const task = await createVerificationService().create(actor, body, request.signal);
    return NextResponse.json(taskResponse(task, actor), { status: task.status === "queued" || task.status === "running" ? 202 : 201 });
  } catch (error) { return verificationApiError(error); }
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getVerificationActor();
    if (!actor) return NextResponse.json({ error: { code: "unauthenticated", message: "需要登录后才能查看验证记录。" } }, { status: 401 });
    const params = request.nextUrl.searchParams;
    const filters = {
      problemId: params.get("problemId") ?? undefined,
      engine: params.get("engine") ?? undefined,
      provider: params.get("provider") ?? undefined,
      status: params.get("status") as never || undefined,
      verdict: params.get("verdict") as never || undefined,
      userId: isVerificationAdmin(actor) ? params.get("userId") ?? undefined : undefined,
      limit: Math.min(Number(params.get("limit") ?? 20) || 20, 100),
    };
    const tasks = await createVerificationService().list(actor, filters);
    return NextResponse.json({ tasks: tasks.map((task) => taskResponse(task, actor)) });
  } catch (error) { return verificationApiError(error); }
}
