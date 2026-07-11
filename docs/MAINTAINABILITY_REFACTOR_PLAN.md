# ProofArena 可维护性治理与渐进式重构方案

> 状态：执行纲领（v2，按六条最高级架构约束修订）
>
> 核心原则：保持现有业务行为，以测试建立安全网，按业务域渐进重构，不进行一次性重写。

## 0. 六条最高级架构约束

本方案的一切目录/依赖方向决策都必须服务于以下六条约束（详细论证见 `docs/architecture/` 下的三份配套文档）：

1. `ProblemVersion → SolutionRevision → ProofIRVersion → VerificationRun → VerificationEvidence` 全链路不可变绑定。
2. Arena 拥有参赛行为和历史快照，Solution 拥有可演化的解答资产。
3. ProofIR 是 Solution、Proof Intelligence 与 Verification 之间的稳定协议。
4. 验证表达运行状态、数学结论、覆盖度、证据等级、假设和局限，不使用单一可信度分数（`VerificationRunStatus` 与 `VerificationConclusion` 必须是两个独立字段；error 不是数学结论）。
5. Platform 是彼此隔离的平台能力集合，不能成为万能目录。
6. 跨领域只通过公开接口、引用、快照、命令和领域事件交互，不共享可变内部对象。

配套文档：

- [`docs/architecture/domain-map.md`](./architecture/domain-map.md) — Core/Supporting/Platform 领域地图，每个领域的职责/拥有数据/对外能力/禁止承担的职责。
- [`docs/architecture/version-lineage.md`](./architecture/version-lineage.md) — 版本血缘链条的目标设计与现状差距。
- [`docs/architecture/verification-semantics.md`](./architecture/verification-semantics.md) — 验证结果的目标字段模型（运行状态/结论/覆盖度/证据等级/假设分离）。
- [`docs/architecture/principle-violations.md`](./architecture/principle-violations.md) — 46 项现状违规的完整审计清单（10 项 P0 已对抗性核实），本方案的阶段划分直接对应这份清单里的条目。

本方案是这四份文档之后的**执行层**：前四份文档回答"目标是什么、现状差多远"，本文档回答"按什么顺序、以什么节奏落地"。

## 1. 背景

ProofArena 已经从静态题库演进为同时包含题目、解法、投稿、审核、比赛、评分、Proof Graph、CAS 和形式化验证的完整应用。当前主要风险已不再是局部代码风格，而是职责、数据和依赖边界失控——`docs/architecture/principle-violations.md` 的审计证实了这一点：46 项违规中，真正阻塞验证可信性和历史不可变性的 P0 有 10 项，其中最密集的一类不是某个大文件，而是**同一条 moderator 判定规则被独立实现了 9 次**（`AUTHZ-001`），说明问题的根源是缺乏领域公开接口，而不是单纯的代码体量。

基线检查发现：

| 文件或区域 | 当前规模或问题 |
| --- | --- |
| `components/AdminContestsView.tsx` | 约 2760 行，26 处直接 `supabase.from()` 调用横跨 8 张表 |
| `components/SubmitForm.tsx` | 约 2240 行 |
| `components/AdminSubmissionsView.tsx` | 约 1763 行，10 处直接 `supabase.from()` 调用横跨 7 张表 |
| `components/ProblemVaultView.tsx` | 约 1405 行 |
| `components/StudioWorkspace.tsx` | 约 1369 行 |
| `components/ProblemDetailExperience.tsx` | 约 1203 行（无直接 DB 调用，是组合/渲染体量问题而非分层问题） |
| `lib/contests.ts` | 999 行，混合行映射、CRUD、锁定检查、评论/评分/脱敏子系统、两套互不相关的评分算法（`ARENA-006`） |
| `lib/types.ts` | 522 行，确认是跨领域耦合中心（Problem/Solution/Arena/Proof Graph/Visualization 全部定义于此，且混入了两个业务逻辑函数） |
| moderator/admin 判定 | 9 处独立实现，其中至少 2 处已产生真实的行为分歧（`AUTHZ-001`/`AUTHZ-002`，P0） |
| Supabase migrations | 两个 `020_*` 迁移 + 核心触发函数 `enforce_contest_submission_window()` 被六次重定义，字典序重放下会静默丢失一处审核修复（`ARENA-005`，P0，本轮审计中风险最具体的一项） |
| 自动化检查 | `npm run lint` 实际仅执行 TypeScript 检查 |
| 自动化测试 | 业务规则测试严重不足 |

主要结构问题：

