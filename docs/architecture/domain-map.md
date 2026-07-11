# ProofArena 领域地图

> 状态：架构固化文档（第一阶段，只读审计的产物）
>
> 本文定义 ProofArena 的目标领域边界，供后续渐进式重构对照。它不要求代码立即符合这里的描述——现状与目标状态的差距记录在 [`principle-violations.md`](./principle-violations.md)。版本血缘的详细设计见 [`version-lineage.md`](./version-lineage.md)，验证语义的详细设计见 [`verification-semantics.md`](./verification-semantics.md)。

## 六条最高级架构约束（本文的依据）

1. `ProblemVersion → SolutionRevision → ProofIRVersion → VerificationRun → VerificationEvidence` 全链路不可变绑定。
2. Arena 拥有参赛行为和历史快照，Solution 拥有可演化的解答资产。
3. ProofIR 是 Solution、Proof Intelligence 与 Verification 之间的稳定协议。
4. 验证表达运行状态、数学结论、覆盖度、证据等级、假设和局限，不使用单一可信度分数。
5. Platform 是彼此隔离的平台能力集合，不能成为万能目录。
6. 跨领域只通过公开接口、引用、快照、命令和领域事件交互，不共享可变内部对象。

## 总览

| 类别 | 领域 | 一句话职责 | 现状成熟度 |
| --- | --- | --- | --- |
| Core | Solution | 拥有可演化的解答资产 | 部分清晰，被 Arena/Verification 字段污染 |
| Core | Proof Intelligence | 拥有结构化证明推理（Proof Graph / 未来 ProofIR） | 存在但直接读写 Problem/Solution 内部 |
| Core | Verification | 运行并记录机器可核验的验证结果 | 内部分层最干净，但仍越权读其他领域表 |
| Core | Arena | 拥有参赛行为和历史快照 | 与 Solution/Submission 表结构深度耦合 |
| Core | Knowledge / Methodology | 拥有"为什么用/为什么不用某方法"的方法论模型 | 与 Proof Intelligence 的同名概念重复、未统一 |
| Supporting | Problem | 拥有题目陈述、元数据、版本 | 无版本概念，且反向持有整个 Solution 数组 |
| Supporting | Learning | 拥有学习路径/思路引导 | 边界几乎未定义，寄生在 Solution 存储里 |
| Supporting | Knowledge Base | 拥有概念/洞察静态词条 | 无统一读接口，5+ 处直接跨域 import |
| Platform | Identity | 拥有会话身份与资料展示 | 基础设施级别，较清晰 |
| Platform | Authorization | 拥有 moderator/admin 判定规则 | **全仓库违规最严重**：9 处独立实现 |
| Platform | Moderation | 拥有审核决策流程 | 决策写入未经授权层，仅靠 RLS |
| Platform | Publishing | 拥有"提交转正式内容"的发布能力 | 三处独立写手，字段覆盖已经漂移 |
| Platform | Search | 拥有查询/过滤/排序能力 | 事实上不存在，只有页面内联数组过滤 |
| Platform | Storage | 拥有文件/图片上传 | 两处组件各自重写同一段逻辑 |
| Platform | Notifications | 拥有状态变更通知 | 完全不存在 |
| Platform | Jobs | 拥有异步任务生命周期 | 完全不存在，"queued/running"只是同步请求内的瞬时状态 |
| Platform | Quota | 拥有限流/冷却策略 | 三套独立实现，语义互不相通 |
| Platform | Audit | 拥有操作审计留痕 | 完全不存在 |
| Platform | Observability | 拥有统一日志/错误上报 | 7+ 处各自的 console.error 约定 |

---

## Core Domains

### Solution

**职责**
- 拥有解答内容本身：陈述、步骤、评分、类型（`SolutionKind`）、作者归属。
- 拥有解答的演化历史（目标：`SolutionRevision`，见 [version-lineage.md](./version-lineage.md)）。
- 拥有解答质量的自评估规则（`lib/quality-checker.ts`）。

