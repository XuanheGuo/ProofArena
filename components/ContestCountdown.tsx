"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Lock } from "lucide-react";
import { contestProblemPhaseMeta } from "@/lib/contest-meta";
import { getEffectiveProblemStatus, type Contest } from "@/lib/types";
import { formatContestDateTime } from "@/lib/format-contest-time";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toBeijingParts(date: Date) {
  const offset = 8 * 60;
  const local = new Date(date.getTime() + offset * 60_000);
  return {
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
  if (ms <= 0) return "00:00";
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
  if (days > 0) return `${days}d ${pad(hours)}h`;
  if (hours > 0) return `${hours}h ${pad(minutes)}m`;
  return `${minutes}m`;
}

// ─── Big countdown unit ───────────────────────────────────────────────────────

function DigitBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-3xl font-black tabular-nums leading-none tracking-tight text-white">
        {value}
      </span>
      <span className="mt-1 text-[10px] uppercase tracking-widest text-zinc-600">
        {label}
      </span>
    </div>
  );
}

function BigCountdown({
  ms,
  label,
  accent,
}: {
  ms: number;
  label: string;
  accent: "cyan" | "amber" | "emerald";
}) {
  if (ms <= 0) return null;
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const borderColor = {
    cyan: "border-cyan-400/25",
    amber: "border-amber-400/25",
    emerald: "border-emerald-500/25",
  }[accent];
  const dotColor = {
    cyan: "bg-cyan-400",
    amber: "bg-amber-400",
    emerald: "bg-emerald-400",
  }[accent];
  const labelColor = {
    cyan: "text-cyan-400",
    amber: "text-amber-400",
    emerald: "text-emerald-400",
  }[accent];

  return (
    <div
      className={`surface-panel-subtle ${borderColor} bg-black/20 px-4 py-4`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className={`size-1.5 ${dotColor}`} />
        <span
          className={`text-[11px] font-bold uppercase tracking-widest ${labelColor}`}
        >
          {label}
        </span>
      </div>
      <div className="flex items-end gap-3">
        {days > 0 && (
          <>
            <DigitBlock value={String(days)} label="天" />
            <span className="mb-5 font-mono text-xl font-black text-zinc-600">
              :
            </span>
          </>
        )}
        <DigitBlock value={pad(hours)} label="时" />
        <span className="mb-5 font-mono text-xl font-black text-zinc-600">
          :
        </span>
        <DigitBlock value={pad(minutes)} label="分" />
        <span className="mb-5 font-mono text-xl font-black text-zinc-600">
          :
        </span>
        <DigitBlock value={pad(seconds)} label="秒" />
      </div>
    </div>
  );
}

// ─── Small pill (for secondary milestones) ────────────────────────────────────

type CountdownItem = {
  label: string;
  targetMs: number;
  accent: "cyan" | "amber" | "emerald" | "zinc";
};

function SmallPill({
  label,
  targetMs,
  now,
  accent,
}: CountdownItem & { now: number }) {
  const remaining = targetMs - now;
  const text =
    remaining > 0
      ? remaining < 3_600_000
        ? formatDuration(remaining)
        : formatDurationLong(remaining)
      : "已过";

  const cls = {
    cyan: "border-cyan-400/20 text-cyan-300",
    amber: "border-amber-400/20 text-amber-300",
    emerald: "border-emerald-500/20 text-emerald-300",
    zinc: "border-white/10 text-zinc-500",
  }[accent];

  return (
    <div
      className={`flex items-center justify-between gap-3 border-b border-white/[0.05] px-3 py-2 last:border-0`}
    >
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`font-mono text-xs font-bold tabular-nums ${cls}`}>
        {text}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ContestCountdown({ contest }: { contest: Contest }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const refreshedAt = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, []);

  // Primary countdown: the most important upcoming timestamp.
  const primary = useMemo<{
    ms: number;
    label: string;
    accent: "cyan" | "amber" | "emerald";
  } | null>(() => {
    if (now === null) return null;
    const startMs = new Date(contest.startAt).getTime();
    const endMs = new Date(contest.endAt).getTime();
    if (contest.status === "draft" && startMs > now) {
      return { ms: startMs - now, label: "距开赛", accent: "cyan" };
    }
    if (contest.status === "active" && endMs > now) {
      return { ms: endMs - now, label: "距比赛结束", accent: "amber" };
    }
    if (contest.status === "judging") {
      const discussEnd = contest.discussionEndAt
        ? new Date(contest.discussionEndAt).getTime()
        : endMs;
      if (discussEnd > now)
        return { ms: discussEnd - now, label: "讨论期结束", accent: "emerald" };
    }
    return null;
  }, [contest, now]);

  // Secondary pills: next problem to open or close.
  const secondary = useMemo<CountdownItem[]>(() => {
    if (now === null) return [];
    if (contest.status !== "active") return [];
    const nowDate = new Date(now);
    const items: CountdownItem[] = [];
    const openProblems = contest.problems
      .filter((cp) => getEffectiveProblemStatus(cp, nowDate) === "open")
      .sort(
        (a, b) => new Date(a.closeAt).getTime() - new Date(b.closeAt).getTime(),
      );
    const lockedProblems = contest.problems
      .filter((cp) => getEffectiveProblemStatus(cp, nowDate) === "locked")
      .sort(
        (a, b) => new Date(a.openAt).getTime() - new Date(b.openAt).getTime(),
      );
    for (const cp of openProblems.slice(0, 2)) {
      items.push({
        label: `${cp.title}（Day ${cp.dayIndex}）截止`,
        targetMs: new Date(cp.closeAt).getTime(),
        accent: "emerald",
      });
    }
    for (const cp of lockedProblems.slice(0, 1)) {
      items.push({
        label: `${cp.title}（Day ${cp.dayIndex}）解锁`,
        targetMs: new Date(cp.openAt).getTime(),
        accent: "cyan",
      });
    }
    return items;
  }, [contest, now]);

  // Milestone-triggered page refresh.
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
    if (now === null) return;
    const upcoming = milestoneMs
      .filter((ms) => ms > now)
      .sort((a, b) => a - b)[0];
    if (!upcoming) return;
    const delay = upcoming - now + 2_000;
    const id = setTimeout(() => {
      if (refreshedAt.current !== upcoming) {
        refreshedAt.current = upcoming;
        router.refresh();
      }
    }, delay);
    return () => clearTimeout(id);
  }, [now, milestoneMs, router]);

  if (contest.status === "finished") return null;
  if (now === null) {
    return (
      <div className="space-y-3" aria-label="比赛倒计时加载中">
        <div className="surface-panel-subtle border-amber-400/25 bg-black/20 px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="size-1.5 bg-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
              同步倒计时
            </span>
          </div>
          <div className="h-8 w-48 max-w-full animate-pulse bg-white/[0.05]" />
        </div>
        <div className="surface-panel h-32 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {primary && (
        <BigCountdown
          ms={primary.ms}
          label={primary.label}
          accent={primary.accent}
        />
      )}
      {secondary.length > 0 && (
        <div className="surface-panel overflow-hidden">
          {secondary.map((item) => (
            <SmallPill key={item.label} {...item} now={now} />
          ))}
        </div>
      )}
      <ProblemTimeline contest={contest} now={now} />
    </div>
  );
}

