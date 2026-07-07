import type { Contest, ContestProblem } from "@/lib/types";

const dayMs = 24 * 60 * 60 * 1000;
const start = Date.UTC(2026, 6, 12, 12, 0, 0);

function iso(dayOffset: number, hour = 12, minute = 0) {
  const date = new Date(start + dayOffset * dayMs);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

// Separate time base for the weekly-arena-01 template, so its schedule can't
// drift if first-arena's `start`/`iso` ever change. Unlike `iso` (which sets
// a raw UTC hour with no timezone meaning of its own — first-arena's
// existing schedule already relies on that), `weeklyIso`'s hour argument is
// Beijing time, matching how docs/WEEKLY_CONTEST_FORMAT.md always states
// windows ("10:00 开放 17:00 截止" 北京时间) and how formatContestDateTime
// (lib/format-contest-time.ts) always displays them — so the literals below
// read the same way the format doc describes them.
const weeklyStart = Date.UTC(2026, 8, 1, 0, 0, 0); // 2026-09-01 — placeholder launch date; admin adjusts in /admin/contests before going live.

function weeklyIso(dayOffset: number, beijingHour = 10, minute = 0) {
  const date = new Date(weeklyStart + dayOffset * dayMs);
  date.setUTCHours(beijingHour - 8, minute, 0, 0);
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

// weekly-arena-01: template for docs/WEEKLY_CONTEST_FORMAT.md's recommended
// 8-day format (§15). Every problem slot here is intentionally unbound
// (problemId/draftProblemId both null) — there usually aren't enough real
// problems ready when this template gets synced, so it seeds empty slots an
// admin fills in from /admin/contests afterward (see AdminContestsView's
// "创建/同步 Weekly 01" button) rather than hardcoding placeholder problem
// ids that don't exist in the catalog. The public contest page and admin
// panel both already render "题目待关联"/"未关联题目" for a null-bound
// contest problem, so this renders fine before any binding happens.
const weeklyDailyDefaults = {
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

const weeklySprintDefaults = {
  problemPhase: "sprint" as const,
  scoreMax: 30,
  scorePolicy: "sprint_step" as const,
  multiplierEligible: false,
  timedModeEnabled: true,
  timeLimitSeconds: 120,
  maxAttempts: 1,
  // Left unset until a real problem (and its answer key in
  // contest_problem_answer_keys, via AdminSprintAnswerKeyEditor) is bound —
  // the admin picks single_choice/multiple_choice/fill_blank per problem.
  answerType: null,
  answerFormatNote: "",
};

const weeklyChallengeDefaults = {
  problemPhase: "challenge" as const,
  scoreMax: 100,
  scorePolicy: "manual" as const,
  multiplierEligible: false,
  timedModeEnabled: false,
  timeLimitSeconds: null,
  maxAttempts: 1,
  answerType: null,
  answerFormatNote: "",
};

const weeklyMajorDefaults = {
  problemPhase: "major" as const,
  scoreMax: 1000,
  scorePolicy: "manual" as const,
  multiplierEligible: false,
  timedModeEnabled: false,
  timeLimitSeconds: null,
  maxAttempts: 1,
  answerType: null,
  answerFormatNote: "",
};

const weeklyDailySlotMeta = [
  { title: "热身题", theme: "难度中低，保证每天都有稳定拿分的机会" },
  { title: "主线题", theme: "难度中等，构成当日主要区分" },
  { title: "拔高题", theme: "难度中高，给强选手留出区分空间" },
];

const weeklySprintTheme = "选择题或填空题，手动解锁后限时 120 秒，答错或超时不计分，不吃挑战倍率";
const weeklyChallengeTheme = "难度高、鼓励探索，不要求完整解出，但要写清关键观察和可行方向；只产出一个倍率，不逐题叠加";
const weeklyMajorTheme = "给参赛者 2-3 天自由作答，允许 partial credit，考察完整证明、复杂构造或综合分析，不吃挑战倍率";

let weeklyChallengeCounter = 0;

// Built day-by-day (not phase-by-phase) so the array is already in dayIndex
// order for the static-fallback path too (lib/contests.ts's Supabase-backed
// toContest() re-sorts by dayIndex regardless, but data/contests.ts's own
// getContest has no such step).
const weeklyArenaProblems: ContestProblem[] = [1, 2, 3, 4, 5].flatMap((day) => {
  const dayProblems: ContestProblem[] = [
    ...weeklyDailySlotMeta.map((slot, index) => ({
      id: `weekly-arena-01-daily-d${day}-${index + 1}`,
      contestId: "contest-weekly-arena-01",
      problemId: null,
      draftProblemId: null,
      dayIndex: day,
      title: slot.title,
      theme: slot.theme,
      openAt: weeklyIso(day - 1, 10, 0),
      closeAt: weeklyIso(day - 1, 17, 0),
      weight: 1,
      status: "locked" as const,
      unlockMode: "auto_time" as const,
      ...weeklyDailyDefaults,
    })),
    ...[1, 2, 3].map((slot) => ({
      id: `weekly-arena-01-sprint-d${day}-${slot}`,
      contestId: "contest-weekly-arena-01",
      problemId: null,
      draftProblemId: null,
      dayIndex: day,
      title: `计时题 ${slot}`,
      theme: weeklySprintTheme,
      openAt: weeklyIso(day - 1, 10, 0),
      closeAt: weeklyIso(day - 1, 17, 0),
      weight: 1,
      status: "locked" as const,
      unlockMode: "auto_time" as const,
      ...weeklySprintDefaults,
    })),
  ];

  // Challenge: Day 1-2, window spans both days — locked after Day 2 closes.
  if (day <= 2) {
    dayProblems.push(
      ...[1, 2].map(() => {
        weeklyChallengeCounter += 1;
        return {
          id: `weekly-arena-01-challenge-d${day}-${weeklyChallengeCounter}`,
          contestId: "contest-weekly-arena-01",
          problemId: null,
          draftProblemId: null,
          dayIndex: day,
          title: `挑战题 ${weeklyChallengeCounter}`,
          theme: weeklyChallengeTheme,
          openAt: weeklyIso(0, 10, 0),
          closeAt: weeklyIso(1, 17, 0),
          weight: 1,
          status: "locked" as const,
          unlockMode: "auto_time" as const,
          ...weeklyChallengeDefaults,
        };
      }),
    );
  }

  // Major: announced Day 3, closes Day 6 — the doc's flexible upper bound
  // (§7.1 allows Day 5 or Day 6 depending on difficulty).
  if (day === 3) {
    dayProblems.push({
      id: "weekly-arena-01-major-1",
      contestId: "contest-weekly-arena-01",
      problemId: null,
      draftProblemId: null,
      dayIndex: day,
      title: "大题",
      theme: weeklyMajorTheme,
      openAt: weeklyIso(2, 10, 0),
      closeAt: weeklyIso(5, 17, 0),
      weight: 1,
      status: "locked" as const,
      unlockMode: "auto_time" as const,
      ...weeklyMajorDefaults,
    });
  }

  return dayProblems;
});

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
  {
    id: "contest-weekly-arena-01",
    slug: "weekly-arena-01",
    title: "ProofArena Weekly 01",
    tagline: "一周赛制：普通题稳定作答、挑战题前期博弈、计时题速答对决、大题深度较量。",
    description: "8 天 / 普通题 + 挑战题 + 计时题 + 大题 / 挑战倍率结算 / 计时阶梯计分 / 赛后讨论与申诉",
    startAt: weeklyIso(0, 10, 0),
    endAt: weeklyIso(5, 17, 0),
    discussionStartAt: weeklyIso(5, 17, 0),
    discussionEndAt: weeklyIso(7, 0, 0),
    status: "draft",
    rules: [
      "总分 = 普通题原始分 × 挑战倍率 + 计时题分 + 大题分 + 可选奖励分 − 违规扣分。",
      "普通题 Day 1-5 每天开放（10:00-17:00，北京时间），计时题同步开放，手动解锁后限时 120 秒，答错或超时不计分，不吃挑战倍率。",
      "挑战题 Day 1-2 开放，只评一个普通题结算倍率（1.00x-1.20x），只作用于普通题，Day 2 结束后锁定提交。",
      "大题 Day 3 公布，Day 5 或 Day 6 截止，允许 partial credit，不吃挑战倍率。",
      "Day 6-7 为讨论与申诉期：可解释原提交、指出误判、补充细节，但不得提交全新核心思路要求重新按完整解法评分。",
      "完整规则、评分细则和公平性条款见 docs/WEEKLY_CONTEST_FORMAT.md。",
    ],
    problems: weeklyArenaProblems,
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