**拥有的数据**
- `solutions` 表；`Solution` / `SolutionScores` / `SolutionKind` / `ThinkingCues` 类型（`lib/types.ts`）。
- `solution_ratings`（对已发布解答的社区评分，区别于 Arena 的 `contest_submission_ratings`）。

**对外能力**
- 解答读取（`lib/db.ts` 的 `toSolution` 及相关查询）。
- 解答质量评分（`lib/quality-checker.ts`，纯函数）。
- （目标）`SolutionRevision` 创建命令，供 Publishing 在发布新修订时调用。

**禁止承担的职责**
- 不得内嵌 Arena 的参赛字段（`contestSolutionType`、`isPostContest` 等）——这些属于 Arena 的参赛快照，不是解答资产本身的属性。现状：`solutions.contest_id/contest_problem_id/contest_slug/contest_problem_key/contest_solution_type/is_post_contest` 直接加在 `solutions` 表上（`ARENA-001`）。
- 不得让 legacy 的编辑式 `Verification` 字段（`verified|partial|manual`）冒充机器核验结论——真正的验证结论必须来自 Verification 领域（`SOL-001`、`SOL-005`）。
- 不得被其他领域（Arena）绕过读接口直接查询 `solutions`/`solution_ratings` 表（`ARENA-002`）。
- 不得让跨解答的血缘指针（`forkOf`）以无约束字符串形式存在于 `thinking_cues` JSONB 里（`SOL-003`）。

**现状锚点**：`lib/db.ts`、`lib/types.ts`（`Solution` 接口）、`lib/quality-checker.ts`、`lib/solution-kinds.ts`。关联违规：`SOL-001` 至 `SOL-007`、`PROB-002`、`ARENA-001`、`ARENA-002`。

---

### Proof Intelligence

**职责**
- 拥有结构化的证明推理产物：观察点（`ProofObservation`）、策略分支、变换步骤、方法边界、挑战边（`ProofChallengeEdge`）——即 Proof Graph，未来演进为有版本的 `ProofIR`。
- 作为 Solution 与 Verification 之间的中介：把解答内容整理成 Verification 引擎可消费的稳定形态（目标状态；今天不存在）。

**拥有的数据**
- `problems.proof_graph` JSONB（目标：独立的、有版本的 `proof_ir_versions`）；`ProofGraphV1` 类型族（`lib/types.ts`）。

**对外能力**
- 按题目查询证明图（供 `ProblemDetailExperience` 渲染）。
- 校验并保存证明图编辑（`lib/save-proof-graph.ts`，目前实现方式需要调整，见下）。
- （目标）向 Verification 输出 `ProofIRVersion` 快照。

**禁止承担的职责**
- 不得绕过 Problem 领域自己的写接口，直接 `UPDATE problems` 表（`lib/save-proof-graph.ts:53-58` 目前正是这样做的——`SOL-002`、`PROB-004`）。
- 不得直接 import `Solution`/`Problem` 的完整 TypeScript 内部结构并解构私有字段（`components/ProofGraphMatrix.tsx`、`lib/load-solution-drafts.ts` 目前正是这样——`SOL-004`）。
- 不得与 Knowledge/Methodology 各自维护一套"为什么不用某方法"的重复模型（`ProofMethodBoundary` vs `WhyNotMethod`，`KNOW-003`）——这个概念应由 Knowledge/Methodology 统一拥有，Proof Intelligence 引用而非复制。
- 不得让证明图的保存成为无版本、覆盖式的 `UPDATE`（`SOL-002`）。

**现状锚点**：`lib/save-proof-graph.ts`、`lib/load-solution-drafts.ts`、`components/ProofGraphEditor.tsx`、`components/ProofGraphMatrix.tsx`、迁移 `011_proof_graph_mvp.sql`。关联违规：`SOL-002`、`SOL-004`、`VER-004`、`PROB-004`、`KNOW-003`。

---

### Verification

**职责**
- 对给定的证明/解答快照运行机器可核验的检查（当前：Lean via AXLE；预留：CAS/numerical/z3）。
- 表达运行状态（`VerificationRunStatus`）与数学结论（`VerificationConclusion`）分离的结果，附带证据、覆盖度、假设与局限（详见 [verification-semantics.md](./verification-semantics.md)）。
- 保证一旦产生终态结果即不可变。