// ─── Problem timeline ─────────────────────────────────────────────────────────

// Group problems by day; within each day show status dots and live countdown.
function ProblemTimeline({ contest, now }: { contest: Contest; now: number }) {
  if (contest.problems.length === 0) return null;

  // Deduplicate days (keep one entry per unique dayIndex).
  const days = [...new Set(contest.problems.map((cp) => cp.dayIndex))].sort(
    (a, b) => a - b,
  );
  const byDay = new Map<number, typeof contest.problems>();
  for (const cp of contest.problems) {
    if (!byDay.has(cp.dayIndex)) byDay.set(cp.dayIndex, []);
    byDay.get(cp.dayIndex)!.push(cp);
  }

  const nowDate = new Date(now);

  return (
    <div className="surface-panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-2.5">
        <CalendarDays className="size-3.5 text-cyan-400" />
        <span className="text-xs font-bold text-zinc-400">题目时间轴</span>
        <span className="ml-auto text-[10px] text-zinc-600">北京时间</span>
      </div>
      <div className="divide-y divide-white/[0.05]">
        {days.map((day) => {
          const problems = byDay.get(day)!;
          // The day is"open" if any of its problems is open right now.
          const dayStatus = problems.some(
            (cp) => getEffectiveProblemStatus(cp, nowDate) === "open",
          )
            ? "open"
            : problems.every(
                  (cp) => getEffectiveProblemStatus(cp, nowDate) === "closed",
                )
              ? "closed"
              : "locked";
          // Use the first problem's times for the day header.
          const firstCp = problems[0];
          const openParts = toBeijingParts(new Date(firstCp.openAt));
          const closeParts = toBeijingParts(new Date(firstCp.closeAt));
          // Find nearest milestone for this day.
          const openMs = new Date(firstCp.openAt).getTime();
          const closeMs = new Date(firstCp.closeAt).getTime();
          const remainingMs =
            dayStatus === "open"
              ? closeMs - now
              : dayStatus === "locked"
                ? openMs - now
                : 0;

          return (
            <div
              key={day}
              className={`px-4 py-3 ${dayStatus === "open" ? "bg-emerald-500/[0.03]" : ""}`}
            >
              {/* Day header row */}
              <div className="flex items-center gap-3 text-xs">
                <span className="w-12 shrink-0 font-mono font-bold text-cyan-400">
                  Day {day}
                </span>
                <StatusDot status={dayStatus} />
                <span className="min-w-0 flex-1 text-zinc-500">
                  {openParts.month}/{openParts.day} {pad(openParts.hour)}:
                  {pad(openParts.minute)}
                  {" –"}
                  {closeParts.month}/{closeParts.day} {pad(closeParts.hour)}:
                  {pad(closeParts.minute)}
                </span>
                {dayStatus === "open" && remainingMs > 0 && (
                  <span className="shrink-0 font-mono text-xs font-bold text-emerald-400">
                    {formatDuration(remainingMs)}
                  </span>
                )}
                {dayStatus === "locked" && remainingMs > 0 && (
                  <span className="shrink-0 text-xs text-zinc-600">
                    {formatDurationLong(remainingMs)} 后解锁
                  </span>
                )}
                {dayStatus === "closed" && (
                  <span className="shrink-0 text-xs text-zinc-700">已结束</span>
                )}
              </div>
              {/* Per-problem chips within the day */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {problems.map((cp) => {
                  const phase = cp.problemPhase ?? "daily";
                  const phaseMeta = contestProblemPhaseMeta[phase];
                  return (
                    <span
                      key={cp.id}
                      className={`inline-flex items-center border px-1.5 py-0.5 text-[10px] font-bold ${phaseMeta.className}`}
                    >
                      {phaseMeta.label}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: "open" | "closed" | "locked" }) {
  if (status === "open")
    return (
      <span className="flex size-2 shrink-0 bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/60" />
    );
  if (status === "locked")
    return <Lock className="size-3 shrink-0 text-zinc-700" />;
  return <span className="flex size-2 shrink-0 bg-zinc-700" />;
}
