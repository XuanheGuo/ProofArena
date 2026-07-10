import { NextResponse } from "next/server";
import { createAxleProvider } from "@/verification";
import { getVerificationConfig } from "@/verification/service/config";
import { getVerificationActor, isVerificationAdmin, verificationApiError } from "@/verification/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await getVerificationActor();
    if (!actor || !isVerificationAdmin(actor)) return NextResponse.json({ error: { code: "forbidden", message: "无权查看 Provider 状态。" } }, { status: 403 });
    const config = getVerificationConfig();
    const health = await createAxleProvider().healthCheck();
    return NextResponse.json({ enabled: config.leanEnabled, provider: config.leanProvider, environments: config.allowedEnvironments, ...health });
  } catch (error) { return verificationApiError(error); }
}
