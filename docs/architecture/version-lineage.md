# 版本血缘：ProblemVersion → SolutionRevision → ProofIRVersion → VerificationRun → VerificationEvidence

> 状态：架构固化文档（第一阶段，只读审计的产物，不含任何 schema 变更）
>
> 本文档只定义目标模型和现状差距，不在本轮执行任何迁移。所有涉及 schema 变更的建议都必须在后续独立设计评审后，作为单独的、可回滚的迁移执行。

## 原则 1 的字面要求

> ProblemVersion → SolutionRevision → ProofIRVersion → VerificationRun → VerificationEvidence 全链路不可变绑定。

"不可变绑定"包含两层要求，缺一不可：

1. **链上每个节点自身不可变**——一旦产生，不能被就地 `UPDATE`；任何"编辑"都必须产生新的版本行，旧版本行保留。
2. **节点之间的引用不可变**——`VerificationRun` 指向的 `ProofIRVersion`、`ProofIRVersion` 指向的 `SolutionRevision`、`SolutionRevision` 指向的 `ProblemVersion`，这些引用一旦写入就不应该因为被引用方后续变化而"跟着漂移"。引用的是某一时刻的快照，不是一个会变化的活动行。

下面逐节点对照现状。

---

## 节点一：ProblemVersion

### 目标

题目的陈述、答案、`proof_graph`、`learning_guide` 等定义性内容，每次编辑产生一个新版本，而不是就地覆盖。下游（`SolutionRevision`、`ProofIRVersion`、`VerificationRun`）引用具体的 `problem_version_id`，而不是 `problem_id`。

### 现状

**完全不存在版本概念。**

- `supabase/migrations/001_initial_schema.sql:14-42` 的 `problems` 表只有 `created_at`/`updated_at`，没有版本/修订列。
- `lib/save-proof-graph.ts:53-58` 对 `problems.proof_graph` 做无条件 `UPDATE ... WHERE id = problemId`，不读取旧值、不留存旧版本、不返回版本号。
- `lib/promote-problem-draft.ts` 的 `promoteProblemDraft` 是一次性 `INSERT`，此后的编辑（例如通过 `saveProofGraph`）仍然是就地覆盖同一行。
- `verification_tasks.problem_id`（`supabase/migrations/024_unified_verification_system.sql:5`）是指向活动行的可空 FK（`ON DELETE SET NULL`），没有版本锚点。

（详见审计 `PROB-001`。）

### 差距的实际影响

一个 `VerificationRun` 的 `problem_id` FK 无法回答"这次验证到底验证的是题目的哪个版本"——如果题目陈述在验证之后被编辑，`VerificationRun` 会静默地"跟着"指向新内容，即使它验证的其实是旧内容。这直接违反原则 1 对"全链路不可变绑定"的要求，且是链条最上游的断裂点。

### 设计方向（供后续独立设计评审，本轮不执行）

- 优先方案：新增 `problems.version INTEGER NOT NULL DEFAULT 1` + 一张 append-only 的 `problem_versions` 表（`problem_id`、`version`、内容快照字段、`created_at`），每次 Problem 领域拥有的写函数执行"内容变更"时，先插入新版本行，再更新 `problems.version` 指针。
- 次优方案（改动更小）：只对 `proof_graph` 单独建立 `problem_proof_graph_versions` 历史表（因为这是当前唯一有实际编辑频率的字段），题目陈述/答案暂缓，先解决使用频率最高的编辑路径。
- 无论哪种方案，都应参照 `verification_tasks` 已经验证过的不可变性实现模式（见下文"不可变性的技术保证"一节），而不是重新发明。

---

## 节点二：SolutionRevision

### 目标

已发布解答的每一次内容修订产生新的版本行；已经被 `ProofIRVersion`/`VerificationRun`/`forkOf` 引用的旧版本永久保留、永不改写。

### 现状

**目前是自然不可变的，但没有显式的版本机制——这是"侥幸安全"而非"设计安全"。**

