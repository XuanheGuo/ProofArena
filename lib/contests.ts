import { contests as staticContests, getContest as getStaticContest } from "@/data/contests";
import { isPublicSubmissionImageUrl } from "@/lib/security";
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
  discussion_start_at: string | null;
  discussion_end_at: string | null;
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
    discussionStartAt: row.discussion_start_at,
    discussionEndAt: row.discussion_end_at,
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

export type ContestStats = {
  contestId: string;
  submissionCount: number;
  participantCount: number;
};

export async function getContestStats(contestIds: string[]): Promise<ContestStats[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || contestIds.length === 0) {
    return contestIds.map((id) => ({ contestId: id, submissionCount: 0, participantCount: 0 }));
  }

  const supabase = await createClient();

  const { data } = await supabase
    .from("submissions")
    .select("contest_slug, user_id")
    .in("contest_slug", contestIds);

  if (!data) return contestIds.map((id) => ({ contestId: id, submissionCount: 0, participantCount: 0 }));

  const byContest = new Map<string, { users: Set<string>; count: number }>();
  for (const row of data) {
    const slug = row.contest_slug as string;
    if (!slug) continue;
    if (!byContest.has(slug)) byContest.set(slug, { users: new Set(), count: 0 });
    const entry = byContest.get(slug)!;
    entry.count++;
    if (row.user_id) entry.users.add(row.user_id as string);
  }

  return contestIds.map((id) => {
    const entry = byContest.get(id);
    return {
      contestId: id,
      submissionCount: entry?.count ?? 0,
      participantCount: entry?.users.size ?? 0,
    };
  });
}

export async function getContestSubmissionStats(contestSlug: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { submissionCount: 0, participantCount: 0 };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("submissions")
    .select("user_id")
    .eq("contest_slug", contestSlug);

  if (!data) return { submissionCount: 0, participantCount: 0 };

  const participants = new Set(data.map((r) => r.user_id).filter(Boolean));
  return {
    submissionCount: data.length,
    participantCount: participants.size,
  };
}

export type ContestThoughtRatingSummary = {
  clarity: number;
  insight: number;
  potential: number;
  count: number;
  total: number;
};

export type ContestThoughtComment = {
  id: string;
  userId: string;
  author: string;
  content: string;
  createdAt: string;
};

export type ContestThoughtEntry = {
  id: string;
  problemId: string | null;
  contestProblemKey: string | null;
  title: string;
  author: string;
  userId: string | null;
  contentText: string;
  imageUrls: string[];
  isPostContest: boolean;
  createdAt: string;
  rating: ContestThoughtRatingSummary | null;
  comments: ContestThoughtComment[];
};

type ContestThoughtRow = {
  id: string;
  problem_id: string | null;
  contest_problem_key: string | null;
  title: string;
  user_id: string | null;
  content: {
    thought?: string;
    approach?: string;
    markdown?: string;
    imageUrls?: string[];
    images?: string[];
  } | null;
  attachment_urls?: string[] | null;
  is_post_contest: boolean | null;
  created_at: string;
  user_profiles?: { display_name: string | null; username: string | null } | Array<{ display_name: string | null; username: string | null }> | null;
};

function firstProfile(
  profile: ContestThoughtRow["user_profiles"] | { display_name?: string | null; username?: string | null } | Array<{ display_name?: string | null; username?: string | null }> | null | undefined,
) {
  return Array.isArray(profile) ? profile[0] : profile;
}

