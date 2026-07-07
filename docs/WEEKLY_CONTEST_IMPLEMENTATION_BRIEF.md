# Weekly Contest Implementation Brief for Codex/Claude Code

This brief turns `docs/WEEKLY_CONTEST_FORMAT.md` into an implementation plan for the current ProofArena codebase.

## Current Project Snapshot

The existing contest system already supports:

- Contest list/detail pages: `app/contests`, `app/contests/[slug]/page.tsx`.
- Contest admin page: `components/AdminContestsView.tsx`.
- Per-problem open/close windows through `contest_problems.open_at`, `close_at`, `unlock_mode`.
- Contest submissions through `submissions.contest_slug`, `contest_problem_key`, `contest_solution_type`.
- Problem Vault drafts for unpublished contest problems.
- Thought arena and discussion ratings through `ContestThoughtArena` and `contest_submission_ratings`.
- My submission status through `ContestMyPanel`.
- Basic leaderboard based on published `solutions` ratings.

The existing system is still shaped around "one thought arena contest" rather than a scored multi-phase competition. The weekly format needs a proper contest scoring layer, typed contest problems, timed sprint attempts, and a new live leaderboard.

## Product Target

Implement an 8-day weekly contest format:

```text
Total score =
  daily problem raw score * challenge multiplier
  + sprint score
  + major problem score
  + optional award points
  - penalties
```

Core modules:

- Daily problems: normal proof/solution submissions, manually scored.
- Challenge problems: Day 1-2, manually scored into a small multiplier, only applied to daily problems.
- Sprint problems: locked by default; user manually unlocks; timer starts; answer is choice/fill-in; correct answers score by elapsed time, wrong answers score 0.
- Major problem: Day 3 open, 2-3 day answer window, manually scored, no multiplier.
- Discussion/judging: public thought review and appeal window.

## Recommended Build Order

### Phase 1: Data Model and Types

Add a new Supabase migration after `012_problem_vault.sql`.

Recommended additions to `contest_problems`:

```sql
ALTER TABLE contest_problems
  ADD COLUMN IF NOT EXISTS problem_phase TEXT NOT NULL DEFAULT 'daily'
    CHECK (problem_phase IN ('daily', 'challenge', 'sprint', 'major', 'discussion')),
  ADD COLUMN IF NOT EXISTS score_max NUMERIC NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS score_policy TEXT NOT NULL DEFAULT 'manual'
    CHECK (score_policy IN ('manual', 'sprint_step', 'none')),
  ADD COLUMN IF NOT EXISTS multiplier_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS timed_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS answer_type TEXT
    CHECK (answer_type IS NULL OR answer_type IN ('single_choice', 'multiple_choice', 'fill_blank')),
  ADD COLUMN IF NOT EXISTS answer_key JSONB,
  ADD COLUMN IF NOT EXISTS answer_format_note TEXT;
```

Create contestant profile table:

```sql
CREATE TABLE IF NOT EXISTS contest_participant_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  contest_slug TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  challenge_score NUMERIC NOT NULL DEFAULT 0,
  challenge_multiplier NUMERIC NOT NULL DEFAULT 1.0 CHECK (challenge_multiplier >= 1.0 AND challenge_multiplier <= 1.25),
  multiplier_reason TEXT NOT NULL DEFAULT '',
  penalty_points NUMERIC NOT NULL DEFAULT 0,
  penalty_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contest_id, user_id)
);
```

Create official scores table:

```sql
CREATE TABLE IF NOT EXISTS contest_submission_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  contest_problem_id UUID NOT NULL REFERENCES contest_problems(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  problem_phase TEXT NOT NULL,
  raw_score NUMERIC NOT NULL DEFAULT 0,
  score_max NUMERIC NOT NULL DEFAULT 100,
  rubric JSONB NOT NULL DEFAULT '{}'::jsonb,
  judge_note TEXT NOT NULL DEFAULT '',
  scored_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  scored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contest_problem_id, user_id)
);
```

Create sprint attempts table:

```sql
CREATE TABLE IF NOT EXISTS contest_sprint_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  contest_problem_id UUID NOT NULL REFERENCES contest_problems(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  unlock_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  elapsed_ms INTEGER,
  answer_raw TEXT,
  answer_normalized TEXT,
  is_correct BOOLEAN,
  score NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contest_problem_id, user_id)
);
```

RLS:

- Contest problem metadata remains public, but `answer_key` must not be publicly readable.
- Normal client should be able to read its own sprint attempt and insert/update only its own attempt.
- Admin/moderator can read/write all scoring tables.
- Public leaderboard can read computed score summaries, but should not expose sprint answer keys or private raw answers before official reveal.

