# 第一批纵向切片：Submissions 领域文件级迁移计划

> 状态：只读规划产物。本文档只描述计划，**不在本轮执行任何文件移动**。
>
> 前置阅读：[`domain-map.md`](./domain-map.md)、[`principle-violations.md`](./principle-violations.md)、[`../MAINTAINABILITY_REFACTOR_PLAN.md`](../MAINTAINABILITY_REFACTOR_PLAN.md) 第 6 节 Phase 2。

## 为什么先做这个切片

1. `docs/MAINTAINABILITY_REFACTOR_PLAN.md` 第 5 节的 git 约束要求"若必须提前并行，只处理与验证分支无交集的投稿领域"——本文档覆盖的全部文件（见下）都不 import `verification/`，也不被 `verification/` import，经 grep 确认零交集。
2. 这是审计中体量最大（`SubmitForm.tsx` 2240 行）但**领域边界最单一**的组件——不像 `AdminContestsView.tsx`/`lib/contests.ts` 那样横跨多个领域，`SubmitForm.tsx` 几乎全部代码都属于 Submissions 这一个应用层切片。
3. 已经发现一个具体、独立可验证的重复实现（`STOR-001`：`SubmitForm.tsx:917-950` 与 `EditSubmissionForm.tsx:277-304` 的图片上传逻辑逐字重复），修复它是这次切片里最小、最安全的一步，适合作为第一个提交。

## 范围内文件

| 文件 | 现状行数 | 在本切片中的角色 |
| --- | --- | --- |
| `components/SubmitForm.tsx` | 2240 | 主体，全部拆分 |
| `components/EditSubmissionForm.tsx` | 681 | 复用 `SubmitForm.tsx` 导出的 UI 原语；图片上传逻辑与 `SubmitForm.tsx` 合并 |
| `lib/submission-errors.ts` | 37 | 原样迁移（已经是纯函数模块） |
| `lib/submission-meta.ts` | 15 | 原样迁移 |
| `lib/submission-rate-limit-actions.ts` | 41 | 原样迁移（server action，仅调用方 import 路径变化） |
| `lib/security.ts` | 40 | 原样迁移 + 改名（见 `AUTHZ-006`） |
| `lib/contest-access.ts` | 81 | **不迁移**——保留在原位，仅被本切片依赖（属于 Arena 领域，Phase 5 处理） |

**明确排除的范围**（不属于本切片，避免范围蔓延）：

- `lib/publish-submission.ts`、`components/AdminSubmissionsView.tsx`：这是"审核/发布"而不是"提交"，属于 `MAINTAINABILITY_REFACTOR_PLAN.md` 的 Phase 3（`domains/submission-review/`），本切片只读它们的字段契约用于核对兼容性，不移动它们的代码。
- `components/StudioWorkspace.tsx`：结构化提交工作台，是一个独立的提交入口，字段形状和 `SubmitForm.tsx` 不同，且不依赖本切片任何一个文件（已核实 `lib/quality-checker.ts` 只被 `StudioWorkspace.tsx` 使用，`SubmitForm.tsx`/`EditSubmissionForm.tsx` 均不 import 它）——留给后续独立评估是否该纳入 `domains/submissions/`。
- `lib/contest-access.ts`：虽被 `SubmitForm.tsx` 依赖，但它是 Arena 领域的公开接口（`computeContestSubmitAccess`），属于 Phase 5 范围，本切片只消费不搬迁。
- `lib/math-normalizer.ts`：跨领域通用文本工具（原属于 `shared/kernel/`，不属于任何单一领域），不属于本切片。

## 目标结构

