#!/usr/bin/env tsx
/**
 * Upserts Weekly 01 draft problems into the Problem Vault and binds them to
 * the weekly-arena-01 contest seed slots. Requires service-role credentials
 * in .env.local so it can write admin-only tables.
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { contests } from "../data/contests";
import { weekly01DraftProblems, weekly01SprintAnswerKeys } from "../data/weekly01-drafts";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (match) process.env[match[1]] = match[2].trim();
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const weeklyContest = contests.find((contest) => contest.slug === "weekly-arena-01");
if (!weeklyContest) {
  console.error("weekly-arena-01 seed not found.");
  process.exit(1);
}

const draftRows = weekly01DraftProblems.map((draft) => ({
  id: draft.id,
  year: draft.year,
  region: draft.region,
  paper: draft.paper,
  number: draft.number,
  difficulty: draft.difficulty,
  question_type: draft.questionType,
  tags: draft.tags,
  title: draft.title,
  statement: draft.statement,
  answer: draft.answer,
  source_pdf: draft.sourcePdf,
  source_page: draft.sourcePage,
  answer_pdf: null,
  learning_guide: draft.learningGuide,
  solution_tree: null,
  proof_graph: null,
  notes: draft.notes,
  status: "drafting",
}));

function contestPatch(status: string) {
  return {
    slug: weeklyContest.slug,
    title: weeklyContest.title,
    description: weeklyContest.description,
    tagline: weeklyContest.tagline,
    rules: weeklyContest.rules,
    status,
    start_at: weeklyContest.startAt,
    end_at: weeklyContest.endAt,
    discussion_start_at: weeklyContest.discussionStartAt ?? null,
    discussion_end_at: weeklyContest.discussionEndAt ?? null,
  };
}

const rowKey = (row: { day_index: number; problem_phase: string; title: string }) =>
  `${row.day_index}::${row.problem_phase}::${row.title}`;

async function main() {
  console.log(`Upserting ${draftRows.length} Weekly 01 drafts…`);
  const { error: draftError } = await supabase.from("problem_drafts").upsert(draftRows, { onConflict: "id" });
  if (draftError) throw new Error(`problem_drafts upsert failed: ${draftError.message}`);

  const { data: existingContest } = await supabase
    .from("contests")
    .select("id, status")
    .eq("slug", weeklyContest.slug)
    .maybeSingle();

  const patch = contestPatch((existingContest?.status as string | undefined) ?? weeklyContest.status);

  const contestResult = existingContest?.id
    ? await supabase.from("contests").update(patch).eq("id", existingContest.id).select("id").single()
    : await supabase.from("contests").insert(patch).select("id").single();

  if (contestResult.error || !contestResult.data) {
    throw new Error(`contest upsert failed: ${contestResult.error?.message ?? "no id returned"}`);
  }

  const contestId = contestResult.data.id as string;
  const { data: existingProblems, error: existingProblemsError } = await supabase
    .from("contest_problems")
    .select("id, title, day_index, problem_phase, draft_problem_id")
    .eq("contest_id", contestId);

  if (existingProblemsError) throw new Error(`contest_problems read failed: ${existingProblemsError.message}`);

  const existingIdByKey = new Map((existingProblems ?? []).map((row) => [rowKey(row), row.id as string]));
  const existingIdByDraftId = new Map(
    (existingProblems ?? [])
      .filter((row) => row.draft_problem_id)
      .map((row) => [row.draft_problem_id as string, row.id as string]),
  );
  const sprintAnswerKeyByDraftId = new Map(weekly01SprintAnswerKeys.map((answerKey) => [answerKey.draftProblemId, answerKey]));

  let inserted = 0;
  let updated = 0;
  let answerKeys = 0;

  for (const contestProblem of weeklyContest.problems) {
    const patch = {
      contest_id: contestId,
      problem_id: contestProblem.problemId,
      draft_problem_id: contestProblem.draftProblemId ?? null,
      day_index: contestProblem.dayIndex,
      title: contestProblem.title,
      theme: contestProblem.theme,
      open_at: contestProblem.openAt,
      close_at: contestProblem.closeAt,
      weight: contestProblem.weight,
      status: contestProblem.status,
      unlock_mode: contestProblem.unlockMode ?? "manual",
      problem_phase: contestProblem.problemPhase,
      score_max: contestProblem.scoreMax,
      score_policy: contestProblem.scorePolicy,
      multiplier_eligible: contestProblem.multiplierEligible,
      timed_mode_enabled: contestProblem.timedModeEnabled,
      time_limit_seconds: contestProblem.timeLimitSeconds,
      max_attempts: contestProblem.maxAttempts,
      answer_type: contestProblem.answerType,
      answer_format_note: contestProblem.answerFormatNote,
    };

    const key = rowKey({ day_index: contestProblem.dayIndex, problem_phase: contestProblem.problemPhase, title: contestProblem.title });
    const matchedId =
      (contestProblem.draftProblemId ? existingIdByDraftId.get(contestProblem.draftProblemId) : undefined) ??
      existingIdByKey.get(key);
    let contestProblemId = matchedId;

    if (matchedId) {
      const { error } = await supabase.from("contest_problems").update(patch).eq("id", matchedId);
      if (error) throw new Error(`contest_problem update failed (${contestProblem.title}): ${error.message}`);
      updated += 1;
    } else {
      const { data, error } = await supabase.from("contest_problems").insert(patch).select("id").single();
      if (error || !data) throw new Error(`contest_problem insert failed (${contestProblem.title}): ${error?.message ?? "no id returned"}`);
      contestProblemId = data.id as string;
      existingIdByKey.set(key, contestProblemId);
      if (contestProblem.draftProblemId) existingIdByDraftId.set(contestProblem.draftProblemId, contestProblemId);
      inserted += 1;
    }

    const sprintAnswerKey = contestProblem.draftProblemId ? sprintAnswerKeyByDraftId.get(contestProblem.draftProblemId) : undefined;
    if (contestProblemId && sprintAnswerKey) {
      const { error } = await supabase.from("contest_problem_answer_keys").upsert(
        {
          contest_problem_id: contestProblemId,
          answer_type: sprintAnswerKey.answerType,
          answer_key: sprintAnswerKey.answerKey,
          format_note: sprintAnswerKey.formatNote,
        },
        { onConflict: "contest_problem_id" },
      );
      if (error) throw new Error(`answer key upsert failed (${contestProblem.title}): ${error.message}`);
      answerKeys += 1;
    }
  }

  const { count: staleCount, error: staleDeleteError } = await supabase
    .from("contest_problems")
    .delete({ count: "exact" })
    .eq("contest_id", contestId)
    .is("problem_id", null)
    .is("draft_problem_id", null);

  if (staleDeleteError) throw new Error(`stale empty contest_problem cleanup failed: ${staleDeleteError.message}`);

  const { count, error: countError } = await supabase
    .from("problem_drafts")
    .select("id", { count: "exact", head: true })
    .in("id", weekly01DraftProblems.map((draft) => draft.id));

  if (countError) throw new Error(`draft count check failed: ${countError.message}`);

  console.log(`Done. drafts=${count}, contest_problem inserted=${inserted}, updated=${updated}, answer_keys=${answerKeys}, stale_empty_deleted=${staleCount ?? 0}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
