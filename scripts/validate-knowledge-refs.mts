// Build-time referential-integrity check for the static content graph.
//
// data/problems.ts, data/knowledge.ts, data/insights.ts, and
// data/concept-boundaries.ts cross-reference each other by plain string id
// (conceptId, problemId, knowledgeIds, insightIds, ...) with no compiler or
// runtime check. A typo'd id currently fails silently: ConceptBoundaryPanel
// falls back to rendering the raw id string, and problem-detail-helpers
// silently drops the dangling reference from the list. This script makes
// that failure mode loud instead of silent (see docs/architecture/
// principle-violations.md, KNOW-006).
//
// Run: npx tsx scripts/validate-knowledge-refs.mts

import { problems } from '../data/problems';
import { knowledgeNodes } from '../data/knowledge';
import { insightNodes } from '../data/insights';
import type {
  ConceptLink,
  ConceptContrast,
  ContrastProblem,
  KnowledgeNode,
  PedagogicalAnnotations,
  Problem,
} from '../lib/types';

type Finding = { source: string; field: string; badId: string };

const problemIds = new Set(problems.map((p) => p.id));
const knowledgeIds = new Set(knowledgeNodes.map((k) => k.id));
const insightIds = new Set(insightNodes.map((i) => i.id));
const solutionIds = new Set(
  problems.flatMap((p) => p.solutions.map((s) => s.id)),
);

const findings: Finding[] = [];

function checkPedagogicalAnnotations(source: string, node: PedagogicalAnnotations) {
  for (const id of node.knowledgeIds ?? []) {
    if (!knowledgeIds.has(id)) findings.push({ source, field: 'knowledgeIds', badId: id });
  }
  for (const id of node.insightIds ?? []) {
    if (!insightIds.has(id)) findings.push({ source, field: 'insightIds', badId: id });
  }
  checkConceptLinks(source, node.conceptLinks);
  checkConceptContrasts(source, node.conceptContrasts);
  checkContrastProblems(source, node.contrastProblems);
}

function checkConceptLinks(source: string, links?: ConceptLink[]) {
  for (const link of links ?? []) {
    if (link.conceptId && !knowledgeIds.has(link.conceptId)) {
      findings.push({ source, field: 'conceptLinks[].conceptId', badId: link.conceptId });
    }
  }
}

function checkConceptContrasts(source: string, contrasts?: ConceptContrast[]) {
  for (const contrast of contrasts ?? []) {
    for (const id of contrast.exampleProblemIds) {
      if (!problemIds.has(id)) {
        findings.push({ source, field: 'conceptContrasts[].exampleProblemIds', badId: id });
      }
    }
  }
}

function checkContrastProblems(source: string, refs?: ContrastProblem[]) {
  for (const ref of refs ?? []) {
    if (!problemIds.has(ref.problemId)) {
      findings.push({ source, field: 'contrastProblems[].problemId', badId: ref.problemId });
    }
  }
}

function checkKnowledgeNode(node: KnowledgeNode) {
  const source = `knowledgeNodes["${node.id}"]`;
  checkConceptLinks(source, node.conceptLinks);
  checkConceptContrasts(source, node.conceptContrasts);
  checkContrastProblems(source, node.contrastProblems);
}

for (const problem of problems as Problem[]) {
  checkPedagogicalAnnotations(`problems["${problem.id}"]`, problem);
  for (const solution of problem.solutions) {
    checkPedagogicalAnnotations(`problems["${problem.id}"].solutions["${solution.id}"]`, solution);
    const forkOf = solution.thinkingCues?.forkOf;
    if (forkOf && !solutionIds.has(forkOf.solutionId)) {
      findings.push({
        source: `problems["${problem.id}"].solutions["${solution.id}"]`,
        field: 'thinkingCues.forkOf.solutionId',
        badId: forkOf.solutionId,
      });
    }
  }
}

for (const node of knowledgeNodes) {
  checkKnowledgeNode(node);
}

for (const insight of insightNodes) {
  const source = `insightNodes["${insight.id}"]`;
  for (const id of insight.relatedKnowledgeIds) {
    if (!knowledgeIds.has(id)) findings.push({ source, field: 'relatedKnowledgeIds', badId: id });
  }
  for (const id of insight.relatedProblemIds) {
    if (!problemIds.has(id)) findings.push({ source, field: 'relatedProblemIds', badId: id });
  }
}

if (findings.length > 0) {
  console.error(`\n${findings.length} dangling reference(s) found in static content:\n`);
  for (const f of findings) {
    console.error(`  ${f.source}.${f.field} -> "${f.badId}" (no matching entity)`);
  }
  console.error('');
  process.exit(1);
}

console.log(
  `OK: ${problems.length} problems, ${solutionIds.size} solutions, ${knowledgeNodes.length} knowledge nodes, ${insightNodes.length} insight nodes — all cross-references resolve.`,
);
