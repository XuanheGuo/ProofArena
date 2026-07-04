import type { Contest } from "@/lib/types";

const dayMs = 24 * 60 * 60 * 1000;
const start = Date.UTC(2026, 6, 6, 14, 30, 0);

function iso(dayOffset: number, hour = 14, minute = 30) {
  const date = new Date(start + dayOffset * dayMs);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

export const contests: Contest[] = [
  {
    id: "contest-first-arena",
    slug: "first-arena",
    title: "ProofArena 第一届思路擂台",
    tagline: "不是刷题赛，而是一场关于“谁能把一道题理解得更漂亮”的解法竞技。",
    description: "7 天 / 6 道题 / 一题多解 / 多维评分 / 赛后优秀解法合集",
    startAt: iso(0),
    endAt: iso(7),
    discussionStartAt: iso(6),
    discussionEndAt: iso(10),
    status: "draft",
    rules: [
      "每道题开放提交多个解法，可以是标准解、巧解、教学解、错解分析，也可以补充他人的思路或提出题目变式。",
      "比赛不只看速度，也看解法的清晰度、优雅度、启发性和考试可用性。",
      "比赛结束后，优秀解法会被整理成合集，保留在 ProofArena 中，成为之后所有人都可以学习和讨论的内容。",
    ],
    problems: [
      {
        id: "first-arena-day-1",
        contestId: "contest-first-arena",
        problemId: "tj-2026-09",
        dayIndex: 1,
        title: "热身题",
        theme: "先把题目读干净",
        openAt: iso(0),
        closeAt: iso(1),
        weight: 1,
        status: "locked",
        unlockMode: "auto_time",
      },
      {
        id: "first-arena-day-2",
        contestId: "contest-first-arena",
        problemId: "ng1-2026-18",
        dayIndex: 2,
        title: "一题多解题",
        theme: "比较不同入口的代价",
        openAt: iso(1),
        closeAt: iso(2),
        weight: 1,
        status: "locked",
        unlockMode: "auto_time",
      },
      {
        id: "first-arena-day-3",
        contestId: "contest-first-arena",
        problemId: "ng2-2026-18",
        dayIndex: 3,
        title: "概念边界题",
        theme: "辨清能用与不能用",
        openAt: iso(2),
        closeAt: iso(3),
        weight: 1,
        status: "locked",
        unlockMode: "auto_time",
      },
      {
        id: "first-arena-day-4",
        contestId: "contest-first-arena",
        problemId: "tj-2026-17",
        dayIndex: 4,
        title: "构造题",
        theme: "把条件组织成对象",
        openAt: iso(3),
        closeAt: iso(4),
        weight: 1,
        status: "locked",
        unlockMode: "auto_time",
      },
      {
        id: "first-arena-day-5",
        contestId: "contest-first-arena",
        problemId: "tj-2026-19",
        dayIndex: 5,
        title: "考试压轴风格题",
        theme: "在考场约束下取舍",
        openAt: iso(4),
        closeAt: iso(5),
        weight: 1,
        status: "locked",
        unlockMode: "auto_time",
      },
      {
        id: "first-arena-day-6",
        contestId: "contest-first-arena",
        problemId: "tj-2026-20",
        dayIndex: 6,
        title: "周末大题",
        theme: "完整路线与表达质量",
        openAt: iso(5),
        closeAt: iso(6),
        weight: 1.5,
        status: "locked",
        unlockMode: "auto_time",
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
