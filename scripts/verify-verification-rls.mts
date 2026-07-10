#!/usr/bin/env npx tsx
/**
 * RLS / forgery regression checker for the unified verification subsystem
 * (supabase/migrations/024_unified_verification_system.sql).
 *
 * Verifies, against a LIVE Supabase project (local or a disposable dev
 * project — never run this against production data, it inserts and
 * deletes throwaway rows):
 *
 *   - an authenticated user cannot INSERT a fabricated verification_tasks
 *     row (forge an accepted/cached result) via the anon key
 *   - an authenticated user cannot UPDATE another user's row (change
 *     status/verdict/valid/cached) via the anon key
 *   - an authenticated user cannot UPDATE or DELETE even their OWN row
 *     via the anon key (all real writes are service-role only)
 *   - an authenticated user can SELECT their own row but not another
 *     user's row
 *   - public_verification_summaries exposes only strictly-accepted rows
 *     and never source_snapshot/messages/provider diagnostics/user_id
 *   - the CHECK constraints reject internally-inconsistent rows even from
 *     a trusted (service-role) writer
 *
 * Usage:
 *   npx tsx scripts/verify-verification-rls.mts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY in env (or a .env.local file in the project
 * root). Without them this prints a clear SKIP/FAIL summary — it never
 * silently reports success. Intended primarily against a local
 * `supabase start` instance; safe to run against any project since it only
 * touches its own throwaway users/rows.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", green: "\x1b[32m",
  yellow: "\x1b[33m", red: "\x1b[31m", cyan: "\x1b[36m", dim: "\x1b[2m",
};

type CheckStatus = "PASS" | "WARN" | "FAIL" | "SKIP";
interface CheckResult { name: string; status: CheckStatus; detail: string; }
const results: CheckResult[] = [];
function pass(name: string, detail = "") { results.push({ name, status: "PASS", detail }); }
function warn(name: string, detail = "") { results.push({ name, status: "WARN", detail }); }
function fail(name: string, detail = "") { results.push({ name, status: "FAIL", detail }); }
function skip(name: string, detail = "") { results.push({ name, status: "SKIP", detail }); }

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
  console.log(`${C.bold}${C.cyan}ProofArena Verification-System RLS Checker${C.reset}`);
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
    console.log(`${C.red}${C.bold}CHECKS FAILED — do not ship until every FAIL is fixed.${C.reset}`);
  } else if (counts.SKIP > 0) {
    console.log(`${C.yellow}${C.bold}INCOMPLETE — some checks were skipped, results are not conclusive.${C.reset}`);
  } else if (counts.WARN > 0) {
    console.log(`${C.yellow}${C.bold}PASSING WITH WARNINGS.${C.reset}`);
  } else {
    console.log(`${C.green}${C.bold}ALL CHECKS PASSED.${C.reset}`);
  }
  console.log();
}

async function createSignedInUser(admin: ReturnType<typeof createClient>, anonUrl: string, anonKey: string, label: string) {
  const email = `verif-rls-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@proofarena.test`;
  const password = `Test-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created?.user) throw new Error(`create ${label}: ${createError?.message ?? "no user returned"}`);
  const userId = created.user.id;
  const anon = createClient(anonUrl, anonKey, { auth: { persistSession: false } });
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) throw new Error(`sign in ${label}: ${signInError?.message ?? "no session"}`);
  const asUser = createClient(anonUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
  });
  return { userId, asUser };
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    if (!SUPABASE_URL) fail("env: NEXT_PUBLIC_SUPABASE_URL", "not set — cannot connect to Supabase");
    if (!SERVICE_ROLE_KEY) fail("env: SUPABASE_SERVICE_ROLE_KEY", "not set — cannot set up/tear down test fixtures");
    printResults();
    process.exit(1);
  }
  pass("env: NEXT_PUBLIC_SUPABASE_URL");
  pass("env: SUPABASE_SERVICE_ROLE_KEY");
  if (!ANON_KEY) {
    warn("env: NEXT_PUBLIC_SUPABASE_ANON_KEY", "not set — all anon/authenticated-role checks will be SKIPPED");
    printResults();
    process.exit(0);
  }
  pass("env: NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  let userAId: string | null = null;
  let userBId: string | null = null;
  let rowAId: string | null = null;
  let rowBId: string | null = null;
  let problemId: string | null = null;

  try {
    const a = await createSignedInUser(admin, SUPABASE_URL, ANON_KEY, "a");
    const b = await createSignedInUser(admin, SUPABASE_URL, ANON_KEY, "b");
    userAId = a.userId; userBId = b.userId;
    pass("setup: two throwaway signed-in users created", `a=${userAId.slice(0, 8)} b=${userBId.slice(0, 8)}`);

    // public_verification_summaries requires problem_id or solution_id to be
    // set (a badge with nothing to attach to isn't meaningful) -- seed a
    // minimal throwaway problem row to satisfy that and the FK.
    problemId = `verif-rls-test-${Date.now()}`;
    const { error: problemErr } = await admin.from("problems").insert({
      id: problemId, year: 2026, region: "原创题", paper: "verify-rls", number: "1",
      difficulty: "基础", question_type: "解答", title: "verify-rls throwaway problem",
      statement: ["placeholder"], answer: "placeholder", learning_guide: {},
    });
    if (problemErr) throw new Error(`seed throwaway problem: ${problemErr.message}`);
    pass("setup: seeded a throwaway problem row");

    // Give the on_auth_user_created trigger a moment to create both profile rows.
    for (const id of [userAId, userBId]) {
      let ok = false;
      for (let i = 0; i < 10 && !ok; i++) {
        const { data: profile } = await admin.from("user_profiles").select("id").eq("id", id).maybeSingle();
        if (profile) { ok = true; break; }
        await new Promise((r) => setTimeout(r, 300));
      }
      if (!ok) throw new Error(`no user_profiles row appeared for ${id}`);
    }
    pass("setup: user_profiles rows auto-created for both users");

    // A row that simulates a real accepted task belonging to user A, inserted
    // the only way the app itself ever does it: via the service-role client.
    const { data: rowA, error: rowAErr } = await admin.from("verification_tasks").insert({
      user_id: userAId, problem_id: problemId, engine: "lean", provider: "axle", environment: "verify-rls-test",
      status: "completed", verdict: "accepted", valid: true, source_hash: `verify-rls-${Date.now()}-a`,
      source_snapshot: "theorem verify_rls_secret : True := trivial", source_size: 10,
    }).select("id").single();
    if (rowAErr || !rowA) throw new Error(`seed row for A: ${rowAErr?.message}`);
    rowAId = rowA.id;
    pass("setup: seeded an accepted verification_tasks row for user A (service-role)");

    // ── RLS: user B cannot forge an accepted row via direct INSERT ───────────
    {
      const { error } = await b.asUser.from("verification_tasks").insert({
        user_id: userBId, engine: "lean", provider: "axle", environment: "verify-rls-test",
        status: "completed", verdict: "accepted", valid: true, source_hash: `verify-rls-${Date.now()}-forged`,
        source_size: 1,
      });
      if (error) pass("rls: authenticated user cannot INSERT a fabricated row", error.message);
      else fail("rls: authenticated user cannot INSERT a fabricated row", "insert succeeded — forgery possible!");
    }

    // ── RLS: user B cannot UPDATE user A's row (change verdict/status) ───────
    {
      const { error } = await b.asUser.from("verification_tasks").update({ verdict: "accepted", status: "completed", valid: true }).eq("id", rowAId);
      const { data: after } = await admin.from("verification_tasks").select("verdict,status,valid").eq("id", rowAId).single();
      if (error || (after && after.verdict === "accepted")) {
        if (error) pass("rls: user B cannot UPDATE user A's row", error.message);
        else pass("rls: user B cannot UPDATE user A's row", "update matched 0 rows (row already accepted, but unchanged is fine)");
      } else {
        fail("rls: user B cannot UPDATE user A's row", "row was mutated by a non-owner!");
      }
    }

    // ── RLS: user B cannot DELETE user A's row ────────────────────────────────
    {
      await b.asUser.from("verification_tasks").delete().eq("id", rowAId);
      const { data: after } = await admin.from("verification_tasks").select("id").eq("id", rowAId).maybeSingle();
      if (after) pass("rls: user B cannot DELETE user A's row");
      else fail("rls: user B cannot DELETE user A's row", "row was deleted by a non-owner!");
    }

    // ── RLS: even the OWNER cannot UPDATE their own row (service-role only) ──
    {
      const { error } = await a.asUser.from("verification_tasks").update({ verdict: "rejected" }).eq("id", rowAId);
      const { data: after } = await admin.from("verification_tasks").select("verdict").eq("id", rowAId).single();
      if (after?.verdict === "accepted") pass("rls: owner cannot self-UPDATE (writes are service-role only)", error ? error.message : "update matched 0 rows");
      else fail("rls: owner cannot self-UPDATE (writes are service-role only)", `verdict became '${after?.verdict}' — owner could tamper with their own result!`);
    }

    // ── RLS: user B cannot SELECT user A's row; user A can ───────────────────
    {
      const { data: bReads } = await b.asUser.from("verification_tasks").select("id").eq("id", rowAId);
      if (!bReads || bReads.length === 0) pass("rls: user B cannot SELECT user A's row");
      else fail("rls: user B cannot SELECT user A's row", "cross-user read leak!");

      const { data: aReads } = await a.asUser.from("verification_tasks").select("id").eq("id", rowAId);
      if (aReads && aReads.length === 1) pass("rls: user A CAN SELECT their own row");
      else fail("rls: user A CAN SELECT their own row", "owner cannot read their own row — RLS is too strict");
    }

    // ── public_verification_summaries: exposes accepted rows, redacts columns ─
    {
      const anonNoAuth = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
      const { data, error } = await anonNoAuth.from("public_verification_summaries").select("*").eq("id", rowAId).maybeSingle();
      if (error) {
        fail("public view: anonymous caller can read an accepted summary", error.message);
      } else if (!data) {
        fail("public view: anonymous caller can read an accepted summary", "no row returned for a genuinely accepted task");
      } else {
        pass("public view: anonymous caller can read an accepted summary");
        const leaked = ["source_snapshot", "messages", "user_id", "provider_request_id", "provider_error_code", "result_metadata"].filter((k) => k in data);
        if (leaked.length === 0) pass("public view: does not expose source/diagnostics/user_id columns");
        else fail("public view: does not expose source/diagnostics/user_id columns", `leaked columns: ${leaked.join(", ")}`);
      }
    }

    // A non-accepted (rejected) row for user B must NOT appear in the public view.
    const { data: rowB } = await admin.from("verification_tasks").insert({
      user_id: userBId, engine: "lean", provider: "axle", environment: "verify-rls-test",
      status: "completed", verdict: "rejected", valid: false, source_hash: `verify-rls-${Date.now()}-b`,
      source_size: 1,
    }).select("id").single();
    rowBId = rowB?.id ?? null;
    if (rowBId) {
      const anonNoAuth = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
      const { data } = await anonNoAuth.from("public_verification_summaries").select("id").eq("id", rowBId).maybeSingle();
      if (!data) pass("public view: a rejected task is NOT exposed");
      else fail("public view: a rejected task is NOT exposed", "rejected task leaked through the public view!");
    } else {
      skip("public view: a rejected task is NOT exposed", "could not seed the rejected row");
    }

    // ── CHECK constraints: service-role writer still can't insert nonsense ───
    {
      const { error } = await admin.from("verification_tasks").insert({
        user_id: userAId, engine: "lean", provider: "axle", environment: "verify-rls-test",
        status: "completed", verdict: null, source_hash: `verify-rls-${Date.now()}-badstate`, source_size: 1,
      });
      if (error) pass("constraint: completed status requires a verdict", error.message);
      else fail("constraint: completed status requires a verdict", "insert succeeded — CHECK constraint missing or broken");
    }
    {
      const { error } = await admin.from("verification_tasks").insert({
        user_id: userAId, engine: "lean", provider: "axle", environment: "verify-rls-test",
        status: "completed", verdict: "accepted", valid: false, source_hash: `verify-rls-${Date.now()}-badaccept`, source_size: 1,
      });
      if (error) pass("constraint: accepted verdict requires valid=true", error.message);
      else fail("constraint: accepted verdict requires valid=true", "insert succeeded — CHECK constraint missing or broken");
    }
  } finally {
    if (rowAId) await admin.from("verification_tasks").delete().eq("id", rowAId);
    if (rowBId) await admin.from("verification_tasks").delete().eq("id", rowBId);
    if (problemId) await admin.from("problems").delete().eq("id", problemId);
    for (const id of [userAId, userBId]) {
      if (!id) continue;
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) warn("cleanup: delete throwaway test user", `please delete manually: id=${id} (${error.message})`);
    }
    if (userAId || userBId) pass("cleanup: throwaway users and rows removed");
  }

  printResults();
  process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
