# Supabase 设置

本文用于把 ProofArena 从静态 fallback 模式切换到社区模式：登录、投稿、审核、题库入库、比赛、评分和奖项都会依赖 Supabase。

## 1. 创建项目

1. 在 [Supabase](https://supabase.com) 创建新项目。
2. 选择离主要用户较近的区域，例如 Singapore 或 Tokyo。
3. 等项目初始化完成后，进入 Project Settings -> API。
4. 记录 `Project URL`、`anon public` key 和 service role key。

## 2. 配置环境变量

在项目根目录创建 `.env.local`：

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

说明：

- `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 会进入浏览器，用于普通用户登录、投稿和公开读取。
- `SUPABASE_SERVICE_ROLE_KEY` 只能用于服务端脚本或受控后台流程，不能暴露给浏览器。
- 缺少前两个变量时，应用自动使用静态题库和静态比赛 fallback。

## 3. 执行 migration

当前项目没有接入 Supabase CLI，migration 以 SQL 文件形式维护。新库按文件编号依次执行：

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_repair_submissions_schema.sql`
3. `supabase/migrations/003_repair_submission_review_policies.sql`
4. `supabase/migrations/004_contest_arena_mvp.sql`
5. `supabase/migrations/005_contest_submission_window.sql`
6. `supabase/migrations/006_contest_problem_unlock_mode.sql`
7. `supabase/migrations/007_solution_ratings_allow_static.sql`
8. `supabase/migrations/008_contest_thought_arena.sql`

执行方式：

1. 打开 Supabase Dashboard -> SQL Editor。
2. 逐个复制 SQL 文件内容并运行。
3. 每次运行后确认没有错误。
4. 在 Table Editor 检查核心表是否出现。

## 4. 核心表

| 表 | 用途 |
| --- | --- |
| `user_profiles` | 应用侧用户资料、展示名和角色 |
| `problems` | 数据库题库 |
| `solutions` | 数据库解法库 |
| `submissions` | 新题、解法和比赛投稿 |
| `comments` | 评论 |
| `votes` / `favorites` | 早期社区互动表 |
| `contests` | 比赛活动 |
| `contest_problems` | 比赛赛题安排 |
| `solution_ratings` | 解法互评 |
| `contest_submission_ratings` | 比赛投稿成为正式解法前的思路互评 |
| `awards` | 比赛奖项 |

`008_contest_thought_arena.sql` 还会创建 `submission-images` storage bucket，并重写比赛投稿窗口 trigger，使比赛投稿同时受比赛状态和单题开放时间约束。

## 5. Auth 与管理员

用户注册后，数据库 trigger 会自动创建 `public.user_profiles` 记录。

长期权限判断应看：

```text
public.user_profiles.role in ('moderator', 'admin')
```

不要把 Supabase 内部的 `auth.users` 当作应用资料表。`auth.users` 负责登录身份；`public.user_profiles` 负责显示资料和业务角色。

部分旧 migration 中有临时管理员邮箱白名单。这可以用于早期自救，但正式运营应改为给对应 `user_profiles.role` 赋值。

## 6. 导入静态题库

配置 `.env.local` 后，可以把 `data/problems.ts` 的题目和解法 seed 到数据库：

```bash
npm run seed
```

如果 Supabase 环境变量缺失、查询失败或表为空，页面会回退到静态题库，避免首页和题库直接变空。

## 7. 投稿与审核流程

`submissions` 同时承载两类投稿：

- `submission_type = 'problem'`：上传新题，`problem_id` 为空，`problem_source` 必填。
- `submission_type = 'solution'`：上传解法，必须绑定已有 `problem_id`。

普通流程：

1. 用户在 `/submit` 或 `/studio` 提交内容。
2. 投稿进入 `pending`。
3. 管理员在 `/admin/submissions` 审核。
4. 审核通过后调用发布流程，把新题写入 `problems`，或把解法写入 `solutions`。
5. 投稿状态和管理员备注保留在 `submissions`。

比赛投稿会额外写入：

- `contest_slug`
- `contest_problem_key`
- `contest_solution_type`
- `is_post_contest`

`005_contest_submission_window.sql` 提供基础比赛投稿窗口限制；`008_contest_thought_arena.sql` 会进一步校验单题开放时间，并自动补齐 `contest_id`、`contest_problem_id` 和 `contest_problem_key`。

## 8. 比赛后台

比赛相关表来自 `004_contest_arena_mvp.sql` 到 `008_contest_thought_arena.sql`。

后台入口：

- `/admin/contests`：创建或同步默认比赛，维护赛题、开放时间、解锁方式和奖项。
- `/contests`：前台比赛列表。
- `/contests/[slug]`：比赛详情、赛题安排、榜单和奖项。

默认比赛仍保存在 `data/contests.ts`，后台可以把它同步到数据库。数据库有数据时以前台数据库为准；没有数据时使用静态 fallback。

## 9. 本地验证

```bash
npm run dev
```

建议检查：

- `/problems` 能读取数据库或静态 fallback。
- `/submit` 登录后可以提交。
- `/profile` 能看到自己的投稿。
- `/admin/submissions` 管理员能看到并审核投稿。
- `/contests` 能显示比赛。
- `/admin/contests` 管理员能同步或编辑比赛。

构建验证：

```bash
npm run lint
npm run build:webpack
```

## 10. Vercel 部署

Vercel 使用默认构建命令即可：

```bash
npm run build
```

在 Project Settings -> Environment Variables 配置：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

如果本地沙箱里 Turbopack 因端口绑定权限报错，使用 `npm run build:webpack` 验证业务代码。

## 常见问题

### 投稿时报 `submission_type` 缺失

旧库缺列。执行：

```text
supabase/migrations/002_repair_submissions_schema.sql
```

### 管理员点击“保存并通过”后仍显示待审核

旧库缺少 `submissions` UPDATE RLS policy。执行：

```text
supabase/migrations/003_repair_submission_review_policies.sql
```

### 静态解法无法评分

旧外键要求 `solution_ratings.solution_id` 必须引用数据库 `solutions`，静态题库解法无法满足。执行：

```text
supabase/migrations/007_solution_ratings_allow_static.sql
```

### 比赛题目没有按时间开放

确认已执行：

```text
supabase/migrations/006_contest_problem_unlock_mode.sql
supabase/migrations/008_contest_thought_arena.sql
```

并检查 `contest_problems.unlock_mode` 是否为 `auto_time`。