- `supabase/migrations/001_initial_schema.sql:46-79` 的 `solutions` 表同样只有 `created_at`/`updated_at`。
- 全仓库 grep 未发现任何 `UPDATE solutions` 的调用点——`lib/publish-submission.ts:318` 只有 `INSERT`，且通过 `source_submission_id` 做防重复发布检查。也就是说，**目前解答一旦发布就不能再被编辑**，这恰好符合不可变要求，但这是当前产品未提供"编辑已发布解答"功能的副作用，不是有意的版本化设计。
- `forkOf`（`lib/types.ts:186-190`）是一个解答指向"我是从哪个解答分叉而来"的血缘指针，但只是写入时复制的 `{solutionId, solutionTitle, solutionAuthor}` 字符串快照，`solutionId` 没有 FK 约束，标题/作者不会随目标解答更新而重新解析（详见 `SOL-003`）。

（详见审计 `SOL-006`、`SOL-003`。）

### 差距的实际影响

不是当前的正确性 bug，而是"未来功能的地雷"：一旦产品需要"编辑已发布解答"（这是一个自然的路线图方向），如果没有提前建立 `SolutionRevision`，实现者只有两个选择——就地 `UPDATE`（打破所有已经引用旧内容的 `proof_graph`/`verification_tasks`/`forkOf`），或者从零设计版本机制（没有先例可循，容易和 `ProblemVersion` 的设计不一致）。

### 设计方向

- 在任何"编辑已发布解答"功能上线**之前**，新增 `solution_revisions` 表（或 `solutions.version` + copy-on-write insert），使得 `proof_graph` 的 `solutionIds`、`verification_tasks.solution_id`、`forkOf.solutionId` 都可以未来迁移为引用具体版本而不是活动行。
- `forkOf` 应该升级为 FK 约束的血缘边（`solution_id REFERENCES solutions(id)`），标题/作者在渲染时实时解析，而不是写入时复制字符串——参照 `010_solution_challenges_profile.sql` 里 `challenge_target_solution_id` 已经是真正 FK 的先例。

---

## 节点三：ProofIRVersion

### 目标

Solution 内容、Proof Graph 标注、Verification 提交的源文本三者应该有一个共享的、有版本的中间表示（`ProofIR`），使得"这个证明图节点对应哪个已验证的声明"可以结构化回答。

### 现状

**这是链条中最薄弱的一环：`ProofIR` 作为一个具名产物，在当前代码里完全不存在。**

- 最接近的现有产物是 `problems.proof_graph` JSONB（`011_proof_graph_mvp.sql:16`），但它是单个可变字段，`lib/save-proof-graph.ts` 每次保存都是整体覆盖，没有版本号、没有历史表。
- `ProofObservation.relatedSolutionIds`、`ProofStrategyBranch.solutionIds`、`ProofTransformation.solutionId`、`ProofChallengeEdge.challengerSolutionId/targetSolutionId`（`lib/types.ts:412-467`）全部是裸字符串引用，没有 FK、没有写入时存在性校验。
- Verification 侧则完全不知道 Proof Graph 的存在：`verification/service/verification-service.ts:96-98` 把 API 请求里的原始文本（`request.source`）逐字透传给 Lean 引擎（`verification/providers/axle/axle-provider.ts:62` 的 `content: request.source`），CAS 侧（`api/cas_service.py`）同样直接用 SymPy 解析原始步骤字符串。两条验证路径都不经过任何"ProofIR"中间表示。

（详见审计 `SOL-002`、`VER-004`。）

### 差距的实际影响

Solution 内容、Proof Graph 标注、Verification 结果三者是三条完全独立演化的数据线，没有任何结构化机制能回答"证明图的这个节点对应验证记录的哪一次运行"。这不是一个可以靠一次 schema 补丁解决的问题——它需要一个独立的设计阶段，明确 `ProofIR` 到底承载什么信息（是 Lean 声明列表？是证明图节点到验证步骤的映射？）。

