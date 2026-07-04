# Proof Graph MVP 执行指挥文档

本文把 `PROOF_GRAPH_TRANSFORMATION.md` 压缩成第一轮可开发、可验收、可交给 Claude Code 执行的 MVP 任务。目标不是一次实现完整宏大图谱，而是先做出 3 道旗舰题的不可替代体验。

## 0. MVP 目标

Proof Graph MVP 只服务一条核心路径：

```text
看题 -> 比较不同路线 -> 理解为什么这样选 -> 挑战/提交自己的解法 -> 审核沉淀为结构化推理资产
```

第一轮完成后，用户在重点题详情页应能清楚看到：

- 这道题有哪些思路入口。
- 每条解法的关键转化是什么。
- 哪些方法看起来能用但不优先。
- 不同解法在考场性、结构美感、计算量和讲解友好度上的差异。
- 如何提交一条挑战现有解法的新路线。

## 1. 非目标

本轮不要做：

- 图数据库。
- pgvector 相似推荐。
- 小程序、IM 机器人、桌面端。
- 完整 Git 式 fork/diff/merge。
- 自动生成大量题解。
- 用户风格画像的复杂算法。
- 全站题目一次性完整改造。

这些方向保留在长期路线里，但不能阻塞 MVP。

## 2. 实施原则

1. **先类型契约，再 UI，再持久化增强。**
   先让静态 fallback 能完整表达 Proof Graph v1，然后再把 Supabase mapper、投稿审核和发布路径跟上。

2. **先 3 道旗舰题，不追求全量覆盖。**
   优先选择已有多解法、已有方法边界或图像/CAS 雏形的题。样板质量比题量重要。

3. **先结构化列表，不急着画复杂节点图。**
   Proof Graph v1 的第一版可以是思路树、比较矩阵、推理回放和方法边界卡片，不要求 canvas/SVG 网络图。

4. **审核后台是生产线，不是附属功能。**
   前台展示的每个结构字段，最终都应该能被审核员编辑、保存和发布。

5. **保持静态 fallback。**
   没有 Supabase 环境变量时，重点题页必须仍然可用。

## 3. Proof Graph v1 数据契约

在 `lib/types.ts` 增加最小契约。字段名应稳定、可被静态数据和 Supabase JSONB 共用。

建议结构：

```ts
export interface ProofObservation {
  id: string;
  title: string;
  signal: string;
  whyItMatters: string;
  relatedSolutionIds: string[];
}

export interface ProofStrategyBranch {
  id: string;
  observationId: string;
  title: string;
  promise: string;
  risk: string;
  methodBoundaryIds?: string[];
  solutionIds: string[];
}

export interface ProofTransformation {
  id: string;
  solutionId: string;
  title: string;
  from: string;
  to: string;
  justification: string;
  complexityReduction: string;
}

export interface ProofVerificationStep {
  id: string;
  solutionId: string;
  type: "substitution" | "boundary" | "equality" | "numeric" | "cas" | "manual";
  statement: string;
  status: VerificationStatus;
  note: string;
}

export interface ProofMethodBoundary {
  id: string;
  methodName: string;
  whyTempting: string;
  whyNotPriority: string;
  whereItBreaks: string;
  whenItWorks: string;
  relatedConcepts: string[];
}

export interface ProofChallengeEdge {
  id: string;
  challengerSolutionId: string;
  targetSolutionId: string;
  claim: string;
  advantages: string[];
  risk: string;
  reviewerNote?: string;
}

export interface ProofGraphV1 {
  observations: ProofObservation[];
  branches: ProofStrategyBranch[];
  transformations: ProofTransformation[];
  verificationSteps: ProofVerificationStep[];
  methodBoundaries: ProofMethodBoundary[];
  challengeEdges: ProofChallengeEdge[];
}
```

Then add `proofGraph?: ProofGraphV1` to `Problem`.

Do not delete existing fields such as `solutionTree`, `thinkingCues`, `whyNotMethods`, `challenge`, or `verification`. MVP should derive or display from both old and new fields until the new contract proves stable.

## 4. 旗舰题选择

Claude Code should inspect `data/problems.ts` and pick 3 problems with the strongest existing material. Prefer problems that already have:

