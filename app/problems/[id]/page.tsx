import { notFound } from "next/navigation";
import { ProblemDetailExperience } from "@/components/ProblemDetailExperience";
import { getProblem, getProblems } from "@/lib/db";
import { getKnowledgeNode } from "@/data/knowledge";
import { getContestForProblem } from "@/lib/contests";
import type { KnowledgeNode } from "@/lib/types";

export const dynamic = "force-dynamic";

function uniqueKnowledgeNodes(ids: string[]) {
  const seen = new Set<string>();
  return ids
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(getKnowledgeNode)
    .filter((node): node is KnowledgeNode => Boolean(node));
}

export default async function ProblemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [problem, allProblems] = await Promise.all([getProblem(id), getProblems()]);

  if (!problem) notFound();

  const knowledgeIds = [
    ...(problem.knowledgeIds ?? []),
    ...(problem.autoMatches ?? []).flatMap((match) => match.matchedKnowledgeIds),
    ...(problem.manualMatches ?? []).flatMap((match) => match.matchedKnowledgeIds),
    ...problem.solutions.flatMap((solution) => solution.knowledgeIds ?? []),
  ];
  const knowledgeNodes = uniqueKnowledgeNodes(knowledgeIds).slice(0, 6);
  const relatedProblems = allProblems
    .filter((item) => item.id !== problem.id)
    .map((item) => ({
      item,
      score:
        item.tags.filter((tag) => problem.tags.includes(tag)).length +
        (item.region === problem.region ? 1 : 0) +
        (item.difficulty === problem.difficulty ? 1 : 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ item }) => item);
  const contestSlug = typeof query.contest === "string" ? query.contest : undefined;
  const contestContext = contestSlug ? await getContestForProblem(problem.id, contestSlug) : null;

  return (
    <ProblemDetailExperience
      problem={problem}
      knowledgeNodes={knowledgeNodes}
      relatedProblems={relatedProblems}
      contestContext={contestContext ?? undefined}
    />
  );
}