export async function getContestThoughts(contestSlug: string): Promise<ContestThoughtEntry[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return [];

  const supabase = await createClient();
  const { data: submissions, error } = await supabase
    .from("submissions")
    .select("id, problem_id, contest_problem_key, title, user_id, content, attachment_urls, is_post_contest, created_at, user_profiles(display_name, username)")
    .eq("contest_slug", contestSlug)
    .eq("submission_type", "solution")
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  if (error || !submissions || submissions.length === 0) return [];

  const ids = submissions.map((item) => item.id as string);

  const [{ data: ratings }, { data: comments }] = await Promise.all([
    supabase
      .from("contest_submission_ratings")
      .select("submission_id, clarity, insight, potential")
      .in("submission_id", ids),
    supabase
      .from("comments")
      .select("id, target_id, user_id, content, created_at, user_profiles(display_name, username)")
      .eq("target_type", "submission")
      .in("target_id", ids)
      .order("created_at", { ascending: true }),
  ]);

  const ratingMap = new Map<string, Array<{ clarity: number; insight: number; potential: number }>>();
  for (const rating of ratings ?? []) {
    const id = rating.submission_id as string;
    if (!ratingMap.has(id)) ratingMap.set(id, []);
    ratingMap.get(id)!.push({
      clarity: Number(rating.clarity),
      insight: Number(rating.insight),
      potential: Number(rating.potential),
    });
  }

  const commentMap = new Map<string, ContestThoughtComment[]>();
  for (const comment of comments ?? []) {
    const targetId = comment.target_id as string;
    const profile = firstProfile(comment.user_profiles as { display_name?: string | null; username?: string | null } | Array<{ display_name?: string | null; username?: string | null }> | null);
    if (!commentMap.has(targetId)) commentMap.set(targetId, []);
    commentMap.get(targetId)!.push({
      id: comment.id as string,
      userId: comment.user_id as string,
      author: profile?.display_name || profile?.username || "匿名用户",
      content: comment.content as string,
      createdAt: comment.created_at as string,
    });
  }

  return (submissions as unknown as ContestThoughtRow[]).map((submission) => {
    const profile = firstProfile(submission.user_profiles);
    const imageUrls = (submission.attachment_urls ?? submission.content?.imageUrls ?? submission.content?.images ?? [])
      .filter((url): url is string => typeof url === "string" && isPublicSubmissionImageUrl(url))
      .slice(0, 4);
    const submissionRatings = ratingMap.get(submission.id) ?? [];
    const rating = submissionRatings.length
      ? {
          clarity: submissionRatings.reduce((sum, item) => sum + item.clarity, 0) / submissionRatings.length,
          insight: submissionRatings.reduce((sum, item) => sum + item.insight, 0) / submissionRatings.length,
          potential: submissionRatings.reduce((sum, item) => sum + item.potential, 0) / submissionRatings.length,
          count: submissionRatings.length,
          total: submissionRatings.reduce((sum, item) => sum + item.clarity + item.insight + item.potential, 0) / submissionRatings.length,
        }
      : null;

    return {
      id: submission.id,
      problemId: submission.problem_id,
      contestProblemKey: submission.contest_problem_key,
      title: submission.title,
      author: profile?.display_name || profile?.username || "匿名用户",
      userId: submission.user_id,
      contentText: submission.content?.thought || submission.content?.approach || submission.content?.markdown || "",
      imageUrls,
      isPostContest: Boolean(submission.is_post_contest),
      createdAt: submission.created_at,
      rating,
      comments: commentMap.get(submission.id) ?? [],
    };
  });
}

export type ContestUserRankEntry = {
  userId: string;
  author: string;
  solutionCount: number;
  ratedSolutionCount: number;
  bestAvgTotal: number;
  totalScore: number;
  awardPoints: number;
  grandTotal: number;
};

export async function getContestUserRankings(contestSlug: string, awards: import("@/lib/types").ContestAward[]): Promise<ContestUserRankEntry[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return [];

  const supabase = await createClient();

  const { data: solutions } = await supabase
    .from("solutions")
    .select("id, author, author_id, problem_id")
    .eq("contest_slug", contestSlug);

  if (!solutions || solutions.length === 0) return [];

  const solutionIds = solutions.map((s) => s.id as string);

  const { data: ratings } = await supabase
    .from("solution_ratings")
    .select("solution_id, correctness, clarity, elegance, insight, exam_usability")
    .in("solution_id", solutionIds);

  type RatingRow = { correctness: number; clarity: number; elegance: number; insight: number; exam_usability: number };
  const ratingMap = new Map<string, RatingRow[]>();
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

  const userMap = new Map<string, ContestUserRankEntry>();

  for (const s of solutions) {
    const authorId = (s.author_id as string | null) ?? `anon-${s.author}`;
    const author = (s.author as string) || "匿名";
    const sRatings = ratingMap.get(s.id as string) ?? [];
    const count = sRatings.length;
    const avgTotal = count > 0
      ? sRatings.reduce((sum, r) => sum + r.correctness + r.clarity + r.elegance + r.insight + r.exam_usability, 0) / count
      : 0;

    if (!userMap.has(authorId)) {
      userMap.set(authorId, {
        userId: authorId,
        author,
        solutionCount: 0,
        ratedSolutionCount: 0,
        bestAvgTotal: 0,
        totalScore: 0,
        awardPoints: 0,
        grandTotal: 0,
      });
    }
    const entry = userMap.get(authorId)!;
    entry.solutionCount++;
    if (count > 0) {
      entry.ratedSolutionCount++;
      if (avgTotal > entry.bestAvgTotal) entry.bestAvgTotal = avgTotal;
    }
  }

  for (const award of awards) {
    if (!award.userId) continue;
    const entry = userMap.get(award.userId);
    if (entry) entry.awardPoints += award.points;
  }

  const rankings = [...userMap.values()].map((entry) => ({
    ...entry,
    totalScore: entry.bestAvgTotal,
    grandTotal: entry.bestAvgTotal + entry.awardPoints,
  }));

  rankings.sort((a, b) => b.grandTotal - a.grandTotal || b.ratedSolutionCount - a.ratedSolutionCount);
  return rankings;
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