- At least 2 existing solutions.
- Distinct solution kinds.
- Existing `solutionTree`, `whyNotMethods`, `conceptLinks`, or `verification`.
- A meaningful contrast between exam-ready and elegant routes.

Expected output of the selection step:

```text
Selected flagship problems:
1. <problemId> - reason
2. <problemId> - reason
3. <problemId> - reason
```

Do this before writing broad data.

## 5. Frontend MVP

### 5.1 Problem detail first screen

Owner: `components/ProblemDetailExperience.tsx`

Add a compact Proof Graph summary near the top of the detail page:

- 思路入口 count.
- 方法分支 count.
- 关键转化 count.
- 方法边界 count.
- 挑战关系 count.
- A clear CTA to submit/challenge a solution.

This should reinforce that the page is an arena for comparing routes, not a static answer page.

### 5.2 Solution comparison matrix

Create or extract a component such as:

```text
components/ProofGraphMatrix.tsx
```

Input:

```ts
problem: Problem
```

Display rows as solutions and columns as:

- 正确性
- 考场性
- 结构美感
- 计算量
- 讲解友好
- 关键转化
- 风险
- 最适合用户

Use existing `Solution.scores`, `keyTransform`, `tradeoffs`, `limitations`, and `suitableFor`. If `proofGraph.transformations` exists, prefer it for the key transform summary.

Mobile requirement:

- Do not render a wide broken table.
- Use cards or horizontally scrollable columns with stable widths.

### 5.3 Reasoning replay

Create a component such as:

```text
components/ReasoningReplayPanel.tsx
```

It should render:

```text
看到什么条件 -> 可能想到哪些路线 -> 排除/降级哪些路线 -> 为什么某条路线变好 -> 关键转化 -> 如何验证
```

Use `proofGraph.observations`, `branches`, `transformations`, `verificationSteps`, and `methodBoundaries`.

This is the most important MVP experience. It should feel like the proof was discovered, not merely printed after the fact.

### 5.4 Method boundary upgrade

Existing `ConceptBoundaryPanel` and `whyNotMethods` should remain usable. Add a bridge so `proofGraph.methodBoundaries` can also feed the same section or a new focused section.

Requirement:

- Each boundary must answer why the method is tempting, why it is not priority, where it breaks, and when it works.

### 5.5 Challenge edge display

Add a compact section on the problem page:

- Challenger solution.
- Target solution.
- Claim.
- Advantages.
- Risk.
- Reviewer note if present.

Do not build a voting system in MVP unless already easy from existing data.

## 6. Submission and review MVP

### 6.1 Submit form

Owner: `components/SubmitForm.tsx` and/or `components/StudioWorkspace.tsx`

Do not make the public form huge. Add lightweight prompts for:

- 我先看到的条件。
- 关键转化。
- 我这条路线比已有解法强在哪里。
- 风险或局限。
- 可验证步骤。

Map these into `content.json.solution` under stable keys that can later become `ProofGraphV1`.

### 6.2 Admin review

Owner: `components/AdminSubmissionsView.tsx`

Add editable fields for the MVP graph parts:

- observation title / signal / whyItMatters
- transformation from / to / justification
- method boundary
- challenge claim / advantages / risk
- verification step

Requirement:

- Reviewer can edit before approving.
- Existing card preview still works.
- `moderator_notes` remains required.

### 6.3 Publishing

Owner: `lib/publish-submission.ts`

When approving a solution, preserve graph-related JSON under the solution or problem payload. Avoid lossy conversion back to Markdown-only content.

## 7. Supabase MVP

Do not create many relational tables in the first pass.

Recommended first persistence model:

- Add a nullable `proof_graph jsonb` column to `problems` if the database problem row is the owner.
- Optionally add graph-related JSON inside `solutions.content` or equivalent if current schema makes solution ownership easier.

Only split into relational tables after the UI and editorial workflow stabilize.

Migration requirements:

- Use a new numbered migration.
- Use `ADD COLUMN IF NOT EXISTS`.
- Do not break old rows.
- Ensure public read policy covers published graph data.
- Keep submission review private.

## 8. Claude Code execution pattern

Use Claude Code in cycles rather than one giant prompt.

### Cycle 1: discovery and flagship selection

Prompt:

