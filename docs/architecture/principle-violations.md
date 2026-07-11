# 六条原则违规审计清单

> 状态：只读审计产物，第一阶段交付。共 46 项，10 项 P0 / 19 项 P1 / 17 项 P2。
>
> **方法论**：本清单由多路并行的代码调研 agent 产出候选项，每一项都要求调研 agent 亲自读取所引用的文件行以后才能提交（不允许仅凭猜测）。全部 10 项 P0 随后经过独立的对抗性核实（另一个 agent 尝试推翻结论，逐行重新核对文件内容）——10 项全部 **CONFIRMED**，其中 1 项（`AUTHZ-002`）在核实中发现原始描述略微夸大了受影响范围，已在下面标注修正后的证据。P1/P2 未经过独立对抗性核实，但同样要求了具体的 file:line 证据。
>
> 本清单只记录违规和目标状态，不在本轮执行任何修复。

## 优先级定义

- **P0**：验证可信性、历史不可变性、版本绑定、权限风险。
- **P1**：领域所有权、跨领域调用、数据库耦合风险。
- **P2**：大文件、全局类型、目录结构、重复实现。

## 索引

| ID | 优先级 | 一句话 |
| --- | --- | --- |
| [SOL-001](#sol-001) | P0 | Solution.verification 用同一个字段表达"运行状态"和"编辑式断言" |
| [SOL-002](#sol-002) | P0 | proof_graph 无版本、整体覆盖式写入 |
| [SOL-005](#sol-005) | P0 | 两套互不相认的验证系统同时挂在 Solution 上 |
| [VER-001](#ver-001) | P0 | verification_tasks 的 FK 指向活动行而非版本 |
| [VER-002](#ver-002) | P0 | verdict 混合数学结论与基础设施失败 |
| [VER-003](#ver-003) | P0 | verification 仓储直接查询其他领域内部表 |
| [ARENA-005](#arena-005) | P0 | 同名 020 迁移 + 核心触发函数被六次重定义 |
| [PROB-001](#prob-001) | P0 | problems 表无版本概念 |
| [AUTHZ-001](#authz-001) | P0 | moderator 判定规则被独立实现 9 次 |
| [AUTHZ-002](#authz-002) | P0 | 上一条导致同一账号出现矛盾的授权结果 |
| [SOL-003](#sol-003) | P1 | forkOf 血缘指针无 FK 约束 |
| [SOL-004](#sol-004) | P1 | Proof Intelligence 直接读写 Solution/Problem 内部 |
| [SOL-006](#sol-006) | P1 | 不存在 SolutionRevision 概念 |
| [VER-004](#ver-004) | P1 | 不存在 ProofIR，验证引擎直接透传原始文本 |
| [VER-005](#ver-005) | P1 | 三套验证系统互不整合 |
| [ARENA-001](#arena-001) | P1 | Solution 表被焊死参赛字段 |
| [ARENA-002](#arena-002) | P1 | Arena 直接查询 Solution/评分表 |
| [ARENA-003](#arena-003) | P1 | Publishing 动作直接改写 Arena 表 |
| [KNOW-001](#know-001) | P1 | Library 页面绕过 lib/db.ts 直接读静态数据 |
| [KNOW-002](#know-002) | P1 | Knowledge Base 无统一读接口，5+ 处直接跨域 import |
| [PROB-002](#prob-002) | P1 | Problem 类型内嵌完整可变 Solution[] |
| [PROB-003](#prob-003) | P1 | Problem 域代码直接读写 Arena/Submission 表 |
| [PROB-004](#prob-004) | P1 | Proof Intelligence 绕过 Problem 域直接写 problems 表 |
| [AUTHZ-003](#authz-003) | P1 | 审核状态变更绕开应用层授权 |
| [AUTHZ-004](#authz-004) | P1 | proof-graph-admin-auth 重复实现 require-moderator |
| [PUB-001](#pub-001) | P1 | 三个独立写手写同一张 problems 表，字段覆盖已漂移 |
| [PLAT-001](#plat-001) | P1 | 限流/配额三套独立实现 |
| [PLAT-002](#plat-002) | P1 | 审计能力完全不存在 |
| [PLAT-006](#plat-006) | P1 | 验证重试无血缘记录 |
| [SOL-007](#sol-007) | P2 | proof-graph-admin-auth 重复 require-moderator（同 AUTHZ-004 的次要案例） |
| [VER-006](#ver-006) | P2 | verification 内部重复实现 admin 判定 |
| [ARENA-004](#arena-004) | P2 | contest-sprint 直接读 Problem 完整对象 |
| [ARENA-006](#arena-006) | P2 | lib/contests.ts 999 行、四类职责混合 |
| [KNOW-003](#know-003) | P2 | WhyNotMethod 与 ProofMethodBoundary 重复建模 |
| [KNOW-004](#know-004) | P2 | data/problems.ts 构造期烘焙 Knowledge 增强数据 |
| [KNOW-005](#know-005) | P2 | PedagogicalAnnotations 成为万能标注口袋 |
| [KNOW-006](#know-006) | P2 | 跨实体字符串引用无校验、静默失配 |
| [PROB-005](#prob-005) | P2 | Problem 内嵌读取暴露 legacy 验证状态 |
| [AUTHZ-005](#authz-005) | P2 | lib/supabase.ts 死代码、第三套匿名客户端 |
| [AUTHZ-006](#authz-006) | P2 | lib/security.ts 命名与内容不符 |
| [PUB-002](#pub-002) | P2 | Publishing 硬编码 Solution/Problem 默认值 |
| [STOR-001](#stor-001) | P2 | 图片上传逻辑复制粘贴两份 |
| [SEARCH-001](#search-001) | P2 | 搜索能力事实上不存在 |
| [PLAT-003](#plat-003) | P2 | 通知能力完全不存在 |
| [PLAT-004](#plat-004) | P2 | Jobs 能力完全不存在，状态词汇名不副实 |
| [PLAT-005](#plat-005) | P2 | 观测性：7+ 处各自的 console.error 约定 |

---

## P0

### SOL-001

**当前实现**：`lib/types.ts:17` `VerificationStatus = "verified" | "partial" | "manual"`，被 `Solution.verification`（`lib/types.ts:170-178`）和 Proof Graph 的 `ProofVerificationStep.status`（`lib/types.ts:445`）共用。`lib/publish-submission.ts:297-305` 在投稿未提供结构化 `verification` 字段时，自动填充 `{status: 'manual', ...}`——且经核实，标准投稿路径（`SubmitForm.tsx`）从不填充这个结构化字段，意味着 `'manual'` 是几乎所有已发布解答的实际取值，不是边缘情况。
**违反的原则**：原则 4（运行状态与数学结论必须分离，此处一个编辑式默认值和真正的机器核验共用同一个 `status` 字段）；原则 3（ProofIR 应是稳定协议，此处同一个临时枚举同时渗入 Solution 和 Proof Graph）。
**风险**：一个解答/证明图节点可以仅仅因为审核员在表单里没填字段，就在 UI 上显示为语义上等同于"verified"的默认状态，与真正跑过 `verification_tasks` 流水线得出的结果在类型系统里无法区分。
**目标状态**：见 [`verification-semantics.md`](./verification-semantics.md) 的目标字段模型——`Solution.verification` 重命名为明确标注"编辑式断言"的字段，真正的验证结论只能来自 `verification_tasks` 派生的只读视图。
**建议动作**：先在类型层面把 `VerificationStatus`/`Verification` 重命名为 `EditorialClaim` 一类的名字并更新 `publish-submission.ts` 的默认值文案，明确它不是机器核验；再逐步引导 UI 从 `verification_tasks` 读取真正的结论。
**前置条件**：依赖 `verification-semantics.md` 的 run_status/conclusion 目标模型完成设计评审；类型重命名本身不需要数据库变更，可独立先行。
**冲突文件**：`lib/types.ts`、`lib/publish-submission.ts`、`components/VerificationPanel.tsx`。
**优先级**：P0

### SOL-002

**当前实现**：`lib/save-proof-graph.ts:53-58` 对 `problems.proof_graph` 执行无条件 `UPDATE`，不读旧值、不留痕、无版本号。`011_proof_graph_mvp.sql:16` 的 `proof_graph JSONB` 列没有配套历史表。`ProofObservation.relatedSolutionIds`/`ProofStrategyBranch.solutionIds`/`ProofTransformation.solutionId`/`ProofChallengeEdge.*SolutionId`（`lib/types.ts:412-467`）都是裸字符串，无 FK、无写入时存在性校验——而同一个 schema 在别处（如 `004_contest_arena_mvp.sql:79`）已经证明团队知道如何给 `solution_id` 加真正的 FK。
**违反的原则**：原则 1（ProofIRVersion 环节完全不可变绑定的要求）；原则 3（ProofIR 应是稳定协议，而不是可被覆盖的手工文档）。
**风险**：证明图可以静默指向已变化、已删除甚至从未存在过的解答 id，且无法重建某一时刻证明图的真实样貌。
**目标状态**：见 [`version-lineage.md`](./version-lineage.md) 节点三——`proof_graph` 写入变为 append 新版本而非覆盖，内部的 solutionId 引用在写入时做存在性校验。
**建议动作**：短期先加写入时存在性校验（应用层即可，不需要 FK）；中期引入版本历史表。
**前置条件**：版本历史表依赖 `version-lineage.md` 的独立设计评审；写入时存在性校验不需要 schema 变更，可独立先行。
**冲突文件**：`lib/save-proof-graph.ts`、`supabase/migrations/011_proof_graph_mvp.sql`、`lib/types.ts`。
**优先级**：P0

### SOL-005

**当前实现**：`components/VerificationPanel.tsx:53-58` 渲染 `Solution.verification`（legacy 静态字段），由 `ProblemDetailExperience.tsx:297` 传入；同一页面 `ProblemDetailExperience.tsx:988` 渲染 `LeanVerificationWorkspace`，只接受 `problemId`，使用 `verification_tasks` 派生的 `VerificationTaskDto`，从不引用 `solutionId`。`lib/db.ts`、`VerificationPanel.tsx`、`SolutionCard.tsx` 全文 grep 确认零处引用 `verification_tasks`/`VerificationTask`——两套系统在代码层面完全不连通。
**违反的原则**：原则 3（Verification 与 Solution/Proof Intelligence 之间应有单一稳定协议，此处是两个互不相认的协议）；原则 4（legacy 字段的单一 `status` 无法表达运行/结论分离）。
**风险**：用户可能同时看到一个来自人工断言的"verified"徽章和一个完全独立、可能结论相反的机器核验结果，且两者视觉上无法区分权重。
**目标状态**：Solution 页面最多展示一种"验证状态"表面，或明确、结构性地区分编辑式断言与机器核验证据等级（见 verification-semantics.md）。
**建议动作**：退役 legacy 静态徽章，或将其重新标注为"作者断言"，不与 `verification_tasks` 共用"verified"字样。
**前置条件**：依赖 SOL-001 的重命名完成；产品需先决定是否需要保留编辑式断言这一 UI 元素。
**冲突文件**：`components/VerificationPanel.tsx`、`components/LeanVerificationWorkspace.tsx`、`lib/types.ts`。
**优先级**：P0

### VER-001

**当前实现**：`024_unified_verification_system.sql:5-7` 的 `problem_id`/`solution_id`/`submission_id` 是指向活动行的可空 FK（`ON DELETE SET NULL`）。`019_submission_author_revision.sql:40-88` 的修订触发器明确保留 `content` 可被作者就地编辑（不在回滚字段白名单内）。`solutions`/`submissions` 均无版本/内容哈希列。`source_hash` 只用于缓存去重（`normalization.ts`），没有任何读路径拿它与当前行内容做一致性核对。
**违反的原则**：原则 1（VerificationRun 必须绑定不可变版本，而非活动行）。
**风险**：一次验证结论可能在事后被静默"重新指派"给已经编辑过的不同内容，且没有机制检测或提示这种漂移。
**目标状态**：见 `version-lineage.md` 节点四——短期读时哈希比对 + UI 过期提示；中期绑定 `solution_revision_id`/`problem_version_id`。
**建议动作**：先实现读时一致性核对与过期提示（不需要 schema 变更）；`solution_revisions`/`problem_versions` 落地后再切换 FK 目标。
**前置条件**：根本修复依赖 `SOL-006`（SolutionRevision）与 `PROB-001`（ProblemVersion）先完成设计；过期提示可独立先行。
**冲突文件**：`supabase/migrations/024_unified_verification_system.sql`、`supabase/migrations/019_submission_author_revision.sql`、`verification/service/normalization.ts`。
**优先级**：P0

### VER-002

**当前实现**：`verification/domain/types.ts:10-13` 的 `VerificationVerdict` 是单一枚举，`accepted`/`rejected`（数学结论）与 `invalid_request`/`timeout`/`rate_limited`/`resource_limit`/`provider_error`/`cancelled`（运行/基础设施失败）共存一列，且该混合在 `024_unified_verification_system.sql:11-12` 的 CHECK 约束里也是同一列。`ui-meta.ts:15-17` 需要专门写注释提醒"provider_error 不是对证明的判断"，`recoverStale()`（`supabase-verification-repository.ts:92-100`）把僵死任务写成 `verdict:'provider_error'`，与真正的数学判断共享同一字段和缓存判定逻辑（`CACHEABLE_VERDICTS`）。
**违反的原则**：原则 4（"error 不是数学结论"，此处 error 类值和结论类值在 schema 层面就是同一枚举）。
**风险**：任何不熟悉这条 UI 层约定的新消费者（报表、导出、第三方集成）都可能用 `verdict !== 'accepted'` 这类朴素过滤，把基础设施故障误判为"证明有误"。
**目标状态**：见 `verification-semantics.md` 的 `run_status`/`conclusion` 拆分与映射表。
**建议动作**：新增 `run_status`/`conclusion` 列（保留旧列），按映射表回填，逐一迁移 `ui-meta.ts`/`policies.ts`/`AdminVerificationsView` 的读取点。
**前置条件**：依赖 `verification-semantics.md` 映射表的评审通过；这是一次 additive migration + 存量回填，需要独立设计迁移脚本。
**冲突文件**：`verification/domain/types.ts`、`verification/ui-meta.ts`、`verification/repositories/supabase-verification-repository.ts`、`supabase/migrations/024_unified_verification_system.sql`。
**优先级**：P0

### VER-003

**当前实现**：`verification/repositories/supabase-verification-repository.ts:55-78` 的 `authorize()` 直接对 `problems`/`submissions`/`solutions` 发起四次原始查询，使用这些表的内部列名（`author_id`、`source_submission_id` 等），不经过任何这些领域自己导出的接口。
**违反的原则**：原则 6（跨领域只通过公开接口/引用交互）；原则 5（Verification 本应是隔离能力，此处反而深入其他领域内部）。
**风险**：`problems`/`solutions`/`submissions` 任何一次列重命名或所有权模型调整都可能静默破坏验证鉴权逻辑——这个问题出现在全仓库分层最干净的模块里，是最值得优先修复的信号。
**目标状态**：Verification 的鉴权逻辑通过 Problem/Solution/Submission 各自导出的窄化只读接口（例如 `getOwnershipInfo(kind, id)`）完成，不再直接查表。
**建议动作**：在 Submission/Solution 域各新增一个 ownership 查询函数，`authorize()` 改为调用它们。
**前置条件**：无——纯代码重构，不涉及 schema 变更，可作为独立、低风险的小提交先行执行。
**冲突文件**：`verification/repositories/supabase-verification-repository.ts`、`lib/db.ts`、`lib/publish-submission.ts`。
**优先级**：P0

### ARENA-005

**当前实现**：`enforce_contest_submission_window()` 被 `005`/`008`/`012`/`016`/`020_allow_post_window_contest_review.sql`/`021` 六次 `CREATE OR REPLACE`。两个文件同为 `020_*` 前缀且无子序号；字典序重放下 `021` 最后执行，其函数体缺少 `020_allow_post_window_contest_review.sql` 新增的 `TG_OP='UPDATE'` 跳过逻辑（用于让 moderator 在窗口关闭后仍可审核状态），尽管 `021` 自己的注释声称"其他检查均未改变"。`docs/SUPABASE_SETUP.md` 明确要求新环境按文件编号顺序执行迁移。
**违反的原则**：原则 1（Arena 的核心执行函数没有单一、可追溯的版本历史，其最终行为依赖非确定的重放顺序）；原则 6（跨领域行为应通过明确命令而非隐式的迁移重放顺序）。
**风险**：在全新环境按文件名顺序重放迁移时，`020_allow_post_window_contest_review.sql` 的审核修复会被静默覆盖，重新引入"关闭窗口后 moderator 无法审核"的 bug，且没有任何测试或约束会捕获这个回归——这是全审计中风险最具体、最可复现的一项。
**目标状态**：`enforce_contest_submission_window()` 只有一个明确排序、无歧义的权威定义。
**建议动作**：`docs/MAINTAINABILITY_REFACTOR_PLAN.md` Phase 7 已经指出此问题；在采取任何重命名/合并动作前，必须先确认两个 `020_*` 文件在生产环境的真实执行顺序。
**前置条件**：**硬性前置**——必须先确认生产环境实际部署历史（哪个 020 先跑的），未确认前不得重命名、合并或调整任何一个迁移文件。这是本清单中唯一要求"先做侦查、再决定方案"而非"直接给出方案"的一项。
**冲突文件**：`supabase/migrations/020_allow_post_window_contest_review.sql`、`supabase/migrations/020_contest_access_control.sql`、`supabase/migrations/021_contest_submission_registration_gate.sql`。
**优先级**：P0

### PROB-001

**当前实现**：`001_initial_schema.sql:14-42` 的 `problems` 表只有 `created_at`/`updated_at`。`lib/save-proof-graph.ts:53-58` 对其做无条件 `UPDATE`；`lib/promote-problem-draft.ts` 只在创建时 `INSERT`，此后的编辑仍是就地覆盖同一行。`024_unified_verification_system.sql:5` 的 `verification_tasks.problem_id` FK 指向这个无版本的活动行。全仓库 grep 确认没有 `ProblemVersion`/`problem_versions`/`problem_history` 等任何形式的版本痕迹。
**违反的原则**：原则 1（链条根节点完全没有版本化）；原则 4（间接：验证结果因此无法锚定到具体的题目内容版本）。
**风险**：题目内容被编辑后，此前对该题目的验证结果会静默地"重新指派"给编辑后的新内容，无法追溯验证发生时题目到底是什么样子。
**目标状态**：见 `version-lineage.md` 节点一。
**建议动作**：新增 `problems.version` + `problem_versions` 历史表（或至少先覆盖 `proof_graph` 这个当前编辑频率最高的字段）。
**前置条件**：依赖 `version-lineage.md` 的独立设计评审；这是一次结构性的 schema 新增，需要专门的迁移设计,不应仓促执行。
**冲突文件**：`supabase/migrations/001_initial_schema.sql`、`lib/save-proof-graph.ts`、`lib/promote-problem-draft.ts`、`supabase/migrations/012_problem_vault.sql`。
**优先级**：P0

### AUTHZ-001

**当前实现**：moderator/admin 判定规则（`role IN ('moderator','admin')` 或硬编码 owner 邮箱旁路）被独立实现至少 9 处：`lib/require-moderator.ts`（标准实现，含邮箱旁路）、`lib/proof-graph-admin-auth.ts`（近乎逐行复制）、`verification/api.ts` 的 `isVerificationAdmin`、`components/AuthButton.tsx` 的 `canReviewSubmissions`（**缺邮箱旁路**）、以及 `app/admin/page.tsx`/`app/admin/submissions/page.tsx`/`app/admin/contests/page.tsx`/`app/admin/problem-vault/page.tsx`/`app/admin/problem-vault/new/page.tsx` 五处内联函数（**全部缺邮箱旁路**）。
**违反的原则**：原则 5（Authorization 应是单一隔离能力，此处是 9 份互不感知的独立实现）；原则 6（每个消费方都自己重新读取 `user_profiles.role` 并重新推导规则，而不是调用一个公开接口）。
**风险**：行为已经真实分叉，不只是代码风格问题——5 个内联检查和 `AuthButton.tsx` 都遗漏了 `lib/require-moderator.ts`/`verification/api.ts`/RLS 策略本身都包含的邮箱旁路；任何未来对判定规则的调整都必须手动同步 9 处，已经证明会遗漏。
**目标状态**：唯一的、可供客户端和服务端共同复用的 Authorization 判定函数。
**建议动作**：把 5 个内联函数和 `AuthButton.tsx` 的本地实现替换为调用共享谓词；让 `lib/proof-graph-admin-auth.ts` 和 `verification/api.ts` 的 `isVerificationAdmin` 内部改为组合调用而非重新实现。
**前置条件**：无实质前置条件——这是本清单中改动面最小、回报最高、最适合作为第一批小范围迁移试点的一项，每个调用点的替换都可以是独立、可回滚的小提交。
**冲突文件**：`lib/require-moderator.ts`、`lib/proof-graph-admin-auth.ts`、`verification/api.ts`、`components/AuthButton.tsx`、5 个 `app/admin/*/page.tsx`。
**优先级**：P0

### AUTHZ-002

**当前实现**（核实后修正范围）：RLS（`003_repair_submission_review_policies.sql:15,27,35`）和 `lib/require-moderator.ts:20-22` 对硬编码 owner 邮箱无条件授予权限；`app/admin/page.tsx`、`app/admin/contests/page.tsx`、`app/admin/submissions/page.tsx`、`app/admin/problem-vault/page.tsx` 及 `AuthButton.tsx` 仅按 `role` 判定，没有邮箱旁路。**核实修正**：原始候选项声称"其余 4 个 admin 子页面"都缺旁路，经核实其中 `app/admin/proof-graph/page.tsx`（走 `requireProofGraphEditor`）和 `app/admin/verifications/page.tsx`（走 `isVerificationAdmin`）**已经包含**相同的邮箱旁路，实际受影响面是 `app/admin/page.tsx` + 3 个子页面（contests/submissions/problem-vault）+ `AuthButton.tsx`。
**违反的原则**：原则 5（授权应是单一权威判定，此处同一个 actor 在不同代码路径下得到矛盾结论）。
**风险**：如果 owner 账号的 `user_profiles.role` 不是字面上的 `'admin'`（邮箱旁路存在的本意就是覆盖这种情况），该账号会被 `/admin` 拒之门外、看不到导航链接，却仍能通过 `requireModerator()` 把关的 server action（如 `publishSubmission`，内部用 service-role 写库）执行特权操作——这是一个已经存在、可复现的功能性矛盾，不只是代码重复。
**目标状态**：同 `AUTHZ-001`。
**建议动作**：与 `AUTHZ-001` 共用同一个修复动作，修复 `AUTHZ-001` 会自动消除本项。
**前置条件**：与 `AUTHZ-001` 相同，无独立前置条件。
**冲突文件**：`supabase/migrations/003_repair_submission_review_policies.sql`、`lib/require-moderator.ts`、`app/admin/page.tsx`、`app/admin/contests/page.tsx`、`app/admin/submissions/page.tsx`、`app/admin/problem-vault/page.tsx`、`components/AuthButton.tsx`。
**优先级**：P0

---

## P1

### SOL-003

**当前实现**：`ThinkingCues.forkOf?`（`lib/types.ts:186-190`）在提交时（`SubmitForm.tsx:1159`）写入 `{solutionId, solutionTitle, solutionAuthor}` 字符串快照，`lib/publish-submission.ts` 原样存入 `thinking_cues` JSONB，无 FK、无写入时存在性校验、标题/作者不随目标解答变化重新解析。
**违反的原则**：原则 1（血缘边应不可变绑定且可追溯）。
**风险**：目标解答被删除/未来若允许编辑，`forkOf` 的缓存标题/作者会静默失真，且写入时目标 id 本身都未校验存在。
**目标状态**：`forkOf` 升级为 FK 约束的血缘边，标题/作者渲染时实时解析。
**建议动作**：参照 `010_solution_challenges_profile.sql` 里 `challenge_target_solution_id` 的真 FK 先例，把 `forkOf` 迁出 JSONB 存入专门列/表。
**前置条件**：需要先确认迁移存量 `thinking_cues.forkOf` 数据的脚本方案；不依赖 SolutionRevision 先行落地。
**冲突文件**：`lib/types.ts`、`components/SubmitForm.tsx`、`lib/publish-submission.ts`。
**优先级**：P1

### SOL-004

**当前实现**：`components/ProofGraphMatrix.tsx:5,22,32` 直接 import `Solution` 并解构 `kind`/`scores`；`lib/load-solution-drafts.ts:32-35` 直接 `supabase.from('solutions').select(...)`；`lib/save-proof-graph.ts:53-58` 直接写 `problems` 表。
**违反的原则**：原则 3（ProofIR 应中介 Solution 与 Proof Intelligence）；原则 6（不共享可变内部对象）。
**风险**：Solution 内部形状任何调整都会静默破坏 Proof Intelligence 组件。
**目标状态**：引入窄化的 `SolutionForProofGraph` DTO 中介两者。
**建议动作**：新增 `lib/proof-graph/` 边界模块，暴露类型化读写函数供 Proof Intelligence 组件消费。
**前置条件**：无 schema 依赖，可作为独立代码重构先行；建议与 `PROB-004`（Proof Intelligence 写 problems 表）一并解决,因为两者共享同一批文件。
**冲突文件**：`components/ProofGraphMatrix.tsx`、`components/ProofGraphEditor.tsx`、`lib/load-solution-drafts.ts`、`lib/save-proof-graph.ts`。
**优先级**：P1

### SOL-006

**当前实现**：`solutions` 表（`001_initial_schema.sql:46-79`）仅有 `created_at`/`updated_at`；全仓库 grep 确认没有任何 `UPDATE solutions` 调用点，发布只走 `INSERT`（`publish-submission.ts:318`）。
**违反的原则**：原则 2（Solution 应支持可演化的历史）；原则 1（SolutionRevision 节点缺失）。
**风险**：非当前 bug（解答目前事实不可变），但"编辑已发布解答"功能一旦上线且没有提前设计版本机制，会破坏所有已引用旧内容的下游（proof_graph、verification_tasks、forkOf）。
**目标状态**：见 `version-lineage.md` 节点二。
**建议动作**：在任何"编辑已发布解答"功能上线前，先落地 `solution_revisions` 表。
**前置条件**：**产品前置**——只有当"编辑已发布解答"功能被排上路线图时才是紧迫项；建议作为该功能立项时的强制前置条件记录下来，而不是本轮就实现。
**冲突文件**：`supabase/migrations/001_initial_schema.sql`、`lib/publish-submission.ts`。
**优先级**：P1

### VER-004

**当前实现**：`verification-service.ts:96-98` 把 `request.source` 逐字透传给 `LeanEngine.verify` → `axle-provider.ts:62` 的 `content: request.source`；`verification/domain/types.ts`、`lib/types.ts` 均无 `ProofIR` 类型。
**违反的原则**：原则 3（ProofIR 应是三方稳定协议，目前不存在）。
**风险**：Solution 内容、Proof Graph 标注、验证结果三条数据线无结构化关联，无法回答"证明图哪个节点对应哪次验证"。
**目标状态**：见 `version-lineage.md` 节点三。
**建议动作**：作为长期设计项，先输出独立的 ProofIR 设计文档,不做仓促 schema 补丁。
**前置条件**：需要独立设计文档先行，不属于本轮或下一轮可执行范围。
**冲突文件**：`verification/service/verification-service.ts`、`verification/providers/axle/axle-provider.ts`、`lib/save-proof-graph.ts`。
**优先级**：P1

### VER-005

**当前实现**：`verification_tasks`/`verification/` 模块（Lean/AXLE）、`Solution.verification` legacy 字段（`VerificationPanel.tsx`）、`api/cas/route.ts` + `CASVerifier.tsx`（结果仅存于 React state，从不持久化）三者并存，在 `ProblemDetailExperience.tsx` 里作为互不关联的独立 tab 渲染。
**违反的原则**：原则 5（"验证"名下并存三套互不通信的机制）；原则 4（legacy 字段无运行/结论分离）。
**风险**：三种"已验证"含义、三种可信基础，用户无法区分。
**目标状态**：见 `verification-semantics.md` 的证据等级模型。
**建议动作**：将 CAS 结果写入 `verification_tasks`（schema 已预留 `engine='cas'`/`provider='sympy'`），逐步淘汰 legacy 静态字段。
**前置条件**：依赖 SOL-001/SOL-005 的重命名先完成；CAS 接入 `verification_tasks` 需要独立的迁移与服务层改造设计。
**冲突文件**：`components/VerificationPanel.tsx`、`components/CASVerifier.tsx`、`lib/cas-client.ts`、`app/api/cas/route.ts`、`lib/types.ts`。
**优先级**：P1

### ARENA-001

**当前实现**：`004_contest_arena_mvp.sql:55-75` 给 `solutions`/`submissions` 加了 `contest_id`/`contest_problem_id`/`contest_slug`/`contest_problem_key`/`contest_solution_type`/`is_post_contest`；`lib/types.ts:202-212` 把这些字段直接嵌入核心 `Solution` 接口；`publish-submission.ts:234-239` 在发布时把这些字段焊死进 `solutions` 行。
**违反的原则**：原则 2（Arena 应拥有独立的参赛快照，不与 Solution 资产焊死）；原则 6。
**风险**：Solution 资产的 schema 永久耦合于它恰好参加过的比赛；无法脱离 Arena 历史独立演化 Solution，也无法让同一解答参与第二场比赛。
**目标状态**：Arena 拥有自己的 append-only 参赛记录表，引用 `solutions.id`。
**建议动作**：新增 `contest_solution_links` 之类的 Arena 拥有的关联表，迁移现有 `solutions.contest_*` 列,并把这些字段从核心 `Solution` 接口移除（保留在 Arena 侧 DTO）。
**前置条件**：需要数据迁移脚本（把现有 `solutions.contest_*` 列的数据搬到新表），且需要确认没有其他读路径依赖这些字段直接挂在 `solutions` 上。
**冲突文件**：`supabase/migrations/004_contest_arena_mvp.sql`、`lib/types.ts`、`lib/publish-submission.ts`。
**优先级**：P1

### ARENA-002

**当前实现**：`lib/contests.ts:622-829`（`getContestUserRankings`/`getContestLeaderboard`）直接 `supabase.from('solutions')`/`supabase.from('solution_ratings')` 查询，读取 `author`/`author_id`/`contest_problem_id` 等内部列，不经过 `lib/db.ts`。
**违反的原则**：原则 2；原则 6。
**风险**：`solutions`/`solution_ratings` 任何 schema 调整会静默破坏 Arena 排行榜，且没有编译期信号。
**目标状态**：Arena 通过 Solution 域导出的窄化读函数获取评分摘要。
**建议动作**：在 `lib/db.ts`（或新的 Solution 域模块）新增 `getSolutionRatingsSummary`，`lib/contests.ts` 改为调用它。
**前置条件**：无 schema 依赖，纯代码重构，可独立先行。
**冲突文件**：`lib/contests.ts`、`lib/db.ts`。
**优先级**：P1

### ARENA-003

**当前实现**：`lib/promote-problem-draft.ts:118-125` 直接 `UPDATE submissions SET problem_id=..., draft_problem_id=NULL WHERE draft_problem_id=...`，以及 `:109-116` 直接 `UPDATE contest_problems`——一个"发布"动作同时改写 Problem、Arena、Submission 三个领域的表。
**违反的原则**：原则 5（Publishing 不应直接改写其他领域内部）；原则 6。
**风险**：没有单一位置拥有"草稿被提升后，参赛赛题和投稿该如何重新链接"这条规则；未来 Arena/Submission 侧的不变式调整（如 `019` 的身份字段锁定）可能被这条直连路径悄悄绕过。
**目标状态**：重新链接动作通过 Arena/Submission 各自拥有的函数完成。
**建议动作**：抽出 `relinkContestProblemToPublishedProblem()`（Arena 拥有）和 `relinkSubmissionsToPromotedProblem()`（Submission 拥有），`promoteProblemDraft()` 调用两者而非直接写表。
**前置条件**：无 schema 依赖，纯代码重构；建议与 `PROB-003`（同一文件的另一处直连）一起处理。
**冲突文件**：`lib/promote-problem-draft.ts`。
**优先级**：P1

### KNOW-001

**当前实现**：`app/library/[id]/page.tsx:16,66-88` 直接 `import problems from '@/data/problems'` 并 `.filter()`/`.flatMap()`，绕过 `lib/db.ts` 这一 CLAUDE.md 文档记录的公开读路径。
**违反的原则**：原则 6；原则 5。
**风险**：Library 页面读到的是静态 fallback 数组，可能与 `/problems/[id]` 页面读到的实时 Supabase 数据不一致，且 CLAUDE.md 已明确标注 `data/problems.ts` "不是数据源真相"。
**目标状态**：Library 页面通过 `lib/db.ts` 暴露的查询获取关联题目/解答。
**建议动作**：新增 `getProblemsReferencingKnowledge(id)` 之类的导出查询，替换直接 import。
**前置条件**：无——纯代码重构，可直接执行。
**冲突文件**：`app/library/[id]/page.tsx`、`lib/db.ts`。
**优先级**：P1

### KNOW-002

**当前实现**：`data/knowledge.ts`/`data/insights.ts` 没有拥有者模块，被 `lib/problem-detail-helpers.ts`、`components/ConceptBoundaryPanel.tsx`、`ShareCard.tsx`、`StudioWorkspace.tsx`、`SolutionCard.tsx`、`app/library/*` 等 5+ 处直接 import。
**违反的原则**：原则 6；原则 3（Knowledge 应有稳定协议入口）。
**风险**：未来若 Knowledge Base 迁移到 Supabase 支撑（`knowledge_nodes`/`insight_nodes` 表已存在但未使用），需要同时修改 5+ 个跨领域文件而非一个接口模块。
**目标状态**：新增 `lib/knowledge.ts` 作为唯一入口。
**建议动作**：创建该模块包装现有静态数据函数，逐一替换调用点的 import 路径。
**前置条件**：无 schema 依赖，可独立先行；建议与 `KNOW-001` 一起处理,因为都是"补齐 Knowledge 读接口"的同一动作。
**冲突文件**：`lib/problem-detail-helpers.ts`、`components/ConceptBoundaryPanel.tsx`、`components/ShareCard.tsx`、`components/StudioWorkspace.tsx`、`components/SolutionCard.tsx`、`app/library/page.tsx`、`app/library/[id]/page.tsx`。
**优先级**：P1

### PROB-002

**当前实现**：`lib/types.ts:353-375` 的 `Problem.solutions: Solution[]` 是必填内嵌字段；`lib/db.ts:71-109` 的 `toProblem` 在每次 `getProblem`/`getProblems` 时都拼装完整数组。
**违反的原则**：原则 2；原则 3；原则 5（Problem 变成了积累 Solution 完整状态的容器）。
**风险**：Solution 任何字段变化（新增评分维度、调整 `verification.status` 语义）都强制影响每一个 Problem 消费方；Problem 无法独立于 Solution 被读取/缓存/推理。
**目标状态**：`Problem` 只引用 Solution 的 id/摘要（`ProblemSummary`/`SolutionSummary` 已经展示了正确模式），完整数据在查询时按需 join。
**建议动作**：拆分 `Problem`（陈述/答案/元数据）与 `ProblemWithSolutions`（页面组装用读模型）。
**前置条件**：需要梳理所有依赖 `problem.solutions` 隐式存在的调用点（`ProblemCard.tsx`、`ProblemDetailExperience.tsx` 等），是一次影响面较广的类型重构,建议作为独立纵向切片而非顺带处理。
**冲突文件**：`lib/types.ts`、`lib/db.ts`、`components/ProblemCard.tsx`、`components/ProblemDetailExperience.tsx`。
**优先级**：P1

### PROB-003

**当前实现**：`components/ProblemVaultView.tsx:493-498` 直接 `supabase.from('submissions').select(...)`；`lib/promote-problem-draft.ts:99-125` 直接写 `contest_problems`/`submissions`。
**违反的原则**：原则 5；原则 6。
**风险**：Problem 域代码对 Arena/Submission 表既读又写，任何一方的 schema/触发器/不变式调整都可能被这条直连路径静默绕过（例如项目内存记录的投稿反滥用触发器）。
**目标状态**：通过 Arena/Submission 拥有的导出函数完成跨域读写。
**建议动作**：与 `ARENA-003` 共用同一批抽取动作；`ProblemVaultView` 的内联计数查询替换为 Submission 域导出的 `countSubmissionsForDraft(draftId)`。
**前置条件**：无 schema 依赖，可独立先行。
**冲突文件**：`components/ProblemVaultView.tsx`、`lib/promote-problem-draft.ts`。
**优先级**：P1

### PROB-004

**当前实现**：`lib/save-proof-graph.ts` 通过 `createServiceClient().from('problems').update(...)` 直接写，不经过任何 Problem 域自己的写函数；`lib/types.ts:353-375` 的 `Problem.proofGraph` 字段没有对应的 Problem 域写入口。
**违反的原则**：原则 3；原则 6。
**风险**：Problem 域无法对这条写路径施加自己的不变式（未来的版本化、更严格的校验），因为写入完全绕过了 Problem 域的文件集合。
**目标状态**：Problem 域暴露 `updateProblemProofGraph(problemId, graph)`，Proof Intelligence 调用它而非直接写表。
**建议动作**：把 `supabase.from('problems').update({proof_graph})` 移入新的 Problem 域写模块。
**前置条件**：无 schema 依赖；建议与 `SOL-002`/`SOL-004` 一起处理,因为都涉及同一份文件。
**冲突文件**：`lib/save-proof-graph.ts`。
**优先级**：P1

### AUTHZ-003

**当前实现**：`AdminSubmissionsView.tsx:429-432` 的审核状态变更（approve/reject/needs_revision）直接走浏览器端 `supabase.from('submissions').update(patch)`，不调用 `lib/require-moderator.ts`；同一审核流程紧接着的发布步骤（`:458`）却调用了 `requireModerator`（`publishSubmission`）。
**违反的原则**：原则 5（Moderation 最关键的动作没有被 Authorization 能力在应用层介入）。
**风险**：这是 `components/AdminContestScoringView.tsx` 里已经被显式记录为"接受的权衡"的同一种模式（RLS 兜底），但在这里没有类似注释说明，且同一流程里两个相邻步骤的授权保证强度不一致,容易被未来重构者误判为"审核动作都走 requireModerator"。
**目标状态**：要么状态变更也走一个调用 `requireModerator()` 的 server action，要么明确记录"此处依赖 RLS"的架构决策。
**建议动作**：至少先补一条与 `AdminContestScoringView.tsx` 同样清晰的注释；有余力时再抽出 server action。
**前置条件**：无 schema 依赖，注释补充可立即执行；抽出 server action 需要先确认不会引入额外的往返延迟/竞态。
**冲突文件**：`components/AdminSubmissionsView.tsx`。
**优先级**：P1

### AUTHZ-004

**当前实现**：`lib/proof-graph-admin-auth.ts:7-31` 与 `lib/require-moderator.ts:11-35` 结构逐行相同（同一邮箱旁路、同一角色检查），独立实现而非组合调用。
**违反的原则**：原则 5。
**风险**：与 `AUTHZ-001` 同源的漂移风险。
**目标状态**：`requireProofGraphEditor` 内部调用 `requireModerator()`。
**建议动作**：重构为组合调用，删除重复的鉴权代码块。
**前置条件**：无，可与 `AUTHZ-001` 的修复一并执行。
**冲突文件**：`lib/proof-graph-admin-auth.ts`、`lib/require-moderator.ts`。
**优先级**：P1

### PUB-001

**当前实现**：`lib/publish-submission.ts:135-168` 的 `publishProblem` 构造包含 9 个知识/概念字段的 `problems` insert；`lib/promote-problem-draft.ts:67-93` 的 `promoteProblemDraft` 为同一张表构造第二份、完全省略这 9 个字段的 insert；`lib/save-proof-graph.ts` 是第三个独立写手。
**违反的原则**：原则 5；原则 6。
**风险**：字段覆盖已经真实漂移——通过 `promoteProblemDraft` 发布的题目永远缺少知识/概念关联字段，而通过 `publishSubmission` 发布的题目会填充它们,同一张表两种发布路径产出不一致的行。
**目标状态**：单一 Publishing 能力拥有 `problems` 行的规范形状和默认值。
**建议动作**：抽出 `buildProblemRow`/`publishProblemRow` 共享 helper，三个写手统一调用。
**前置条件**：需要先梳理两个写手当前各自实际写入的完整字段清单,确保合并后不遗漏任何一方已有的字段。
**冲突文件**：`lib/publish-submission.ts`、`lib/promote-problem-draft.ts`、`lib/save-proof-graph.ts`。
**优先级**：P1

### PLAT-001

**当前实现**：三套独立限流实现——投稿（`022`/`023` DB 触发器 + `submission_rate_limits` 表）、验证（`verification-service.ts:44-66` 服务层计数查询 + `policies.ts` 常量）、CAS（`app/api/cas/route.ts:11-40` 进程内内存 Map，冷启动即重置）。
**违反的原则**：原则 5；原则 6。
**风险**：清除某用户的投稿冷却对其验证/CAS 限流毫无影响，运营者无法把"这个用户的配额"当作一个整体概念处理；CAS 的内存限流在多实例部署下不保证生效。
**目标状态**：见 domain-map.md 的 Quota 能力定义——一个共享的策略/接口契约，允许不同后端实现。
**建议动作**：先统一策略常量和 `清除/查询` 操作的接口形状，不强求立即合并三套后端。
**前置条件**：无 schema 阻塞，但涉及三个不同子系统的协调设计，建议单独立项而非顺带处理。
**冲突文件**：`supabase/migrations/022_submission_rate_limit_schema.sql`、`023_submission_rate_limit_enforcement.sql`、`lib/submission-rate-limit-actions.ts`、`lib/submission-errors.ts`、`verification/service/verification-service.ts`、`verification/domain/policies.ts`、`app/api/cas/route.ts`。
**优先级**：P1

### PLAT-002

**当前实现**：全仓库 grep `audit_log|AuditLog|audit_trail|reviewed_by|reviewer_id` 零匹配。唯一的审核痕迹是 `submissions.moderator_notes`，在作者重新提交时被 `019_submission_author_revision.sql:72` 的触发器清空,没有历史表。
**违反的原则**：原则 5（Audit 完全没有归属，不是分散而是缺失）。
**风险**：一旦出现审核争议（被拒稿、被手动清除冷却、验证任务被重试),无法查询"谁在何时做了什么"。
**目标状态**：新增 append-only `audit_log` 表（actor/action/target/diff/timestamp）,由现有特权操作入口写入。
**建议动作**：作为新 Platform 能力设计,不是现有代码的重构。
**前置条件**：需要先确定 audit 记录的 schema 和写入时机,建议在下一轮新增管理员操作前就先完成这项设计,避免后续每个新特权操作都要重新决定"要不要记审计日志"。
**冲突文件**：无（尚无代码）。
**优先级**：P1

### PLAT-006

**当前实现**：`app/api/admin/verifications/[id]/retry/route.ts:18-28` 读取原任务的 `environment` 后创建全新 `verification_tasks` 行,`cache_source_id` 只用于缓存命中血缘,不用于重试血缘。
**违反的原则**：原则 1（VerificationRun 链条里"重试"这条关系没有被持久化,只能靠人工比对 `source_snapshot` 文本推断）。
**风险**：审计人员无法从 schema 直接查出"这条失败记录后来被重试过吗、结果是哪一条"。
**目标状态**：新增 `retry_of` 列显式记录血缘。
**建议动作**：新增 `verification_tasks.retry_of UUID REFERENCES verification_tasks(id) ON DELETE SET NULL`,retry 路由的 `create()` 调用带上这个值。
**前置条件**：**本清单中改动最小、最适合优先执行的 schema 变更之一**——单列新增,不影响现有读写路径,不需要等待其他版本化工作完成。
**冲突文件**：`app/api/admin/verifications/[id]/retry/route.ts`、`supabase/migrations/024_unified_verification_system.sql`。
**优先级**：P1

---

## P2

> P2 项优先级最低，且大多是"补齐一致性"而非"修复错误行为"，建议在 P0/P1 的纵向切片顺带覆盖到相关文件时一并处理，不建议单独立项。

### SOL-007

**当前实现**：`lib/proof-graph-admin-auth.ts` 复制 `lib/require-moderator.ts` 的判定逻辑（与 `AUTHZ-004` 同一现象，从 Proof Intelligence 视角重复记录）。
**违反的原则**：原则 5。**风险**：与 `AUTHZ-001` 同源漂移风险，严重度更低。**目标状态/建议动作**：同 `AUTHZ-004`。
**前置条件**：与 `AUTHZ-004` 合并处理，无需单独排期。
**冲突文件**：`lib/proof-graph-admin-auth.ts`。**优先级**：P2

### VER-006

**当前实现**：`verification/api.ts:14-16` 的 `isVerificationAdmin` 与 `verification/repositories/supabase-verification-repository.ts:48-50` 的 `isPrivileged` 各自独立实现同一条 `email === owner || role in (moderator, admin)` 规则。
**违反的原则**：原则 5。**风险**：与 `AUTHZ-001` 同源，是全仓库第 3/4 份重复实现。**目标状态/建议动作**：改为调用共享谓词。
**前置条件**：与 `AUTHZ-001` 合并处理。
**冲突文件**：`verification/api.ts`、`verification/repositories/supabase-verification-repository.ts`。**优先级**：P2

### ARENA-004

**当前实现**：`lib/contest-sprint.ts:1-4,116-126` 直接调用 `lib/db.ts` 的 `getProblem` 和 `lib/problem-drafts.ts` 的 `getProblemDraftForContestDisplay`，拿到完整 Problem/Draft 对象后才截取需要的字段。
**违反的原则**：原则 3；原则 6。**风险**：Arena 对参赛者的信息披露范围隐式耦合于 Problem 完整对象的形状,没有显式契约声明"冲刺揭示时到底该看到哪些字段"。
**目标状态**：Problem 域暴露 `getProblemStatementSummary()` 窄接口。**建议动作**：新增该窄接口,`contest-sprint.ts` 改用它。
**前置条件**：无。**冲突文件**：`lib/contest-sprint.ts`。**优先级**：P2

### ARENA-006

**当前实现**：`lib/contests.ts` 999 行内混合 (1) 行映射+CRUD，(2) 锁定/可见性检查，(3) ~160 行的 thoughts/redaction 子系统，(4) 两套评分算法（社区评分排行榜 vs 官方周赛记分板），命名相近（`getContestUserRankings` vs `getContestScoreboard`）。
**违反的原则**：原则 5；原则 4（两套不同性质的评分被放在一起，容易误改）。**风险**：维护者容易改错評分逻辑；文件体量本身增加认知负担。
**目标状态**：按四类职责拆分为独立文件。**建议动作**：抽出 `lib/contest-thoughts.ts`，把两套评分算法拆到清晰命名的独立文件。
**前置条件**：无 schema 依赖，是纯文件拆分,建议作为 P2 中优先级最高的一项（体量最大、认知收益最直接）。
**冲突文件**：`lib/contests.ts`。**优先级**：P2

### KNOW-003

**当前实现**：`WhyNotMethod`（`lib/types.ts:107-112`，Knowledge 域）与 `ProofMethodBoundary`（`lib/types.ts:449-457`，Proof Graph 域）字段近乎一一对应（`whenItWouldWork` vs `whenItWorks` 等），却是两个无关类型、两套数据源（`data/concept-boundaries.ts` vs `problems.proofGraph`）、两个渲染组件。
**违反的原则**：原则 3；原则 5。**风险**：同一个"为什么不用这个方法"的判断可能在两处出现矛盾表述，读者无法判断哪个权威。
**目标状态**：合并为一个概念（Proof Intelligence 拥有，Knowledge 引用），或显式记录两者故意不同的理由。
**建议动作**：产品/内容团队先决定是否要合并；技术上先在两个类型定义处互相加注释说明关系。
**前置条件**：需要产品决策（合并 or 保持分离），技术动作依赖该决策。
**冲突文件**：`lib/types.ts`、`components/ConceptBoundaryPanel.tsx`、`components/MethodBoundaryHighlights.tsx`、`data/concept-boundaries.ts`。**优先级**：P2

### KNOW-004

**当前实现**：`data/problems.ts` 的 `solution()`/`problem()` 构造函数在模块加载期直接调用 `matchTagsToKnowledge`/`mergeConceptBoundaryFields`（Knowledge 域函数），把结果永久烘焙进静态对象。
**违反的原则**：原则 5；原则 6。**风险**：Knowledge 数据（如 `tagKnowledgeMap`）更新后，必须重新触发 `data/problems.ts` 的构建才能生效，两个领域的数据生命周期被焊死。
**目标状态**：Knowledge 增强改为读时查询而非写时烘焙。
**建议动作**：把匹配/合并调用移到 `lib/db.ts` 或新的 `lib/knowledge.ts` 的读路径。
**前置条件**：依赖 `KNOW-002`（先有 `lib/knowledge.ts`）。
**冲突文件**：`data/problems.ts`、`data/tag-matcher.ts`、`data/concept-boundaries.ts`。**优先级**：P2

### KNOW-005

**当前实现**：`PedagogicalAnnotations`（`lib/types.ts:123-133`，9 个可选字段）被 `Solution`、`Problem` 直接 extends，`KnowledgeNode` 又独立重复了近乎相同的字段集，`mergeConceptBoundaryFields<T extends KnowledgeNode | Problem | Solution>` 泛型函数把同一份增强数据机械地挂到三种不同实体上。
**违反的原则**：原则 5（万能标注口袋）；原则 2（Solution 自己的资产边界因此模糊）。**风险**：未来任何新实体都可以同样廉价地继续扩展这个口袋，没有领域所有者把关。
**目标状态**：每个实体拥有明确、独立命名的增强字段，或抽成一个显式引用（而非合并）的共享概念。
**建议动作**：先审计 9 个字段是否每个实体都真的需要，再决定拆分方案。
**前置条件**：需要先做一次范围审计（本轮之外），属于设计决策而非直接可执行的动作。
**冲突文件**：`lib/types.ts`、`data/concept-boundaries.ts`。**优先级**：P2

### KNOW-006

**当前实现**：`ConceptLink.conceptId`、`ContrastProblem.problemId`、`ConceptContrast.exampleProblemIds`、`InsightNode.relatedKnowledgeIds/relatedProblemIds` 等跨实体引用都是裸字符串，无校验；`ConceptBoundaryPanel.tsx:211` 在找不到目标时静默 fallback 成原始 ID 文本，`problem-detail-helpers.ts:21-22` 静默丢弃悬空引用。
**违反的原则**：原则 6（"引用"应该有完整性保证）。**风险**：内容作者的 typo 不会导致构建失败，只会静默丢失内容或显示裸 ID，且当前唯一的构建门禁（`npm run build`，无测试套件）无法捕获。
**目标状态**：构建期校验所有跨实体字符串引用。
**建议动作**：新增 `scripts/validate-knowledge-refs.mjs`，接入 `npm run lint` 或 `npm run build`。
**前置条件**：无 schema 依赖，是一个独立的、低风险的新增脚本，可作为测试安全网的一部分优先执行。
**冲突文件**：`data/knowledge.ts`、`data/insights.ts`、`data/concept-boundaries.ts`、`data/problems.ts`。**优先级**：P2

### PROB-005

**当前实现**：legacy `VerificationStatus`（见 `SOL-001`）通过 `Problem.solutions[].verification` 间接暴露给每一个 Problem 消费方（因 `PROB-002` 的内嵌关系），`components/ProblemCard.tsx:113/129` 直接读取展示。
**违反的原则**：原则 4；原则 2/3（附带）。**风险**：与 `SOL-001`/`SOL-005` 同源，附加影响是"每一次 Problem 读取"都会传播这个问题。
**目标状态/建议动作**：同 `SOL-001`；本项会随 `SOL-001` 的修复自动缓解。
**前置条件**：依赖 `SOL-001`。
**冲突文件**：`lib/types.ts`、`components/ProblemCard.tsx`。**优先级**：P2

### AUTHZ-005

**当前实现**：`lib/supabase.ts:1-6` 是第三个匿名 Supabase 客户端构造器（模块加载时 eager 实例化），repo 内 grep 确认零调用方。
**违反的原则**：原则 5（能力边界从未收敛,留下死代码）。**风险**：低（死代码），但若被误用会在缺少环境变量时于 import 时刻直接抛错，行为不同于其余两个客户端。
**目标状态**：只保留 `supabase-public.ts`/`supabase-client.ts` 两个文档化的客户端。
**建议动作**：确认零调用后删除；或写明保留原因。
**前置条件**：删除前需要一次全仓库（含构建脚本）的最终 grep 确认，风险很低但要走一遍确认流程。
**冲突文件**：`lib/supabase.ts`。**优先级**：P2

### AUTHZ-006

**当前实现**：`lib/security.ts` 全部内容是投稿图片/文本校验（`MAX_IMAGE_BYTES`、`clampText`、`isPublicSubmissionImageUrl`），与"security"这个通用名字不符。
**违反的原则**：原则 5（易成为未来真正安全代码和输入校验代码混杂的诱因）。**风险**：低,主要是命名误导。
**目标状态**：改名为 `lib/submission-validation.ts` 一类更贴切的名字。**建议动作**：重命名 + 更新两个调用方 import。
**前置条件**：无。**冲突文件**：`lib/contests.ts`、`lib/publish-submission.ts`。**优先级**：P2

### PUB-002

**当前实现**：`lib/publish-submission.ts:289-305` 硬编码默认 `SolutionScores`（全 8 分）和默认 `Verification` 脚手架；`lib/promote-problem-draft.ts:83-89` 独立硬编码默认 `learning_guide`。
**违反的原则**：原则 5（Publishing 积累了本该属于 Solution/Problem 域的业务默认值知识）。**风险**：Solution 域若调整默认评分/验证脚手架的定义，`publish-submission.ts` 不会自动同步。
**目标状态**：默认值函数由 Solution/Problem 域拥有，Publishing 调用。
**建议动作**：抽出 `defaultSolutionScores()`/`defaultVerification()` 到 `lib/solution-kinds.ts` 或新的 `lib/solution-defaults.ts`。
**前置条件**：与 `SOL-001` 的重命名协调（默认 `Verification` 脚手架的字段会变化）。
**冲突文件**：`lib/publish-submission.ts`、`lib/promote-problem-draft.ts`。**优先级**：P2

### STOR-001

**当前实现**：`components/SubmitForm.tsx:917-950` 与 `components/EditSubmissionForm.tsx:277-304` 独立实现完全相同的上传路径拼接 + `supabase.storage.upload` + `getPublicUrl` 序列。
**违反的原则**：原则 5；原则 6。**风险**：bucket 名/路径约定必须手工在两处保持同步，`lib/security.ts` 的 `isPublicSubmissionImageUrl()` 依赖这个约定但没有共享常量强制保证。
**目标状态**：单一 `uploadSubmissionImage()` 接口。**建议动作**：抽取共享 helper，两个组件复用；导出 bucket/路径常量供校验函数引用。
**前置条件**：无。**冲突文件**：`components/SubmitForm.tsx`、`components/EditSubmissionForm.tsx`、`lib/security.ts`。**优先级**：P2

### SEARCH-001

**当前实现**：`components/ProblemExplorer.tsx:158-187` 对全量拉取的 `ProblemSummary[]` 做客户端 `.filter()`/`.includes()`；`app/library/page.tsx:18-47` 重复同样模式；均无服务端查询下推、无分页、无相关性排序、中文子串匹配无分词。
**违反的原则**：原则 5（"搜索"作为一个能力名不副实,不存在真正隔离的实现可供审计）。**风险**：数据量增长后的可扩展性问题，非当前架构违规的主因。
**目标状态**：若确有需要，建立真正的服务端 Search 能力；否则在文档中明确这只是列表过滤，不称为"搜索"。
**建议动作**：产品先决定是否需要真正的搜索能力。
**前置条件**：产品决策优先于技术动作。
**冲突文件**：`components/ProblemExplorer.tsx`、`app/library/page.tsx`。**优先级**：P2

### PLAT-003

**当前实现**：全仓库 grep `notif|Notif|sendEmail|webhook` 零匹配；唯一相关机制是 `LeanVerificationWorkspace.tsx:64` 的客户端轮询（不持久化、关闭标签页即失效）。
**违反的原则**：原则 5（完全缺失，非分散）。**风险**：产品能力缺口，非当前架构风险；但若仓促补上容易重蹈 `PLAT-001` 的三次独立实现覆辙。
**目标状态**：见 domain-map.md 的 Notifications 定义。**建议动作**：无代码可改,列入设计待办,并明确要求"第一次实现时就作为独立能力，不要内联到 publish-submission.ts/verification-service.ts"。
**前置条件**：产品排期驱动，非技术前置。**冲突文件**：无。**优先级**：P2

### PLAT-004

**当前实现**：`verification_tasks.status` 的 `queued`/`running` 只是同步 HTTP 请求内（`maxDuration=300`）的瞬时状态，没有真正的后台调度/worker；重试通过创建全新行实现，没有 `retry_of` 血缘列（同 `PLAT-006`）。
**违反的原则**：原则 5（Jobs 能力完全缺失，状态词汇却暗示它存在）。**风险**：当前 AXLE 延迟画像下不是正确性 bug，但未来更长耗时的引擎接入时会缺少可回退的队列机制。
**目标状态**：见 domain-map.md 的 Jobs 定义。**建议动作**：暂不需要真正的异步执行；`retry_of` 列（`PLAT-006`）是眼下唯一值得做的低成本改进。
**前置条件**：真正的 Jobs 能力属于未来按需建设,当前无行动前置；`retry_of` 已在 `PLAT-006` 单独列出。**冲突文件**：`verification/service/verification-service.ts`、`app/api/verifications/route.ts`、`app/api/admin/verifications/[id]/retry/route.ts`。**优先级**：P2

### PLAT-005

**当前实现**：至少 7 个文件（`lib/db.ts`、`lib/publish-submission.ts`、`lib/promote-problem-draft.ts`、`lib/save-proof-graph.ts`、`lib/problem-drafts.ts`、`verification/api.ts`、`app/api/cas/route.ts`）各自用不同前缀约定 `console.error`，无共享 logger，无持久化，无告警聚合。
**违反的原则**：原则 5。**风险**：错误可见性完全依赖各文件作者当时的习惯，无法建立一致的告警/仪表盘。
**目标状态**：共享 `logError(scope, error, context)` 接口。**建议动作**：抽取共享 helper，逐一迁移现有 `console.error` 调用点。
**前置条件**：无 schema 依赖，可独立执行,建议作为测试/检查安全网建设的一部分。
**冲突文件**：见上述 7 个文件。**优先级**：P2