- React 组件直接了解和读写 Supabase 表。
- 查询、权限、业务规则、状态管理和渲染集中在同一文件。
- 页面和 API route 中存在本应属于领域或应用服务的逻辑。
- 静态 fallback 与数据库数据缺少统一、可验证的契约。
- 比赛、赛题、报名和答题状态容易混用，且 Arena 的参赛字段被直接焊死在 `solutions`/`submissions` 表上（`ARENA-001`）。
- 大文件导致多人或多 Agent 并行开发时频繁冲突。
- `.next/types` 等生成物可能让类型检查受到其他分支残留影响。
- **验证可信性的结构性缺口**：三套"验证"系统（`verification_tasks`、Solution 上的 legacy 编辑式字段、CAS 临时结果）互不相认（`SOL-005`/`VER-005`）；`verification_tasks` 的 `verdict` 字段混合了数学结论和基础设施失败（`VER-002`）；全链路没有任何版本绑定机制（`PROB-001`/`SOL-006`/`VER-001`）。这些是本方案新增的、旧版本文档未覆盖的风险类别，详见 `docs/architecture/verification-semantics.md` 和 `docs/architecture/version-lineage.md`。

形式化验证分支已经使用 `domain / service / repositories / providers / engines` 分层，经本轮审计确认是全仓库分层最干净的模块，可作为其他业务域的参考——但它自身也有 6 项待修复的违规（`VER-001` 至 `VER-006`，详见 `docs/architecture/principle-violations.md`），需要等待该分支稳定后再一并处理，不得现在动它的 schema 或核心服务逻辑。

## 2. 治理目标

治理完成后应满足：

1. UI 不直接承担完整数据库工作流。
2. 核心业务规则不依赖 React、Next.js、Supabase 或浏览器 API。
3. 页面和 API route 只负责参数、授权入口、用例调用和输出。
4. 静态 fallback 与 Supabase 映射到同一领域模型。
5. 投稿、比赛和验证拥有清晰、稳定的扩展点。
6. 新增验证引擎不需要修改大量题目、投稿和后台内部代码。
7. 新增比赛计分策略不需要重写比赛页面。
8. 关键业务行为具有自动化回归保护。
9. 新代码有明确归属，不再自然堆入 `components/` 和 `lib/` 根目录。
10. **（新增）每个 Core/Supporting 领域和每个 Platform 能力只有一个公开接口，跨域调用必须通过它**——这是对 `AUTHZ-001`（9 处重复实现）、`PLAT-001`（限流三套实现）这类问题的直接回应。
11. **（新增）验证结果的运行状态与数学结论在类型和 schema 层面强制分离**，不存在任何单一可信度分数字段。
12. **（新增）ProblemVersion/SolutionRevision/ProofIRVersion 在关键写路径（proof_graph 保存、验证任务创建）具备至少"读时可检测漂移"的能力**，即使完整的版本化 schema 尚未落地。

## 3. 非目标

本轮治理不包含：

- 产品视觉重设计或大范围文案调整。
- 更换 Next.js、Supabase、Tailwind 等核心技术栈。
- 一次性移动整个仓库或全面重写。
- 为追求抽象而引入复杂依赖注入框架。
- 未经确认改变数据库业务语义、权限语义或用户流程。
- 在同一提交中混合架构调整、功能开发和 UI 改版。
- 未经确认合并、删除或重写其他 Agent 的分支。
- 在形式化验证分支稳定前，对 `verification_tasks` schema 或 `verification/` 内部实现做任何改动（`VER-001`/`VER-002` 的字段拆分等设计已经记录在 `verification-semantics.md`，但**执行**必须等待该分支合并）。

## 4. 目标架构

项目逐步从按技术目录堆积，过渡到以业务域和平台能力为主的结构，目录命名直接对应 `domain-map.md` 的 Core/Supporting/Platform 分类：

```text
app/                         # Next.js 路由、参数解析和页面组装

domains/
  solution/                  # Core：可演化的解答资产
    domain/
    application/
    infrastructure/
    components/
    index.ts

  proof-intelligence/        # Core：Proof Graph / 未来 ProofIR
    domain/
    application/
    infrastructure/
    components/
    index.ts

  verification/              # Core：已存在，保留其现有分层，稳定后统一到这个位置
    domain/
    service/
    repositories/
    providers/
    engines/
    api.ts
    index.ts

  arena/                     # Core：比赛参与行为与历史快照
    domain/
    application/
    infrastructure/
    components/
    index.ts

  knowledge-methodology/     # Core：方法论/概念边界模型
    domain/
    application/
    infrastructure/
    components/
    index.ts

  problem/                   # Supporting：题目陈述、元数据、版本
    domain/
    application/
    infrastructure/
    components/
    index.ts

  learning/                  # Supporting：学习路径引导
    domain/
    components/
    index.ts

  knowledge-base/            # Supporting：概念/洞察静态词条
    domain/
    infrastructure/
    index.ts

  submissions/                # 投稿提交流程（第一批迁移目标，见第 6 节 Phase 2）
    domain/
    application/
    infrastructure/
    components/
    index.ts

  submission-review/          # 投稿审核流程（第二批迁移目标，见第 6 节 Phase 3）
    domain/
    application/
    infrastructure/
    components/
    index.ts

capabilities/
  identity/
  authorization/              # 全站唯一的 moderator/admin 判定入口（AUTHZ-001 的修复目标）
  moderation/
  publishing/
  search/
  storage/
  notifications/
  jobs/
  quota/
  audit/
  observability/

shared/
  ui/                         # 无业务含义的 UI 原语（components/ui 已经是雏形）
  kernel/                     # 少量真正跨领域的基础类型/纯工具（math-normalizer 等）

data/                         # 静态内容与 fallback 原始数据
supabase/migrations/          # 数据库真相来源
scripts/
tests/
```

