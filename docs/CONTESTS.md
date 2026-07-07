# 比赛模块

比赛模块的目标不是做刷题计时器，而是把一组题目的不同解法、思路火花、互评和赛后沉淀组织起来。当前代码已经有比赛前台、后台、默认数据、提交窗口和榜单框架，但仍有少量数据库缺口。

## 用户视角

一个比赛包含：

- 活动标题、口号、说明、规则、开始和结束时间
- 多道赛题，每题有开放时间、关闭时间、权重、主题和状态
- 比赛期间的解法投稿入口
- 赛后或评审期的解法互评、榜单和奖项
- 优秀解法回流到题目详情页，成为长期学习内容

比赛进行中，从比赛入口进入题目页时，已有解法和解法树会被保护性隐藏，避免提前泄题式影响。

**题干本身不保密。** 赛题取自已经公开的题库（`data/problems.ts` / 数据库 `problems` 表），同一道题随时能在 `/problems` 里搜到，标题、题干、专题标签本来就是公开信息。比赛真正要保护的是「已有解法」「参考答案」「比较/图谱工具」——这些内容如果提前可见，会替参赛者把路线定死。`/contests/[slug]/problems/[id]` 在赛题锁定（`unlockMode: auto_time` 且未到 `openAt`，或比赛还是 `draft`）时会展示"未解锁"占位页，**这只是为了不提前公布比赛节奏（第几天考哪道题），不是为了给题干本身保密**——同一题干仍可能通过 `/problems/[id]` 正常访问到。如果未来某场比赛需要使用从未公开过的新题，题干保密才需要额外的按天/按状态门控，目前的架构不提供这种门控。

第一场具体运营方案见 [ProofArena Invitational 01 启动方案](./FIRST_CONTEST_PLAN.md)。
后续一周制比赛、挑战倍率、大题讨论和计时题的完整规划见
[ProofArena 一周赛制规划](./WEEKLY_CONTEST_FORMAT.md)。
面向实现的功能拆解和 PR 顺序见
[一周赛制实现 Brief](./WEEKLY_CONTEST_IMPLEMENTATION_BRIEF.md)。

## 核心类型

类型集中在 `lib/types.ts`：

- `ContestStatus = 'draft' | 'active' | 'judging' | 'finished'`
- `ContestProblemStatus = 'locked' | 'open' | 'reviewing' | 'closed'`
- `ContestProblemUnlockMode = 'manual' | 'auto_time'`
- `ContestSolutionType` 描述投稿类型，例如标准解、巧解、教学解、错解分析、变式等
- `ContestAwardType` 描述奖项类型，例如最快提交、最佳标准解、最佳巧解、最佳贡献者等

`getEffectiveProblemStatus(problem, now)` 会在 `auto_time` 模式下根据 `openAt` 和 `closeAt` 计算展示状态；`manual` 模式直接使用数据库或静态数据里的 `status`。

## 数据来源

### 静态 fallback

`data/contests.ts` 保存默认比赛：

- slug: `first-arena`
- 7 天活动
- 3 道正式题 + 1 道开放讨论题
- 题目按日期自动解锁

没有 Supabase 或数据库为空时，前台会读取这份数据。

### Supabase

数据库读取集中在 `lib/contests.ts`：

- `getContests()`
- `getContest(slug)`
- `getContestForProblem(problemId, slug?)`
- `getFeaturedContest()`
- `getContestStats(contestIds)`
- `getContestSubmissionStats(contestSlug)`
- `getContestThoughts(contestSlug)`
- `getContestLeaderboard(contestSlug)`
- `getContestUserRankings(contestSlug, awards)`

Supabase 缺失时，比赛基础信息回退到静态数据，统计、榜单和思路投稿返回空值。

## 数据库表

已由 migration 覆盖：

- `contests`
- `contest_problems`
- `submissions` 的比赛字段
- `solutions` 的比赛字段
- `solution_ratings`
- `awards`

相关 migration：