```text
domains/submissions/
  domain/
    types.ts                    # SubmitMode, SolutionKind, ProblemOption, 各 *Draft 类型
    constants.ts                # KINDS, initialProblemForm, initialVaultForm, initialSolutionForm, VAULT_*
    draft-keys.ts                # contestDraftKey, problemDraftKey, solutionDraftKey, vaultDraftKey, draftHasContent, generalDraftContentKeys
    contest-submission-state.ts  # getContestSubmissionState
    submission-scope.ts          # computeSubmissionScopeKey
    content-builders.ts          # buildProblemMarkdown, buildSolutionMarkdown, buildProblemEditMarkdown, buildSolutionEditMarkdown, toLines
    cooldown.ts                  # formatCooldownRemaining
    validation.ts                # 原 lib/security.ts 内容，改名后落地于此（见下）

  application/
    useDraftAutosave.ts          # 现在分散在 SubmitForm 组件内的 8 个 draft 相关 useEffect/useCallback（合并 contest 与 general 两套，参数化 key/content-keys/表单形状）
    useRateLimitState.ts         # refreshRateLimitState 的 hook 化版本
    submitProblem.ts             # 原 SubmitForm.tsx 内 submitProblem（拆出纯 payload 构造 + repository 调用）
    submitVault.ts               # 原 SubmitForm.tsx 内 submitVault
    submitSolution.ts            # 原 SubmitForm.tsx 内 submitSolution（拆出纯 payload 构造 + repository 调用）
    reviseSubmission.ts          # 原 EditSubmissionForm.tsx 内 handleSubmit 的非 UI 部分（buildProblemPatch/buildSolutionPatch + repository 调用）

  infrastructure/
    draft-store.ts               # readDraft/writeDraft/clearDraft（原样迁移，不改行为）
    submission-repository.ts     # repository 接口定义
    supabase-submission-repository.ts  # insert/update submissions、insert problem_drafts 的实际 Supabase 调用
    submission-image-storage.ts  # 新增：uploadSubmissionImages()，合并 SubmitForm.tsx 和 EditSubmissionForm.tsx 重复的上传逻辑（STOR-001 的修复）
    rate-limit-repository.ts     # refreshRateLimitState 里的 submission_rate_limits 查询

  components/
    SubmitForm.tsx               # 瘦身后的主组件（模式选择 + 组合）
    EditSubmissionForm.tsx
    TextField.tsx
    SelectField.tsx
    TextArea.tsx
    ImageUploadField.tsx
    index.ts                     # 公开入口：re-export SubmitForm, EditSubmissionForm

capabilities/quota/
  submission-errors.ts           # 原 lib/submission-errors.ts（原样迁移，属于 Quota 能力而非 Submissions 领域，见下方说明）
  submission-meta.ts             # 原 lib/submission-meta.ts
  submission-rate-limit-actions.ts  # 原 lib/submission-rate-limit-actions.ts
```

**为什么 `submission-errors.ts`/`submission-meta.ts`/`submission-rate-limit-actions.ts` 去 `capabilities/quota/` 而不是 `domains/submissions/`**：这三个文件描述的是"限流/冷却/预检"这个平台能力在投稿场景下的具体表现，而不是"提交"这个业务动作本身——按 `domain-map.md` 的 Quota 能力定义，它们应该和未来验证域、CAS 域的限流实现并列在 `capabilities/quota/` 下，作为 `PLAT-001`（限流三套独立实现）最终收敛的落点之一。**本轮不要求真的把它们物理搬到 `capabilities/quota/`**——这依赖 `PLAT-001` 的整体设计（尚未评审），本切片执行时这三个文件可以先原地不动，只在 `domains/submissions/` 的调用点上照常 import，等 Quota 能力统一设计完成后再一起搬迁。写在这里是为了不让"投稿切片"的目录结构产生"这几个文件天然属于 submissions"的错误印象。

## 逐项迁移映射（精确到行号）

### A. 纯规则（第一步提取，无 React/Supabase 依赖）

