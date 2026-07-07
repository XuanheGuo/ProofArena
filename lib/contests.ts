import { contests as staticContests, getContest as getStaticContest } from "@/data/contests";
import { isPublicSubmissionImageUrl } from "@/lib/security";
import { createPublicClient } from "@/lib/supabase-public";
import { createServiceClient } from "@/lib/supabase-server";
import type { Contest, ContestAward, ContestProblem } from "@/lib/types";
import { getEffectiveProblemStatus } from "@/lib/types";

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
  draft_problem_id: string | null;
  day_index: number;
  title: string;
  theme: string;
  open_at: string;
  close_at: string;
  weight: number;
  status: ContestProblem["status"];
  unlock_mode: ContestProblem["unlockMode"];
  problem_phase: ContestProblem["problemPhase"];
  score_max: number;
  score_policy: ContestProblem["scorePolicy"];
  multiplier_eligible: boolean;
  timed_mode_enabled: boolean;
  time_limit_seconds: number | null;
  max_attempts: number;
  answer_type: ContestProblem["answerType"];
  answer_format_note: string;
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
        draftProblemId: problem.draft_problem_id ?? null,
        dayIndex: problem.day_index,
        title: problem.title,
        theme: problem.theme,
        openAt: problem.open_at,
        closeAt: problem.close_at,
        weight: problem.weight,
        status: problem.status,
        unlockMode: problem.unlock_mode ?? "manual",
        problemPhase: problem.problem_phase ?? "daily",
        scoreMax: problem.score_max ?? 100,
        scorePolicy: problem.score_policy ?? "manual",
        multiplierEligible: problem.multiplier_eligible ?? true,
        timedModeEnabled: problem.timed_mode_enabled ?? false,
        timeLimitSeconds: problem.time_limit_seconds ?? null,
        maxAttempts: problem.max_attempts ?? 1,
        answerType: problem.answer_type ?? null,
        answerFormatNote: problem.answer_format_note ?? "",
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

  const supabase = createPublicClient();
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

  const supabase = createPublicClient();
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

// Always called with an explicit slug — used only by the dedicated
// /contests/[slug]/problems/[id] route, which carries the full contest
// context (banner, day/theme, submit CTA). The canonical /problems/[id]
// route no longer auto-scans every contest; it uses the much cheaper
// getActiveContestLockForProblem below for its "hide solutions" gate.
//
// `id` may be either a public `problems.id` or a Problem Vault
// `problem_drafts.id` — the route's [id] segment covers both, since a
// contest problem can be backed by either source (never both at once).
export async function getContestForProblem(id: string, slug: string) {
  const contest = await getContest(slug);
  if (!contest) return null;

  const contestProblem = contest.problems.find(
    (problem) => problem.problemId === id || problem.draftProblemId === id,
  );
  return contestProblem ? { contest, contestProblem } : null;
}

export type ActiveContestLock = { slug: string };

// Cheap, targeted check for the canonical /problems/[id] page: is this
// problem currently locked by a contest that's live right now? Deliberately
// only checks `status = 'active'` (matches the existing "hide solutions"
// rule) and selects nothing beyond the contest slug, instead of pulling
// every contest + contest_problems + awards row like getContests() does.
export async function getActiveContestLockForProblem(problemId: string): Promise<ActiveContestLock | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("contest_problems")
    .select("contests!inner(slug, status)")
    .eq("problem_id", problemId)
    .eq("contests.status", "active")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as {
    contests: { slug: string; status: string } | { slug: string; status: string }[] | null;
  };
  const contest = Array.isArray(row.contests) ? row.contests[0] : row.contests;
  return contest ? { slug: contest.slug } : null;
}

export type ActiveSprintLock = {
  slug: string;
  contestProblemId: string;
  dayIndex: number;
  openAt: string;
  closeAt: string;
  isSprint: true;
};