1. `004_contest_arena_mvp.sql`
2. `005_contest_submission_window.sql`
3. `006_contest_problem_unlock_mode.sql`
4. `007_solution_ratings_allow_static.sql`
5. `008_contest_thought_arena.sql`
6. `012_problem_vault.sql`
7. `013_weekly_contest_scoring.sql`

`008_contest_thought_arena.sql` 补充了：

- `discussion_start_at` / `discussion_end_at`
- 投稿附件 `attachment_urls`
- `contest_submission_ratings`
- `submission-images` storage bucket
- 单题开放窗口校验

`012_problem_vault.sql` 新增了未公开题库（见下一节）。

`013_weekly_contest_scoring.sql` 新增了一周赛制的评分表（见「一周赛制 Weekly
Contest」一节）。

## 未公开题库 Problem Vault

比赛新题、Proof Graph 建设中题目、官方题解未发布题目放在 `problem_drafts` 表，
不是 `problems`。这张表默认只有 `admin`/`moderator` 能读写（RLS，没有
"viewable by everyone" 策略），公开题库查询（`getProblems`、`getProblem`、
`getProblemSummaries`、相关题推荐）一律不读它。

`contest_problems` 新增 `draft_problem_id` 字段，和 `problem_id` 互斥（DB
check constraint 保证同一行只能二选一）：

- `problem_id` 非空：赛题来自公开题库，行为和现有逻辑完全一致。
- `draft_problem_id` 非空：赛题是一道还没公开的新题。

赛题解锁前（`contest.status === 'draft'`，或
`getEffectiveProblemStatus(contestProblem) === 'locked'`），
`/contests/[slug]/problems/[id]` 一律展示"未解锁"占位，不读取、也不在
`generateMetadata` 里暴露任何题面或标题。解锁后，页面通过
`lib/problem-drafts.ts` 的 `getProblemDraftForContestDisplay` 用
service role key 绕过 RLS 读取草稿内容，再用 `adaptProblemDraftToProblem`
适配成普通 `Problem` 对象——之后完全复用现有渲染和"比赛进行中隐藏"逻辑
（`redactLockedProblem`、`hideSolutionsForContest`），答案、官方解法、
Proof Graph 依然只在 `active` 期间隐藏。

`/admin/contests` 可以直接创建未公开题目、把赛题关联到未公开题库、以及
把某道未公开题目「发布到公开题库」（`lib/promote-problem-draft.ts` 的
`promoteProblemDraft`）。发布会：

1. 把草稿内容写入 `problems`，生成新的公开 `problemId`，并记录
   `problems.source_draft_id` 指回草稿（保留来源关系，类比
   `solutions.source_submission_id`）。
2. 把草稿标记为 `promoted`，记录 `promoted_problem_id`。
3. 把所有仍指向该草稿的 `contest_problems` 行自动切换为
   `problem_id = 新公开题目`、`draft_problem_id = null`。

发布是赛后清理动作，不应该在比赛进行中执行——一旦发布，题目立刻对全站
公开可见，会破坏"新题只在比赛内可见"的前提。

**已知限制**：这一轮没有让 `submissions`/`solutions` 支持关联未公开题库
（它们的 `problem_id` 仍然要求外键指向 `problems`）。因此一道纯未公开题库
赛题在发布前无法收到正式的参赛投稿——`/submit` 的题目下拉框本来就会因为
`contestProblem.problemId` 为空而自动排除它。要让未公开新题真正收集比赛
投稿，需要后续再给 `submissions`/`solutions` 加 `draft_problem_id`，并相应
更新 `enforce_contest_submission_window` 触发器、`SubmitForm`、
`ContestThoughtArena` 和发布流程。

## 前台页面

### `/contests`

比赛列表页，展示活动数量、赛题数量、参与/投稿统计和入口。

### `/contests/[slug]`

比赛详情页，展示：

- 比赛状态、时间、规则
- 题目安排和锁定状态
- 今日题目和提交解法入口
- 赛后优秀解法、榜单和奖项