**与旧版本方案的差异说明**：v1 版本使用 `features/` 作为顶层目录名，且领域划分是按当时观察到的技术切片（`problems`/`submissions`/`submission-review`/`contests`/`verification`）。v2 改为 `domains/` + `capabilities/` + `shared/`，并采用 `domain-map.md` 定义的 Core/Supporting/Platform 三分类，原因：
- `submissions`/`submission-review` 本质上是 Solution/Arena/Publishing/Moderation 几个领域和能力交叉出来的一个应用层切片，不是一个独立领域——保留它们作为**迁移执行单元**（见第 6 节 Phase 2/3）是合理的，但不应被误当作最终的领域边界。
- `contests` 更名为 `arena`，`problems` 更名为 `problem`，以对齐 `domain-map.md` 的命名。
- 新增 `capabilities/` 顶层目录，专门收纳此前散落各处、本该是单一能力的代码（Authorization 是其中最紧迫的一项，见第 6 节新增的 Phase 1.5）。

这是一张渐进式目标地图，**不要求第一阶段立即完成全部目录迁移**。只有在某个领域实际重构时，才迁移它对应的代码；且如 `domain-map.md` 反复强调的，目标目录不得先行创建为空壳。

### 4.1 依赖方向

```text
app / components
        ↓
application use cases
        ↓
domain rules and types
        ↑
repository interfaces
        ↑
Supabase / localStorage / static implementations
```

强制约束：

- `domain` 不得依赖 React、Next.js、Supabase、DOM 或 localStorage。
- `application` 组织业务用例，不得包含 JSX。
- `infrastructure` 负责 Supabase、Storage、HTTP、localStorage 和数据映射。
- `components` 不得直接接收或传播数据库 row。
- `app` 不得包含复杂计分、发布、排名或状态推导。
- 其他领域不得深层导入某领域内部文件，应通过公开入口或明确契约调用（原则 6）——`verification/repositories/supabase-verification-repository.ts` 直接查询 `problems`/`submissions`/`solutions` 内部列（`VER-003`）是这条规则在全仓库分层最干净的模块里都会被违反的具体案例，修复时应作为反面教材。
- **（新增）`capabilities/` 下的模块不得反向依赖任何 `domains/` 下的具体领域**——Authorization 只应依赖 Identity 提供的 `role` 读取，不得 import 任何领域的业务类型。这条规则是防止 Platform 能力退化为新的 `lib/utils` 的核心机制（原则 5）。

### 4.2 数据类型分层

```text
Database Row / Static Source
            ↓ mapper
        Domain Model
            ↓ presenter
         View Model
```

- 数据库行类型忠实描述持久化结构。
- 领域类型表达业务语义。
- View Model 只服务具体页面或组件。
- Supabase row 不得直接流入 UI。
- fallback 默认值集中在 mapper，不在多个页面重复拼装。
- **（新增）版本/血缘字段（`problem_version_id`、`solution_revision_id` 等，一旦落地）在 mapper 层就应该被显式建模为独立字段，不得与活动行 id 合并成同一个概念**——避免重蹈 `verification_tasks.problem_id`/`solution_id` 当前指向活动行而非版本的覆辙（`VER-001`）。

## 5. Git 与并行开发约束

执行前必须先进行只读检查：

```bash
git status --short --branch
git worktree list
git branch --all
git log --oneline --decorate -15
```

执行规则：

1. 当前工作区的未提交修改全部视为用户或其他 Agent 的在途工作。
2. 不得覆盖、清理、暂存或提交不属于本任务的修改。
3. 禁止使用 `git reset --hard`。
4. 禁止删除未跟踪文件或用 checkout 恢复用户文件。
5. 不得直接在 `main` 或形式化验证开发分支中进行全站重构。
6. 形式化验证稳定并合并后，应从最新 `main` 创建独立重构分支和 worktree。
7. 若必须提前并行，只处理与验证分支无交集的投稿领域。
8. 每个阶段拆成可独立验证、可独立回滚的小提交。

**当前会话的具体情况**（写入时间：本轮架构审计执行时）：仓库当前检出在 `audit/unified-verification-system` 分支，该分支即追踪 `feat/unified-verification-system`——也就是规则 5 里所说的"形式化验证开发分支"本身。这意味着：

- 本轮只产出只读的架构文档（`docs/architecture/*.md`）和本文档的修订，不修改任何业务代码，在这个分支上执行是安全的。
- **一旦进入第 6 节 Phase 2 的实际代码迁移，不应继续在 `audit/unified-verification-system` 分支上提交**，即使 Phase 2 的范围（投稿提交）本身与验证分支代码无直接冲突——原因是把领域重构提交和验证功能提交混在同一分支历史里，会让未来 review 和潜在回滚都更困难。正确做法是等验证分支合并回 `main` 后，从最新 `main` 切一个新分支；如果业务上不能等待，需要用户显式确认是否接受"提前从当前 `main`（尚不含验证分支）切一个并行重构分支"这一方案，因为这意味着重构分支和验证分支会各自独立推进，后续需要一次额外的合并协调。

