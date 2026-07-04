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
  const allContests = slug ? [await getContest(slug)] : await getContests();
  const validContests = allContests.filter((item): item is Contest => Boolean(item));

  for (const contest of validContests) {
    const contestProblem = contest.problems.find((problem) => problem.problemId === problemId);
    if (contestProblem) return { contest, contestProblem };
  }
  return null;
}

export async function getFeaturedContest() {
  const contests = await getContests();
  return contests[0];
}

export type ContestSolutionEntry = {
  solutionId: string;
  problemId: string | null;
  contestProblemId: string | null;
  contestSolutionType: string | null;
  title: string;
  author: string;
  authorId: string | null;
  isPostContest: boolean;
  avgCorrectness: number;
  avgClarity: number;
  avgElegance: number;
  avgInsight: number;
  avgExamUsability: number;
  avgTotal: number;
  ratingCount: number;
};

export type ContestLeaderboard = {
  solutions: ContestSolutionEntry[];
};

export async function getContestLeaderboard(contestSlug: string): Promise<ContestLeaderboard> {
  const empty: ContestLeaderboard = { solutions: [] };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return empty;
  }

  const supabase = await createClient();

  const { data: solutions, error } = await supabase
    .from("solutions")
    .select("id, problem_id, contest_problem_id, contest_solution_type, title, author, author_id, is_post_contest")
    .eq("contest_slug", contestSlug);

  if (error || !solutions || solutions.length === 0) return empty;

  const solutionIds = solutions.map((s) => s.id as string);

  const { data: ratings } = await supabase
    .from("solution_ratings")
    .select("solution_id, correctness, clarity, elegance, insight, exam_usability")
    .in("solution_id", solutionIds);

  const ratingMap = new Map<string, { correctness: number; clarity: number; elegance: number; insight: number; exam_usability: number }[]>();
  for (const r of ratings ?? []) {
    const id = r.solution_id as string;
    if (!ratingMap.has(id)) ratingMap.set(id, []);
    ratingMap.get(id)!.push({
      correctness: Number(r.correctness),
      clarity: Number(r.clarity),
      elegance: Number(r.elegance),
      insight: Number(r.insight),
      exam_usability: Number(r.exam_usability),
    });
  }

  const entries: ContestSolutionEntry[] = solutions.map((s) => {
    const id = s.id as string;
    const sRatings = ratingMap.get(id) ?? [];
    const count = sRatings.length;
    const avg = (key: keyof typeof sRatings[0]) =>
      count > 0 ? sRatings.reduce((sum, r) => sum + r[key], 0) / count : 0;

    const avgCorrectness = avg("correctness");
    const avgClarity = avg("clarity");
    const avgElegance = avg("elegance");
    const avgInsight = avg("insight");
    const avgExamUsability = avg("exam_usability");

    return {
      solutionId: id,
      problemId: (s.problem_id as string | null) ?? null,
      contestProblemId: (s.contest_problem_id as string | null) ?? null,
      contestSolutionType: (s.contest_solution_type as string | null) ?? null,
      title: (s.title as string) || "无标题",
      author: (s.author as string) || "匿名",
      authorId: (s.author_id as string | null) ?? null,
      isPostContest: Boolean(s.is_post_contest),
      avgCorrectness,
      avgClarity,
      avgElegance,
      avgInsight,
      avgExamUsability,
      avgTotal: avgCorrectness + avgClarity + avgElegance + avgInsight + avgExamUsability,
      ratingCount: count,
    };
  });

  entries.sort((a, b) => b.avgTotal - a.avgTotal || b.ratingCount - a.ratingCount);

  return { solutions: entries };
}