| 源文件:行号 | 函数/常量 | 目标文件 | 备注 |
| --- | --- | --- | --- |
| `SubmitForm.tsx:49-50` | `SubmitMode`, `SolutionKind` | `domain/types.ts` | `SolutionKind` 与 `lib/solution-kinds.ts` 重复定义，迁移时改为从 `lib/solution-kinds.ts` import，不新增第二份定义 |
| `SubmitForm.tsx:52-66` | `ProblemOption` | `domain/types.ts` | |
| `SubmitForm.tsx:125-130` | `ContestDraft` | `domain/types.ts` | |
| `SubmitForm.tsx:206-223` | `ProblemDraft`, `VaultDraft`, `SolutionDraft` | `domain/types.ts` | |
| `SubmitForm.tsx:68-116` | `KINDS`, `initialProblemForm`, `initialVaultForm`, `initialSolutionForm` | `domain/constants.ts` | `initialVaultForm` 的 `year` 默认值用 `String(new Date().getFullYear())`，迁移时保持原样（模块加载期求值，不是运行时逻辑变化） |
| `SubmitForm.tsx:132-145` | `VAULT_SOURCE_TYPES`, `VAULT_DIFFICULTIES`, `VAULT_QUESTION_TYPES` | `domain/constants.ts` | |
| `SubmitForm.tsx:121-123` | `contestDraftKey` | `domain/draft-keys.ts` | key 字符串 `` `pa:cdraft:v1:${contestSlug}:${problemId \|\| "any"}` `` 必须逐字保留 |
| `SubmitForm.tsx:196-204` | `problemDraftKey`, `solutionDraftKey`, `vaultDraftKey` | `domain/draft-keys.ts` | `"pa:draft:v1:problem"`、`` `pa:draft:v1:solution:${problemId \|\| "any"}` ``、`"pa:draft:v1:vault"` 必须逐字保留 |
| `SubmitForm.tsx:179-190` | `draftHasContent`, `generalDraftContentKeys` | `domain/draft-keys.ts` | |
| `SubmitForm.tsx:225-346` | `getContestSubmissionState` | `domain/contest-submission-state.ts` | 依赖外部 import `computeContestSubmitAccess`（`lib/contest-access.ts`，不迁移）和 `getEffectiveProblemStatus`（`lib/types.ts`，Phase 6 处理）——迁移后这两个 import 路径不变 |
| `SubmitForm.tsx:352-364` | `computeSubmissionScopeKey` | `domain/submission-scope.ts` | 必须与 DB 触发器 `enforce_submission_rate_limit()`（023 迁移）计算的 `scope_key` 格式保持一致，迁移时不改变字符串拼接逻辑 |
| `SubmitForm.tsx:366-373` | `formatCooldownRemaining` | `domain/cooldown.ts` | |
| `SubmitForm.tsx:375-403` | `toLines`, `buildProblemMarkdown` | `domain/content-builders.ts` | |
| `SubmitForm.tsx:405-480` | `buildSolutionMarkdown` | `domain/content-builders.ts` | |
| `EditSubmissionForm.tsx:77-82` | `toLines`（重复定义） | 删除，改为 import `domain/content-builders.ts` 的版本 | 与 `SubmitForm.tsx` 的 `toLines`（375-380）逐字比对后确认可合并 |
| `EditSubmissionForm.tsx:84-109` | `buildProblemEditMarkdown` | `domain/content-builders.ts` | |
| `EditSubmissionForm.tsx:111-166` | `buildSolutionEditMarkdown` | `domain/content-builders.ts` | |

### B. localStorage 基础设施（第二步提取）

| 源文件:行号 | 函数 | 目标文件 | 备注 |
| --- | --- | --- | --- |
| `SubmitForm.tsx:147-172` | `readDraft`, `writeDraft`, `clearDraft` | `infrastructure/draft-store.ts` | 原样迁移，`typeof window !== "undefined"` 守卫和吞掉异常的行为必须保留 |

### C. 图片上传基础设施（第三步提取，STOR-001 的修复）

| 源文件:行号 | 函数 | 目标文件 | 备注 |
| --- | --- | --- | --- |
| `SubmitForm.tsx:917-950` | `uploadImages` | `infrastructure/submission-image-storage.ts`，导出为 `uploadSubmissionImages(files, userId, supabase): Promise<string[]>` | 与 `EditSubmissionForm.tsx:277-304` 的内联循环逐字比对确认相同：bucket 名 `"submission-images"`、路径表达式 `` `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}` ``、`.upload()` 选项 `{cacheControl:"3600", contentType:file.type, upsert:false}` 必须逐字保留。合并后两个调用点都改为调用这一个函数。 |
| `EditSubmissionForm.tsx:277-304` | 内联上传循环 | 删除，改为调用 `uploadSubmissionImages` | 注意 `EditSubmissionForm.tsx` 在上传后还有一行 `[...existingImageUrls, ...uploadedUrls].slice(0, MAX_IMAGE_COUNT)` 的合并逻辑（305 行），这一行**不属于**上传函数本身，保留在 `reviseSubmission.ts` / 组件内 |

