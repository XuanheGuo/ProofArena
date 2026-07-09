import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, Timer } from "lucide-react";
import { ProblemDetailExperience } from "@/components/ProblemDetailExperience";
import { getProblem, getProblemSummaries } from "@/lib/db";
import {
  getActiveContestLockForProblem,
  getActiveSprintLockForProblem,
  type ActiveSprintLock,
} from "@/lib/contests";
import {
  getKnowledgeNodesForProblem,
  getRelatedProblemSummaries,
  redactLockedProblem,
} from "@/lib/problem-detail-helpers";

export const revalidate = 300;

export async function generateStaticParams() {
  const summaries = await getProblemSummaries();
  return summaries.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  // A sprint contest problem's statement must never appear in metadata
  // (page source / link previews) — checked before ever calling getProblem,
  // same as the dedicated contest sprint page's own generateMetadata. See
  // getActiveSprintLockForProblem's doc comment for why this defense-in-depth
  // check exists even though sprint problems are meant to use Problem Vault
  // drafts, not public problem ids.
  const sprintLock = await getActiveSprintLockForProblem(id);
  if (sprintLock) {
    return {
      title: "计时题 · ProofArena",
      description:
        "这是一场比赛的计时题，需要在比赛页面个人解锁后才能查看题面。",
    };
  }

  const problem = await getProblem(id);
  if (!problem) return {};

  const rawDescription = problem.statement[0]?.replace(/\$/g, "") ?? "";
  const description =
    rawDescription.length > 120
      ? `${rawDescription.slice(0, 120)}…`
      : rawDescription;
  const title = `${problem.title} · ${problem.year}${problem.region} | ProofArena`;

  return {
    title,
    description: description || undefined,
    openGraph: {
      title: `${problem.title} | ProofArena`,
      description:
        description ||
        `${problem.year}${problem.region} · ${problem.solutions.length} 条解法对比`,
      images: ["/opengraph-image"],
    },
  };
}

// Placeholder for a sprint contest problem that happens to be bound to a
// public `problems.id` (normally sprint problems use a Problem Vault draft,
// but nothing at the schema level forbids an admin from misconfiguring
// this — see getActiveSprintLockForProblem). Renders no statement/solutions/
// answer/proof graph at all; the actual problem face only ever reaches the
// client through ContestSprintPanel, after a personal unlock.
function SprintLockedProblem({
  sprintLock,
  id,
}: {
  sprintLock: ActiveSprintLock;
  id: string;
}) {
  return (
    <main className="grid-surface flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg border border-amber-400/25 bg-zinc-950 p-8 text-center">
        <Timer className="mx-auto size-7 text-amber-300" />
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-amber-300">
          Day {sprintLock.dayIndex} · 计时题
        </p>
        <h1 className="mt-3 text-xl font-black text-white">
          这是一道比赛计时题
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-500">
          计时题需要个人手动解锁后才会显示题面并开始计时，请从比赛页面进入并点击「解锁计时题」。
        </p>
        <Link
          href={`/contests/${sprintLock.slug}/problems/${id}`}
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200"
        >
          <Lock className="size-4" />
          前往比赛页面解锁
        </Link>
      </div>
    </main>
  );
}

export default async function ProblemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Checked first, and deliberately not run in Promise.all with getProblem
  // below: if this hits, getProblem/getProblemSummaries/getActiveContestLockForProblem
  // must never even be called for this request, let alone have their result
  // passed to the client component ProblemDetailExperience — the statement
  // must not exist anywhere in this request's rendering at all.
  const sprintLock = await getActiveSprintLockForProblem(id);
  if (sprintLock) {
    return <SprintLockedProblem sprintLock={sprintLock} id={id} />;
  }

  const [problem, allSummaries, contestLock] = await Promise.all([
    getProblem(id),
    getProblemSummaries(),
    getActiveContestLockForProblem(id),
  ]);

  if (!problem) notFound();

  // Contest lock only hides existing solutions/answer/proof graph — the
  // problem statement itself stays visible so contestants can read and
  // solve it. Redact server-side so the hidden data never reaches the
  // client bundle in the first place.
  const safeProblem = contestLock ? redactLockedProblem(problem) : problem;
  const knowledgeNodes = getKnowledgeNodesForProblem(safeProblem);
  const relatedProblems = getRelatedProblemSummaries(problem, allSummaries);

  return (
    <ProblemDetailExperience
      problem={safeProblem}
      knowledgeNodes={knowledgeNodes}
      relatedProblems={relatedProblems}
      contestLock={contestLock ?? undefined}
    />
  );
}