### 设计方向

- **不建议**在本轮或下一轮直接实现 `ProofIRVersion`——应先输出一份独立的 `ProofIR` 设计文档（明确它的字段、谁写入、谁读取），再迁移。
- 短期可执行的、风险更低的过渡步骤：
  1. 给 `proof_graph` 增加版本历史（复用节点一的机制），至少让"证明图曾经长什么样"可追溯。
  2. 给 `proof_graph` 里的 `solutionId` 类引用加上写入时存在性校验（应用层校验即可，不必现在就上 FK），先把"引用不可能是垃圾字符串"这个最低保证做到。
  3. 暂不强求 Verification 消费 `ProofIR`——继续接受原始文本输入，但在 `verification_tasks` 增加一个可空的 `proof_ir_version_id` 预留列（类似 `024` 迁移里已经预留的 `problems.lean_statement_version`），为未来打通留出接口，不阻塞当前功能。

---

## 节点四：VerificationRun

### 目标

每一次验证执行是一条不可变记录，绑定到具体的 `ProofIRVersion`（或过渡期的 `SolutionRevision`/`ProblemVersion`），而不是绑定到会变化的活动行。

### 现状

**这是全链条中实现得最好的一环，但绑定关系仍然指向活动行而非版本。**

好的部分（应作为其余节点的参照范式）：

- `verification_tasks.status`（`queued|running|completed|failed|cancelled`）和 `verdict`（`accepted|rejected|invalid_request|timeout|rate_limited|resource_limit|provider_error|cancelled`）已经是两个独立字段，加上四个 CHECK 约束（终态必有 verdict、running 必有 started_at、cached 必有 cache_source_id、accepted 必然 valid 且无 failed_declarations）——这是"不可变性靠 schema 约束保证，而不是靠约定"的正确范式。
- RLS 层面对 `verification_tasks` **没有任何角色的 INSERT/UPDATE/DELETE 策略**，所有写入必须经过 service-role，这是防止绕过应用层校验的第二道防线。
- `finish()`（`verification/repositories/supabase-verification-repository.ts:144-154`）只会把 `queued`/`running` 的行转成终态，从未在已有终态行上再次调用——重试（retry）会创建一条全新的行而不是修改旧行（`app/api/admin/verifications/[id]/retry/route.ts:24-28`）。这是"不可变性靠代码路径设计保证"的正确范式。

差距：

- `problem_id`/`solution_id`/`submission_id` 是指向活动行的可空 FK（`ON DELETE SET NULL`），不是指向版本的 FK。`019_submission_author_revision.sql` 显示 `submissions.content` 可以在作者重新提交时被就地编辑（`content` 不在触发器的字段回滚白名单里），意味着一条 `verification_tasks` 行的 `submission_id` 在验证完成后可能悄悄指向已经变化的内容（详见 `VER-001`）。
- `source_hash`/`source_snapshot` 目前只用于**缓存去重**（`normalization.ts` 的 `createSourceHash`），不作为"这次运行验证的到底是哪个版本"的权威锚点，也没有任何读路径拿它去和当前 `submissions.content`/`solutions.*` 做一致性核对。
- 重试产生的新行与原任务行之间没有 `retry_of` 之类的血缘列（`PLAT-006`）。

（详见审计 `VER-001`、`PLAT-006`。）

### 设计方向

- 短期（风险最低、不改变现有语义）：新增 `verification_tasks.retry_of UUID REFERENCES verification_tasks(id) ON DELETE SET NULL`，让重试血缘可查询——这是本文档中优先级最高、改动面最小的一条具体建议。
- 中期：一旦节点一/节点二建立版本机制，把 `verification_tasks` 的 `problem_id`/`solution_id`/`submission_id` 逐步扩展为同时记录 `problem_version_id`/`solution_revision_id`（新增列，不删除旧列），读路径优先使用版本化的列。
- 在版本机制落地前的过渡期，至少应该在读取 `verification_tasks` 展示结果时，比较 `source_hash` 与当前内容重新计算的 hash 是否一致，UI 上明确标注"验证结果可能已过期"，把不可检测的静默漂移变成可见的过期提示。