**拥有的数据**
- `verification_tasks` 表；`verification/domain/*` 类型；`public_verification_summaries` 视图（唯一合法的公开只读入口）。

**对外能力**
- 创建/查询验证任务（`verification/index.ts`、`verification/api.ts`、`/api/verifications/*`）。
- 面向 UI 的状态展示映射（`verification/ui-meta.ts`）。

**禁止承担的职责**
- 不得为了做鉴权而直接查询 `problems`/`submissions`/`solutions` 的内部列（`author_id`、`source_submission_id` 等）——现状：`verification/repositories/supabase-verification-repository.ts:55-78` 的 `authorize()` 正是这样做的，是本轮审计中"最干净的领域反而违反了跨域隔离"的典型案例（`VER-003`）。
- 不得让单一 `verdict` 字段同时承担"数学结论"和"基础设施失败原因"两种语义（`VER-002`：`accepted|rejected` 与 `timeout|rate_limited|provider_error` 混在同一枚举里）。
- 不得放任自己与另外两套"验证"系统（Solution 上的 legacy `Verification` 字段、CAS 的临时性 `useState` 结果）在同一个领域名下互不相认（`VER-005`）。
- 不得独立重新实现 moderator/admin 判定规则（`VER-006`）——必须调用 Authorization 领域的唯一公开谓词。
- 不得让重试（retry）产生的新任务行与原任务之间没有可查询的血缘关系（`PLAT-006`）。

**现状锚点**：`verification/`（`domain/`、`service/`、`repositories/`、`providers/`、`engines/`）、迁移 `024_unified_verification_system.sql`。这是全仓库分层最干净的模块（domain → service → repositories/providers/engines，且大多数外部调用者只通过 `verification/index.ts` 或 `verification/api.ts` 进入），应作为其他领域重构的参照范式——但其自身仍有 `VER-001` 至 `VER-006` 六项违规需要修正。

---

### Arena

**职责**
- 拥有比赛参与行为的完整生命周期：报名、赛题解锁窗口、限时冲刺答题、评分、排行榜、奖项。
- 拥有参赛行为的历史快照——一旦比赛结束，该快照不应再被参赛者事后改变。

**拥有的数据**
- `contests`、`contest_problems`、`contest_registrations`、`contest_participant_profiles`、`contest_submission_scores`、`contest_sprint_attempts`、`contest_problem_answer_keys`、`awards`、`contest_submission_ratings` 等表；`Contest`/`ContestProblem`/`ContestRegistration`/`ContestAward` 类型。

**对外能力**
- 比赛读取（`lib/contests.ts` 的 CRUD 部分）、提交窗口/访问判断（`lib/contest-access.ts`）、冲刺解锁/提交 API（`app/api/contests/[slug]/sprint/*`）、排行榜/记分板查询。

**禁止承担的职责**
- 不得把参赛专属字段（`contest_id`、`contest_solution_type`、`is_post_contest` 等）写死在 `solutions`/`submissions` 表上，把 Solution 资产和 Arena 参赛快照永久焊死在一起（`ARENA-001`）——目标状态是 Arena 拥有自己的、引用 `solutions.id` 的参赛记录表。
- 不得绕过 Solution 领域自己的读接口，直接查询 `solutions`/`solution_ratings` 表来计算排行榜（`ARENA-002`）。
- 不得在没有 Arena 拥有的"重新链接"命令的情况下，任由 Publishing 领域直接改写 `contest_problems`（`ARENA-003`，`lib/promote-problem-draft.ts` 直接 `UPDATE contest_problems`）。
- 不得让核心执行函数（`enforce_contest_submission_window()`）在多个迁移文件间反复 `CREATE OR REPLACE` 而没有单一权威版本——当前该函数被六个迁移重定义，且两个同号为 `020_*` 的迁移在字典序重放下会静默丢失其中一个修复（`ARENA-005`，本审计中确认的最严重的一条 P0）。
- 不得把"社区评分排行榜"和"官方周赛记分板"两套完全不同的评分算法混在同一个文件、用相近的函数名（`getContestUserRankings` vs `getContestScoreboard`）表达（`ARENA-006`）。

