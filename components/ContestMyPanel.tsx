"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, LogIn, MessageSquareText, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { formatContestDateTime } from "@/lib/format-contest-time";
import type { Contest, ContestProblem } from "@/lib/types";

type MySubmission = {
  id: string;
  problem_id: string | null;
  draft_problem_id: string | null;
  contest_problem_key: string | null;
  title: string;
  status: "pending" | "approved" | "rejected" | "needs_revision";
  created_at: string;
  is_post_contest: boolean | null;
};

type ProblemEntry = {
  contestProblem: ContestProblem;
  problemTitle: string | null;
  submissions: MySubmission[];
};

const statusMeta: Record<
  MySubmission["status"],
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  pending: { label: "待审核", className: "border-amber-400/40 bg-amber-400/[0.07] text-amber-300", icon: Clock },
  approved: { label: "已通过", className: "border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-300", icon: CheckCircle2 },
  rejected: { label: "已拒绝", className: "border-red-500/40 bg-red-500/[0.07] text-red-300", icon: XCircle },
  needs_revision: { label: "需修改", className: "border-cyan-400/40 bg-cyan-400/[0.07] text-cyan-300", icon: MessageSquareText },
};

export function ContestMyPanel({
  contest,
  problemTitles,
}: {
  contest: Contest;
  problemTitles: Record<string, string>;
}) {
  const supabase = createClient();
  const [user, setUser] = useState<{ id: string } | null | undefined>(undefined);
  const [submissions, setSubmissions] = useState<MySubmission[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("submissions")
      .select("id, problem_id, draft_problem_id, contest_problem_key, title, status, created_at, is_post_contest")
      .eq("contest_slug", contest.slug)
      .eq("submission_type", "solution")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setSubmissions((data ?? []) as MySubmission[]);
        setLoading(false);
      });
  }, [user, contest.slug]);

  // Still checking auth
  if (user === undefined) return null;

  if (user === null) {
    return (
      <section className="border border-white/10 bg-zinc-950 p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <MessageSquareText className="size-4 text-zinc-400" />
          我的参赛状态
        </div>
        <div className="mt-4 flex items-center gap-3 border border-amber-400/20 bg-amber-400/[0.04] px-4 py-3">
          <LogIn className="size-4 shrink-0 text-amber-400" />
          <p className="text-sm text-zinc-400">
            <Link href="/auth/login" className="font-bold text-cyan-300 hover:underline">登录</Link>
            {" "}后可以查看你在本场比赛每道题的投稿状态。
          </p>
        </div>
      </section>
    );
  }

  const entries: ProblemEntry[] = contest.problems.map((cp) => {
    const mySubs = submissions.filter((s) => {
      if (s.contest_problem_key === cp.id) return true;
      if (s.problem_id && s.problem_id === cp.problemId) return true;
      if (s.draft_problem_id && s.draft_problem_id === cp.draftProblemId) return true;
      return false;
    });
    const title = cp.problemId
      ? (problemTitles[cp.problemId] ?? null)
      : cp.draftProblemId
        ? (problemTitles[cp.draftProblemId] ?? null)
        : null;
    return { contestProblem: cp, problemTitle: title, submissions: mySubs };
  });

  const totalSubs = submissions.filter((s) => !s.is_post_contest).length;
  const approvedSubs = submissions.filter((s) => s.status === "approved").length;

  return (
    <section className="border border-white/10 bg-zinc-950 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <MessageSquareText className="size-4 text-cyan-300" />
          我的参赛状态
        </div>
        <div className="text-xs text-zinc-500">
          {totalSubs > 0 && `${totalSubs} 份投稿${approvedSubs > 0 ? `，${approvedSubs} 份已通过` : ""}`}
        </div>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-white/[0.03]" />)}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {entries.map(({ contestProblem, problemTitle, submissions: mySubs }) => {
            const officialSubs = mySubs.filter((s) => !s.is_post_contest);
            const latestSub = mySubs[0];
            const bestStatus = officialSubs.find((s) => s.status === "approved")?.status
              ?? officialSubs.find((s) => s.status === "needs_revision")?.status
              ?? officialSubs.find((s) => s.status === "pending")?.status
              ?? officialSubs[0]?.status
              ?? null;
            const meta = bestStatus ? statusMeta[bestStatus] : null;
            const StatusIcon = meta?.icon;

            return (
              <div
                key={contestProblem.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border border-white/[0.07] bg-black/20 px-4 py-3"
              >
                <span className="shrink-0 border border-cyan-400/25 bg-cyan-400/[0.06] px-2 py-0.5 font-mono text-xs font-bold text-cyan-300">
                  Day {contestProblem.dayIndex}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">
                    {problemTitle ?? contestProblem.title}
                  </p>
                  {latestSub && (
                    <p className="mt-0.5 text-[11px] text-zinc-600">
                      {mySubs.length} 次投稿 · 最近：{formatContestDateTime(latestSub.created_at)}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {meta && StatusIcon ? (
                    <span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] font-bold ${meta.className}`}>
                      <StatusIcon className="size-3" />
                      {meta.label}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-600">未提交</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-5 text-zinc-600">
        仅显示你自己的投稿状态，其他参赛者的投稿在结束前不可见。
      </p>
    </section>
  );
}