验证分支稳定前，第一批重构避免修改：

- `components/ProblemDetailExperience.tsx`
- `components/AdminPanel.tsx`
- 验证页面和 API routes
- 验证相关 migration
- `verification/` 内正在开发的实现
- 与验证功能相关的 README、环境变量和运行脚本

**新增限制**：`AUTHZ-001`/`VER-006` 的修复涉及 `verification/api.ts` 和 `verification/repositories/supabase-verification-repository.ts`——这两个文件属于上面列出的"验证相关正在开发的实现"。因此 Authorization 收敛（见 Phase 1.5）在验证分支稳定前，**只能覆盖 `verification/` 之外的 7 处重复实现**（5 个 `app/admin/*/page.tsx` + `components/AuthButton.tsx` + `lib/proof-graph-admin-auth.ts`），`verification/` 内的 2 处（`VER-006`）留到验证分支合并后再处理。

## 6. 分阶段执行计划

## Phase 0：行为基线与边界确认

### 目标

在移动代码前，明确不能破坏的业务行为、领域边界和冲突区域。

### 关键流程清单

投稿领域：

- 新题投稿、普通解法投稿、比赛解法投稿。
- 本地草稿保存、恢复、切换和清除。
- 图片上传、失败恢复和附件顺序。
- cooldown、rate limit 和 precheck。
- 管理员审核、拒绝和发布。

比赛领域：

- 比赛列表、详情、报名和访问控制。
- 赛题安排、解锁和提交窗口。
- 冲刺答案归一化、自动评分和人工复核。
- 排名、奖项和赛后展示。

验证领域：

- 创建任务、查询状态、缓存、幂等和重试。
- CAS、Lean、AXLE provider。
- 验证失败、系统错误、超时和不可验证状态。
- 管理员任务和健康检查。

### 交付与验收

- 建立行为清单、领域边界和高冲突文件清单。✅ 已通过本轮 `docs/architecture/` 三份文档 + `principle-violations.md` 完成，比原计划更完整（覆盖全部 19 个领域/能力，而不只是投稿/比赛/验证三个）。
- 记录重构前的验证命令和结果。
- 不修改任何业务行为。

**本阶段状态：已完成（本轮审计即 Phase 0 的交付物）。**

## Phase 1：检查与测试安全网

### 目标

让后续重构得到稳定、可信的反馈。

### 工作内容

- 将 TypeScript、ESLint、测试和构建检查分离。
- 沿用形式化验证分支最终采用的测试方案，避免引入第二套框架。
- 解决类型检查受到过期 `.next/types` 或其他 worktree 生成物影响的问题。
- 建立适合本地和 CI 的统一验证入口。

第一批纯规则测试：

- `getEffectiveProblemStatus`
- 比赛访问控制
- 冲刺答案归一化和计分
- submission scope key
- cooldown 计算
- score normalization
- 投稿内容/Markdown 构建
- 投稿发布 mapper
- 验证状态策略
- **（新增）`scripts/validate-knowledge-refs.mjs`**：`KNOW-006` 发现的跨实体字符串引用（`conceptId`/`problemId`/`knowledgeIds`/`insightIds`）目前完全无校验，静默失配。这是一个不依赖任何领域重构、可以独立立即执行的测试安全网条目，建议作为 Phase 1 的第一个具体产出。

数据契约测试：

```text
Supabase row → mapper → domain object
Static data  → mapper → domain object
```

### 验收

- 类型检查只反映当前源码。
- 测试能够独立、稳定运行。
- 构建检查能够在干净环境复现。
- 核心状态、计分和映射规则具有回归测试。
- 用户可见行为不变。

## Phase 1.5：Authorization 收敛（新增阶段，P0，建议最先执行的代码改动）

### 目标

`docs/architecture/principle-violations.md` 的 `AUTHZ-001` 是本轮审计中优先级最高、改动面最小、回报最确定的一项：同一条 moderator/admin 判定规则被独立实现了 9 处，其中至少 2 处已经产生真实的行为分歧（`AUTHZ-002`：owner 账号可能被 `/admin` 拒之门外却仍能执行特权 server action）。这不需要等待投稿领域的迁移设计完成，可以作为一个独立、极窄的纵向切片单独执行。

### 范围（受 5 节新增限制约束，验证分支稳定前只做这 7 处）

- `app/admin/page.tsx`、`app/admin/submissions/page.tsx`、`app/admin/contests/page.tsx`、`app/admin/problem-vault/page.tsx`、`app/admin/problem-vault/new/page.tsx`：删除各自的内联 `canAccessAdmin`/`canReviewSubmissions`/`canManageContests` 函数，改为调用共享判定。
- `components/AuthButton.tsx`：同上。
- `lib/proof-graph-admin-auth.ts`：`requireProofGraphEditor` 改为内部组合调用 `lib/require-moderator.ts` 的 `requireModerator`，不再重复邮箱旁路 + 角色检查逻辑。

