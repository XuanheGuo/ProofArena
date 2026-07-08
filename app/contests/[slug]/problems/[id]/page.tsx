import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { ProblemDetailExperience } from "@/components/ProblemDetailExperience";
import { ContestSprintPanel } from "@/components/ContestSprintPanel";
import { getProblem, getProblemSummaries } from "@/lib/db";
import { getContestForProblem, getContests } from "@/lib/contests";
import { getKnowledgeNodesForProblem, getRelatedProblemSummaries, redactLockedProblem } from "@/lib/problem-detail-helpers";
import { adaptProblemDraftToProblem, getProblemDraftForContestDisplay } from "@/lib/problem-drafts";
import { isContestProblemLocked, type Contest, type ContestProblem, type Problem } from "@/lib/types";
import { formatContestDateTime } from "@/lib/format-contest-time";

// This page decides locked-vs-open server-side. Keep it dynamic so scheduled
// unlocks and manual admin unlocks are visible on the next refresh instead
// of waiting for an ISR window to expire.
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const contests = await getContests();
  return contests.flatMap((contest) =>
    contest.problems
      .filter((contestProblem) => contestProblem.problemId || contestProblem.draftProblemId)
      .map((contestProblem) => ({
        slug: contest.slug,
        id: (contestProblem.problemId ?? contestProblem.draftProblemId) as string,
      }))
  );
}