**现状锚点**：`lib/contests.ts`（999 行，本轮审计中职责最集中的单文件）、`lib/contest-*.ts`、`components/AdminContestsView.tsx`（2760 行）、`components/AdminContestScoringView.tsx`、迁移 `004`-`021`。关联违规：`ARENA-001` 至 `ARENA-006`。

---

### Knowledge / Methodology

**职责**
- 拥有"这道题/这个解法为什么该用某方法、为什么不该用另一方法、方法的适用边界在哪里"这一核心方法论模型——这是 ProofArena 区别于普通题库的教学差异化能力，因此归为 Core 而非 Supporting。
- 为 Problem、Solution、Proof Intelligence 提供统一的方法论引用点，而不是被三者各自复制一份。

**拥有的数据**
- `ConceptLink`、`ConceptContrast`、`BoundaryNote`、`ContrastProblem`、`WhyNotMethod`（`lib/types.ts`）；`data/concept-boundaries.ts`。
- 目标：与 Proof Intelligence 的 `ProofMethodBoundary` 合并为一个概念，或明确记录两者的差异原因（见 `KNOW-003`）。

**对外能力**
- 按 problem/solution/knowledge id 查询方法论标注（目标：单一模块；现状：`data/concept-boundaries.ts` 的三张平行查找表 + 一个通用 `mergeConceptBoundaryFields` 泛型合并函数）。
- （目标）供 Proof Graph 渲染复用的方法边界读接口，取代 `ProofMethodBoundary` 的重复定义。

**禁止承担的职责**
- 不得成为一个可以无差别挂到 `Problem`、`Solution`、`KnowledgeNode` 任意实体上的"万能标注口袋"（`PedagogicalAnnotations` 现有 9 个可选字段，`KNOW-005`）。
- 不得被 Solution/Problem 的构造函数在模块加载时静默调用合并（`data/problems.ts` 在 `solution()`/`problem()` 构造器里直接调用 `matchTagsToKnowledge`/`mergeConceptBoundaryFields`，`KNOW-004`）——方法论增强应该是读时查询，不是写时烘焙。

**现状锚点**：`data/concept-boundaries.ts`、`lib/types.ts` 的 `PedagogicalAnnotations`、`components/MethodBoundaryHighlights.tsx`、`components/ConceptBoundaryPanel.tsx`。关联违规：`KNOW-003`、`KNOW-004`、`KNOW-005`。

---

## Supporting Domains

### Problem

**职责**
- 拥有题目陈述、答案、来源、难度等元数据。
- 作为不可变版本链的根节点（目标：`ProblemVersion`，见 [version-lineage.md](./version-lineage.md)）。
- 保持轻量、可独立缓存——不应因为需要携带 Solution 的完整数据而无法被独立读取/缓存。

**拥有的数据**
- `problems` 表、`problem_drafts`（Problem Vault）；`Problem`/`ProblemSummary` 类型。

**对外能力**
- `getProblem`/`getProblems`/`getProblemSummaries`/`getProblemsByIds`（`lib/db.ts`）。
- （目标）面向 Arena 的窄化只读 DTO（例如 `getProblemStatementSummary`），而不是把完整 `Problem` 对象暴露给 Arena。

**禁止承担的职责**
- 不得把完整、可变的 `Solution[]` 作为 `Problem` 类型的必填内嵌字段（`lib/types.ts:353-375`）——这使得每一次 Problem 读取都结构性耦合于 Solution 的完整内部形状（`PROB-002`）。`ProblemSummary`/`SolutionSummary` 已经展示了正确的引用式模式，应推广为默认。
- 不得在自己的动作（如 `promoteProblemDraft`）里直接改写 Arena 的 `contest_problems` 和 Submission 的 `submissions` 表（`PROB-003`）——应通过 Arena/Submission 拥有的重新链接函数。
- 不得允许 Proof Intelligence 绕过自己直接写 `problems` 表（`PROB-004`）。
- 不得让 legacy 的 `Solution.verification` 状态借着内嵌关系冒充"题目的验证真相"（`PROB-005`）。

