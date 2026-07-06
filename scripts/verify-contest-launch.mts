#!/usr/bin/env npx tsx
/**
 * Pre-launch readiness checker for ProofArena contest.
 *
 * Usage:
 *   npx tsx scripts/verify-contest-launch.mts
 *   npx tsx scripts/verify-contest-launch.mts --contest first-arena
 *   npx tsx scripts/verify-contest-launch.mts --write-rehearsal   # also inserts test data
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in env
 * (or a .env.local file in the project root).
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const args = process.argv.slice(2);
const contestSlugArg = (() => {
  const idx = args.indexOf("--contest");
  return idx >= 0 ? args[idx + 1] : "first-arena";
})();
const writeRehearsal = args.includes("--write-rehearsal");

// ─── ANSI colours ────────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

type CheckStatus = "PASS" | "WARN" | "FAIL" | "SKIP";

interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

const results: CheckResult[] = [];

function pass(name: string, detail = "") {
  results.push({ name, status: "PASS", detail });
}

function warn(name: string, detail = "") {
  results.push({ name, status: "WARN", detail });
}

function fail(name: string, detail = "") {
  results.push({ name, status: "FAIL", detail });
}

function skip(name: string, detail = "") {
  results.push({ name, status: "SKIP", detail });
}

function statusColor(s: CheckStatus) {
  switch (s) {
    case "PASS": return C.green;
    case "WARN": return C.yellow;
    case "FAIL": return C.red;
    case "SKIP": return C.dim;
  }
}

function printResults() {
  console.log();
  console.log(`${C.bold}${C.cyan}ProofArena Contest Launch Checker${C.reset}`);
  console.log(`${C.dim}Contest slug: ${contestSlugArg}${C.reset}`);
  console.log();

  const maxLen = Math.max(...results.map((r) => r.name.length));
  for (const r of results) {
    const pad = " ".repeat(maxLen - r.name.length);
    const sc = statusColor(r.status);
    const detail = r.detail ? `  ${C.dim}${r.detail}${C.reset}` : "";
    console.log(`  ${sc}${r.status.padEnd(4)}${C.reset}  ${r.name}${pad}${detail}`);
  }

  const counts = { PASS: 0, WARN: 0, FAIL: 0, SKIP: 0 };
  for (const r of results) counts[r.status]++;

  console.log();
  console.log(
    `${C.bold}Summary:${C.reset} ` +
    `${C.green}${counts.PASS} PASS${C.reset}  ` +
    `${C.yellow}${counts.WARN} WARN${C.reset}  ` +
    `${C.red}${counts.FAIL} FAIL${C.reset}  ` +
    `${C.dim}${counts.SKIP} SKIP${C.reset}`,
  );
  console.log();

  if (counts.FAIL > 0) {
    console.log(`${C.red}${C.bold}NOT READY — fix all FAIL items before opening.${C.reset}`);
  } else if (counts.WARN > 0) {
    console.log(`${C.yellow}${C.bold}READY WITH WARNINGS — review WARN items.${C.reset}`);
  } else {
    console.log(`${C.green}${C.bold}READY TO LAUNCH.${C.reset}`);
  }
  console.log();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // ── 0. Environment ──────────────────────────────────────────────────────────

  if (!SUPABASE_URL) {
    fail("env: NEXT_PUBLIC_SUPABASE_URL", "not set — cannot connect to Supabase");
    printResults();
    process.exit(1);
  } else {
    pass("env: NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!ANON_KEY) {
    warn("env: NEXT_PUBLIC_SUPABASE_ANON_KEY", "not set — anon-role checks will be skipped");
  } else {
    pass("env: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (!SERVICE_ROLE_KEY) {
    fail("env: SUPABASE_SERVICE_ROLE_KEY", "required for service-role checks and Problem Vault access");
    printResults();
    process.exit(1);
  } else {
    pass("env: SUPABASE_SERVICE_ROLE_KEY");
  }

  const admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
  const anon = ANON_KEY
    ? createClient(SUPABASE_URL!, ANON_KEY, { auth: { persistSession: false } })
    : null;

  // ── 1. Schema: problem_drafts table exists ───────────────────────────────────

  {
    const { error } = await admin.from("problem_drafts").select("id").limit(1);
    if (error) {
      fail("schema: problem_drafts table", error.message);
    } else {
      pass("schema: problem_drafts table");
    }
  }

  // ── 2. Schema: contest_problems.draft_problem_id column ─────────────────────

  {
    const { error } = await admin
      .from("contest_problems")
      .select("id, draft_problem_id")
      .limit(1);
    if (error?.message?.includes("draft_problem_id")) {
      fail("schema: contest_problems.draft_problem_id", "column missing — run 012_problem_vault.sql");
    } else if (error) {
      warn("schema: contest_problems.draft_problem_id", error.message);
    } else {
      pass("schema: contest_problems.draft_problem_id");
    }
  }

  // ── 3. Schema: submissions.draft_problem_id column ──────────────────────────

  {
    const { error } = await admin
      .from("submissions")
      .select("id, draft_problem_id")
      .limit(1);
    if (error?.message?.includes("draft_problem_id")) {
      fail("schema: submissions.draft_problem_id", "column missing — run 012_problem_vault.sql");
    } else if (error) {
      warn("schema: submissions.draft_problem_id", error.message);
    } else {
      pass("schema: submissions.draft_problem_id");
    }
  }

  // ── 4. Schema: problems.source_draft_id column ──────────────────────────────

  {
    const { error } = await admin
      .from("problems")
      .select("id, source_draft_id")
      .limit(1);
    if (error?.message?.includes("source_draft_id")) {
      fail("schema: problems.source_draft_id", "column missing — run 012_problem_vault.sql");
    } else if (error) {
      warn("schema: problems.source_draft_id", error.message);
    } else {
      pass("schema: problems.source_draft_id");
    }
  }

  // ── 5. RLS: anon cannot SELECT from problem_drafts ──────────────────────────

  if (anon) {
    const { data, error } = await anon.from("problem_drafts").select("id").limit(1);
    if (error) {
      // RLS-denied (PGRST116 or empty result) is the expected happy path
      pass("rls: anon denied on problem_drafts", "anon gets an error (RLS is active)");
    } else if (!data || data.length === 0) {
      pass("rls: anon denied on problem_drafts", "anon sees 0 rows (RLS default-deny)");
    } else {
      fail(
        "rls: anon denied on problem_drafts",
        `anon can read ${data.length} draft row(s) — check RLS policy`,
      );
    }
  } else {
    skip("rls: anon denied on problem_drafts", "ANON_KEY not set");
  }

  // ── 6. RLS: service role CAN read problem_drafts ────────────────────────────

  {
    const { error } = await admin.from("problem_drafts").select("id").limit(1);
    if (error) {
      fail("rls: service role can read problem_drafts", error.message);
    } else {
      pass("rls: service role can read problem_drafts");
    }
  }

  // ── 7. Contest row: target contest exists ───────────────────────────────────

  const { data: contestRow, error: contestError } = await admin
    .from("contests")
    .select("id, slug, status, start_at, end_at, title")
    .eq("slug", contestSlugArg)
    .maybeSingle();

  if (contestError || !contestRow) {
    fail(
      `contest: '${contestSlugArg}' exists`,
      contestError?.message ?? `no contest row with slug '${contestSlugArg}' — run /admin/contests to sync`,
    );
  } else {
    pass(`contest: '${contestSlugArg}' exists`, `status=${contestRow.status}, id=${contestRow.id}`);
  }

  // ── 8. Contest problems: at least one problem linked ────────────────────────

  if (contestRow) {
    const { data: cps, error: cpError } = await admin
      .from("contest_problems")
      .select("id, problem_id, draft_problem_id, status, day_index")
      .eq("contest_id", contestRow.id);

    if (cpError) {
      fail("contest_problems: at least one problem", cpError.message);
    } else if (!cps || cps.length === 0) {
      fail("contest_problems: at least one problem", "no problems linked to this contest");
    } else {
      const linked = cps.filter((cp) => cp.problem_id || cp.draft_problem_id);
      if (linked.length === 0) {
        warn("contest_problems: at least one problem", `${cps.length} contest problem row(s) but none have a problem_id or draft_problem_id`);
      } else {
        pass("contest_problems: at least one problem", `${linked.length}/${cps.length} row(s) have a problem linked`);
      }

      // ── 9. Draft-backed problems: drafts actually exist ──────────────────────

      const draftIds = cps.map((cp) => cp.draft_problem_id).filter(Boolean) as string[];
      if (draftIds.length > 0) {
        const { data: drafts, error: draftError } = await admin
          .from("problem_drafts")
          .select("id, title, status")
          .in("id", draftIds);

        if (draftError) {
          fail("draft-backed contest problems: drafts exist", draftError.message);
        } else {
          const foundIds = new Set((drafts ?? []).map((d) => d.id as string));
          const missing = draftIds.filter((id) => !foundIds.has(id));
          if (missing.length > 0) {
            fail(
              "draft-backed contest problems: drafts exist",
              `missing draft ids: ${missing.join(", ")}`,
            );
          } else {
            pass(
              "draft-backed contest problems: drafts exist",
              `${draftIds.length} draft(s) confirmed`,
            );
          }

          // Check none are already promoted (would break the contest-isolation guarantee)
          const promoted = (drafts ?? []).filter((d) => d.status === "promoted");
          if (promoted.length > 0) {
            warn(
              "draft-backed contest problems: still unpublished",
              `${promoted.length} draft(s) already promoted; contest problem FK may have been relinked`,
            );
          } else if (draftIds.length > 0) {
            pass("draft-backed contest problems: still unpublished");
          }
        }
      } else {
        skip("draft-backed contest problems: drafts exist", "no draft-backed contest problems for this contest");
      }
    }
  }

  // ── 10. Contest timing sanity ──────────────────────────────────────────────

  if (contestRow) {
    const now = new Date();
    const startAt = new Date(contestRow.start_at);
    const endAt = new Date(contestRow.end_at);

    if (Number.isNaN(startAt.getTime())) {
      fail("contest timing: start_at is valid", "start_at could not be parsed");
    } else if (Number.isNaN(endAt.getTime())) {
      fail("contest timing: end_at is valid", "end_at could not be parsed");
    } else if (endAt <= startAt) {
      fail("contest timing: end_at after start_at", `start=${startAt.toISOString()}, end=${endAt.toISOString()}`);
    } else {
      pass("contest timing: dates are valid", `start=${startAt.toISOString().slice(0, 16)}, end=${endAt.toISOString().slice(0, 16)}`);

      if (contestRow.status === "draft" && now >= startAt) {
        warn(
          "contest timing: status vs start_at",
          `start_at has passed (${startAt.toISOString().slice(0, 16)}) but status is still 'draft' — open the contest in /admin/contests`,
        );
      } else {
        pass("contest timing: status vs start_at");
      }

      if (contestRow.status === "active" && now >= endAt) {
        warn(
          "contest timing: status vs end_at",
          `end_at has passed (${endAt.toISOString().slice(0, 16)}) but status is still 'active' — move to 'judging' in /admin/contests`,
        );
      } else if (contestRow.status !== "active") {
        pass("contest timing: status vs end_at", `status is '${contestRow.status}' — not expecting active window`);
      } else {
        const minsLeft = Math.round((endAt.getTime() - now.getTime()) / 60000);
        pass("contest timing: status vs end_at", `${minsLeft} minutes remaining`);
      }
    }
  }

  // ── 11. Optional rehearsal write (--write-rehearsal) ──────────────────────

  if (writeRehearsal) {
    console.log();
    console.log(`${C.yellow}${C.bold}--write-rehearsal enabled — inserting test draft and cleaning up${C.reset}`);

    const rehearsalId = `rehearsal-${Date.now()}`;
    const { error: insertError } = await admin.from("problem_drafts").insert({
      id: rehearsalId,
      year: 2099,
      region: "天津卷",
      paper: "数学",
      number: "99",
      difficulty: "中档",
      question_type: "解答",
      tags: ["rehearsal"],
      title: "[REHEARSAL] 临时验收写入测试，请忽略",
      statement: ["这是一条自动验收脚本写入的测试记录，将立刻删除。"],
      answer: "N/A",
      notes: "auto-rehearsal",
    });

    if (insertError) {
      fail("rehearsal: write to problem_drafts", insertError.message);
    } else {
      pass("rehearsal: write to problem_drafts", `inserted id=${rehearsalId}`);

      const { error: deleteError } = await admin
        .from("problem_drafts")
        .delete()
        .eq("id", rehearsalId);

      if (deleteError) {
        warn("rehearsal: cleanup", `inserted but failed to delete — please delete manually: id=${rehearsalId}`);
      } else {
        pass("rehearsal: cleanup", "test record deleted successfully");
      }
    }
  }

  printResults();

  const hasFail = results.some((r) => r.status === "FAIL");
  process.exit(hasFail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
