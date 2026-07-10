"use client";

import { useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { Badge, Button, Panel } from "@/components/ui";
import type { VerificationTaskDto } from "@/verification/domain/types";
import { getVerificationDisplay, toBadgeTone } from "@/verification/ui-meta";

export function AdminVerificationsView({ tasks }: { tasks: VerificationTaskDto[] }) {
  const [health, setHealth] = useState<{ healthy?: boolean; enabled?: boolean; provider?: string; latencyMs?: number; message?: string } | null>(null);
  const [busyId, setBusyId] = useState("");

  async function checkHealth() {
    setHealth(null);
    const response = await fetch("/api/admin/verifications/health", { cache: "no-store" });
    setHealth(await response.json());
  }

  async function retry(id: string) {
    setBusyId(id);
    await fetch(`/api/admin/verifications/${id}/retry`, { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="mt-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-black text-white">验证任务</h1><p className="mt-1 text-sm text-zinc-500">规范化诊断与脱敏 Provider 状态</p></div>
        <Button onClick={checkHealth}><Activity className="size-4" />检查 Provider</Button>
      </div>
      {health && <Panel tone="subtle" className="p-4 text-sm text-zinc-300">Feature flag：{health.enabled ? "开启" : "关闭"} · Provider：{health.provider ?? "—"} · 健康：{health.healthy ? "是" : "否"}{health.latencyMs !== undefined ? ` · ${health.latencyMs} ms` : ""}{health.message ? ` · ${health.message}` : ""}</Panel>}
      <div className="overflow-x-auto border border-white/10">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-white/[0.04] text-zinc-500"><tr>{["时间", "用户/关联", "引擎", "状态", "耗时", "缓存", "诊断", "操作"].map((item) => <th key={item} className="px-3 py-2 font-bold">{item}</th>)}</tr></thead>
          <tbody className="divide-y divide-white/10">
            {tasks.map((task) => {
              const display = getVerificationDisplay(task);
              const retryable = ["provider_error", "timeout"].includes(task.verdict);
              return <tr key={task.id} className="text-zinc-400">
                {/* Explicit timeZone: this table is server-rendered from a force-dynamic
                    page, so server and client must format identically regardless of the
                    host machine's local zone, or React hydration will mismatch. */}
                <td className="whitespace-nowrap px-3 py-3">{new Date(task.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</td>
                <td className="px-3 py-3"><div className="font-mono">{task.userId?.slice(0, 8)}</div><div>{task.problemId || task.solutionId || task.submissionId || "—"}</div></td>
                <td className="px-3 py-3">{task.engine} / {task.provider}</td>
                <td className="px-3 py-3"><Badge tone={toBadgeTone(display.tone)}>{display.label}</Badge></td>
                <td className="px-3 py-3">{task.durationMs === undefined ? "—" : `${task.durationMs} ms`}</td>
                <td className="px-3 py-3">{task.cached ? "是" : "否"}</td>
                <td className="max-w-xs px-3 py-3"><div className="font-mono text-zinc-500">{task.providerErrorCode || "—"}</div>{task.messages.slice(0, 2).map((message, i) => <div key={i} className="mt-1">{message.message}</div>)}</td>
                <td className="px-3 py-3">{retryable && <Button size="sm" disabled={busyId === task.id} onClick={() => retry(task.id)}><RefreshCw className={`size-3 ${busyId === task.id ? "animate-spin" : ""}`} />重试</Button>}</td>
              </tr>;
            })}
          </tbody>
        </table>
        {tasks.length === 0 && <p className="p-6 text-center text-sm text-zinc-600">暂无验证任务。</p>}
      </div>
    </div>
  );
}