### D. Supabase 仓储基础设施（第四步提取）

| 源文件:行号 | 函数 | 目标文件 | 备注（精确到列名，供迁移后核对不变） |
| --- | --- | --- | --- |
| `SubmitForm.tsx:952-980` | `submitProblem` 中的 insert 部分 | `infrastructure/supabase-submission-repository.ts`，`insertProblemSubmission(...)` | 写入 `submissions`：`submission_type:"problem"`, `problem_id:null`, `problem_source`, `user_id`, `kind:"standard"`, `title`, `content`, `attachment_urls`, `status:"pending"`；`.insert().select("id, status, failure_reason").single()` |
| `SubmitForm.tsx:986-1009` | `submitVault` 中的 insert 部分 | `infrastructure/supabase-submission-repository.ts`，`insertProblemDraft(...)` | 写入 `problem_drafts`：`id`（客户端生成）, `year`, `region`, `paper`, `number`, `difficulty`, `question_type`, `tags`, `title`, `statement`, `answer`, `notes`, `status:"drafting"`；纯 `.insert()` 无 `.select()` |
| `SubmitForm.tsx:1011-1175` | `submitSolution` 中的 insert 部分 | `infrastructure/supabase-submission-repository.ts`，`insertSolutionSubmission(...)` | 写入 `submissions`：`submission_type:"solution"`, `problem_id`, `draft_problem_id`, `problem_source`, `user_id`, `kind`, `title`, `contest_slug`, `contest_solution_type`, `is_post_contest`, `challenge_target_solution_id`, `challenge_claim`, `challenge_advantages`, `challenge_risk`, `attachment_urls`, `content`, `status:"pending"` |
| `SubmitForm.tsx:632-648` | `refreshRateLimitState` | `infrastructure/rate-limit-repository.ts`，`getRateLimitState(supabase, userId, scopeKey)` | 查询 `submission_rate_limits.cooldown_until`，`.eq("user_id",...).eq("scope_key",...).maybeSingle()` |
| `SubmitForm.tsx:662-667` | 内联 `supabase.auth.getUser()` | 保留在组件/hook 内（认证态是 UI 关注点，不下沉到 repository） | |
| `EditSubmissionForm.tsx:314-318` | `handleSubmit` 中的 update 部分 | `infrastructure/supabase-submission-repository.ts`，`updateSubmission(id, patch)` | `.update(patch).eq("id", submission.id).select("*")` |
| `EditSubmissionForm.tsx:336-369` | `buildProblemPatch` | `application/reviseSubmission.ts` | 纯 payload 构造，写入列：`title`, `problem_source`, `content`, `attachment_urls`, `status:"pending"`, `moderator_notes:null` |
| `EditSubmissionForm.tsx:371-451` | `buildSolutionPatch` | `application/reviseSubmission.ts` | 纯 payload 构造，写入列：`title`, `kind`, `content`, `challenge_claim`, `challenge_advantages`, `challenge_risk`, `attachment_urls`, `status:"pending"`, `moderator_notes:null`；**核对确认**：其写入的 `content.json.solution` 字段集合是 `lib/publish-submission.ts` 的 `publishSolution` 读取字段集合的子集（迁移时不得改变这个子集关系，否则会破坏审核发布流程） |

### E. 应用层用例（第五步提取）

