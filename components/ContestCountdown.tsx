"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, Lock, Unlock } from "lucide-react";
import { getEffectiveProblemStatus, type Contest, type ContestProblem } from "@/lib/types";
import { formatContestDateTime } from "@/lib/format-contest-time";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toBeijingParts(date: Date) {
  // Asia/Shanghai = UTC+8, no DST
  const offset = 8 * 60;
  const local = new Date(date.getTime() + offset * 60_000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatDuration(ms: number) {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

function formatDurationLong(ms: number) {
  if (ms <= 0) return "即将开始";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分`;
  return `${minutes} 分钟`;
}

// ─── Countdown pill ───────────────────────────────────────────────────────────

type CountdownItem = {
  label: string;
  targetMs: number;
  accent: "cyan" | "amber" | "emerald" | "zinc";
};

function CountdownPill({ label, targetMs, now, accent }: CountdownItem & { now: number }) {
  const remaining = targetMs - now;
  const text = remaining > 0
    ? (remaining < 3600_000 ? formatDuration(remaining) : formatDurationLong(remaining))
    : "已过";
  const accentClass = {
    cyan: "border-cyan-400/30 bg-cyan-400/[0.07] text-cyan-300",
    amber: "border-amber-400/30 bg-amber-400/[0.07] text-amber-300",
    emerald: "border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-300",
    zinc: "border-zinc-500/30 bg-zinc-800 text-zinc-400",
  }[accent];

  return (
    <div className={`flex flex-col items-center border px-4 py-3 text-center ${accentClass}`}>
      <span className="text-[11px] uppercase tracking-wide opacity-70">{label}</span>
      <span className="mt-1 font-mono text-lg font-bold tabular-nums leading-none">{text}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ContestCountdown({ contest }: { contest: Contest }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const refreshedAt = useRef<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const countdownItems = useMemo<CountdownItem[]>(() => {
    const startMs = new Date(contest.startAt).getTime();
    const endMs = new Date(contest.endAt).getTime();
    const items: CountdownItem[] = [];

    if (contest.status === "draft") {
      items.push({ label: "距开赛", targetMs: startMs, accent: "cyan" });
      return items;
    }

    if (contest.status === "active") {
      items.push({ label: "距比赛结束", targetMs: endMs, accent: "amber" });

      const nowDate = new Date(now);
      const openProblems = contest.problems.filter(
        (cp) => getEffectiveProblemStatus(cp, nowDate) === "open",
      );
      const lockedProblems = contest.problems
        .filter((cp) => getEffectiveProblemStatus(cp, nowDate) === "locked")
        .sort((a, b) => new Date(a.openAt).getTime() - new Date(b.openAt).getTime());

      for (const cp of openProblems.slice(0, 1)) {
        const closeMs = new Date(cp.closeAt).getTime();
        items.push({ label: `Day ${cp.dayIndex} 截止`, targetMs: closeMs, accent: "emerald" });
      }
      for (const cp of lockedProblems.slice(0, 1)) {
        const openMs = new Date(cp.openAt).getTime();
        items.push({ label: `Day ${cp.dayIndex} 解锁`, targetMs: openMs, accent: "cyan" });
      }
    }

    if (contest.status === "judging") {
      items.push({ label: "评审阶段", targetMs: 0, accent: "amber" });
    }

    return items;
  }, [contest, now]);

  // Refresh page when a key milestone passes (start, problem open/close, end).
  const milestoneMs = useMemo(() => {
    const ms: number[] = [
      new Date(contest.startAt).getTime(),
      new Date(contest.endAt).getTime(),
    ];
    for (const cp of contest.problems) {
      ms.push(new Date(cp.openAt).getTime());
      ms.push(new Date(cp.closeAt).getTime());
    }
    return ms;
  }, [contest]);

  useEffect(() => {
    const upcoming = milestoneMs
      .filter((ms) => ms > now)
      .sort((a, b) => a - b)[0];
    if (!upcoming) return;
    const delay = upcoming - now + 2_000; // 2s grace
    const id = setTimeout(() => {
      if (refreshedAt.current !== upcoming) {
        refreshedAt.current = upcoming;
        router.refresh();
      }
    }, delay);
    return () => clearTimeout(id);
  }, [now, milestoneMs, router]);

  if (countdownItems.length === 0 && contest.status === "finished") return null;

  return (
    <div className="space-y-3">
      {countdownItems.length > 0 && (
        <div className={`grid gap-3 ${countdownItems.length === 1 ? "grid-cols-1" : countdownItems.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {countdownItems.map((item) => (
            <CountdownPill key={item.label} {...item} now={now} />
          ))}
        </div>
      )}

      <ProblemTimeline contest={contest} now={now} />
    </div>
  );
}

// ─── Problem timeline ─────────────────────────────────────────────────────────

function ProblemTimeline({ contest, now }: { contest: Contest; now: number }) {
  if (contest.problems.length === 0) return null;

  return (
    <div className="border border-white/10 bg-zinc-950">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-xs font-bold text-zinc-400">
        <CalendarDays className="size-3.5 text-cyan-400" />
        题目时间轴（北京时间）
      </div>
      <div className="divide-y divide-white/[0.06]">
        {contest.problems.map((cp) => {
          const status = getEffectiveProblemStatus(cp, new Date(now));
          const openMs = new Date(cp.openAt).getTime();
          const closeMs = new Date(cp.closeAt).getTime();

          const openParts = toBeijingParts(new Date(cp.openAt));
          const closeParts = toBeijingParts(new Date(cp.closeAt));

          const remainingMs = status === "open" ? closeMs - now : status === "locked" ? openMs - now : 0;

          return (
            <div key={cp.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 text-xs ${status === "open" ? "bg-emerald-500/[0.04]" : ""}`}>
              <span className="w-12 shrink-0 font-mono font-bold text-cyan-400">Day {cp.dayIndex}</span>

              <StatusDot status={status} />

              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white">{cp.title}</p>
                <p className="mt-0.5 text-zinc-500">
                  {openParts.month}/{openParts.day} {pad(openParts.hour)}:{pad(openParts.minute)}
                  {" "}—{" "}
                  {closeParts.month}/{closeParts.day} {pad(closeParts.hour)}:{pad(closeParts.minute)}
                </p>
              </div>

              {status === "open" && remainingMs > 0 && (
                <span className="shrink-0 font-mono text-emerald-300">
                  剩 {formatDuration(remainingMs)}
                </span>
              )}
              {status === "locked" && remainingMs > 0 && (
                <span className="shrink-0 text-zinc-500">
                  {formatDurationLong(remainingMs)} 后解锁
                </span>
              )}
              {status === "closed" && (
                <span className="shrink-0 text-zinc-600">已结束</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: ReturnType<typeof getEffectiveProblemStatus> }) {
  if (status === "open") return <span className="flex size-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/70" />;
  if (status === "locked") return <Lock className="size-3.5 shrink-0 text-zinc-600" />;
  if (status === "closed") return <span className="flex size-2 shrink-0 rounded-full bg-zinc-600" />;
  return <span className="flex size-2 shrink-0 rounded-full bg-amber-400" />;
}
