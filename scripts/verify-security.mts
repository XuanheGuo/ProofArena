#!/usr/bin/env npx tsx
/**
 * Security / RLS regression checker for ProofArena.
 *
 * Verifies the fixes in supabase/migrations/017_harden_profile_and_submission_rls.sql
 * are actually enforced against a live Supabase project:
 *
 *   - anon cannot read problem_drafts
 *   - a normal authenticated user cannot self-promote user_profiles.role
 *   - a normal authenticated user cannot force submissions.status = 'approved'
 *   - a normal authenticated user CAN still insert a pending submission
 *
 * Usage:
 *   npx tsx scripts/verify-security.mts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY in env (or a .env.local file in the project root).
 * Without them this prints a clear SKIP/FAIL summary — it never silently
 * reports success.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
  console.log(`${C.bold}${C.cyan}ProofArena Security Checker${C.reset}`);
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
    console.log(`${C.red}${C.bold}SECURITY CHECKS FAILED — do not ship until every FAIL is fixed.${C.reset}`);
  } else if (counts.SKIP > 0) {
    console.log(`${C.yellow}${C.bold}INCOMPLETE — some checks were skipped, results are not conclusive.${C.reset}`);
  } else if (counts.WARN > 0) {
    console.log(`${C.yellow}${C.bold}PASSING WITH WARNINGS.${C.reset}`);
  } else {
    console.log(`${C.green}${C.bold}ALL SECURITY CHECKS PASSED.${C.reset}`);
  }
  console.log();
}

// ─── Main ────────────────────────────────────────────────────────────────────

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
  } else {
    pass("env: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const anon = ANON_KEY ? createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } }) : null;

  // ── 1. RLS: anon cannot SELECT from problem_drafts ──────────────────────────

  if (anon) {
    const { data, error } = await anon.from("problem_drafts").select("id").limit(1);
    if (error) {
      pass("rls: anon denied on problem_drafts", "anon gets an error (RLS is active)");
    } else if (!data || data.length === 0) {
      pass("rls: anon denied on problem_drafts", "anon sees 0 rows (RLS default-deny)");
    } else {
      fail("rls: anon denied on problem_drafts", `anon can read ${data.length} draft row(s) — check RLS policy`);
    }
  } else {
    skip("rls: anon denied on problem_drafts", "ANON_KEY not set");
  }

  if (!anon) {
    skip("rls: user cannot self-promote role", "ANON_KEY not set");
    skip("rls: user cannot forge approved submission", "ANON_KEY not set");
    skip("rls: user can insert pending submission", "ANON_KEY not set");
    printResults();
    process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
  }

  // ── 2. Set up a throwaway normal-role test user ─────────────────────────────

  const testEmail = `security-verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@proofarena.test`;
  const testPassword = `Test-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
  let testUserId: string | null = null;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });

  if (createError || !created?.user) {
    fail("setup: create throwaway test user", createError?.message ?? "no user returned");
    printResults();
    process.exit(1);
  }
  testUserId = created.user.id;
  pass("setup: create throwaway test user", `id=${testUserId}`);

  try {
    const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError || !signIn.session) {
      fail("setup: sign in as test user", signInError?.message ?? "no session returned");
      return;
    }

    const asUser = createClient(SUPABASE_URL, ANON_KEY!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
    });

    // Give the on_auth_user_created trigger a moment to create the profile row.
    let profileExists = false;
    for (let i = 0; i < 10 && !profileExists; i++) {
      const { data: profile } = await admin.from("user_profiles").select("id, role").eq("id", testUserId).maybeSingle();
      if (profile) {
        profileExists = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!profileExists) {
      fail("setup: user_profiles row auto-created", "no profile row appeared for test user after 3s");
      return;
    }
    pass("setup: user_profiles row auto-created");

    // ── 3. RLS: a normal user cannot self-promote role ────────────────────────

    {
      const { error: updateError } = await asUser
        .from("user_profiles")
        .update({ role: "admin", reputation: 999999 })
        .eq("id", testUserId);

      const { data: after, error: readError } = await admin
        .from("user_profiles")
        .select("role, reputation")
        .eq("id", testUserId)
        .single();

      if (readError) {
        fail("rls: normal user cannot self-promote role", `could not re-read profile: ${readError.message}`);
      } else if (after.role === "admin" || after.role === "moderator") {
        fail("rls: normal user cannot self-promote role", `role became '${after.role}' after self-update — privilege escalation!`);
      } else if (updateError) {
        pass("rls: normal user cannot self-promote role", `update rejected: ${updateError.message}`);
      } else {
        pass("rls: normal user cannot self-promote role", `update accepted but role stayed '${after.role}' (trigger reverted it)`);
      }
    }

    // ── 3b. RLS: an existing moderator cannot self-promote to admin ───────────
    // Moderators are deliberately excluded from the "privileged actor" set in
    // protect_user_profile_privileged_fields() (see migration 017) — only
    // admin/service-role/the hardcoded owner account may change role or
    // reputation. A moderator promoting themselves to admin via the same
    // self-update path is the exact escalation that trigger exists to stop.

    {
      const { error: setModError } = await admin
        .from("user_profiles")
        .update({ role: "moderator" })
        .eq("id", testUserId);

      if (setModError) {
        fail("setup: promote test user to moderator", setModError.message);
      } else {
        const { error: updateError } = await asUser
          .from("user_profiles")
          .update({ role: "admin", reputation: 999999 })
          .eq("id", testUserId);

        const { data: after, error: readError } = await admin
          .from("user_profiles")
          .select("role, reputation")
          .eq("id", testUserId)
          .single();

        if (readError) {
          fail("rls: moderator cannot self-promote to admin", `could not re-read profile: ${readError.message}`);
        } else if (after.role === "admin") {
          fail("rls: moderator cannot self-promote to admin", "role became 'admin' after moderator self-update — privilege escalation!");
        } else if (after.role !== "moderator") {
          fail("rls: moderator cannot self-promote to admin", `expected role to stay 'moderator', got '${after.role}'`);
        } else if (updateError) {
          pass("rls: moderator cannot self-promote to admin", `update rejected: ${updateError.message}`);
        } else {
          pass("rls: moderator cannot self-promote to admin", `update accepted but role stayed 'moderator' (trigger reverted it)`);
        }

        // Reset back to a normal user before the rest of the checks run —
        // cleanup below deletes the whole test user regardless, but this
        // keeps this block's side effects from leaking into later checks.
        await admin.from("user_profiles").update({ role: "user", reputation: 0 }).eq("id", testUserId);
      }
    }

    // ── 4. RLS: a normal user cannot forge an approved submission ─────────────

    let forgedSubmissionId: string | null = null;
    {
      const { data: inserted, error: insertError } = await asUser
        .from("submissions")
        .insert({
          submission_type: "problem",
          problem_source: "security-verify-script",
          user_id: testUserId,
          kind: "standard",
          title: "security-verify: forged approval attempt",
          content: { note: "written by scripts/verify-security.mts, safe to delete" },
          status: "approved",
          moderator_notes: "forged by verify-security.mts",
        })
        .select("id, status, moderator_notes")
        .maybeSingle();

      if (insertError) {
        pass("rls: user cannot forge approved submission", `insert rejected: ${insertError.message}`);
      } else if (inserted && inserted.status === "approved") {
        forgedSubmissionId = inserted.id;
        fail("rls: user cannot forge approved submission", "insert succeeded with status='approved' — forgeable!");
      } else if (inserted) {
        forgedSubmissionId = inserted.id;
        pass(
          "rls: user cannot forge approved submission",
          `insert accepted but status was coerced to '${inserted.status}', moderator_notes=${JSON.stringify(inserted.moderator_notes)}`,
        );
      } else {
        fail("rls: user cannot forge approved submission", "no row and no error — unexpected");
      }
    }
    if (forgedSubmissionId) {
      await admin.from("submissions").delete().eq("id", forgedSubmissionId);
    }

    // ── 5. RLS: a normal user CAN still insert a pending submission ───────────

    let pendingSubmissionId: string | null = null;
    {
      const { data: inserted, error: insertError } = await asUser
        .from("submissions")
        .insert({
          submission_type: "problem",
          problem_source: "security-verify-script",
          user_id: testUserId,
          kind: "standard",
          title: "security-verify: legitimate pending submission",
          content: { note: "written by scripts/verify-security.mts, safe to delete" },
          status: "pending",
        })
        .select("id, status")
        .maybeSingle();

      if (insertError) {
        fail("rls: user can insert pending submission", `legitimate pending insert was rejected: ${insertError.message}`);
      } else if (inserted?.status === "pending") {
        pendingSubmissionId = inserted.id;
        pass("rls: user can insert pending submission");
      } else {
        fail("rls: user can insert pending submission", `unexpected status: ${inserted?.status}`);
      }
    }
    if (pendingSubmissionId) {
      await admin.from("submissions").delete().eq("id", pendingSubmissionId);
    }
  } finally {
    // ── Cleanup: delete the throwaway test user (cascades profile + submissions) ─

    if (testUserId) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(testUserId);
      if (deleteError) {
        warn("cleanup: delete throwaway test user", `please delete manually: id=${testUserId} (${deleteError.message})`);
      } else {
        pass("cleanup: delete throwaway test user");
      }
    }
  }

  printResults();
  process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