**暂不处理**（等待验证分支合并）：`verification/api.ts` 的 `isVerificationAdmin`、`verification/repositories/supabase-verification-repository.ts` 的 `isPrivileged`（`VER-006`）。

### 必须保持

- 邮箱旁路（硬编码 owner 邮箱）的行为在所有 7 个调用点变得一致，且与 RLS 策略、`lib/require-moderator.ts` 已有行为对齐——不是"通过重构顺便改变权限语义"，而是"消除已经存在的不一致"。
- 每个调用点的替换是独立提交，可单独回滚。

### 验收

- 全仓库对"是否是 moderator/admin"这条规则只有一处定义。
- `AUTHZ-002` 描述的行为分歧消失。
- 类型检查和构建通过。

## Phase 2：投稿领域与 `SubmitForm`

### 目标

把投稿逻辑从大型 React 组件中分离，形成第一个可复制的标准领域样板。这是第一批实际结构迁移的主体，精确到文件级别的计划见配套文档 [`docs/architecture/submissions-vertical-slice.md`](./architecture/submissions-vertical-slice.md)（与本方案同批产出）。

### 建议结构

```text
domains/submissions/
  domain/
    types.ts
    draft-rules.ts
    submission-scope.ts
    submission-validation.ts
    content-builders.ts

  application/
    create-problem-submission.ts
    create-solution-submission.ts
    create-contest-submission.ts
    check-submission-limit.ts
    save-submission-draft.ts
    load-submission-draft.ts

  infrastructure/
    submission-repository.ts
    supabase-submission-repository.ts
    draft-store.ts
    local-storage-draft-store.ts
    attachment-storage.ts
    supabase-attachment-storage.ts
    mappers.ts

  components/
    SubmitForm.tsx
    SubmitModeSelector.tsx
    ProblemSubmissionForm.tsx
    SolutionSubmissionForm.tsx
    ContestSubmissionForm.tsx
    SubmissionDraftNotice.tsx
    SubmissionCooldownNotice.tsx
    SubmissionImageUpload.tsx
```

图片上传部分应实现为 `capabilities/storage/` 的第一个消费方（对应 `STOR-001`：当前 `SubmitForm.tsx` 和 `EditSubmissionForm.tsx` 各自重复实现同一段上传逻辑），而不是继续留在 `domains/submissions/infrastructure/` 内部——上传路径约定本身属于 Storage 这个平台能力，不属于投稿领域。

### 提取顺序

1. 提取不依赖 React 的纯函数。
2. 为纯函数补充行为测试。
3. 提取草稿存储接口与 localStorage 实现。
4. 提取附件上传接口（同时建立 `capabilities/storage/uploadSubmissionImage()`，见上）。
5. 提取 Supabase 投稿 repository 和 mapper。
6. 建立三种投稿 application use case。
7. 最后拆分 UI。
8. 必要时保留旧入口 re-export，避免一次修改全部调用方。

### 必须保持

- localStorage key 和旧草稿兼容。
- 图片上传顺序、限制和错误行为不变。
- cooldown、precheck 和 rate limit 语义不变。
- 比赛投稿窗口和访问规则不变。
- Supabase 写入字段和 revalidation 行为不变。
- 登录要求和错误提示语义不变。

### 验收

- 投稿纯规则不依赖 React 或 Supabase。
- UI 不再直接拼装完整数据库 payload。
- 三种投稿拥有明确用例。
- 主入口组件主要负责模式选择和组合。
- 关键流程测试、类型检查和构建通过。
- 用户可见行为无变化。

## Phase 3：管理员投稿审核

### 目标

分离列表、筛选、评分、审核、发布、限流管理和预览。同时修复 `AUTHZ-003`（审核状态变更绕开应用层授权，与相邻的发布步骤授权强度不一致）。

### 建议结构

```text
domains/submission-review/
  domain/
    types.ts
    review-status.ts
    review-decision.ts
    score-normalization.ts

  application/
    list-review-submissions.ts
    load-review-context.ts
    approve-submission.ts
    reject-submission.ts
    publish-problem-submission.ts
    publish-solution-submission.ts
    update-submission-limit.ts

  infrastructure/
    review-repository.ts
    supabase-review-repository.ts
    review-mappers.ts

  components/
    AdminSubmissionsView.tsx
    ReviewFilters.tsx
    ReviewQueue.tsx
    ReviewCard.tsx
    ReviewDecisionForm.tsx
    ReviewPreviews.tsx
    GraphDraftSection.tsx
```

审核和发布必须成为两个不同用例，且发布用例应下沉到 `capabilities/publishing/`（对应 `PUB-001`：当前 `lib/publish-submission.ts`、`lib/promote-problem-draft.ts`、`lib/save-proof-graph.ts` 是三个独立写 `problems`/`solutions` 表的写手，字段覆盖已经漂移）：

```text
Review Decision  (domains/submission-review)
      ↓
Approved Submission
      ↓
Publish Problem / Publish Solution  (capabilities/publishing，统一的行 shape 构造)
```