---

## 节点五：VerificationEvidence

### 目标

每一次 `VerificationRun` 附带的证据（消息、失败声明、覆盖范围、耗时、环境、假设）本身也不可变。

### 现状

**已经足够好，可以视为满足要求，无需改动。**

`verification_tasks` 把证据作为运行记录自身的字段而不是单独的表（`messages`/`failed_declarations`/`duration_ms`/`source_hash`/`source_snapshot`/`provider_request_id`/`environment`/`result_metadata`），这是一个合理的实现选择——只要运行记录本身不可变（已经满足，见节点四），证据就自动不可变。不需要拆成独立的 `VerificationEvidence` 表。

唯一的现状缺口（非阻塞，记录供未来参考）：

- `resultMetadata`（JSONB 预留列）目前没有任何写入路径实际填充它（`axle-provider.ts` 的返回对象从不设置该字段）。
- Provider/引擎版本号没有被捕获——如果 AXLE 的检查逻辑在两次调用之间发生变化但 `source_hash` 相同，缓存层会把旧结果当作仍然有效的新结果返回，因为 `VERIFICATION_POLICY_VERSION` 是手动维护的常量而不是与 provider 实际版本绑定。

（详见验证深挖调研，未单独立案为违规，因为不直接违反六条原则中的任何一条，但会削弱"证据"本身的完整性，建议在后续实现覆盖度/证据等级模型时一并考虑，见 [verification-semantics.md](./verification-semantics.md)。）

---

## 不可变性的技术保证：从 verification_tasks 提炼的可复用模式

`verification_tasks` 是目前唯一被验证过、真正做到不可变的表，其技术手段可以直接复用到未来的 `problem_versions`/`solution_revisions`/`proof_ir_versions`：

1. **RLS 默认拒绝所有角色的写权限**，写入只能通过 service-role（绕过 RLS）完成，杜绝客户端直接篡改历史记录。
2. **CHECK 约束作为第二道防线**，即使信任 service-role 路径，也用数据库约束保证关键不变式（终态必有结论、running 必有开始时间等），防止应用层代码的 bug 破坏数据完整性。
3. **代码路径设计上"新建而非修改"**：重试/修订通过创建新行实现，旧行永不在正常业务路径上被再次 `UPDATE`。
4. **自引用血缘 FK**（`cache_source_id`）而不是靠命名约定或事后比对推断关系。

新建 `problem_versions`/`solution_revisions`/`proof_ir_versions` 时，应逐条对照这四条,而不是简单加一个 `version` 整数列就宣称"已版本化"。

---

## 迁移优先级建议（供后续设计评审排序，本轮不执行任何一条）

| 优先级 | 动作 | 理由 |
| --- | --- | --- |
| 最高、改动最小 | `verification_tasks.retry_of` FK | 单列新增，不影响现有读写路径，直接把 `PLAT-006` 从"P1 记录问题"变成"已修复" |
| 高 | 读时比对 `source_hash` 与当前内容，UI 标注可能过期 | 不需要 schema 变更，只是读路径增加一次哈希重算和一个 UI 状态 |
| 高，但需独立设计 | `problem_versions` / `solution_revisions` 历史表 | 是节点一/二的地基，其余节点的版本化都依赖它先存在 |
| 中，依赖上一条 | `ProofIR` 设计文档 + 过渡期预留列 | 范围最不确定，必须先有独立设计文档，不能直接动手写 schema |

以上任何一条进入实施前，都必须先有独立的、聚焦单一切片的迁移计划（参照 `docs/MAINTAINABILITY_REFACTOR_PLAN.md` 的分阶段纪律），且不得在形式化验证分支仍在开发时对 `verification_tasks` 做破坏性 schema 变更。
