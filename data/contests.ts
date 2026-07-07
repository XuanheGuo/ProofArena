import type { Contest } from "@/lib/types";

const dayMs = 24 * 60 * 60 * 1000;
const start = Date.UTC(2026, 6, 12, 12, 0, 0);

function iso(dayOffset: number, hour = 12, minute = 0) {
  const date = new Date(start + dayOffset * dayMs);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

// Shared defaults for the existing `first-arena` seed, which predates the
// weekly contest format's phase/scoring fields — every problem here is a
// plain, manually-scored daily problem with no timed/sprint behavior.
const dailyPhaseDefaults = {
  problemPhase: "daily" as const,
  scoreMax: 100,
  scorePolicy: "manual" as const,
  multiplierEligible: true,
  timedModeEnabled: false,
  timeLimitSeconds: null,
  maxAttempts: 1,
  answerType: null,
  answerFormatNote: "",
};

export const contests: Contest[] = [
  {
    id: "contest-first-arena",
    slug: "first-arena",
    title: "ProofArena Invitational 01：同一道题，不同思路",
    tagline: "第一场邀请制思路擂台：不比谁先写出答案，而比谁能把一道题理解得更清楚、更漂亮。",
    description: "7 天 / 4 道正式题 + 1 道开放讨论题 / 一题多解 / 人工评审 / 赛后优秀解法合集",
    startAt: iso(0),
    endAt: iso(7),
    discussionStartAt: iso(5),
    discussionEndAt: iso(10),
    status: "draft",
    rules: [
      "第一场采用小规模邀请制，建议 10-30 人参与。每位参赛者可以为同一道题提交多个解法或思路补充，最终按质量评审。",
      "正式评分以正确性、推理清晰度、方法优雅度、表达质量和讨论贡献为核心；平台互评只作为参考，不直接替代人工评审。",
      "参赛内容可以是标准解、巧解、教学解、错解分析或题目变式，但必须写清关键转化、适用边界和可复核位置。",
      "比赛结束后，优秀解法会被整理成合集并回流到题目页，成为长期可学习、可讨论、可引用的内容。",
    ],
    problems: [
      {
        id: "first-arena-day-1",
        contestId: "contest-first-arena",
        problemId: "tj-2026-16",
        dayIndex: 1,
        title: "正式题 1：热身与表达",
        theme: "把一个中等难度题讲清楚，比堆技巧更重要",
        openAt: iso(0),
        closeAt: iso(2),
        weight: 1,
        status: "locked",
        unlockMode: "auto_time",
        ...dailyPhaseDefaults,
      },
      {
        id: "first-arena-day-2",
        contestId: "contest-first-arena",
        problemId: "ng1-2026-18",
        dayIndex: 3,
        title: "正式题 2：一题多解",
        theme: "比较不同入口的代价、收益和可迁移性",
        openAt: iso(2),
        closeAt: iso(4),
        weight: 1.25,
        status: "locked",
        unlockMode: "auto_time",
        ...dailyPhaseDefaults,
      },
      {
        id: "first-arena-day-3",
        contestId: "contest-first-arena",
        problemId: "ng2-2026-18",
        dayIndex: 5,
        title: "正式题 3：概念边界",
        theme: "辨清方法什么时候能用、什么时候会误导",
        openAt: iso(4),
        closeAt: iso(6),
        weight: 1.5,
        status: "locked",
        unlockMode: "auto_time",
        ...dailyPhaseDefaults,
      },
      {
        id: "first-arena-day-4",
        contestId: "contest-first-arena",
        problemId: "tj-2026-17",
        dayIndex: 6,
        title: "正式题 4：综合应用",
        theme: "把前几天的工具整合起来，处理更复杂的情形",
        openAt: iso(5),
        closeAt: iso(7),
        weight: 1.75,
        status: "locked",
        unlockMode: "auto_time",
        ...dailyPhaseDefaults,
      },
      {
        id: "first-arena-day-5",
        contestId: "contest-first-arena",
        problemId: "tj-2026-20",
        dayIndex: 7,
        title: "开放讨论题：不只求解，也比较路线",
        theme: "允许未完成思路、错解分析、路线比较和变式讨论",
        openAt: iso(5),
        closeAt: iso(10),
        weight: 0.5,
        status: "locked",
        unlockMode: "auto_time",
        ...dailyPhaseDefaults,
        problemPhase: "discussion",
        multiplierEligible: false,
      },
    ],
    awards: [],
  },
];

export function getContest(slug: string) {
  return contests.find((contest) => contest.slug === slug);
}

export function getContestForProblem(problemId: string, slug?: string) {
  const contest = slug ? getContest(slug) : contests.find((item) => item.problems.some((problem) => problem.problemId === problemId));
  if (!contest) return null;
  const contestProblem = contest.problems.find((problem) => problem.problemId === problemId);
  if (!contestProblem) return null;
  return { contest, contestProblem };
}