**现状锚点**：`lib/db.ts`、`lib/problem-drafts.ts`、`lib/promote-problem-draft.ts`、迁移 `001_initial_schema.sql`、`012_problem_vault.sql`。关联违规：`PROB-001` 至 `PROB-005`。

---

### Learning

**职责**
- 拥有面向读者的学习路径引导：`LearningGuide`、`ThinkingCues` 中与"如何循序渐进理解这道题/这个解法"相关的部分。
- 与 Knowledge/Methodology 的关系：Learning 编排"怎么学"，Knowledge/Methodology 提供"学什么"的方法论素材。

**拥有的数据**
- `LearningGuide` 类型；`ThinkingCues`（需要与 Solution 的血缘指针字段拆分，见下）。

**对外能力**
- 按题目/解答查询学习路径（当前隐含在 `Problem`/`Solution` 类型内，尚无独立读接口）。

**禁止承担的职责**
- 不得成为 Solution 血缘指针（`forkOf`）的事实存储地——`forkOf` 目前寄生在 `thinking_cues` JSONB 里（`SOL-003`），这是 Solution 领域的血缘关系，不应该因为存储位置在 `thinking_cues` 就被当成 Learning 的数据。

**现状锚点**：`lib/types.ts` 的 `LearningGuide`/`ThinkingCues`。本轮审计未对 Learning 领域单独立案，但 `SOL-003`/`SOL-006` 触及其存储边界，需要在后续设计中明确 Learning 与 Solution 在 `thinking_cues` 上的字段归属。

---

### Knowledge Base

**职责**
- 拥有概念词条（`KnowledgeNode`）和洞察卡片（`InsightNode`）这类静态参考内容——百科式的定义/背景资料，供 Methodology、Learning 和展示层引用。

**拥有的数据**
- `data/knowledge.ts`、`data/insights.ts`（当前的事实数据源；`knowledge_nodes`/`insight_nodes` 表自 `001_initial_schema.sql` 存在但未见任何实际读路径消费）。

**对外能力**
- （目标）唯一的读接口 `lib/knowledge.ts`：`getKnowledgeNode`/`getInsightNode`/`getKnowledgeByCategory`。
- 现状：不存在这样的模块，5 个以上跨域文件（`lib/problem-detail-helpers.ts`、`components/ConceptBoundaryPanel.tsx`、`components/ShareCard.tsx`、`components/StudioWorkspace.tsx`、`components/SolutionCard.tsx`、`app/library/*`）各自直接 `import` `@/data/knowledge`/`@/data/insights`（`KNOW-002`）。

**禁止承担的职责**
- 不得被跨域代码绕过统一入口直接 import 静态数据模块（`KNOW-001`：`app/library/[id]/page.tsx` 直接 `import problems from '@/data/problems'` 而不经过 `lib/db.ts`，同时违反了 Problem 领域的读边界）。
- 不得让 `conceptId`/`problemId`/`knowledgeIds`/`insightIds` 这类跨实体引用停留在无校验的裸字符串状态、失配时静默降级（`KNOW-006`）。

**现状锚点**：`data/knowledge.ts`、`data/insights.ts`、迁移 `001_initial_schema.sql`。关联违规：`KNOW-001`、`KNOW-002`、`KNOW-006`。

---

## Platform Capabilities

> Platform 能力集合的共同规则：每个能力必须有且只有一个公开接口；任何领域需要该能力时调用接口，不得各自重新实现；能力本身不得反向积累业务语义变成新的 `lib/utils`。

### Identity

