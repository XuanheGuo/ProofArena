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

第一场具体运营方案见 [ProofArena Invitational 01 启动方案](./FIRST_CONTEST_PLAN.md)。

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

`008_contest_thought_arena.sql` 补充了：

- `discussion_start_at` / `discussion_end_at`
- 投稿附件 `attachment_urls`
- `contest_submission_ratings`
- `submission-images` storage bucket
- 单题开放窗口校验

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

- 同步 `data/contests.ts` 中的默认比赛
- 创建或编辑比赛基础信息
- 添加赛题、设置开放/关闭时间、权重和解锁模式
- 添加奖项

管理员权限依赖 Supabase RLS，建议使用 `public.user_profiles.role` 管理。

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
- 管理员能在 `/admin/contests` 同步默认比赛。
- `npm run lint` 和 `npm run build:webpack` 通过。

## 下一步建议

1. 把 `contest_submission_ratings` 的前台写入、编辑和防重复交互补完整。
2. 将比赛评分维度文案、`solution_ratings` 字段和思路互评字段统一整理。
3. 给 `lib/contests.ts` 的 mapper 和排序逻辑补单元测试。
4. 增加管理员一键切换比赛状态和赛题状态的操作确认。
5. 明确附件上传大小、格式和清理策略。