页面会同时读取 `getProblems()` 和 `getContest(slug)`，因此比赛赛题必须能通过 `problemId` 关联到题库。

## 后台页面

### `/admin/contests`

由 `AdminContestsView` 实现，管理员可以：

- 一键同步 `data/contests.ts` 中的模板比赛：「同步 Invitational 01」（原有旧格式比赛）和「创建/同步 Weekly 01」（一周赛制模板，见下一节）
- 创建或编辑比赛基础信息
- 添加赛题、设置开放/关闭时间、权重、解锁模式，以及一周赛制字段（赛题阶段、满分、评分方式、是否吃挑战倍率、是否计时模式、限时、提交次数上限、答案类型）
- 计时题（`problem_phase = 'sprint'` 或 `timed_mode_enabled = true`）额外显示 `AdminSprintAnswerKeyEditor`：编辑标准答案、答案类型、格式说明，见下一节
- 通过 `AdminContestScoringView` 给 daily/challenge/major 评分、设置挑战倍率和扣分
- 添加奖项

管理员权限依赖 Supabase RLS，建议使用 `public.user_profiles.role` 管理。

## 一周赛制 Weekly Contest

完整规则见 [ProofArena 一周赛制规划](./WEEKLY_CONTEST_FORMAT.md)，实现拆解见
[一周赛制实现 Brief](./WEEKLY_CONTEST_IMPLEMENTATION_BRIEF.md)。这里只记录当前
已经落地、可以直接操作的部分。

### 数据模型

`013_weekly_contest_scoring.sql` 给 `contest_problems` 加了 `problem_phase`
（`daily` / `challenge` / `sprint` / `major` / `discussion`）、`score_max`、
`score_policy`、`multiplier_eligible`、`timed_mode_enabled`、
`time_limit_seconds`、`max_attempts`、`answer_type`、`answer_format_note`，并新增
四张表：`contest_problem_answer_keys`（计时题标准答案，admin-only）、
`contest_participant_profiles`（挑战倍率、扣分）、
`contest_submission_scores`（daily/challenge/major 人工评分）、
`contest_sprint_attempts`（计时题解锁/提交记录，无任何用户可读写的 RLS，只能
通过 service-role 的 sprint API 或 `/api/contests/[slug]/me` 访问）。

### 计时题答案 key 编辑器

`components/AdminSprintAnswerKeyEditor.tsx`（嵌入 `AdminContestsView` 的赛题
安排行）现在可以直接编辑 `contest_problem_answer_keys`，不需要手动进 Supabase：

- 每道 sprint / 计时模式赛题旁显示「答案已配置」/「答案未配置」徽章。
- 展开后可以设置答案类型（单选/多选/填空）、标准答案（textarea，一行一个可
  接受答案，保存时转换成 `string[]`）、格式说明，以及清空按钮。
- 答案 key 只在这个编辑器里读取和展示；公开页面、`unlock`/`submit` API、
  `getContestScoreboard` 都不会返回 `answer_key`。

### Weekly 01 模板

`/admin/contests` 的「创建/同步 Weekly 01」按钮会从 `data/contests.ts` 的
`weekly-arena-01` 种子创建/更新一场 8 天赛程模板：Day 1-5 每天 3 道普通题 + 3
道计时题，Day 1-2 挑战题，Day 3 公布、Day 6 截止的大题，Day 6-7 为讨论期。
每个赛题槽位的 `problemId`/`draftProblemId` 都是 `null`（题目待关联），前台
和后台已经能正确显示"未关联题目"状态。

`syncSeedContest(seedSlug)` 同步 `contest_problems` 时按
`(day_index, problem_phase, title)` 匹配已有行做更新，找不到才插入——一周模板
同一天有多道题，不能再用 `(contest_id, day_index)` 当唯一定位键（这是
`first-arena` 原来的假设，只适用于一天一题的赛程）。