**职责**：拥有会话身份（登录态）与用户资料展示字段（用户名、显示名、头像）。
**拥有的数据**：`auth.users`（Supabase Auth）、`user_profiles` 表。
**对外能力**：`createClient`/`createServiceClient`/`createPublicClient`（`lib/supabase-server.ts`、`lib/supabase-public.ts`、`lib/supabase-client.ts`）。
**禁止承担的职责**：不得自己判定"谁是 moderator"——Identity 只存储 `role` 列，如何解释这个角色（含 owner 邮箱旁路）是 Authorization 的职责，两者边界不清正是 `AUTHZ-001` 系列问题的根源之一。
**现状锚点**：`lib/supabase-server.ts`、`lib/supabase-client.ts`、`lib/supabase-public.ts`；`lib/supabase.ts` 是无调用方的死代码，应删除或明确说明保留原因（`AUTHZ-005`）。

### Authorization

**职责**：拥有唯一的 moderator/admin 判定规则（角色检查 + owner 邮箱旁路），供全站调用。
**拥有的数据**：不拥有数据本身（读取 `user_profiles.role`），拥有的是"规则"。
**对外能力**：`requireModerator()`（`lib/require-moderator.ts`，当前的事实标准实现）。
**禁止承担的职责**：不得被每个领域各自重新实现。**这是本轮审计中违规最密集的能力**：同一条判定规则被独立实现了至少 9 处——`lib/require-moderator.ts`（标准实现，含 owner 邮箱旁路）、`lib/proof-graph-admin-auth.ts`（`AUTHZ-004`）、`verification/api.ts` + `verification/repositories/supabase-verification-repository.ts`（`VER-006`）、`components/AuthButton.tsx`（缺邮箱旁路）、以及 5 个 `app/admin/*/page.tsx`（均缺邮箱旁路）。其中 3 处已经产生真实的行为分歧（`AUTHZ-002`：owner 账号可能被 `/admin` 拒之门外，却仍能通过 server action 执行特权写入）。
**现状锚点**：`lib/require-moderator.ts`。关联违规：`AUTHZ-001`、`AUTHZ-002`、`AUTHZ-004`、`SOL-007`、`VER-006`。

### Moderation

**职责**：拥有投稿的审核决策流程（approve/reject/needs_revision），决策本身，不包括决策之后的发布副作用（那是 Publishing 的职责）。
**拥有的数据**：`submissions.status`/`moderator_notes`（现状；目标是审核决策历史独立于会被销毁性清空的 `moderator_notes`）。
**对外能力**：（目标）一个审核决策命令，供 `AdminSubmissionsView` 调用。
**禁止承担的职责**：不得让状态迁移写入完全绕开应用层授权（`AUTHZ-003`：`AdminSubmissionsView.tsx:429-432` 的状态 patch 直接走浏览器端 `supabase.from('submissions').update()`，只靠 RLS 兜底，而同一审核流程里紧接着的发布步骤却调用了 `requireModerator`——同一个操作流程里两种不同的授权保证强度）。
**现状锚点**：`components/AdminSubmissionsView.tsx`、迁移 `003`/`017`/`019`。关联违规：`AUTHZ-003`；与 `PLAT-002`（审核历史不可追溯）相邻。

### Publishing

**职责**：拥有"把已批准的投稿/草稿转化为正式 `problems`/`solutions` 行"这一单一能力，并拥有这个转化过程的规范字段/默认值。
**拥有的数据**：不拥有独立数据表，代表 Moderation/Problem Vault 写入 `problems`/`solutions`。
**对外能力**：（目标）`publishProblem()`/`publishSolution()`，字段覆盖和默认值统一。
**禁止承担的职责**：不得让同一张表被三个互不知情的写手独立写入、字段覆盖范围各自漂移——现状：`lib/publish-submission.ts` 的 `publishProblem` 与 `lib/promote-problem-draft.ts` 的 `promoteProblemDraft` 各自构造 `problems` 的 insert payload，前者填充 9 个知识/概念字段，后者全部留空（`PUB-001`）；`lib/save-proof-graph.ts` 是第三个独立写手。不得把 Solution/Problem 领域自己的默认值（默认 `SolutionScores` 全 8 分、默认 `Verification` 脚手架）硬编码在 Publishing 文件里（`PUB-002`）。不得在"发布"的名义下顺手改写 Arena/Submission 表（`ARENA-003`、`PROB-003`、`PROB-004`）。
**现状锚点**：`lib/publish-submission.ts`、`lib/promote-problem-draft.ts`、`lib/save-proof-graph.ts`。关联违规：`PUB-001`、`PUB-002`、`ARENA-003`、`PROB-003`、`PROB-004`。

