import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { ProblemDetailExperience } from "@/components/ProblemDetailExperience";
import { getProblem, getProblemSummaries } from "@/lib/db";
import { getContestForProblem, getContests } from "@/lib/contests";
import { getKnowledgeNodesForProblem, getRelatedProblemSummaries, redactLockedProblem } from "@/lib/problem-detail-helpers";
import { adaptProblemDraftToProblem, getProblemDraftForContestDisplay } from "@/lib/problem-drafts";
import { isContestProblemLocked, type Contest, type ContestProblem, type Problem } from "@/lib/types";
import { formatContestDateTime } from "@/lib/format-contest-time";

export const revalidate = 300;

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