```text
Read docs/PROOF_GRAPH_TRANSFORMATION.md, docs/PROOF_GRAPH_MVP_EXECUTION.md, lib/types.ts, data/problems.ts, components/ProblemDetailExperience.tsx, components/AdminSubmissionsView.tsx.
Select 3 flagship problems for Proof Graph MVP and explain why. Do not edit files yet.
```

Expected result:

- Problem IDs.
- Existing assets.
- Content gaps.
- Proposed first graph fields.

### Cycle 2: type contract and static data

Prompt:

```text
Implement ProofGraphV1 types in lib/types.ts and add proofGraph data for the 3 selected flagship problems in data/problems.ts.
Keep existing fields compatible. Do not touch Supabase yet.
Run typecheck/lint.
```

Expected result:

- Types compile.
- Static data validates through existing pages.

### Cycle 3: frontend read experience

Prompt:

```text
Build the frontend MVP for Proof Graph: summary strip, comparison matrix, reasoning replay, method boundary bridge, and challenge edge display.
Integrate into ProblemDetailExperience without making the page a long dump.
Verify desktop and mobile layout.
```

Expected result:

- 3 flagship pages visibly feel different.
- Mobile path remains usable.

### Cycle 4: review production line

Prompt:

```text
Extend AdminSubmissionsView and publishSubmission so reviewers can preserve/edit graph fields from submitted solution content.
Keep moderator notes required and existing preview intact.
```

Expected result:

- Submitted solution can become graph-aware published content.

### Cycle 5: Supabase migration and mapper

Prompt:

```text
Add the minimum Supabase persistence for proofGraph data using JSONB.
Update mappers so database rows and static fallback share the same Problem.proofGraph contract.
Keep RLS public/private boundaries correct.
```

Expected result:

- DB and static modes both render.
- No unpublished review data leaks.

### Cycle 6: verification

Prompt:

```text
Run npm run lint and npm run build:webpack.
If UI changed, run a local server and inspect at least one flagship problem at desktop and narrow mobile widths.
Fix regressions only within the MVP scope.
```

Expected result:

- Lint passes.
- Build passes.
- Mobile inspection passes.

## 9. Suggested subagents

If Claude Code uses subagents, split them by responsibility:

- **content-modeler**: inspect `data/problems.ts`, select 3 flagship problems, write `proofGraph` static content.
- **frontend-ux**: build `ProofGraphMatrix`, `ReasoningReplayPanel`, and integrate into `ProblemDetailExperience`.
- **review-flow**: extend `AdminSubmissionsView`, submit/studio fields, and `publishSubmission`.
- **db-mapper**: add migration and mapper changes after frontend contract stabilizes.
- **qa**: run lint/build and mobile checks, report regressions with file/line references.

Do not let subagents independently invent incompatible field names. `lib/types.ts` is the contract.

## 10. Acceptance checklist

MVP is not done until all are true:

- [ ] `Problem.proofGraph?: ProofGraphV1` exists and compiles.
- [ ] 3 flagship problems have meaningful graph data.
- [ ] Each flagship problem has at least 3 observations or branches.
- [ ] Each flagship problem has at least 1 method boundary.
- [ ] Each flagship problem has at least 1 reasoning replay path.
- [ ] Comparison matrix uses existing scores and graph transformations.
- [ ] Challenge edge display works when data exists.
- [ ] Review/admin path can preserve graph fields.
- [ ] Static fallback still works without Supabase.
- [ ] Supabase mode does not leak unpublished review content.
- [ ] `npm run lint` passes.
- [ ] `npm run build:webpack` passes.
- [ ] At least one flagship page is checked on a narrow viewport.

## 11. Product quality bar

Reject the implementation if:

- It only adds labels without changing the reading experience.
- It turns the page into a long encyclopedia dump.
- It requires users to understand internal graph terminology.
- It breaks mobile reading.
- It stores rich review data but publishes only Markdown.
- It makes all future graph work depend on a complex database redesign.

Accept the implementation if:

- A new visitor can tell this is about comparing routes, not finding answers.
- A reviewer can turn a natural language solution into structured assets.
- The 3 flagship problems feel like small research arenas.
- The implementation remains incremental and does not block existing community, contest, or submission flows.
