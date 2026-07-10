"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, Loader2, ShieldCheck } from "lucide-react";
import { Badge, Button, Panel } from "@/components/ui";
import type { VerificationTaskDto } from "@/verification/domain/types";
import { isStrictlyLeanVerified } from "@/verification/domain/policies";
import { getVerificationDisplay, toBadgeTone } from "@/verification/ui-meta";

const STARTER = `import Mathlib

theorem example_proof : 1 + 1 = 2 := by
  norm_num
`;

function Result({ task }: { task: VerificationTaskDto }) {
  const display = getVerificationDisplay(task);
  const verified = isStrictlyLeanVerified(task);
  return (
    <Panel tone="subtle" className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={toBadgeTone(display.tone)}>{display.label}</Badge>
        {verified && <Badge tone="verified"><ShieldCheck className="size-3" /> Lean Verified</Badge>}
        {task.cached && <Badge tone="neutral">缓存结果</Badge>}
      </div>
      <dl className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
        <div><dt>环境</dt><dd className="mt-1 text-zinc-300">{task.environment || "—"}</dd></div>
        <div><dt>耗时</dt><dd className="mt-1 text-zinc-300">{task.durationMs === undefined ? "—" : `${task.durationMs} ms`}</dd></div>
        <div><dt>任务</dt><dd className="mt-1 font-mono text-zinc-300">{task.id.slice(0, 8)}</dd></div>
      </dl>
      {(task.messages.length > 0 || (task.failedDeclarations?.length ?? 0) > 0) && (
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
          {task.messages.map((message, index) => (
            <div key={`${message.code ?? "message"}-${index}`} className="border-l border-amber-400/40 pl-3 text-sm leading-6 text-zinc-300">
              <span className="mr-2 font-mono text-xs text-zinc-500">{message.line !== undefined ? `${message.line}${message.column !== undefined ? `:${message.column}` : ""}` : message.severity}</span>
              {message.message}
            </div>
          ))}
          {task.failedDeclarations?.map((name) => <div key={name} className="text-sm text-red-300">未通过声明：<code>{name}</code></div>)}
        </div>
      )}
    </Panel>
  );
}

export function LeanVerificationWorkspace({ problemId, enabled }: { problemId: string; enabled: boolean }) {
  const [source, setSource] = useState(STARTER);
  const [current, setCurrent] = useState<VerificationTaskDto | null>(null);
  const [history, setHistory] = useState<VerificationTaskDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    const response = await fetch(`/api/verifications?problemId=${encodeURIComponent(problemId)}&limit=8`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json() as { tasks?: VerificationTaskDto[] };
    setHistory(payload.tasks ?? []);
  }, [problemId]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  useEffect(() => {
    if (!current || !["queued", "running"].includes(current.status)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/verifications/${current.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const task = await response.json() as VerificationTaskDto;
      setCurrent(task);
      if (!["queued", "running"].includes(task.status)) { setBusy(false); void loadHistory(); }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [current, loadHistory]);

  async function verify() {
    setBusy(true); setError(""); setCurrent(null);
    try {
      const response = await fetch("/api/verifications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine: "lean", source, problemId }),
      });
      const payload = await response.json() as VerificationTaskDto | { error?: { message?: string } };
      if (!response.ok) { setError("error" in payload ? payload.error?.message || "验证请求失败。" : "验证请求失败。"); setBusy(false); return; }
      const task = payload as VerificationTaskDto;
      setCurrent(task);
      if (!["queued", "running"].includes(task.status)) { setBusy(false); await loadHistory(); }
    } catch { setError("无法连接验证服务，请稍后重试。"); setBusy(false); }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-black text-white">Lean 形式化验证</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">提交完整 Lean 文件。服务端会固定 Provider 与环境；`sorry`、`admit`、`axiom`、`unsafe` 或失败声明不会获得验证徽章。文件中的 <code>import</code> 语句仅供阅读参考——实际验证始终使用服务端固定的环境（含 Mathlib），不会按你写的 import 解析。</p>
      </div>
      {!enabled && <div className="border border-amber-400/30 bg-amber-400/[0.06] p-4 text-sm text-amber-200">形式化验证暂时不可用；已有验证历史仍可查看。</div>}
      <Panel className="p-4">
        <label htmlFor="lean-source" className="text-xs font-bold text-zinc-400">Lean 源码（最大 64 KiB）</label>
        <textarea id="lean-source" value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false}
          className="mt-3 min-h-80 w-full resize-y border border-white/10 bg-black/30 p-4 font-mono text-sm leading-6 text-zinc-200 outline-none focus:border-cyan-400/50" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-zinc-600">{new TextEncoder().encode(source).length} bytes</span>
          <Button tone="primary" onClick={verify} disabled={!enabled || busy || !source.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {busy ? "验证中" : "验证 Lean 证明"}
          </Button>
        </div>
      </Panel>
      {error && <div className="border border-amber-400/30 bg-amber-400/[0.06] p-4 text-sm text-amber-200">{error}</div>}
      {current && <Result task={current} />}
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><Clock3 className="size-4 text-zinc-500" />最近验证历史</h3>
        {history.length === 0 ? <p className="mt-3 text-sm text-zinc-600">登录后可查看自己的验证记录；当前尚无历史。</p> : (
          <div className="mt-3 grid gap-2">
            {history.map((task) => {
              const display = getVerificationDisplay(task);
              return <button type="button" key={task.id} onClick={() => setCurrent(task)} className="flex items-center justify-between gap-3 border border-white/10 bg-black/20 px-3 py-2 text-left text-xs text-zinc-400 hover:border-white/20">
                <span className="flex items-center gap-2">{isStrictlyLeanVerified(task) && <CheckCircle2 className="size-3 text-emerald-400" />} {display.label}</span>
                <span>{new Date(task.createdAt).toLocaleString("zh-CN")} {task.cached ? "· 缓存" : ""}</span>
              </button>;
            })}
          </div>
        )}
      </div>
    </section>
  );
}
