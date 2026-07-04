import { contests as staticContests, getContest as getStaticContest } from "@/data/contests";
import { createClient } from "@/lib/supabase-server";
import type { Contest, ContestAward, ContestProblem } from "@/lib/types";

type ContestRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  tagline: string;
  rules: string[];
  status: Contest["status"];
  start_at: string;
  end_at: string;
  contest_problems?: ContestProblemRow[];
  awards?: AwardRow[];
};

type ContestProblemRow = {
  id: string;
  contest_id: string;
  problem_id: string | null;
  day_index: number;
  title: string;
  theme: string;
  open_at: string;
  close_at: string;
  weight: number;
  status: ContestProblem["status"];
  unlock_mode: ContestProblem["unlockMode"];
};

type AwardRow = {
  id: string;
  contest_id: string;
  problem_id: string | null;
  solution_id: string | null;
  user_id: string | null;
  type: ContestAward["type"];
  title: string;
  reason: string;
  points: number;
  created_at: string;
};

function toContest(row: ContestRow): Contest {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    tagline: row.tagline,
    rules: row.rules ?? [],
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    problems: (row.contest_problems ?? [])
      .map((problem): ContestProblem => ({
        id: problem.id,
        contestId: problem.contest_id,
        problemId: problem.problem_id,
        dayIndex: problem.day_index,
        title: problem.title,
        theme: problem.theme,
        openAt: problem.open_at,
        closeAt: problem.close_at,
        weight: problem.weight,
        status: problem.status,
        unlockMode: problem.unlock_mode ?? "manual",
      }))
      .sort((a, b) => a.dayIndex - b.dayIndex),
    awards: (row.awards ?? []).map((award): ContestAward => ({
      id: award.id,
      contestId: award.contest_id,
      problemId: award.problem_id ?? undefined,
      solutionId: award.solution_id ?? undefined,
      userId: award.user_id ?? undefined,
      type: award.type,
      title: award.title,
      reason: award.reason,
      points: award.points,
      createdAt: award.created_at,
    })),
  };
}

export async function getContests(): Promise<Contest[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return staticContests;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contests")
    .select("*, contest_problems(*), awards(*)")
    .order("start_at", { ascending: false });

  if (error) {
    console.error("[contests] getContests error:", error.message);
    return staticContests;
  }

  if (!data || data.length === 0) return staticContests;
  return (data as ContestRow[]).map(toContest);
}

export async function getContest(slug: string): Promise<Contest | undefined> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return getStaticContest(slug);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contests")
    .select("*, contest_problems(*), awards(*)")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[contests] getContest error:", error.message);
    return getStaticContest(slug);
  }

  return data ? toContest(data as ContestRow) : getStaticContest(slug);
}

export async function getContestForProblem(problemId: string, slug?: string) {
  const contests = slug ? [await getContest(slug)] : await getContests();
  const contest = contests.find((item): item is Contest => Boolean(item));
  if (!contest) return null;

  const contestProblem = contest.problems.find((problem) => problem.problemId === problemId);
  if (!contestProblem) return null;
  return { contest, contestProblem };
}

export async function getFeaturedContest() {
  const contests = await getContests();
  return contests[0];
}