Important: if `answer_key` lives on publicly readable `contest_problems`, do not select it from public queries. Safer option: put sprint answer keys in a separate admin-only table:

```sql
contest_problem_answer_keys(contest_problem_id, answer_type, answer_key, format_note)
```

Prefer the separate table if time allows.

Update TypeScript types in `lib/types.ts`:

- `ContestProblemPhase`
- `ContestScorePolicy`
- `ContestAnswerType`
- Extend `ContestProblem` with the new fields.
- Update `lib/contests.ts` row mapping.

### Phase 2: Admin Contest Setup

> **Status update:** the phase/score fields, the admin scoring panel
> (`components/AdminContestScoringView.tsx`), and the sprint answer key
> editor (`components/AdminSprintAnswerKeyEditor.tsx`, embedded in
> `AdminContestsView`'s schedule row for any sprint/timed problem) are all
> implemented — answer keys are edited straight into
> `contest_problem_answer_keys` from the admin UI now, not by hand in
> Supabase. See docs/CONTESTS.md's "一周赛制 Weekly Contest" section for the
> current operational summary. Manual override for sprint attempts (last
> bullet below) was intentionally left out — read-only review only, to avoid
> silently changing an auto-computed score.

Update `components/AdminContestsView.tsx`.

For each contest problem, allow admin to configure:

- Phase: daily / challenge / sprint / major / discussion.
- Max score.
- Score policy.
- Multiplier eligible toggle.
- Timed mode toggle.
- Time limit seconds.
- Max attempts.
- Answer type.
- Answer key and answer format note for sprint problems.

UI guidance:

- Use compact controls, not a landing-page style redesign.
- Put phase/score controls next to existing day/time/status fields.
- Only show sprint-specific fields when `problem_phase === 'sprint'`.
- Show a small warning that answer keys must stay hidden from public queries.

Also add an admin scoring panel, either in `AdminContestsView` or a dedicated component such as `components/AdminContestScoringView.tsx`:

- List contest participants and submissions by problem.
- For daily/major/challenge submissions: input raw score and judge note.
- For challenge: input challenge score and multiplier reason, save into `contest_participant_profiles`.
- For penalties: input penalty points and reason.
- For sprint attempts: read-only review of elapsed time, answer, correctness, score; allow manual override if necessary.

### Phase 3: Sprint Attempt Flow

Create a client component:

```text
components/ContestSprintPanel.tsx
```

Behavior:

1. If user is not logged in, show login prompt.
2. If sprint problem is locked/not open, show locked state.
3. If no attempt exists, show "解锁计时题" button.
4. On unlock, insert row into `contest_sprint_attempts` with server timestamp.
5. After unlock, show problem content, answer UI, and countdown.
6. Submit answer once.
7. Server computes correctness, elapsed time, and score.
8. After submit, show result: correct/wrong, elapsed time, score.

Do not trust client elapsed time for scoring. Use server-side timestamps.

Recommended server route:

```text
app/api/contests/[slug]/sprint/[contestProblemId]/unlock/route.ts
app/api/contests/[slug]/sprint/[contestProblemId]/submit/route.ts
```

The submit route should:

- Authenticate user.
- Verify contest/problem open state.
- Load answer key from admin-only source.
- Normalize submitted answer.
- Compute elapsed time from `unlock_at` to server `now()`.
- Mark score 0 if wrong, already submitted, or over time.
- Use the configured step policy.

Recommended default step scoring for 30-point, 120-second sprint:

```text
0-15s: 30
16-30s: 26
31-60s: 21
61-90s: 15
91-120s: 9
>120s: 0
```

### Phase 4: Live Leaderboard

Do not reuse the existing `getContestLeaderboard` as the primary weekly contest leaderboard. It currently ranks published solutions by rating average, which is useful for "best solution" but not for the weekly score formula.

Add a new query/function:

```text
getContestScoreboard(slug)
```

Return rows like:

```ts
type ContestScoreboardRow = {
  userId: string;
  displayName: string;
  dailyRawScore: number;
  challengeScore: number;
  challengeMultiplier: number;
  dailyFinalScore: number;
  sprintScore: number;
  majorScore: number;
  awardPoints: number;
  penaltyPoints: number;
  totalScore: number;
};
```

Score formula:

```text
dailyFinalScore = dailyRawScore * challengeMultiplier
totalScore = dailyFinalScore + sprintScore + majorScore + awardPoints - penaltyPoints
```

Daily raw score should sum only `contest_submission_scores.problem_phase = 'daily'`.

Major score should sum only `problem_phase = 'major'`.

Challenge submissions do not directly add to total unless explicitly configured later.

Sprint score comes from `contest_sprint_attempts.score`.

Render it on `app/contests/[slug]/page.tsx` as "实时积分榜":

- Rank.
- User.
- Daily raw score.
- Challenge multiplier.
- Daily final score.
- Sprint score.
- Major score or `评分中`.
- Total score.

Keep the existing "最佳解法榜" as a secondary section for finished/judging phases if useful.

### Phase 5: Frontend Contest Detail UI

Update `app/contests/[slug]/page.tsx`:

- Add phase-aware grouping:
  - 今日普通题
  - 计时题
  - 挑战题
  - 大题
  - 讨论区
- Replace the current generic "题目安排" list with phase badges.
- For sprint problems, route to the sprint panel instead of generic solution submission.
- For challenge problems, make CTA "提交挑战思路".
- For major problem, show remaining time and "提交大题解答".
- Keep locked states and draft-backed problem protection.

Update `ContestMyPanel`:

- Show per-phase progress:
  - Daily submissions and scores.
  - Challenge multiplier.
  - Sprint attempts: not unlocked / unlocked / submitted / score.
  - Major score status.

### Phase 6: Submit Flow Adjustments

`components/SubmitForm.tsx` currently handles contest solution thoughts. Keep it for daily/challenge/major, but add phase-aware copy:

- daily: "普通题提交".
- challenge: "挑战思路提交，可不完整，但要写清关键观察".
- major: "大题解答提交".

For sprint problems:

- Do not show them as normal solution submission targets.
- Use `ContestSprintPanel`.

The submission window trigger currently only matches `contest_problem_row.problem_id = NEW.problem_id`. If draft-backed contest submissions are required before promotion, update the trigger to also match `draft_problem_id`. There is already a known limitation documented in `docs/CONTESTS.md`.

### Phase 7: Seed Data

> **Status update:** implemented. `data/contests.ts` has the `weekly-arena-01`
> seed described below, and `/admin/contests` has a "创建/同步 Weekly 01"
> quick-action button (`syncSeedContest(seedSlug)`, parameterized so it can
> sync either template). Every problem slot is unbound
> (`problemId`/`draftProblemId` both `null`) rather than pointing at
> placeholder public problem ids that don't exist — an admin binds real
> problems (or Problem Vault drafts) afterward from the schedule list. Since
> the weekly template has several problems sharing a `day_index` (unlike
> first-arena's one-per-day schedule), the sync logic matches existing
> `contest_problems` rows by `(day_index, problem_phase, title)` instead of
> a `(contest_id, day_index)` conflict target, so re-running sync updates in
> place instead of erroring or duplicating rows.

Update `data/contests.ts` to include a new seed contest for the weekly format, for example:

```text
slug: weekly-arena-01
title: ProofArena Weekly 01
```

Use phase fields:

- Day 1-5: 3 daily problems per day.
- Day 1-5: 3 sprint problems per day.
- Day 1-2: challenge problems.
- Day 3-5/6: major problem.

If there are not enough real problems yet, create placeholder/problem-vault entries through admin rather than hard-coding fake public problem ids.

### Phase 8: QA Checklist

Run:

```text
npm run lint
npm run build
```

Manual checks:

- Contest detail page renders without Supabase and with Supabase.
- Admin can create a sprint problem and save answer config.
- Public contest query never exposes sprint answer key.
- User can unlock sprint problem once.
- Refresh after unlock does not reset timer.
- Wrong sprint answer gives 0.
- Correct sprint answer scores by server elapsed time.
- Over-time submission gives 0.
- Daily/major/challenge submissions still work.
- Admin can score submissions.
- Challenge multiplier appears on user panel and leaderboard.
- Live leaderboard formula matches manual calculation.
- Draft contest and locked problem states still hide protected content.

## Suggested First PR Scope

Keep the first implementation small:

1. Add DB migration and TS types for phases, participant profiles, submission scores, and sprint attempts.
2. Update admin contest problem form to configure phase/score/timed fields.
3. Update public contest detail list to display phase badges.
4. Add `getContestScoreboard(slug)` skeleton that returns empty/default rows without breaking existing pages.

Do not implement the full sprint UI in the first PR unless the data layer and admin config are already stable.

## Suggested Second PR Scope

1. Add sprint unlock/submit API routes.
2. Add `ContestSprintPanel`.
3. Add sprint cards to contest detail page.
4. Add tests or manual QA notes for one correct, one wrong, and one expired attempt.

## Suggested Third PR Scope

1. Add admin scoring interface.
2. Implement full live leaderboard.
3. Add phase-aware `ContestMyPanel`.
4. Keep old best-solution leaderboard as secondary/finished-state content.

