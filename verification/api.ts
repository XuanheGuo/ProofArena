import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { VerificationError } from "./domain/errors";
import type { VerificationActor, VerificationTaskDto } from "./domain/types";

export async function getVerificationActor(): Promise<VerificationActor | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", data.user.id).maybeSingle();
  return { userId: data.user.id, email: data.user.email, role: profile?.role as string | undefined };
}

export function isVerificationAdmin(actor: VerificationActor): boolean {
  return actor.email === "xuanheguo@icloud.com" || ["moderator", "admin"].includes(actor.role ?? "");
}

export function taskResponse(task: VerificationTaskDto, actor: VerificationActor) {
  if (isVerificationAdmin(actor)) return task;
  const { providerErrorCode: _providerErrorCode, resultMetadata: _resultMetadata, userId: _userId, ...safe } = task;
  return safe;
}

export function verificationApiError(error: unknown) {
  if (error instanceof VerificationError) {
    return NextResponse.json({ error: { code: error.code, message: error.message, verdict: error.verdict } }, { status: error.httpStatus });
  }
  console.error("[verification] request failed", error instanceof Error ? error.message : "unknown error");
  return NextResponse.json({ error: { code: "internal_error", message: "验证服务暂时不可用。", verdict: "provider_error" } }, { status: 500 });
}

export function parseCreateBody(value: unknown) {
  if (!value || typeof value !== "object") throw new VerificationError("请求体格式无效。", "invalid_body", "invalid_request", 400);
  const body = value as Record<string, unknown>;
  if (body.engine !== "lean") throw new VerificationError("当前只支持 Lean 验证。", "unsupported_engine", "invalid_request", 400);
  if (typeof body.source !== "string") throw new VerificationError("source 必须是字符串。", "invalid_source", "invalid_request", 400);
  for (const key of ["problemId", "solutionId", "submissionId"] as const) {
    if (body[key] !== undefined && typeof body[key] !== "string") throw new VerificationError(`${key} 格式无效。`, "invalid_relation", "invalid_request", 400);
  }
  return {
    engine: "lean" as const, source: body.source,
    problemId: body.problemId as string | undefined,
    solutionId: body.solutionId as string | undefined,
    submissionId: body.submissionId as string | undefined,
  };
}
