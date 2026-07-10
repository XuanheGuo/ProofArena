import type { VerificationTaskDto, VerificationVerdict } from "./domain/types";

export function getVerificationDisplay(task: Pick<VerificationTaskDto, "status" | "verdict">): { label: string; tone: "neutral" | "success" | "danger" | "warning" } {
  if (task.status === "queued" || task.status === "running") return { label: "正在验证", tone: "neutral" };
  const labels: Record<VerificationVerdict, { label: string; tone: "neutral" | "success" | "danger" | "warning" }> = {
    accepted: { label: "Lean 验证通过", tone: "success" },
    rejected: { label: "证明未通过", tone: "danger" },
    invalid_request: { label: "输入不符合验证策略", tone: "warning" },
    timeout: { label: "验证超时", tone: "warning" },
    rate_limited: { label: "请求过于频繁", tone: "warning" },
    resource_limit: { label: "输入超过资源限制", tone: "warning" },
    provider_error: { label: "验证服务暂时不可用", tone: "danger" },
    cancelled: { label: "验证已取消", tone: "neutral" },
  };
  return labels[task.verdict];
}