// Sprint problems require a PERSONAL unlock (see components/ContestSprintPanel.tsx
// and lib/contest-sprint.ts) before their statement is readable at all — that
// rule must hold even if an admin mistakenly binds a sprint contest problem
// to a public `problems.id` instead of a Problem Vault draft, because the
// canonical /problems/[id] page would otherwise happily show the statement
// to anyone, timer or no timer. This is the dedicated, defense-in-depth
// check that page uses: unlike getActiveContestLockForProblem (which only
// hides existing solutions/answer/proof graph — the statement itself stays
// public there, by design, for every non-sprint contest), a hit here means
// the canonical page must not render the statement, solutions, answer, or
// proof graph at all, and must not call getProblem() in the first place.
export async function getActiveSprintLockForProblem(problemId: string): Promise<ActiveSprintLock | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("contest_problems")
    .select("id, day_index, open_at, close_at, contests!inner(slug, status)")
    .eq("problem_id", problemId)
    .eq("problem_phase", "sprint")
    .eq("timed_mode_enabled", true)
    .eq("contests.status", "active")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as {
    id: string;
    day_index: number;
    open_at: string;
    close_at: string;
    contests: { slug: string; status: string } | { slug: string; status: string }[] | null;
  };
  const contest = Array.isArray(row.contests) ? row.contests[0] : row.contests;
  if (!contest) return null;

  return {
    slug: contest.slug,
    contestProblemId: row.id,
    dayIndex: row.day_index,
    openAt: row.open_at,
    closeAt: row.close_at,
    isSprint: true,
  };
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

  const supabase = createPublicClient();

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

  const supabase = createPublicClient();
  // Rejected submissions are spam/noise, not real participation — they must
  // not inflate the public submission/participant counts shown on the
  // contest list and detail pages.
  const { data } = await supabase
    .from("submissions")
    .select("user_id")
    .eq("contest_slug", contestSlug)
    .neq("status", "rejected");

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
  draftProblemId: string | null;
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
  // When true the entry represents an aggregated placeholder for a still-open
  // contest problem: content/images/comments/rating are all empty. The count
  // of redacted submissions is in `redactedCount`.
  isRedacted?: boolean;
  redactedCount?: number;
};

