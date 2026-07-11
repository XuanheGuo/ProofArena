# 验证语义：运行状态、数学结论、覆盖度、证据等级、假设与局限

> 状态：架构固化文档（第一阶段，只读审计的产物，不含任何 schema/代码变更）

## 原则 4 的字面要求

> 验证表达运行状态、数学结论、覆盖度、证据等级、假设和局限，不使用单一可信度分数。

```text
VerificationRunStatus: queued | running | succeeded | failed | timed_out | cancelled
VerificationConclusion: verified | refuted | inconclusive | unsupported | not_assessed
error 不是数学结论。
```

这条原则要求验证结果是一个**多维记录**，而不是一个标量。下面先评估现状哪些维度已经存在、哪些完全缺失，再给出目标字段模型。

## 现状评估：五个维度逐一对照

### 1. 运行状态（已部分实现，需要改名对齐）

`verification_tasks.status`（`queued|running|completed|failed|cancelled`，`verification/domain/types.ts:7`）已经是一个独立于结论的字段，语义上接近 `VerificationRunStatus`，但：

- 词汇不完全对齐目标枚举——目标要求 `succeeded`/`timed_out` 显式区分，现状的 `completed`/`failed` 把"运行成功但数学上被拒绝"和"运行本身失败"混在了状态与结论两个字段的交界处（见下一条）。
- `timed_out` 在当前模型里不是独立的运行状态，而是被塞进了 `verdict` 枚举（`timeout` 值）。

### 2. 数学结论（已被"运行细节"污染，是本文档要修复的核心问题）

`verification_tasks.verdict`（`accepted|rejected|invalid_request|timeout|rate_limited|resource_limit|provider_error|cancelled`）**同时**承担了两种完全不同性质的信息：

- 真正的数学结论：`accepted`（对应 `verified`）、`rejected`（对应 `refuted`）。
- 运行层面的失败原因：`timeout`、`rate_limited`、`resource_limit`、`provider_error`、`cancelled`——这些描述的是"验证器没能得出结论"，本身不是结论。
- `invalid_request`：语义上暧昧——可能是"提交的证明格式不对，验证器判断不了"（更接近结论层面的 `unsupported`），也可能是"请求本身有问题"（更接近运行层面）。

`verification/ui-meta.ts:15-17` 已经用注释显式提醒后来者"`provider_error` 是基础设施失败，不是对证明的判断，不能读成 rejected 的近似值"——**这条注释本身就是原则 4 要修复的证据**：一个需要靠 UI 层注释才能维持的区分，说明底层数据模型没有把它结构化表达出来。`verification/repositories/supabase-verification-repository.ts:92-100` 的 `recoverStale()` 把僵死任务写成 `verdict:'provider_error'`，与 `accepted`/`rejected` 共享同一列、同一组 CHECK 约束，进一步坐实了这个问题（详见审计 `VER-002`，已对抗性验证为 CONFIRMED）。

此外，Solution 上还存在一个完全独立、更原始的"结论"概念：`lib/types.ts:17` 的 `VerificationStatus = 'verified' | 'partial' | 'manual'`，这是编辑式的人工断言，不区分运行状态和数学结论（因为它压根没有运行的概念——它只是表单里的一个下拉框默认值，`lib/publish-submission.ts:297-305` 甚至会在投稿没填这个字段时自动填充 `status: 'manual'`）。这个字段与 `verification_tasks` 完全不连通，却共享"verified"这个词，是当前系统里对原则 4 最严重的违反（详见审计 `SOL-001`、`SOL-005`，均已对抗性验证为 CONFIRMED，且是本轮 10 项 P0 里的两项）。

### 3. 覆盖度（部分存在，未被结构化为"覆盖度"）

`failed_declarations: string[]`（`verification/domain/types.ts:45`）记录了具体哪些声明验证失败——这本质上是一个覆盖度信号（"提交的 N 个声明里，这些失败了"），但目前只是一个字符串列表，没有配套的"总声明数"，无法直接读出"验证覆盖了多少比例"。

### 4. 证据等级（完全缺失）

当前系统里实际上存在三种证据强度完全不同的"验证"，但没有任何字段表达它们的等级差异：

- **机器完整核验**（Lean via AXLE）：`verification_tasks` 记录的完整证明检查，证据等级最高。
- **符号/数值抽查**（CAS）：`api/cas_service.py` 对单个代数步骤做 SymPy 等价性判断，证据等级中等，且结果目前完全不持久化（详见审计 `VER-005`）。CAS 的返回值里已经有一个三态 `valid: boolean | null`（`lib/cas-client.ts:23`，`None` 代表"无法判定"/"条件性成立"），这其实已经是"不确定性作为独立结论类别"的雏形，只是没有被纳入统一模型。
- **编辑式人工断言**（`Solution.verification`）：证据等级最低，是作者/审核员的主观判断，不是机器核验。

原则 4 要求的"证据等级"字段应该能区分这三者，而不是让它们共用"verified"这个视觉徽章。

### 5. 假设与局限（部分存在于零散字段，未系统化）

`environment`（AXLE/Mathlib 环境标识）和最近提交历史中的 `ignore_imports` 披露（见 `e84cd20 AXLE provider: fail closed on incomplete responses, disclose ignore_imports`）已经是"假设/局限"维度的雏形，但目前分散、非结构化，没有统一的 `assumptions[]`/`limitations[]` 表达。超时预算（policy 里的 timeout 常量）也是一种应披露的局限，目前只影响行为，不出现在结果记录里供 UI 展示。

### 单一可信度分数：确认不存在，需要保持这个状态

