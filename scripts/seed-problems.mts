#!/usr/bin/env tsx
/**
 * Seed script: inserts all problems and solutions from data/problems.ts into Supabase.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (service role bypasses RLS).
 *
 * Usage:
 *   npm run seed
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { problems } from '../data/problems';
import type { Problem, Solution } from '../lib/types';

// Load .env.local (tsx doesn't load it automatically)
const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (match) process.env[match[1]] = match[2].trim();
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function problemToRow(p: Problem) {
  return {
    id: p.id,
    year: p.year,
    region: p.region,
    paper: p.paper,
    number: p.number,
    difficulty: p.difficulty,
    question_type: p.questionType,
    tags: p.tags,
    title: p.title,
    statement: p.statement,
    answer: p.answer,
    heat: p.heat,
    source_pdf: p.sourcePdf,
    source_page: p.sourcePage,
    answer_pdf: p.answerPdf ?? null,
    learning_guide: p.learningGuide,
    solution_tree: p.solutionTree ?? null,
    knowledge_ids: p.knowledgeIds ?? [],
    insight_ids: p.insightIds ?? [],
    auto_matches: p.autoMatches ?? [],
    manual_matches: p.manualMatches ?? [],
    concept_links: p.conceptLinks ?? null,
    concept_contrasts: p.conceptContrasts ?? null,
    boundary_notes: p.boundaryNotes ?? null,
    contrast_problems: p.contrastProblems ?? null,
    why_not_methods: p.whyNotMethods ?? null,
  };
}

function solutionToRow(s: Solution, problemId: string) {
  return {
    id: s.id,
    problem_id: problemId,
    kind: s.kind,
    title: s.title,
    author: s.author,
    author_role: s.authorRole,
    tags: s.tags,
    badge: s.badge,
    origin: s.origin,
    key_transform: s.keyTransform,
    thinking_cues: s.thinkingCues,
    inspiration: s.inspiration,
    transfer_value: s.transferValue,
    suitable_for: s.suitableFor,
    tradeoffs: s.tradeoffs,
    limitations: s.limitations,
    summary: s.summary,
    scores: s.scores,
    scoring_reason: s.scoringReason,
    verification: s.verification,
    estimated_minutes: s.estimatedMinutes,
    knowledge_ids: s.knowledgeIds ?? [],
    insight_ids: s.insightIds ?? [],
    auto_matches: s.autoMatches ?? [],
    manual_matches: s.manualMatches ?? [],
    concept_links: s.conceptLinks ?? null,
    concept_contrasts: s.conceptContrasts ?? null,
    boundary_notes: s.boundaryNotes ?? null,
    contrast_problems: s.contrastProblems ?? null,
    why_not_methods: s.whyNotMethods ?? null,
  };
}

async function seed() {
  console.log(`Seeding ${problems.length} problems…`);

  for (const problem of problems) {
    const { error: pError } = await supabase
      .from('problems')
      .upsert(problemToRow(problem), { onConflict: 'id' });

    if (pError) {
      console.error(`Failed to insert problem ${problem.id}:`, pError.message);
      continue;
    }

    const solutionRows = problem.solutions.map((s) => solutionToRow(s, problem.id));
    const { error: sError } = await supabase
      .from('solutions')
      .upsert(solutionRows, { onConflict: 'id' });

    if (sError) {
      console.error(`Failed to insert solutions for ${problem.id}:`, sError.message);
    } else {
      console.log(`✓ ${problem.id} (${solutionRows.length} solutions)`);
    }
  }

  console.log('Done.');
}

seed().catch(console.error);
