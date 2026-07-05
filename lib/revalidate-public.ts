import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

type ContestSlugRow = {
  contests: { slug: string } | Array<{ slug: string }> | null;
};

export function revalidatePublicProblemPaths(problemId?: string | null) {
  revalidatePath('/');
  revalidatePath('/problems');
  if (problemId) revalidatePath(`/problems/${problemId}`);
}

export function revalidateContestSlug(slug?: string | null, problemId?: string | null) {
  if (!slug) return;
  revalidatePath('/contests');
  revalidatePath(`/contests/${slug}`);
  if (problemId) revalidatePath(`/contests/${slug}/problems/${problemId}`);
}

export async function revalidateContestProblemPaths(
  supabase: SupabaseClient,
  problemId: string,
) {
  const { data, error } = await supabase
    .from('contest_problems')
    .select('contests!inner(slug)')
    .eq('problem_id', problemId);

  if (error || !Array.isArray(data)) return;

  for (const row of data as ContestSlugRow[]) {
    const contest = Array.isArray(row.contests) ? row.contests[0] : row.contests;
    revalidateContestSlug(contest?.slug, problemId);
  }
}