### Search

**职责**：（目标）拥有对题库/知识内容的查询、过滤、排序能力，通过一个服务端接口暴露。
**拥有的数据**：无。
**对外能力**：无——`SEARCH-001` 发现这个能力事实上不存在。
**禁止承担的职责**：不得让每个列表页各自发明一套客户端数组过滤然后自称"搜索"（`components/ProblemExplorer.tsx` 对全量拉取的 `ProblemSummary[]` 做 `.filter()` + `.includes()`；`app/library/page.tsx` 重复同样的模式，且没有中文分词，长尾会静默漏配）。
**现状锚点**：`components/ProblemExplorer.tsx`、`app/library/page.tsx`。关联违规：`SEARCH-001`。

### Storage

**职责**：拥有文件/图片上传（bucket、路径约定、校验规则）背后的单一接口。
**拥有的数据**：`submission-images` Supabase Storage bucket。
**对外能力**：（目标）`uploadSubmissionImage()`。
**禁止承担的职责**：不得被复制粘贴进两个互不知情的表单组件——`components/SubmitForm.tsx:917-950` 与 `components/EditSubmissionForm.tsx:277-304` 独立实现了完全相同的路径拼接 + 上传 + 取公开 URL 序列（`STOR-001`）。
**现状锚点**：`components/SubmitForm.tsx`、`components/EditSubmissionForm.tsx`、`lib/security.ts`（`isPublicSubmissionImageUrl`，与上传路径约定耦合但无共享常量）。关联违规：`STOR-001`。

### Notifications

**职责**：（目标）拥有状态变更（投稿被审核、验证任务完成）向用户的通知分发。
**拥有的数据**：无。
**对外能力**：无——`PLAT-003` 发现完全不存在，仅有 `LeanVerificationWorkspace.tsx` 的客户端轮询作为临时替代。
**禁止承担的职责**：不得在第一次真正需要通知功能时，直接 inline 塞进 `lib/publish-submission.ts` 或 `verification-service.ts` 内部——那会重复 Quota 已经出现过的"三处独立实现"模式（`PLAT-001`）。
**现状锚点**：无。关联违规：`PLAT-003`。

### Jobs

**职责**：（目标）拥有异步/后台任务的执行与 `queued → running → 终态` 生命周期，以及重试的血缘关系。
**拥有的数据**：无——`verification_tasks.status` 的 `queued`/`running` 目前只是**同步 HTTP 请求内**的瞬时状态（`maxDuration = 300`），不是真正的异步任务队列。
**对外能力**：无。
**禁止承担的职责**：不得让状态词汇（`queued`/`running`）暗示一个不存在的异步执行能力（`PLAT-004`）；重试不得产生与原任务无法关联的孤立新行（`PLAT-006`，缺少 `retry_of` 列）。
**现状锚点**：`verification/service/verification-service.ts`、`app/api/admin/verifications/[id]/retry/route.ts`。关联违规：`PLAT-004`、`PLAT-006`。

### Quota

**职责**：拥有限流/冷却/预检策略与执行，无论后端实现是数据库触发器、服务层计数器还是内存 Map，都应共享同一套接口契约。
**拥有的数据**：`submission_rate_limits` 表（投稿）；验证服务内的计数查询；CAS 代理的内存 Map。
**对外能力**：（目标）检查/递增/清除配额的统一接口；`lib/submission-rate-limit-actions.ts` 是"清除"操作现有的（但仅限投稿域）范例。
**禁止承担的职责**：不得被独立实现三次、窗口语义互不相通、清除一处对另外两处毫无影响——投稿（迁移 `022`/`023`，DB 触发器）、验证（`verification/service/verification-service.ts` 内的服务层计数）、CAS（`app/api/cas/route.ts` 的进程内内存 Map，冷启动即失效）三套机制完全独立（`PLAT-001`）。
**现状锚点**：迁移 `022`/`023`、`lib/submission-errors.ts`、`lib/submission-rate-limit-actions.ts`、`verification/domain/policies.ts`、`app/api/cas/route.ts`。关联违规：`PLAT-001`。