type ContestThoughtRow = {
  id: string;
  problem_id: string | null;
  draft_problem_id: string | null;
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

export async function getContestThoughts(contestSlug: string, contest?: Contest | null): Promise<ContestThoughtEntry[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return [];

  // Determine which contest problems are currently "still open" and need content redaction.
  // A problem is "still open" when contest.status === "active" and the problem window has not
  // yet closed. Once the problem closes, or the contest moves to judging/finished, full content
  // is revealed. draft-backed problems are identified by draftProblemId.
  const now = new Date();
  const openProblemIds = new Set<string>();
  const openDraftProblemIds = new Set<string>();
  if (contest && contest.status === "active") {
    for (const cp of contest.problems) {
      const eff = getEffectiveProblemStatus(cp, now);
      if (eff === "open") {
        if (cp.problemId) openProblemIds.add(cp.problemId);
        if (cp.draftProblemId) openDraftProblemIds.add(cp.draftProblemId);
      }
    }
  }

  const supabase = createPublicClient();
  const { data: submissions, error } = await supabase
    .from("submissions")
    .select("id, problem_id, draft_problem_id, contest_problem_key, title, user_id, content, attachment_urls, is_post_contest, created_at, user_profiles(display_name, username)")
    .eq("contest_slug", contestSlug)
    .eq("submission_type", "solution")
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  if (error || !submissions || submissions.length === 0) return [];

  const allRows = submissions as unknown as ContestThoughtRow[];

  // Partition into open (redact) vs closed (show full content) rows.
  const openRows: ContestThoughtRow[] = [];
  const closedRows: ContestThoughtRow[] = [];
  for (const s of allRows) {
    const isOpen =
      (s.problem_id != null && openProblemIds.has(s.problem_id)) ||
      (s.draft_problem_id != null && openDraftProblemIds.has(s.draft_problem_id));
    if (isOpen) openRows.push(s);
    else closedRows.push(s);
  }

  // Build one redacted placeholder per open problem (groups all its submissions into a count).
  const redactedEntries: ContestThoughtEntry[] = [];
  if (openRows.length > 0) {
    const groups = new Map<
      string,
      { problemId: string | null; draftProblemId: string | null; contestProblemKey: string | null; count: number }
    >();
    for (const s of openRows) {
      const groupKey = s.draft_problem_id ?? s.problem_id ?? s.contest_problem_key ?? "unknown";
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          problemId: s.problem_id,
          draftProblemId: s.draft_problem_id,
          contestProblemKey: s.contest_problem_key,
          count: 0,
        });
      }
      groups.get(groupKey)!.count++;
    }
    for (const [groupKey, group] of groups) {
      redactedEntries.push({
        id: `redacted-${groupKey}`,
        problemId: group.problemId,
        draftProblemId: group.draftProblemId,
        contestProblemKey: group.contestProblemKey,
        title: "",
        author: "",
        userId: null,
        contentText: "",
        imageUrls: [],
        isPostContest: false,
        createdAt: "",
        rating: null,
        comments: [],
        isRedacted: true,
        redactedCount: group.count,
      });
    }
  }

  if (closedRows.length === 0) return redactedEntries;

  const ids = closedRows.map((item) => item.id);

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

  const fullEntries = closedRows.map((submission) => {
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
      draftProblemId: submission.draft_problem_id,
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

  return [...redactedEntries, ...fullEntries];
}

export type ContestUserRankEntry = {
  userId: string;
  author: string;
  /** Total solutions submitted (including post-contest). */
  solutionCount: number;
  /** Solutions with at least MIN_RATERS ratings (official period only). */
  ratedSolutionCount: number;
  /** Weighted score: sum over each problem of (bestAvg × weight), official only. */
  weightedScore: number;
  /** Legacy alias kept for the existing UI that renders this field. */
  bestAvgTotal: number;
  totalScore: number;
  awardPoints: number;
  grandTotal: number;
};

/** Minimum number of raters before a solution's score counts toward the ranking. */
const MIN_RATERS = 3;

export async function getContestUserRankings(contestSlug: string, awards: import("@/lib/types").ContestAward[]): Promise<ContestUserRankEntry[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return [];

  const supabase = createPublicClient();

  // Resolve contest id first (needed to fetch contest_problems weights).
  const { data: contestRow } = await supabase
    .from("contests")
    .select("id")
    .eq("slug", contestSlug)
    .maybeSingle();

  // Fetch solutions and contest_problems (for weight) in parallel.
  const [{ data: solutions }, { data: cpRows }] = await Promise.all([
    supabase
      .from("solutions")
      .select("id, author, author_id, problem_id, contest_problem_id, is_post_contest")
      .eq("contest_slug", contestSlug),
    contestRow?.id
      ? supabase
          .from("contest_problems")
          .select("id, weight")
          .eq("contest_id", contestRow.id)
      : Promise.resolve({ data: [] as Array<{ id: string; weight: number }> }),
  ]);

  // Weight lookup: contest_problem_id → weight (default 1).
  const weightMap = new Map<string, number>();
  for (const cp of cpRows ?? []) {
    weightMap.set(cp.id as string, Number(cp.weight) || 1);
  }

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

  // Per user, per contest_problem: track the best qualifying score.
  // Only official (is_post_contest=false) solutions with >= MIN_RATERS count.
  type UserEntry = {
    userId: string;
    author: string;
    solutionCount: number;
    ratedSolutionCount: number;
    // contestProblemId → best avg total for that problem (official, >= MIN_RATERS)
    bestPerProblem: Map<string, number>;
    awardPoints: number;
  };

  const userMap = new Map<string, UserEntry>();

  for (const s of solutions) {
    const authorId = (s.author_id as string | null) ?? `anon-${s.author}`;
    const author = (s.author as string) || "匿名";
    const sRatings = ratingMap.get(s.id as string) ?? [];
    const raterCount = sRatings.length;
    const avgTotal = raterCount > 0
      ? sRatings.reduce((sum, r) => sum + r.correctness + r.clarity + r.elegance + r.insight + r.exam_usability, 0) / raterCount
      : 0;

    if (!userMap.has(authorId)) {
      userMap.set(authorId, { userId: authorId, author, solutionCount: 0, ratedSolutionCount: 0, bestPerProblem: new Map(), awardPoints: 0 });
    }
    const entry = userMap.get(authorId)!;
    entry.solutionCount++;

    const isPostContest = Boolean(s.is_post_contest);
    const cpId = s.contest_problem_id as string | null;

    // Only official, sufficiently-rated solutions contribute to the score.
    if (!isPostContest && raterCount >= MIN_RATERS && cpId) {
      entry.ratedSolutionCount++;
      const prev = entry.bestPerProblem.get(cpId) ?? 0;
      if (avgTotal > prev) entry.bestPerProblem.set(cpId, avgTotal);
    }
  }

  for (const award of awards) {
    if (!award.userId) continue;
    const entry = userMap.get(award.userId);
    if (entry) entry.awardPoints += award.points;
  }

  const rankings = [...userMap.values()].map((entry): ContestUserRankEntry => {
    let weightedScore = 0;
    let bestAvgTotal = 0;
    for (const [cpId, score] of entry.bestPerProblem) {
      const w = weightMap.get(cpId) ?? 1;
      weightedScore += score * w;
      if (score > bestAvgTotal) bestAvgTotal = score;
    }
    const grandTotal = weightedScore + entry.awardPoints;
    return {
      userId: entry.userId,
      author: entry.author,
      solutionCount: entry.solutionCount,
      ratedSolutionCount: entry.ratedSolutionCount,
      weightedScore,
      bestAvgTotal,
      totalScore: weightedScore,
      awardPoints: entry.awardPoints,
      grandTotal,
    };
  });

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

  const supabase = createPublicClient();

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

// Weekly contest format scoreboard (docs/WEEKLY_CONTEST_FORMAT.md §3, §11).
// Unlike getContestLeaderboard (which ranks published solutions by community
// rating), this sums the official judge scores in contest_submission_scores /
// contest_participant_profiles / contest_sprint_attempts per the weekly
// scoring formula:
//   dailyFinalScore = dailyRawScore * challengeMultiplier
//   totalScore = dailyFinalScore + sprintScore + majorScore + awardPoints - penaltyPoints
// This is the Phase 1 data-layer version: it reads real rows once judges
// start scoring, and returns [] before any scoring exists — either way it
// never breaks the contest detail page, since callers must handle an empty
// scoreboard.
// contest_sprint_attempts has no "viewable by everyone" RLS policy — it
// stores raw_answer/normalized_answer, which must stay hidden from other
// participants before the official reveal (migration 013). That means the
// anon/public client used everywhere else in this file can only ever see
// the calling browser's own row (and createPublicClient never even carries
// a user session — see lib/supabase-public.ts), so it cannot compute a
// cross-participant sprint total.
//
// This helper is the one privileged read in the scoreboard: it uses the
// service role key to bypass RLS, but selects ONLY user_id + score — never
// unlock_at, submitted_at, answer_raw, answer_normalized, or is_correct.
// That keeps the "safe public score summary" property from leaking to
// getContestScoreboard's return value, which the contest detail page (a
// Server Component) renders for every visitor.
//
// Like getProblemDraftForContestDisplay in lib/problem-drafts.ts, this must
// stay a server-only helper: never import it into a "use client" component
// or expose it via a public API route. lib/contests.ts is safe today
// because the one client component that touches this module
// (components/ContestThoughtArena.tsx) only does `import type`, which is
// erased at compile time and never bundles this function's code.
async function getContestSprintScoreSummary(contestId: string): Promise<Array<{ user_id: string; score: number }>> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  const { data, error } = await createServiceClient()
    .from("contest_sprint_attempts")
    .select("user_id, score")
    .eq("contest_id", contestId);

  if (error || !data) return [];
  return data as Array<{ user_id: string; score: number }>;
}

export type ContestScoreboardRow = {
  userId: string;
  displayName: string;
  dailyRawScore: number;
  challengeScore: number;
  challengeMultiplier: number;
  dailyFinalScore: number;
  sprintScore: number;
  majorScore: number;
  awardPoints: number;
  penaltyPoints: number;
  totalScore: number;
};

export async function getContestScoreboard(slug: string): Promise<ContestScoreboardRow[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }

  const supabase = createPublicClient();

  const { data: contestRow } = await supabase
    .from("contests")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!contestRow?.id) return [];
  const contestId = contestRow.id as string;

  const [{ data: scoreRows }, { data: profileRows }, { data: awardRows }] = await Promise.all([
    supabase
      .from("contest_submission_scores")
      .select("user_id, problem_phase, raw_score")
      .eq("contest_id", contestId),
    supabase
      .from("contest_participant_profiles")
      .select("user_id, challenge_score, challenge_multiplier, penalty_points")
      .eq("contest_id", contestId),
    supabase
      .from("awards")
      .select("user_id, points")
      .eq("contest_id", contestId),
  ]);

  const sprintRows = await getContestSprintScoreSummary(contestId);

  type Entry = {
    dailyRawScore: number;
    majorScore: number;
    sprintScore: number;
    challengeScore: number;
    challengeMultiplier: number;
    penaltyPoints: number;
    awardPoints: number;
  };
  const byUser = new Map<string, Entry>();
  const ensure = (userId: string): Entry => {
    let entry = byUser.get(userId);
    if (!entry) {
      entry = { dailyRawScore: 0, majorScore: 0, sprintScore: 0, challengeScore: 0, challengeMultiplier: 1, penaltyPoints: 0, awardPoints: 0 };
      byUser.set(userId, entry);
    }
    return entry;
  };

  for (const row of scoreRows ?? []) {
    if (!row.user_id) continue;
    const entry = ensure(row.user_id as string);
    const rawScore = Number(row.raw_score) || 0;
    if (row.problem_phase === "daily") entry.dailyRawScore += rawScore;
    else if (row.problem_phase === "major") entry.majorScore += rawScore;
  }

  for (const row of profileRows ?? []) {
    if (!row.user_id) continue;
    const entry = ensure(row.user_id as string);
    entry.challengeScore = Number(row.challenge_score) || 0;
    entry.challengeMultiplier = Number(row.challenge_multiplier) || 1;
    entry.penaltyPoints = Number(row.penalty_points) || 0;
  }

  for (const row of sprintRows ?? []) {
    if (!row.user_id) continue;
    ensure(row.user_id as string).sprintScore += Number(row.score) || 0;
  }

  for (const row of awardRows ?? []) {
    if (!row.user_id) continue;
    ensure(row.user_id as string).awardPoints += Number(row.points) || 0;
  }

  if (byUser.size === 0) return [];

  const { data: userProfiles } = await supabase
    .from("user_profiles")
    .select("id, display_name, username")
    .in("id", [...byUser.keys()]);

  const nameMap = new Map<string, string>();
  for (const profile of userProfiles ?? []) {
    nameMap.set(profile.id as string, (profile.display_name as string) || (profile.username as string) || "匿名用户");
  }

  const rows: ContestScoreboardRow[] = [...byUser.entries()].map(([userId, entry]) => {
    const dailyFinalScore = entry.dailyRawScore * entry.challengeMultiplier;
    const totalScore = dailyFinalScore + entry.sprintScore + entry.majorScore + entry.awardPoints - entry.penaltyPoints;
    return {
      userId,
      displayName: nameMap.get(userId) ?? "匿名用户",
      dailyRawScore: entry.dailyRawScore,
      challengeScore: entry.challengeScore,
      challengeMultiplier: entry.challengeMultiplier,
      dailyFinalScore,
      sprintScore: entry.sprintScore,
      majorScore: entry.majorScore,
      awardPoints: entry.awardPoints,
      penaltyPoints: entry.penaltyPoints,
      totalScore,
    };
  });

  rows.sort((a, b) => b.totalScore - a.totalScore);
  return rows;
}