| 源文件:行号 | 内容 | 目标文件 | 备注 |
| --- | --- | --- | --- |
| `SubmitForm.tsx:1177-1245` | `handleSubmit` | `application/submitProblem.ts` / `submitVault.ts` / `submitSolution.ts`（按 mode 分发到三个用例，原函数拆分为编排层） | 原函数目前身兼"编排 + 三选一 dispatch"，拆分后组件只保留极薄的事件处理，调用对应的 `application` 用例 |
| `SubmitForm.tsx:718-882`（8 个 draft 相关 `useEffect`/`useCallback`） | contest draft 与 general draft 的读取/自动保存/恢复/丢弃 | `application/useDraftAutosave.ts` | 这是本切片里改动风险最高的一段——8 个闭包目前直接读写 6 个 `useState`，拆分为参数化 hook 时必须保证：防抖保存的时机（debounce）、`beforeunload` 时的强制 flush、"是否有草稿可恢复"判断逻辑（`draftHasContent`）三者的行为完全不变。建议这一步单独一个 PR，并手工验证草稿保存/恢复/清除的完整用户操作路径后再合并。 |
| `EditSubmissionForm.tsx:258-334` | `handleSubmit` | `application/reviseSubmission.ts` | |

### F. UI 原语（第六步提取，最后做）

| 源文件:行号 | 组件 | 目标文件 |
| --- | --- | --- |
| `SubmitForm.tsx:2050-2077` | `TextField` | `components/TextField.tsx` |
| `SubmitForm.tsx:2079-2111` | `SelectField` | `components/SelectField.tsx` |
| `SubmitForm.tsx:2113-2208` | `ImageUploadField` | `components/ImageUploadField.tsx` |
| `SubmitForm.tsx:2210-2240` | `TextArea` | `components/TextArea.tsx` |

**兼容层要求**：`SubmitForm.tsx` 目前 `export` 了这四个组件，供 `EditSubmissionForm.tsx` 直接 `import ... from "@/components/SubmitForm"` 消费。拆分后，`components/SubmitForm.tsx`（旧路径）必须保留 `export { TextField, SelectField, ImageUploadField, TextArea } from "./index"` 这样的 re-export，直到确认没有其他文件依赖旧路径（迁移前需要先跑一次全仓库 grep `from ["']@/components/SubmitForm["']` 确认调用方清单，目前已知的调用方只有 `EditSubmissionForm.tsx`，但迁移执行时必须重新核实,因为这份清单会随时间变化）。

### G. 命名改动（`AUTHZ-006` 顺带修复）

`lib/security.ts` 改名为 `domains/submissions/domain/validation.ts`（或迁移阶段决定的更贴切名字），因为其内容（`MAX_IMAGE_COUNT`、`isAllowedImage`、`clampText` 等）全部是投稿输入校验，与"安全"这个通用词不符（详见 `principle-violations.md` 的 `AUTHZ-006`）。迁移时：
- 保留 `lib/security.ts` 作为 re-export（`export * from "@/domains/submissions/domain/validation"`），直到所有调用方（已知：`lib/contests.ts` 的 `isPublicSubmissionImageUrl`、`lib/publish-submission.ts` 的 `clampText`/`MAX_TITLE_CHARS`）迁移完毕。
- `isPublicSubmissionImageUrl` 校验的路径模式（`/storage/v1/object/public/submission-images/`）必须和步骤 C 里 `uploadSubmissionImages` 使用的 bucket 名（`"submission-images"`）保持同源——建议在 `submission-image-storage.ts` 里导出一个 `SUBMISSION_IMAGES_BUCKET = "submission-images"` 常量，`validation.ts` 的 `isPublicSubmissionImageUrl` 也引用这个常量，而不是分别硬编码字符串（这是本切片顺带修复 `STOR-001` 风险描述中"bucket 名靠约定而非共享常量保证"这一点的具体做法）。

## 严格保持不变的行为清单（验收基线）

迁移完成后，以下内容必须逐字/逐行为一致，任何差异都视为回归：