### Audit

**职责**：（目标）拥有对每一次特权操作（审核、发布、限流清除、验证重试）的可追加、不可变留痕：谁、对什么、何时、做了什么。
**拥有的数据**：无——`PLAT-002` 发现全仓库没有任何 `audit_log`/`reviewer_id`/`reviewed_at` 之类的痕迹，唯一相关的 `moderator_notes` 字段还会在作者重新提交时被触发器清空。
**对外能力**：无。
**禁止承担的职责**：不得继续用"从可变状态反推历史"这种不可靠的方式替代真正的审计留痕。
**现状锚点**：无。关联违规：`PLAT-002`。

### Observability

**职责**：（目标）拥有统一的结构化日志/错误上报接口，供所有领域调用。
**拥有的数据**：无。
**对外能力**：无——`PLAT-005` 发现至少 7 个文件（`lib/db.ts`、`lib/publish-submission.ts`、`lib/promote-problem-draft.ts`、`lib/save-proof-graph.ts`、`lib/problem-drafts.ts`、`verification/api.ts`、`app/api/cas/route.ts`）各自发明了不同前缀约定的 `console.error`，无法聚合、无法建立告警。
**禁止承担的职责**：不得让每个领域各写各的日志格式。
**现状锚点**：见上。关联违规：`PLAT-005`。

---

## 跨域协作规则（原则 6 的具体化）

### 已经做对的例子

- `lib/contest-registration-actions.ts` 需要鉴权和缓存失效时，调用 `lib/require-moderator.ts` 和 `lib/revalidate-public.ts`，而不是重新实现——这是"通过公开接口交互"的正确范式。
- `components/AdminVerificationsView.tsx`、`components/LeanVerificationWorkspace.tsx`、`components/ContestSprintPanel.tsx` 都不直接访问 Supabase 表，而是通过 `fetch()` 调用 API route，由 API route 背后的领域服务（`verification/`、`app/api/contests/[slug]/sprint/*`）承担业务逻辑——这是"命令"式跨域交互的正确范式，应作为其余大型组件（`AdminContestsView`、`AdminSubmissionsView`、`StudioWorkspace`）重构时的目标形态。
- `verification_tasks.cache_source_id` 是一个自引用 FK，明确记录"这条结果其实复用了哪一条任务的结果"——这是"血缘关系应该是可查询的引用，而不是靠约定推断"的正确范式，`PLAT-006` 建议给 `retry_of` 也建立同样的机制。

### 现状中违反规则的例子（详见 principle-violations.md）

- `verification/repositories/supabase-verification-repository.ts` 为了鉴权直接查询 `problems`/`submissions`/`solutions` 的内部列（`VER-003`）。
- `lib/contest-sprint.ts`（Arena）直接调用 `lib/db.ts`/`lib/problem-drafts.ts`（Problem）的完整读函数，而不是通过一个 Arena 专用的窄化接口（`ARENA-004`）。
- `lib/promote-problem-draft.ts`（Publishing）直接 `UPDATE contest_problems`、`UPDATE submissions`（`ARENA-003`、`PROB-003`）。
- `components/ProofGraphMatrix.tsx`（Proof Intelligence）直接 import 并解构 `Solution` 的内部字段（`SOL-004`）。
- `app/library/[id]/page.tsx`（Knowledge Base 的消费方）绕过 `lib/db.ts`，直接 `import problems from '@/data/problems'`（`KNOW-001`）。

这些案例的共同模式是：某个领域为了图方便，直接读/写另一个领域拥有的表或内部类型，而不是要求对方领域暴露一个窄接口。修复方向统一：由被访问的领域新增一个"只暴露调用方需要的字段"的导出函数，调用方改为依赖这个函数而不是原始表/类型。

## 与现状的差距

完整的、经过逐条核实的违规清单（46 项，含 10 项已对抗性验证的 P0）见 [`principle-violations.md`](./principle-violations.md)。
