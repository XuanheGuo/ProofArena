import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProblemDetailExperience } from "@/components/ProblemDetailExperience";
import { getProblem, getProblemSummaries } from "@/lib/db";
import { getActiveContestLockForProblem } from "@/lib/contests";
import { getKnowledgeNodesForProblem, getRelatedProblemSummaries } from "@/lib/problem-detail-helpers";

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
  const problem = await getProblem(id);
  if (!problem) return {};

  const rawDescription = problem.statement[0]?.replace(/\$/g, "") ?? "";
  const description =
    rawDescription.length > 120 ? `${rawDescription.slice(0, 120)}…` : rawDescription;
  const title = `${problem.title} · ${problem.year}${problem.region} | ProofArena`;

  return {
    title,
    description: description || undefined,
    openGraph: {
      title: `${problem.title} | ProofArena`,
      description: description || `${problem.year}${problem.region} · ${problem.solutions.length} 条解法对比`,
      images: ["/opengraph-image"],
    },
  };
}

export default async function ProblemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [problem, allSummaries, contestLock] = await Promise.all([
    getProblem(id),
    getProblemSummaries(),
    getActiveContestLockForProblem(id),
  ]);

  if (!problem) notFound();

  const knowledgeNodes = getKnowledgeNodesForProblem(problem);
  const relatedProblems = getRelatedProblemSummaries(problem, allSummaries);

  return (
    <ProblemDetailExperience
      problem={problem}
      knowledgeNodes={knowledgeNodes}
      relatedProblems={relatedProblems}
      contestLock={contestLock ?? undefined}
    />
  );
}