### 验收

- 审核 UI 不再控制完整发布事务。
- 题目发布与解法发布的 mapper 独立并有测试，且与 `lib/promote-problem-draft.ts` 共用同一个字段构造函数（消除 `PUB-001` 的字段覆盖漂移）。
- 审核状态转换明确、可测试，且状态变更走应用层授权（消除 `AUTHZ-003`）。
- Graph Draft 和预览组件可独立维护。
- 权限、过滤、revalidation 和现有发布结果保持不变。

## Phase 4：形式化验证合并与统一

### 前提

等待形式化验证功能及 audit 修复确定最终版本，再从最终合并结果继续。不得另建一套重复模型。

### 目标

让 CAS、Lean 和 AXLE 通过统一验证任务和 provider 契约工作：

```text
VerificationProvider
├── CASProvider
├── LeanProvider
└── AXLEProvider
```

同时处理 `docs/architecture/principle-violations.md` 记录的 6 项验证域自身违规（`VER-001` 至 `VER-006`），具体字段模型见 `docs/architecture/verification-semantics.md`，版本绑定设计见 `docs/architecture/version-lineage.md`。

### 原则

- 保留验证分支已有的 domain/service/repository/provider/engine 分层——本轮审计确认这是全仓库分层最干净的模块，应作为其他领域重构的参照范式，而不是被推倒重来。
- 页面只调用验证应用服务，不直接调用 provider。
- 任务持久化失败与 provider 执行失败必须区分。
- 超时、不可验证、结论失败和系统错误必须具有不同语义——**具体实现为 `run_status`/`conclusion` 两个独立字段**（见 `verification-semantics.md` 的映射表），而不是继续让 `verdict` 一个字段承担两种语义（`VER-002`）。
- CAS 通过 adapter 渐进接入，不要求立即重写现有 Python 服务；长期方向是让 CAS 结果也写入 `verification_tasks`（schema 已预留 `engine='cas'`），消除 `VER-005` 描述的三套验证系统互不相认的问题。
- `verification/repositories/supabase-verification-repository.ts` 的鉴权逻辑改为调用 Problem/Solution/Submission 域导出的窄接口，而不是直接查询三张表的内部列（`VER-003`）——这条本身不需要等 CAS/Lean 整合完成，可以作为验证分支稳定后最先执行的一条。
- 题目、解法、投稿审核通过稳定 View Model 消费验证结果。
- 新增 `verification_tasks.retry_of` 列记录重试血缘（`PLAT-006`）——这是本清单里改动最小的一条 schema 变更，可以和其他验证域修复一起、作为验证分支稳定后的第一个 migration。

### 验收

- 不同验证引擎共享统一任务生命周期。
- 新增 provider 不要求修改既有 provider。
- 管理后台能够统一查询、诊断和重试任务，且重试与原任务的血缘关系可查询。
- 验证故障不会破坏题目或解法主流程。
- 验证分支已有测试继续通过。
- `run_status`/`conclusion` 分离落地，UI 不再用同一视觉语言渲染基础设施失败和数学结论为假。
- Solution 上的 legacy 编辑式验证字段（`SOL-001`/`SOL-005`）已重命名为明确的"作者断言"，不再与机器核验共用"verified"字样。

## Phase 5：比赛领域

### 目标

拆分比赛核心、报名、访问、调度、冲刺、投稿、计分、榜单和奖项。同时修复 `docs/architecture/principle-violations.md` 记录的 6 项 Arena 违规（`ARENA-001` 至 `ARENA-006`）。

### 子域

```text
domains/arena/
  core/
  registration/
  access/
  scheduling/
  sprint/
  submissions/
  scoring/
  leaderboard/
  awards/
  admin/
```

必须区分不同生命周期：

```text
Contest:       draft → active → judging → finished
ContestProblem: locked → open → reviewing → closed
Registration:  pending → accepted / rejected
SprintAttempt: not_started → active → submitted → reviewed
```

优先提取并测试：

- `getEffectiveProblemStatus`
- `canRegisterForContest`
- `canAccessContest`
- `canUnlockSprintProblem`
- `normalizeSprintAnswer`
- `scoreSprintAttempt`
- `calculateContestScore`
- `calculateLeaderboard`
- `matchAwardToParticipant`

`lib/contests.ts` 应按查询、统计、思路、排名、计分板和 mapper 拆分（对应 `ARENA-006`：当前混合了 DB 行映射、CRUD、锁定检查、~160 行的 thoughts/redaction 子系统、以及两套命名相近但语义完全不同的评分算法）；`AdminContestsView` 应拆为设置、赛程、赛题、报名、评分、奖项和危险操作面板。

同时应处理：

