import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProblemDetailExperience } from "@/components/ProblemDetailExperience";
import { getProblem, getProblemSummaries } from "@/lib/db";
import { getContestForProblem, getContests } from "@/lib/contests";
import { getKnowledgeNodesForProblem, getRelatedProblemSummaries } from "@/lib/problem-detail-helpers";

export const revalidate = 300;

export async function generateStaticParams() {
  const contests = await getContests();
  return contests.flatMap((contest) =>
    contest.problems
      .filter((contestProblem) => contestProblem.problemId)
      .map((contestProblem) => ({ slug: contest.slug, id: contestProblem.problemId as string }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const [problem, contestContext] = await Promise.all([getProblem(id), getContestForProblem(id, slug)]);
  if (!problem || !contestContext) return {};

  const rawDescription = problem.statement[0]?.replace(/\$/g, "") ?? "";
  const description =
    rawDescription.length > 120 ? `${rawDescription.slice(0, 120)}…` : rawDescription;

  return {
    title: `${problem.title} · ${contestContext.contest.title} | ProofArena`,
    description: description || undefined,
  };
}

export default async function ContestProblemDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const [problem, allSummaries, contestContext] = await Promise.all([
    getProblem(id),
    getProblemSummaries(),
    getContestForProblem(id, slug),
  ]);

  if (!problem || !contestContext) notFound();

  const knowledgeNodes = getKnowledgeNodesForProblem(problem);
  const relatedProblems = getRelatedProblemSummaries(problem, allSummaries);

  return (
    <ProblemDetailExperience
      problem={problem}
      knowledgeNodes={knowledgeNodes}
      relatedProblems={relatedProblems}
      contestContext={contestContext}
    />
  );
}