// A contest problem is backed by exactly one of a public `problems` row or a
// Problem Vault draft (never both — enforced by a DB check constraint). Only
// call this after the caller has confirmed the contest problem is unlocked:
// the draft branch does a trusted, RLS-bypassing read (see
// getProblemDraftForContestDisplay's own doc comment for why that's safe
// here but never safe from a client component).
async function resolveContestProblem(contestProblem: ContestProblem, id: string): Promise<Problem | null> {
  if (contestProblem.problemId) {
    return getProblem(id);
  }
  if (contestProblem.draftProblemId) {
    const draft = await getProblemDraftForContestDisplay(contestProblem.draftProblemId);
    return draft ? adaptProblemDraftToProblem(draft) : null;
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const contestContext = await getContestForProblem(id, slug);
  if (!contestContext) return {};

  // Locked (not-yet-open, or contest still in draft) contest problems must
  // not leak their title or statement through metadata (visible in page
  // source / link previews) even though the page body itself already gates
  // on the same check. Bail out before ever resolving the underlying
  // problem/draft — a locked page has no legitimate reason to read it.
  if (isContestProblemLocked(contestContext.contest, contestContext.contestProblem)) {
    return {
      title: `Day ${contestContext.contestProblem.dayIndex} · ${contestContext.contest.title} | ProofArena`,
      description: "这道赛题还未解锁，暂不公开题干。",
    };
  }

  // Sprint problems require a personal unlock (a contest_sprint_attempts
  // row for this specific user) before the statement is readable at all —
  // metadata generation has no per-user session concept worth trusting here
  // (it's also what crawlers/link previews see), so it must stay fully
  // generic regardless of the contest-level window being open. Never call
  // resolveContestProblem for a sprint problem.
  if (contestContext.contestProblem.problemPhase === "sprint") {
    return {
      title: `Day ${contestContext.contestProblem.dayIndex} · ${contestContext.contest.title} | ProofArena`,
      description: "这是一道计时题，解锁后显示题面并开始计时。",
    };
  }

  const problem = await resolveContestProblem(contestContext.contestProblem, id);
  if (!problem) return {};

  const rawDescription = problem.statement[0]?.replace(/\$/g, "") ?? "";
  const description =
    rawDescription.length > 120 ? `${rawDescription.slice(0, 120)}…` : rawDescription;

  return {
    title: `${problem.title} · ${contestContext.contest.title} | ProofArena`,
    description: description || undefined,
  };
}

function LockedContestProblem({
  contest,
  contestProblem,
}: {
  contest: Contest;
  contestProblem: ContestProblem;
}) {
  const isDraft = contest.status === "draft";
  return (
    <main className="grid-surface flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg border border-amber-400/25 bg-zinc-950 p-8 text-center">
        <Lock className="mx-auto size-7 text-amber-300" />
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-amber-300">
          {contest.title} · Day {contestProblem.dayIndex}
        </p>
        <h1 className="mt-3 text-xl font-black text-white">
          {isDraft ? "比赛尚未开始" : "这道赛题还没有解锁"}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-500">{contestProblem.theme}</p>
        <p className="mt-3 text-xs text-zinc-600">
          {isDraft
            ? `比赛开始（${formatContestDateTime(contest.startAt)}（北京时间））后，赛题会按开放时间陆续解锁。`
            : contestProblem.unlockMode === "auto_time"
              ? `预计 ${formatContestDateTime(contestProblem.openAt)}（北京时间）自动解锁`
              : "等待管理员手动解锁"}
        </p>
        <Link
          href={`/contests/${contest.slug}`}
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 border border-white/15 px-5 text-sm font-bold text-zinc-300 transition hover:border-white/30 hover:text-white"
        >
          返回比赛主页
        </Link>
      </div>
    </main>
  );
}

// Deliberately does NOT take a `problem` prop and never resolves one — the
// whole point of this component is that the sprint problem's statement must
// not exist anywhere in this page's server-rendered output or JS payload
// until the viewer has personally unlocked it (a contest_sprint_attempts
// row for their own user id). Only contest/day/phase metadata, which is
// already public elsewhere on the site (the contest detail page's problem
// list), is shown here. ContestSprintPanel fetches the actual title/
// statement itself, from the API, only once an attempt exists — see that
// component's and lib/contest-sprint.ts's doc comments.
function SprintContestProblem({
  contest,
  contestProblem,
}: {
  contest: Contest;
  contestProblem: ContestProblem;
}) {
  return (
    <main className="grid-surface min-h-screen">
      {/* Amber accent stripe for sprint problems */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
        <Link
          href={`/contests/${contest.slug}`}
          className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft className="size-4" />
          返回比赛主页
        </Link>

        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
          <span className="bg-cyan-400 px-2.5 py-1 font-bold text-zinc-950">Day {contestProblem.dayIndex}</span>
          <span className="border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 font-bold text-amber-300">
            计时题
          </span>
          <span className="border border-white/15 px-2.5 py-1 text-zinc-400">{contestProblem.title}</span>
        </div>

        <h1 className="mt-4 text-2xl font-black leading-snug text-white">{contestProblem.theme}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          解锁后题面立即显示，计时同时开始。满分{" "}
          <span className="font-bold text-amber-300">{contestProblem.scoreMax} 分</span>
          {contestProblem.timeLimitSeconds
            ? <>，限时 <span className="font-bold text-amber-300">{contestProblem.timeLimitSeconds} 秒</span>。</>
            : "。"}
          {" "}答错或超时不计分，不影响其他题型的挑战倍率。
        </p>

        <div className="mt-6">
          <ContestSprintPanel
            contestSlug={contest.slug}
            contestProblemId={contestProblem.id}
            scoreMax={contestProblem.scoreMax}
            timeLimitSeconds={contestProblem.timeLimitSeconds}
            answerType={contestProblem.answerType}
            answerFormatNote={contestProblem.answerFormatNote}
          />
        </div>
      </div>
    </main>
  );
}

export default async function ContestProblemDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const contestContext = await getContestForProblem(id, slug);
  if (!contestContext) notFound();

  // Never let a not-yet-open contest problem be read early — knowing or
  // guessing a problem id (they're visible in the open-source data file, or
  // in a Problem Vault draft id) must not be enough to see a later day's
  // statement ahead of schedule, and a draft contest hasn't committed to its
  // schedule yet at all.
  if (isContestProblemLocked(contestContext.contest, contestContext.contestProblem)) {
    return <LockedContestProblem contest={contestContext.contest} contestProblem={contestContext.contestProblem} />;
  }

  // Sprint problems are a quick choice/fill-blank check against a timer, not
  // a proof to write up — they skip ProblemDetailExperience entirely (no
  // solutions, proof graph, or SubmitForm CTA make sense here) in favor of a
  // small dedicated view built around ContestSprintPanel. Checked BEFORE
  // resolveContestProblem runs: that call reads the actual statement, which
  // for a sprint problem must never be fetched at the page layer at all
  // (personal unlock happens client-side, through the sprint API routes) —
  // see SprintContestProblem's own doc comment.
  if (contestContext.contestProblem.problemPhase === "sprint") {
    return <SprintContestProblem contest={contestContext.contest} contestProblem={contestContext.contestProblem} />;
  }

  const isDraftProblem = Boolean(contestContext.contestProblem.draftProblemId);
  const [problem, allSummaries] = await Promise.all([
    resolveContestProblem(contestContext.contestProblem, id),
    // Related problems are only meaningful once a problem has a home in the
    // public catalog — skip the fetch entirely for a still-unpublished draft.
    isDraftProblem ? Promise.resolve([]) : getProblemSummaries(),
  ]);

  if (!problem) notFound();

  const hideSolutions = contestContext.contest.status === "active";
  const safeProblem = hideSolutions ? redactLockedProblem(problem) : problem;
  const knowledgeNodes = getKnowledgeNodesForProblem(safeProblem);
  const relatedProblems = isDraftProblem ? [] : getRelatedProblemSummaries(problem, allSummaries);

  return (
    <ProblemDetailExperience
      problem={safeProblem}
      knowledgeNodes={knowledgeNodes}
      relatedProblems={relatedProblems}
      contestContext={contestContext}
      isDraftProblem={isDraftProblem}
    />
  );
}