- `ARENA-001`：把 `solutions.contest_id`/`contest_solution_type` 等字段迁移到 Arena 拥有的独立参赛记录表，`Solution` 核心类型不再内嵌这些字段。
- `ARENA-002`：`lib/contests.ts` 的排行榜函数改为调用 Solution 域导出的评分摘要接口，不再直接查询 `solutions`/`solution_ratings`。
- `ARENA-003`：`lib/promote-problem-draft.ts` 对 `contest_problems` 的直接写入改为调用 Arena 拥有的 `relinkContestProblemToPublishedProblem()`。
- `ARENA-005`：在对两个 `020_*` 迁移做任何重命名/合并动作前，**必须先确认生产环境的真实部署历史**（哪个先执行的）——这是本方案中唯一要求"先侦查、后动手"的一项，不得跳过直接假设某种顺序。

### 验收

- 前后台共享同一套状态和计分规则。
- 计分与排名可以脱离数据库和 UI 测试。
- 页面不再拼装复杂 Supabase 查询。
- 修改奖项不会影响报名与赛题调度。
- 修改 sprint 规则不会影响普通比赛投稿。
- Solution 核心类型不再携带任何 Arena 专属字段。

## Phase 6：类型与数据契约

### 目标

渐进拆分 `lib/types.ts`，消除全局耦合。按 `domain-map.md` 的领域划分，而不是按 v1 版本的技术切片：

```text
domains/problem/domain/types.ts
domains/solution/domain/types.ts
domains/arena/domain/types.ts
domains/proof-intelligence/domain/types.ts
domains/verification/domain/types.ts   （已存在，位置不变）
domains/knowledge-methodology/domain/types.ts
domains/knowledge-base/domain/types.ts
shared/kernel/types.ts                  （真正跨领域的基础类型，如 GraphColor/SliderParam 这类可视化专用类型应重新评估是否该留在共享层）
```

执行规则：

- 禁止一次性移动所有类型。
- 按正在重构的领域迁移。
- 旧入口暂时 re-export，再逐步迁移调用方。
- 对静态题库、比赛数据、provider 响应和复杂 JSON 字段增加适当运行时校验。
- 不得创建重复、含义相近但无法转换的第二套领域类型。
- **（新增）`Problem.solutions: Solution[]` 这类内嵌完整可变领域对象的字段（`PROB-002`）拆分时优先处理**——`ProblemSummary`/`SolutionSummary` 已经展示了引用式的正确模式，`Problem` 应该向这个模式收敛，而不是继续内嵌完整 `Solution[]`。
- **（新增）`PedagogicalAnnotations` 这类可以无差别挂到 `Problem`/`Solution`/`KnowledgeNode` 任意实体的"万能标注口袋"（`KNOW-005`）在拆分时需要重新审视是否每个字段都该保留在每个实体上**，不能简单地把现有的合并逻辑原样搬到新目录。

### 验收

- `lib/types.ts` 明显缩小。
- 数据库字段变化主要影响 mapper/repository。
- 静态数据错误能在测试或构建阶段发现。
- 每个领域拥有清晰的公开类型入口。

## Phase 7：数据库迁移与权限治理

### 目标

让数据库 schema、migration 和 RLS 可重复、可审计。

### 工作内容

- 调查两个 `020_*` migration 的真实部署历史（即 `ARENA-005`，已在 Phase 5 中列为前置条件，此处不重复展开，只强调这是跨 Phase 共享的同一个待办）。
- 未确认生产执行历史前不得直接重命名旧 migration。
- 已部署时使用新的修复 migration；未部署时才考虑统一编号。
- 建立 migration 顺序和关键 schema 验证。
- 验证所有新增业务表的 RLS。
- 区分数据库安全边界、应用业务授权和 UI 展示限制。
- **（新增）审计能力从零建立**（`PLAT-002`）：新增 append-only `audit_log` 表，由发布、限流清除、验证重试等特权操作入口写入。这是本方案中唯一一项"没有现存代码可重构、纯粹是从零设计"的条目，建议在本 Phase 而不是更早阶段处理，因为它依赖 Authorization（Phase 1.5）和 Publishing（Phase 3）的接口先稳定下来，才能确定审计日志该挂在哪些调用点上。

```text
RLS / Database    强制安全边界
Application       业务授权和错误语义
UI                隐藏、禁用和提示
```

### 必测权限

- 普通用户不能执行管理员写操作。
- 用户不能修改他人投稿。
- 未报名用户不能绕过比赛访问限制。
- 比赛关闭后不能通过 API 绕过 UI 提交。
- 无权限用户不能重试验证任务。
- service role 只能在服务端使用。

### 验收

- migration 顺序明确，新环境可以可靠重建 schema。
- RLS 检查可以自动执行。
- UI 隐藏不再被当作安全措施。
- 验证系统表纳入统一权限审计。
- 特权操作具备可查询的审计留痕。

## Phase 8：共享 UI 与兼容层清理

此阶段必须在业务边界稳定之后执行。

### 工作内容

- 收敛真正重复的 Button、Panel、Badge 和 FormField。
- 删除已无调用的旧 helper 和临时兼容 re-export（含 `lib/supabase.ts` 死代码，`AUTHZ-005`）。
- 清理新旧双入口和死代码。
- 更新架构文档、维护规范和贡献指南。
- 统一散落各处的 `console.error` 为共享 Observability 接口（`PLAT-005`）。

