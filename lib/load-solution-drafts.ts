'use server';

import { createServiceClient } from '@/lib/supabase-server';
import { requireProofGraphEditor } from '@/lib/proof-graph-admin-auth';

export type SolutionDraft = {
  solutionId: string;
  solutionTitle: string;
  solutionKind: string;
  draft: {
    observationSignal?: string;
    observationWhy?: string;
    transformationFrom?: string;
    transformationTo?: string;
    transformationJustification?: string;
    transformationComplexityReduction?: string;
    methodBoundaryName?: string;
    methodBoundaryWhyTempting?: string;
    methodBoundaryWhyNotPriority?: string;
    methodBoundaryWhereItBreaks?: string;
    methodBoundaryWhenItWorks?: string;
    verificationSteps?: string | string[];
  };
};

export async function loadSolutionDrafts(problemId: string): Promise<SolutionDraft[]> {
  const auth = await requireProofGraphEditor();
  if (!auth.ok || !problemId.trim()) return [];

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('solutions')
    .select('id, title, kind, thinking_cues')
    .eq('problem_id', problemId);

  if (error || !data) return [];

  const results: SolutionDraft[] = [];

  for (const row of data) {
    const cues = row.thinking_cues;
    if (!cues || typeof cues !== 'object') continue;

    const draft = (cues as Record<string, unknown>).proofGraphDraft;
    if (!draft || typeof draft !== 'object') continue;

    const d = draft as Record<string, unknown>;

    // Expose only public graph-draft fields — never moderator_notes.
    const filtered: SolutionDraft['draft'] = {};
    if (d.observationSignal) filtered.observationSignal = String(d.observationSignal);
    if (d.observationWhy) filtered.observationWhy = String(d.observationWhy);
    if (d.transformationFrom) filtered.transformationFrom = String(d.transformationFrom);
    if (d.transformationTo) filtered.transformationTo = String(d.transformationTo);
    if (d.transformationJustification) filtered.transformationJustification = String(d.transformationJustification);
    if (d.transformationComplexityReduction) filtered.transformationComplexityReduction = String(d.transformationComplexityReduction);
    if (d.methodBoundaryName) filtered.methodBoundaryName = String(d.methodBoundaryName);
    if (d.methodBoundaryWhyTempting) filtered.methodBoundaryWhyTempting = String(d.methodBoundaryWhyTempting);
    if (d.methodBoundaryWhyNotPriority) filtered.methodBoundaryWhyNotPriority = String(d.methodBoundaryWhyNotPriority);
    if (d.methodBoundaryWhereItBreaks) filtered.methodBoundaryWhereItBreaks = String(d.methodBoundaryWhereItBreaks);
    if (d.methodBoundaryWhenItWorks) filtered.methodBoundaryWhenItWorks = String(d.methodBoundaryWhenItWorks);
    if (d.verificationSteps) filtered.verificationSteps = d.verificationSteps as string | string[];

    if (Object.keys(filtered).length === 0) continue;

    results.push({
      solutionId: String(row.id),
      solutionTitle: String(row.title),
      solutionKind: String(row.kind),
      draft: filtered,
    });
  }

  return results;
}