全仓库 grep 确认 `verification/`、`components/VerificationPanel.tsx`、`components/CASVerifier.tsx`、`lib/cas-client.ts`、`api/cas_service.py`、`verification_tasks` schema 中都没有 `confidence`/`trustScore`/`confidenceScore` 之类的标量字段。仅有的两处 `confidence: number` 字段（`TagMatch.confidence`、`ThinkingCues.confidence?`）是完全无关的教学标签匹配/作者自评概念，不会被验证路径读写。**这是现状中值得保留的正确设计，本文档的目标模型必须继续避免引入任何标量可信度字段**，包括在 UI 层做"加权平均"这类操作——任何试图把 run_status/conclusion/evidence_level/coverage 压缩成一个分数的需求都应该被拒绝。

---

## 目标字段模型

在**不破坏现有 `status`/`verdict`/`valid` 列**的前提下（新增列，不删除旧列，符合渐进式重构纪律），建议的目标模型：

```text
run_status      VerificationRunStatus   queued | running | succeeded | failed | timed_out | cancelled
conclusion      VerificationConclusion  verified | refuted | inconclusive | unsupported | not_assessed
evidence_level  text                    machine_checked | symbolic_spot_check | editorial_claim
coverage        jsonb                   { checked: number, total: number, failedDeclarations: string[] }
assumptions     jsonb                   [{ kind: 'environment' | 'ignored_imports' | 'timeout_budget' | ..., detail: string }]
```

### 从现状字段到目标字段的映射（供后续独立迁移设计参考）

| 现状 `status` | 现状 `verdict` | 目标 `run_status` | 目标 `conclusion` |
| --- | --- | --- | --- |
| `queued` | — | `queued` | `not_assessed` |
| `running` | — | `running` | `not_assessed` |
| `completed` | `accepted`（且 `valid=true`） | `succeeded` | `verified` |
| `completed` | `rejected` | `succeeded` | `refuted` |
| `completed` | `invalid_request` | `succeeded` | `unsupported`（验证器成功运行，但判断"这不是它能评估的东西"） |
| — | `timeout` | `timed_out` | `not_assessed` |
| `failed` | `rate_limited` / `resource_limit` / `provider_error` | `failed` | `not_assessed` |
| `cancelled` | `cancelled` | `cancelled` | `not_assessed` |

CAS 路径的三态 `valid: boolean | null` 映射：`true → verified`、`false → refuted`、`null → inconclusive`（"无法判定"，区别于 `unsupported` 的"这类输入根本不支持判定"）。

Solution 上 legacy 的 `VerificationStatus`（`verified|partial|manual`）**不参与这套映射**——它应该被重新命名为一个明确标注"作者/审核员断言，非机器核验"的字段（例如 `editorialClaim`），并在 `evidence_level` 维度上永远标记为 `editorial_claim`，不得再共用 "verified" 这个词。

---

## UI 呈现规则

1. 任何展示验证结果的 UI 组件，必须能同时访问 `run_status` 和 `conclusion` 两个字段，不得只读一个。`verification/ui-meta.ts` 现有的 `getVerificationDisplay` 已经在事实上这样做（分别处理 `status` 优先、`verdict` 次之），目标模型下应该显式改为读 `run_status`/`conclusion` 两个字段，而不是继续从合并语义的 `verdict` 里推断。
2. **`error 不是数学结论`**：任何 `run_status` 不是 `succeeded` 的记录，`conclusion` 必须是 `not_assessed`，UI 不得用与 `refuted` 相同的视觉语言（红色/"证明有误"类文案）渲染 `failed`/`timed_out`/`cancelled` 的记录。这是一条应该在数据库层用 CHECK 约束强制的不变式（参照 `verification_tasks_terminal_verdict_check` 的先例）。
3. `evidence_level` 必须在徽章旁始终可见，不能只在 hover/详情页才展示——尤其是 `editorial_claim` 等级的结果，不能和 `machine_checked` 等级视觉上等价，这是修复 `SOL-005`（两套验证系统在同一个 Solution 上互不相认）的核心 UI 要求。
4. 不得引入任何形式的"综合评分"展示（例如把 conclusion + coverage + evidence_level 加权成一个百分比或星级）——这正是原则 4 明确禁止的"单一可信度分数"，即使它是从多维字段计算出来的展示层聚合，也违反原则精神。

---

## 与三套验证系统整合的语义要求（关联 SOL-005 / VER-005）

原则 4 的字段模型不要求三套系统（`verification_tasks`、legacy `Solution.verification`、CAS）立即合并成一张表，但要求：

- 如果三者继续并存，**必须在 `evidence_level` 维度上明确标注各自等级**，且 UI 不得让用户在不查看 `evidence_level` 的情况下混淆三者的可信程度。
- 更推荐的方向（非本轮执行范围，供后续设计参考）：让 CAS 的结果写入 `verification_tasks`（schema 已经预留 `engine IN ('lean','cas','numerical','z3')`、`provider IN (...,'sympy',...)`，不需要 schema 变更即可承载），使其获得与 Lean 路径同等的持久化、run_status/conclusion 分离、不可变性保证；legacy 的 `Solution.verification` 逐步降级为"作者断言"展示，不再使用"verified"字样。

---

## 本文档明确不做的事

- 不修改 `verification_tasks` 的任何列。
- 不修改 `verification/domain/types.ts` 的任何枚举。
- 不合并 CAS/legacy Verification 到 `verification_tasks`。

以上都需要独立的设计评审和迁移计划，且必须遵守"不在形式化验证分支仍在开发时对 `verification_tasks` 做破坏性变更"的既有约束（详见 `docs/MAINTAINABILITY_REFACTOR_PLAN.md` 第 5 节）。本文档的产出是字段模型和映射表，供该设计评审直接引用。