### 禁止事项

- 不因两处 className 相似就制造抽象。
- 不把业务不同的表单强制合并。
- 不创建大量一行转发 wrapper。
- 不为目录整齐破坏领域内聚。

## 7. 提交策略

每个提交只承担一种变化。例如：

```text
test(submissions): cover draft and submission scope rules
refactor(submissions): extract pure domain rules
refactor(submissions): introduce draft store
refactor(submissions): introduce submission repository
refactor(submissions): extract submission use cases
refactor(submissions): split submission form views
refactor(authorization): consolidate moderator predicate into lib/require-moderator.ts
test(review): cover publish mappings
refactor(review): isolate review and publish workflows
```

禁止提交：

```text
refactor entire project architecture
cleanup components and fix contest bugs
move folders and redesign forms
```

每个阶段交付报告应包含：

- 改动范围和文件。
- 架构决策（本轮新增：应明确指出该决策对应 `principle-violations.md` 的哪个/哪些 ID）。
- 明确保留的行为。
- 新增或调整的测试。
- 类型、测试和构建结果。
- 工作区冲突（未提交的用户/其他 Agent 改动，是否与本次改动范围重叠）。
- 临时兼容层。
- 已知风险和下一阶段建议。

## 8. Definition of Done

单个重构任务只有同时满足以下条件才算完成：

- 用户可见行为未改变，除非任务明确授权。
- 提取出的纯业务逻辑具有相应测试。
- 没有覆盖或提交用户及其他 Agent 的在途修改。
- 没有混入无关格式化、文案或视觉调整。
- TypeScript、测试和相关构建检查通过。
- 新模块依赖方向符合本方案（含 4.1 节新增的 `capabilities/` 不得反向依赖 `domains/` 约束）。
- 没有新增 UI 对数据库结构的直接耦合。
- 旧入口兼容性经过处理。
- diff 能够在合理时间内由人类审查。
- **（新增）如果该任务对应 `principle-violations.md` 中的某个 ID，该文档中对应条目应更新为已修复状态。**

## 9. 预期效果

完成 Phase 0～1.5 后：

- 领域地图和违规清单固化为团队共享的架构语言。
- 全站只有一处 moderator/admin 判定规则，`AUTHZ-002` 描述的行为分歧消失。

完成 Phase 1～3 后：

- 投稿成为第一个标准领域样板。
- 投稿草稿、附件、提交、审核和发布可以独立维护与测试。
- 投稿需求涉及的文件范围明显下降。
- 大文件分支冲突显著减少。
- 投稿相关开发和回归成本预计下降约 30%～50%。
- `problems` 表不再有三个互不知情的独立写手（`PUB-001` 消除）。

完成 Phase 4～5 后：

- CAS、Lean、AXLE 具有统一扩展接口。
- 新增验证引擎不再侵入题目详情核心组件。
- 验证结果的运行状态与数学结论在字段层面强制分离，UI 不再可能把基础设施失败渲染成"证明有误"。
- 比赛状态、计分和排名规则可以独立验证。
- 前后台规则不一致问题显著减少。
- `Solution` 核心类型不再携带任何 Arena 参赛字段。

全部完成后的目标指标：

- 超过 1000 行的业务组件降至 0。
- 业务入口组件原则上控制在约 200～400 行，例外需要说明理由。
- UI 中直接 Supabase 表操作减少 80% 以上。
- 页面和 route handler 不再包含复杂业务规则。
- 核心业务规则拥有稳定回归测试。
- 静态数据和数据库数据拥有统一契约。
- migration 和 RLS 可以自动验证。
- 新开发者能够按业务域快速定位代码。
- `docs/architecture/principle-violations.md` 中的 P0 项全部清零，P1 项大部分清零。

## 10. 推荐执行顺序

| 顺序 | 阶段 | 收益 | 与验证分支冲突风险 |
| --- | --- | --- | --- |
| 1 | Phase 0：行为与边界基线 | 高 | 低 | 已完成 |
| 2 | Phase 1：检查与测试安全网 | 极高 | 中 |
| 3 | Phase 1.5：Authorization 收敛 | 极高（P0，改动最小） | 低（验证分支内的 2 处需等待） |
| 4 | Phase 2：投稿领域 | 极高 | 低 |
| 5 | Phase 3：管理员投稿审核 | 高 | 低 |
| 6 | Phase 4：验证统一 | 高 | 中（需等待验证分支合并） |
| 7 | Phase 5：比赛领域 | 极高 | 高 |
| 8 | Phase 6：类型与数据契约 | 高 | 中 |
| 9 | Phase 7：数据库与权限 | 高 | 中 |
| 10 | Phase 8：共享 UI 与清理 | 中 | 低 |

不要一次执行全部阶段。**本轮（第一轮）只完成 Phase 0（已完成，即本次架构审计）、并产出 Phase 2 的精确文件级计划（见 `docs/architecture/submissions-vertical-slice.md`）**；Phase 1、1.5、2 的实际代码改动需要用户确认后，在新分支上按阶段验收后再继续执行。
