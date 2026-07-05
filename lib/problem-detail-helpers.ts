import { getKnowledgeNode } from '@/data/knowledge';
import type { KnowledgeNode, Problem, ProblemSummary } from '@/lib/types';

// Shared by the canonical /problems/[id] page and the contest-scoped
// /contests/[slug]/problems/[id] page so both stay in sync.

export function getKnowledgeNodesForProblem(problem: Problem, limit = 6): KnowledgeNode[] {
  const ids = [
    ...(problem.knowledgeIds ?? []),
    ...(problem.autoMatches ?? []).flatMap((match) => match.matchedKnowledgeIds),
    ...(problem.manualMatches ?? []).flatMap((match) => match.matchedKnowledgeIds),
    ...problem.solutions.flatMap((solution) => solution.knowledgeIds ?? []),
  ];
  const seen = new Set<string>();
  return ids
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(getKnowledgeNode)
    .filter((node): node is KnowledgeNode => Boolean(node))
    .slice(0, limit);
}

export function getRelatedProblemSummaries(
  problem: Problem,
  allSummaries: ProblemSummary[],
  limit = 4
): ProblemSummary[] {
  return allSummaries
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
    .slice(0, limit)
    .map(({ item }) => item);
}
