import type { VerificationTaskDto, VerificationVerdict } from "./domain/types";

export type VerificationDisplayTone = "neutral" | "success" | "danger" | "warning";
export type VerificationBadgeTone = "verified" | "danger" | "warning" | "neutral";

export function getVerificationDisplay(task: Pick<VerificationTaskDto, "status" | "verdict">): { label: string; tone: VerificationDisplayTone } {
  if (task.status === "queued" || task.status === "running") return { label: "正在验证", tone: "neutral" };
  const labels: Record<VerificationVerdict, { label: string; tone: VerificationDisplayTone }> = {
    accepted: { label: "Lean 验证通过", tone: "success" },
    rejected: { label: "证明未通过", tone: "danger" },
    invalid_request: { label: "输入不符合验证策略", tone: "warning" },
    timeout: { label: "验证超时", tone: "warning" },
    rate_limited: { label: "请求过于频繁", tone: "warning" },
    resource_limit: { label: "输入超过资源限制", tone: "warning" },
    // Distinct from "rejected" (danger/red): this is an infrastructure
    // failure, not a judgment on the proof, and must not read as one.
    provider_error: { label: "验证服务暂时不可用", tone: "warning" },
    cancelled: { label: "验证已取消", tone: "neutral" },
  };
  return labels[task.verdict];
}

// Single source of truth for mapping a display tone to the Badge component's
// tone prop, so call sites can't hand-duplicate (and drift from) this mapping.
export function toBadgeTone(tone: VerificationDisplayTone): VerificationBadgeTone {
  if (tone === "success") return "verified";
  if (tone === "danger") return "danger";
  if (tone === "warning") return "warning";
  return "neutral";
}