**正式开赛前，管理员仍需要：**

1. 把每个赛题槽位绑定到公开题库或 Problem Vault 草稿。
2. 给每道计时题配置标准答案（`AdminSprintAnswerKeyEditor`）。
3. 确认已执行 `013_weekly_contest_scoring.sql`。
4. 根据实际排期调整 `weekly-arena-01` 的时间（种子数据里是占位日期）。
5. 把比赛状态从 `draft` 切换为 `active` 前，检查所有赛题时间和内容是否就绪。

## 投稿流程

比赛投稿本质上仍是 `submissions` 里的解法投稿：

```text
submission_type = 'solution'
contest_slug = 当前比赛 slug
contest_problem_key = 当前赛题 key
contest_solution_type = standard / clever / teaching / ...
is_post_contest = 根据窗口自动判断或由发布流程保留
```

数据库 trigger `enforce_contest_submission_window` 会检查：

- 比赛存在
- 投稿题目属于该比赛
- 草稿状态不能投稿
- active 状态可投稿
- judging / finished 或超过 `end_at` 后标记为赛后投稿

## 发布流程

管理员在 `/admin/submissions` 审核通过后，`publishSubmission` 会：

- 新题投稿写入 `problems`
- 解法投稿写入 `solutions`
- 保留 `contest_slug`、`contest_problem_key`、`contest_solution_type`、`is_post_contest`
- 记录 `author_id` 和 `source_submission_id`

这让比赛优秀解法可以进入正式解法库，并在题目页长期展示。

## 榜单与评分

正式解法评分写入 `solution_ratings`，每项 0-5：

- `correctness`
- `clarity`
- `elegance`
- `insight`
- `exam_usability`

`getContestLeaderboard` 按解法平均总分排序。`getContestUserRankings` 按用户最佳平均分加奖项积分排序。

注意：这套 0-5 比赛互评分不同于题解内容里的 0-10 五维评分。前者是社区评价，后者是编辑整理时的内容画像。

## 开发检查清单

改比赛功能时，至少检查：

- 无 Supabase 时 `/contests` 和 `/contests/first-arena` 仍可打开。
- 有 Supabase 时比赛列表、详情、统计和后台读取正常。
- `auto_time` 赛题按时间锁定、开放和关闭。
- 比赛投稿会写入 `contest_slug` 和 `contest_problem_key`。
- 比赛进行中从 `?contest=slug` 进入题目页时，已有解法隐藏逻辑仍有效。
- 赛题题干本身不额外保密（题库本来就公开）；改动隐藏逻辑时不要误把题干也裁掉。
- 管理员能在 `/admin/contests` 同步 Invitational 01 和 Weekly 01 两个模板。
- 未公开题库（`problem_drafts`）锁定/`draft` 期间不泄漏题面和 metadata；解锁后能展示草稿题面；`active` 期间仍隐藏答案/官方解/Proof Graph；`getProblems`/`getProblem`/`getProblemSummaries`/相关题推荐不读取 `problem_drafts`。
- 同一天有多道赛题（Weekly 01 模板）时，重复点击「创建/同步 Weekly 01」不会互相覆盖或重复插入。
- `AdminSprintAnswerKeyEditor` 保存/清空答案 key 后，状态徽章正确刷新；非 sprint / 非计时模式赛题不显示编辑器。
- 公开比赛页面、sprint 的 unlock/submit API、`/api/contests/[slug]/me`、`getContestScoreboard` 都不会返回 `answer_key`。
- `npm run lint` 和 `npm run build:webpack` 通过。

## 下一步建议

1. 把 `contest_submission_ratings` 的前台写入、编辑和防重复交互补完整。
2. 将比赛评分维度文案、`solution_ratings` 字段和思路互评字段统一整理。
3. 给 `lib/contests.ts` 的 mapper 和排序逻辑补单元测试。
4. 增加管理员一键切换比赛状态和赛题状态的操作确认。
5. 明确附件上传大小、格式和清理策略。