1. 四个 localStorage key 的拼接结果：`pa:cdraft:v1:<slug>:<problemId|any>`、`pa:draft:v1:problem`、`pa:draft:v1:solution:<problemId|any>`、`pa:draft:v1:vault`。
2. 图片上传的 bucket 名（`submission-images`）、路径拼接表达式、`.upload()` 的三个选项值。
3. `submissions`/`problem_drafts` 两张表在 insert/update 时写入的列名集合（见上表，逐项列出，不得多写或少写列）。
4. `computeSubmissionScopeKey` 产出的 `scope_key` 字符串格式，必须继续与 `enforce_submission_rate_limit()`（023 迁移）的计算方式一致。
5. `enforce_submission_revision_fields` 触发器允许作者修改的字段集合（`title`/`content`/`kind`/`problem_source`/`attachment_urls`/`challenge_*`）与 `EditSubmissionForm.tsx` 实际提交的 patch 字段集合的对应关系——迁移不得让 patch 里出现触发器会拒绝或静默回滚的字段。
6. 草稿自动保存的防抖时机、`beforeunload` 时的强制保存、"有草稿可恢复"提示的触发条件。
7. 登录要求、cooldown 展示文案、`precheck_failed` 状态的处理路径。

## 建议执行顺序（对应 `MAINTAINABILITY_REFACTOR_PLAN.md` 第 6 节 Phase 2 的"提取顺序"）

1. **提交 1**：新建 `domains/submissions/domain/*`（上表 A 部分），`SubmitForm.tsx`/`EditSubmissionForm.tsx` 改为 import 这些新文件,删除原地定义,不改变任何运行时行为。纯文件搬迁 + import 路径修改,风险最低,适合单独验证。
2. **提交 2**：新建 `infrastructure/draft-store.ts`（上表 B 部分），两个组件改为 import。
3. **提交 3**：新建 `infrastructure/submission-image-storage.ts` 的 `uploadSubmissionImages`（上表 C 部分），**这是唯一一步同时改变两个文件行为一致性的提交**——合并前两处逻辑已经逐字比对确认相同，合并后需要手工验证一次 `SubmitForm.tsx` 提交图片和 `EditSubmissionForm.tsx` 修改图片两条路径均正常。
4. **提交 4**：新建 `infrastructure/supabase-submission-repository.ts`、`infrastructure/rate-limit-repository.ts`（上表 D 部分）。
5. **提交 5**：新建 `application/submitProblem.ts`/`submitVault.ts`/`submitSolution.ts`/`reviseSubmission.ts`（上表 E 部分，除草稿自动保存外）。
6. **提交 6**（单独隔离，风险最高）：`application/useDraftAutosave.ts`——按上文 E 部分的说明,这一步需要手工走查草稿保存/恢复/清除的完整路径。
7. **提交 7**：UI 原语搬迁 + 兼容 re-export（上表 F 部分）。
8. **提交 8**：`lib/security.ts` 改名 + 兼容 re-export（上表 G 部分）。

每个提交必须独立可回滚，符合 `MAINTAINABILITY_REFACTOR_PLAN.md` 第 7 节的提交策略；提交 1-2、7-8 风险最低可以合并加快节奏，提交 3、6 建议保持独立并各自附带手工验证记录。

## 与其他已知违规条目的关系

- 完成本切片后，`principle-violations.md` 的 `STOR-001` 应标记为已修复。
- `AUTHZ-006`（`lib/security.ts` 命名）可以顺带完成，标记为已修复。
- 本切片**不**触及 `AUTHZ-001`（Authorization 收敛）——那是独立的、优先级更高但范围完全不重叠的切片（`MAINTAINABILITY_REFACTOR_PLAN.md` Phase 1.5），建议在本切片之前或与之并行执行，两者互不阻塞。
- 本切片**不**触及 `PUB-001`/`PUB-002`（Publishing 三处写手不一致）——那依赖 Phase 3（`domains/submission-review/`），本切片只做只读核对（见上表 D 关于 `content.json.solution` 字段子集关系的核对要求），不修改 `lib/publish-submission.ts`。

## 分支执行提醒

按 `MAINTAINABILITY_REFACTOR_PLAN.md` 第 5 节的修订内容：当前工作区检出在 `audit/unified-verification-system`（即形式化验证开发分支本身）。本文档描述的 8 个提交**不应在这个分支上执行**——即使范围与验证功能无重叠，也应等验证分支合并回 `main` 后从最新 `main` 切出独立重构分支，或经用户显式确认后从当前 `main`（不含验证分支内容）提前切出。在收到这类确认前，本计划保持"已规划、未执行"状态。
