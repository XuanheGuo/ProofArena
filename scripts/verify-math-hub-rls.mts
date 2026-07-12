#!/usr/bin/env npx tsx
/**
 * RLS / forgery / privacy checker for the Math Hub v2 schema
 * (migrations 027–030: problem_versions, solution_versions, capability_runs,
 * capability_run_inputs, artifacts, artifact_relations, evidence).
 *
 * Runs against a LIVE Supabase project — local `supabase start` or a
 * disposable dev project, NEVER production: it creates and deletes throwaway
 * users and rows. As a guard it refuses to run unless the URL looks local
 * (127.0.0.1 / localhost / *.supabase.co with ALLOW_REMOTE_RLS_TEST=true).
 *
 * Every check asserts programmatically and the process exits non-zero on any
 * FAIL. Covers:
 *   versions:  anon reads published only; owner reads own unpublished;
 *              stranger cannot; moderator reads all; public views hide
 *              source_snapshot; client roles cannot INSERT/UPDATE versions;
 *              030 triggers: content immutable, unpublish rejected
 *   runs:      client roles cannot INSERT runs/inputs; owner reads own run,
 *              stranger cannot
 *   artifacts: client roles cannot INSERT/UPDATE artifacts or evidence;
 *              draft artifact invisible to anon + stranger, visible to owner
 *              and moderator; published+public artifact visible to anon;
 *              provider_trace evidence NEVER visible to anon (CHECK + RLS);
 *              publish_artifact RPC not callable by client roles;
 *              publish blocked while input version unpublished, allowed after
 *   rpcs:      create_capability_run_with_inputs / create_artifact_bundle are
 *              service-role only; bundle rejects verifies-relation forgery
 *              from ad-hoc runs; duplicate bundle rejected (unique index)
 *
 * Usage:
 *   npm run test:rls        (requires NEXT_PUBLIC_SUPABASE_URL,
 *                            NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *                            SUPABASE_SERVICE_ROLE_KEY in env or .env.local)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const C = { reset: "\x1b[0m", bold: "\x1b[1m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", cyan: "\x1b[36m", dim: "\x1b[2m" };
type CheckStatus = "PASS" | "FAIL" | "SKIP";
const results: { name: string; status: CheckStatus; detail: string }[] = [];
function pass(name: string, detail = "") { results.push({ name, status: "PASS", detail }); }
function fail(name: string, detail = "") { results.push({ name, status: "FAIL", detail }); }

function printResults() {
  console.log(`\n${C.bold}${C.cyan}ProofArena Math Hub v2 RLS Checker${C.reset}\n`);
  const maxLen = Math.max(...results.map((r) => r.name.length));
  for (const r of results) {
    const color = r.status === "PASS" ? C.green : r.status === "FAIL" ? C.red : C.dim;
    console.log(`  ${color}${r.status.padEnd(4)}${C.reset}  ${r.name}${" ".repeat(maxLen - r.name.length)}  ${C.dim}${r.detail}${C.reset}`);
  }
  const counts = { PASS: 0, FAIL: 0, SKIP: 0 };
  for (const r of results) counts[r.status]++;
  console.log(`\n${C.bold}Summary:${C.reset} ${C.green}${counts.PASS} PASS${C.reset}  ${C.red}${counts.FAIL} FAIL${C.reset}  ${C.dim}${counts.SKIP} SKIP${C.reset}\n`);
  if (counts.FAIL > 0) console.log(`${C.red}${C.bold}CHECKS FAILED — do not ship until every FAIL is fixed.${C.reset}\n`);
  else console.log(`${C.green}${C.bold}ALL CHECKS PASSED.${C.reset}\n`);
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function createSignedInUser(admin: SupabaseClient, label: string) {
  const email = `mathhub-rls-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@proofarena.test`;
  const password = `Test-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created?.user) throw new Error(`create user ${label}: ${error?.message}`);
  const anon = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) throw new Error(`sign in ${label}: ${signInError?.message}`);
  const asUser = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
  });
  return { userId: created.user.id, asUser };
}

async function waitForProfile(admin: SupabaseClient, userId: string) {
  for (let i = 0; i < 10; i++) {
    const { data } = await admin.from("user_profiles").select("id").eq("id", userId).maybeSingle();
    if (data) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`no user_profiles row for ${userId}`);
}

async function main() {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY })) {
      if (!v) fail(`env: ${k}`, "not set");
    }
    printResults();
    process.exit(1);
  }
  const isLocal = /127\.0\.0\.1|localhost/.test(SUPABASE_URL);
  if (!isLocal && process.env.ALLOW_REMOTE_RLS_TEST !== "true") {
    fail("safety: refusing non-local Supabase URL", `${SUPABASE_URL} — set ALLOW_REMOTE_RLS_TEST=true only for a DISPOSABLE project`);
    printResults();
    process.exit(1);
  }
  pass("env + safety", isLocal ? "local Supabase" : "remote (explicitly allowed)");

  const admin = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  void admin;

  const cleanup: (() => Promise<void>)[] = [];
  try {
    // ── fixtures ─────────────────────────────────────────────────────────────
    const owner = await createSignedInUser(service, "owner");
    const stranger = await createSignedInUser(service, "stranger");
    const mod = await createSignedInUser(service, "mod");
    cleanup.push(async () => {
      for (const u of [owner, stranger, mod]) await service.auth.admin.deleteUser(u.userId);
    });
    await waitForProfile(service, owner.userId);
    await waitForProfile(service, stranger.userId);
    await waitForProfile(service, mod.userId);
    {
      const { error } = await service.from("user_profiles").update({ role: "moderator" }).eq("id", mod.userId);
      if (error) throw new Error(`promote moderator: ${error.message}`);
    }
    pass("setup: three throwaway users (owner, stranger, moderator)");

    const problemId = `mathhub-rls-${Date.now()}`;
    {
      const { error } = await service.from("problems").insert({
        id: problemId, year: 2026, region: "原创题", paper: "mathhub-rls", number: "1",
        difficulty: "基础", question_type: "解答", title: "mathhub-rls throwaway", statement: ["x"], answer: "x", learning_guide: {},
      });
      if (error) throw new Error(`seed problem: ${error.message}`);
    }
    const solutionId = `mathhub-rls-sol-${Date.now()}`;
    {
      const { error } = await service.from("solutions").insert({
        id: solutionId, problem_id: problemId, kind: "standard", title: "t", author: "a", author_role: "r",
        badge: "b", origin: "o", key_transform: "k", thinking_cues: {}, inspiration: "i", transfer_value: "t",
        scores: { correctness: 5, examReady: 5, elegance: 5, calculation: 5, explanation: 5 },
        scoring_reason: "s", verification: {}, estimated_minutes: 5,
      });
      if (error) throw new Error(`seed solution: ${error.message}`);
    }
    cleanup.push(async () => { await service.from("problems").delete().eq("id", problemId); });

    const leanSource = "theorem mathhub_rls : 1 + 1 = 2 := rfl";
    const publishedContent = { formalProofs: { lean: { source: leanSource } } };
    const secretDraftContent = { formalProofs: { lean: { source: "theorem secret_draft : True := trivial" } } };

    const { data: publishedVersion, error: pvErr } = await service.from("solution_versions").insert({
      solution_id: solutionId, version_number: 1, content: publishedContent,
      content_hash: sha256(JSON.stringify(publishedContent)), created_by: owner.userId,
      published_at: new Date().toISOString(), source_snapshot: { private: "submission-internal" },
    }).select("id").single();
    if (pvErr || !publishedVersion) throw new Error(`seed published version: ${pvErr?.message}`);

    const { data: draftVersion, error: dvErr } = await service.from("solution_versions").insert({
      solution_id: solutionId, version_number: 2, content: secretDraftContent,
      content_hash: sha256(JSON.stringify(secretDraftContent)), created_by: owner.userId, published_at: null,
    }).select("id").single();
    if (dvErr || !draftVersion) throw new Error(`seed draft version: ${dvErr?.message}`);
    pass("setup: published + unpublished solution versions seeded");

    // ── versions: read visibility ───────────────────────────────────────────
    {
      const { data } = await anon.from("solution_versions").select("id").eq("id", publishedVersion.id).maybeSingle();
      data ? pass("versions: anon reads a published version") : fail("versions: anon reads a published version", "no row returned");
    }
    {
      const { data } = await anon.from("solution_versions").select("id").eq("id", draftVersion.id).maybeSingle();
      !data ? pass("versions: anon cannot read an unpublished version") : fail("versions: anon cannot read an unpublished version", "draft leaked to anon!");
    }
    {
      const { data } = await owner.asUser.from("solution_versions").select("id").eq("id", draftVersion.id).maybeSingle();
      data ? pass("versions: owner reads own unpublished version") : fail("versions: owner reads own unpublished version", "owner blocked");
    }
    {
      const { data } = await stranger.asUser.from("solution_versions").select("id").eq("id", draftVersion.id).maybeSingle();
      !data ? pass("versions: stranger cannot read another user's draft") : fail("versions: stranger cannot read another user's draft", "cross-user draft leak!");
    }
    {
      const { data } = await mod.asUser.from("solution_versions").select("id").eq("id", draftVersion.id).maybeSingle();
      data ? pass("versions: moderator reads any unpublished version") : fail("versions: moderator reads any unpublished version", "moderator blocked");
    }
    {
      const { data, error } = await anon.from("public_solution_versions").select("*").eq("id", publishedVersion.id).maybeSingle();
      if (error || !data) fail("versions: public view returns published rows", error?.message ?? "no row");
      else {
        const leaked = ["source_snapshot", "source_submission_id", "created_by"].filter((k) => k in data);
        leaked.length === 0
          ? pass("versions: public view hides source_snapshot/submission/creator")
          : fail("versions: public view hides source_snapshot/submission/creator", `leaked: ${leaked.join(", ")}`);
      }
    }

    // ── versions: write protection ──────────────────────────────────────────
    {
      const { data } = await owner.asUser.from("solution_versions").insert({
        solution_id: solutionId, version_number: 3, content: {}, content_hash: sha256("{}"), created_by: owner.userId,
      }).select("id").maybeSingle();
      !data ? pass("versions: client role cannot INSERT a version") : fail("versions: client role cannot INSERT a version", "insert succeeded!");
    }
    {
      await owner.asUser.from("solution_versions").update({ content: { forged: true } }).eq("id", publishedVersion.id);
      const { data: after } = await service.from("solution_versions").select("content").eq("id", publishedVersion.id).single();
      JSON.stringify(after!.content) === JSON.stringify(publishedContent)
        ? pass("versions: client role cannot UPDATE version content")
        : fail("versions: client role cannot UPDATE version content", "content was mutated!");
    }

    // ── versions: 030 immutability triggers (service-role writer) ───────────
    {
      const { error } = await service.from("solution_versions").update({ content: { tampered: true } }).eq("id", publishedVersion.id);
      error && /immutable/.test(error.message)
        ? pass("trigger: content mutation rejected even for service role", error.message)
        : fail("trigger: content mutation rejected even for service role", error?.message ?? "update succeeded — 030 trigger missing/broken");
    }
    {
      const { error } = await service.from("solution_versions").update({ content_hash: sha256("forged") }).eq("id", publishedVersion.id);
      error ? pass("trigger: content_hash mutation rejected") : fail("trigger: content_hash mutation rejected", "update succeeded");
    }
    {
      const { error } = await service.from("solution_versions").update({ version_number: 99 }).eq("id", publishedVersion.id);
      error ? pass("trigger: version_number mutation rejected") : fail("trigger: version_number mutation rejected", "update succeeded");
    }
    {
      const { error } = await service.from("solution_versions").update({ published_at: null }).eq("id", publishedVersion.id);
      error && /unpublish/.test(error.message)
        ? pass("trigger: unpublishing a published version rejected", error.message)
        : fail("trigger: unpublishing a published version rejected", error?.message ?? "unpublish succeeded");
    }
    {
      // publishing a draft (NULL -> value) must be ALLOWED — 029's broken
      // trigger crashed on every UPDATE, so this doubles as the regression test.
      const publishTime = new Date().toISOString();
      const { error } = await service.from("solution_versions").update({ published_at: publishTime }).eq("id", draftVersion.id);
      if (error) fail("trigger: publishing a draft (NULL→ts) is allowed", error.message);
      else {
        pass("trigger: publishing a draft (NULL→ts) is allowed");
        // revert for later publish-gating checks
        // (can't unpublish via UPDATE now — recreate the draft instead)
        await service.from("solution_versions").delete().eq("id", draftVersion.id);
        const { data: redraft, error: reErr } = await service.from("solution_versions").insert({
          solution_id: solutionId, version_number: 2, content: secretDraftContent,
          content_hash: sha256(JSON.stringify(secretDraftContent)), created_by: owner.userId, published_at: null,
        }).select("id").single();
        if (reErr || !redraft) throw new Error(`recreate draft: ${reErr?.message}`);
        draftVersion.id = redraft.id;
      }
    }

    // ── runs + inputs via the atomic RPC ────────────────────────────────────
    const runIdemKey = `rls-test-${Date.now()}`;
    let runId: string;
    {
      const { data, error } = await service.rpc("create_capability_run_with_inputs", {
        p_capability_key: "verify.lean", p_provider_key: "axle", p_requested_by: owner.userId,
        p_configuration: {}, p_input_hash: sha256("inputs"), p_idempotency_key: runIdemKey,
        p_inputs: [{ object_type: "solution_version", object_id: solutionId, version_id: publishedVersion.id, role: "proof_source", content_hash: sha256(leanSource), snapshot: { mode: "version_bound", source: leanSource } }],
      });
      if (error || !data) throw new Error(`create run RPC: ${error?.message}`);
      runId = data as string;
      pass("rpc: create_capability_run_with_inputs creates run + inputs atomically");
    }
    {
      const { error } = await service.rpc("create_capability_run_with_inputs", {
        p_capability_key: "verify.lean", p_provider_key: "axle", p_requested_by: owner.userId,
        p_configuration: {}, p_input_hash: sha256("inputs"), p_idempotency_key: runIdemKey,
        p_inputs: [{ object_type: "ad_hoc_source", object_id: "", version_id: null, role: "proof_source", content_hash: sha256("x"), snapshot: {} }],
      });
      error && error.code === "23505"
        ? pass("rpc: duplicate idempotency key raises unique_violation", error.code)
        : fail("rpc: duplicate idempotency key raises unique_violation", error?.message ?? "second run created!");
    }
    {
      const { error } = await service.rpc("create_capability_run_with_inputs", {
        p_capability_key: "verify.lean", p_provider_key: "axle", p_requested_by: owner.userId,
        p_configuration: {}, p_input_hash: sha256("bad"), p_idempotency_key: `rls-bad-${Date.now()}`,
        p_inputs: [{ object_type: "solution_version", object_id: "some-other-solution", version_id: publishedVersion.id, role: "proof_source", content_hash: sha256("x"), snapshot: {} }],
      });
      error && /does not belong/.test(error.message)
        ? pass("rpc: run insert rejects version not belonging to named solution", error.message)
        : fail("rpc: run insert rejects version not belonging to named solution", error?.message ?? "accepted a mismatched binding!");
      // and the failed transaction must not have left an orphaned run
      const { data: orphans } = await service.from("capability_runs").select("id").eq("input_hash", sha256("bad"));
      (orphans ?? []).length === 0
        ? pass("rpc: failed input validation leaves NO orphaned run (atomic rollback)")
        : fail("rpc: failed input validation leaves NO orphaned run (atomic rollback)", `${orphans!.length} orphan(s)`);
    }
    {
      const { error } = await owner.asUser.rpc("create_capability_run_with_inputs", {
        p_capability_key: "verify.lean", p_provider_key: "axle", p_requested_by: owner.userId,
        p_configuration: {}, p_input_hash: sha256("z"), p_idempotency_key: `rls-client-${Date.now()}`,
        p_inputs: [{ object_type: "ad_hoc_source", object_id: "", version_id: null, role: "proof_source", content_hash: sha256("z"), snapshot: {} }],
      });
      error ? pass("rpc: client role cannot call create_capability_run_with_inputs", error.message)
            : fail("rpc: client role cannot call create_capability_run_with_inputs", "client executed a service-role RPC!");
    }
    {
      const { data } = await owner.asUser.from("capability_runs").select("id").eq("id", runId).maybeSingle();
      data ? pass("runs: owner reads own run") : fail("runs: owner reads own run", "owner blocked");
      const { data: strangerRead } = await stranger.asUser.from("capability_runs").select("id").eq("id", runId).maybeSingle();
      !strangerRead ? pass("runs: stranger cannot read another user's run") : fail("runs: stranger cannot read another user's run", "cross-user run leak!");
      const { data: inputRead } = await stranger.asUser.from("capability_run_inputs").select("id").eq("run_id", runId);
      (inputRead ?? []).length === 0 ? pass("runs: stranger cannot read another user's input snapshots") : fail("runs: stranger cannot read another user's input snapshots", "snapshot leak!");
    }
    {
      const { data } = await owner.asUser.from("capability_runs").insert({
        capability_key: "verify.lean", provider_key: "axle", requested_by: owner.userId, input_hash: sha256("forge"),
      }).select("id").maybeSingle();
      !data ? pass("runs: client role cannot INSERT a run directly") : fail("runs: client role cannot INSERT a run directly", "forged a run!");
    }

    // ── artifact bundle via the atomic RPC ──────────────────────────────────
    let artifactId: string;
    {
      const { data, error } = await service.rpc("create_artifact_bundle", {
        p_kind: "verification_report", p_schema_version: 1, p_run_id: runId, p_provider_key: "axle",
        p_producer_version: null, p_payload: { conclusion: "verified" }, p_summary: "Lean proof accepted",
        p_created_by: owner.userId,
        p_relations: [{ relation: "verifies", target_type: "solution_version", target_id: publishedVersion.id }],
        p_evidence: [
          { kind: "provider_trace", payload: { secret: "trace" }, is_public: false },
          { kind: "lean_proof", payload: { sourceHash: sha256(leanSource), verdict: "accepted" }, is_public: true },
        ],
      });
      if (error || !data) throw new Error(`create bundle RPC: ${error?.message}`);
      artifactId = data as string;
      pass("rpc: create_artifact_bundle writes artifact+relations+evidence atomically");
    }
    {
      const { error } = await service.rpc("create_artifact_bundle", {
        p_kind: "verification_report", p_schema_version: 1, p_run_id: runId, p_provider_key: "axle",
        p_producer_version: null, p_payload: {}, p_summary: "", p_created_by: owner.userId,
        p_relations: [], p_evidence: [],
      });
      error && error.code === "23505"
        ? pass("rpc: second bundle for same run/kind rejected (unique index)", error.code)
        : fail("rpc: second bundle for same run/kind rejected (unique index)", error?.message ?? "duplicate artifact created!");
    }
    {
      // ad-hoc forgery: a run whose inputs are ad-hoc cannot mint a verifies relation
      const { data: adHocRun, error: adHocErr } = await service.rpc("create_capability_run_with_inputs", {
        p_capability_key: "verify.lean", p_provider_key: "axle", p_requested_by: stranger.userId,
        p_configuration: {}, p_input_hash: sha256("adhoc"), p_idempotency_key: `rls-adhoc-${Date.now()}`,
        p_inputs: [{ object_type: "ad_hoc_source", object_id: "", version_id: null, role: "proof_source", content_hash: sha256("adhoc"), snapshot: { mode: "ad_hoc" } }],
      });
      if (adHocErr || !adHocRun) throw new Error(`ad-hoc run: ${adHocErr?.message}`);
      const { error } = await service.rpc("create_artifact_bundle", {
        p_kind: "verification_report", p_schema_version: 1, p_run_id: adHocRun as string, p_provider_key: "axle",
        p_producer_version: null, p_payload: {}, p_summary: "", p_created_by: stranger.userId,
        p_relations: [{ relation: "verifies", target_type: "solution_version", target_id: publishedVersion.id }],
        p_evidence: [],
      });
      error && /version-bound input/.test(error.message)
        ? pass("rpc: ad-hoc run CANNOT claim verifies → solution_version", error.message)
        : fail("rpc: ad-hoc run CANNOT claim verifies → solution_version", error?.message ?? "forged a verifies relation!");
    }
    {
      const { error } = await owner.asUser.rpc("create_artifact_bundle", {
        p_kind: "verification_report", p_schema_version: 1, p_run_id: runId, p_provider_key: "axle",
        p_producer_version: null, p_payload: {}, p_summary: "", p_created_by: owner.userId, p_relations: [], p_evidence: [],
      });
      error ? pass("rpc: client role cannot call create_artifact_bundle", error.message)
            : fail("rpc: client role cannot call create_artifact_bundle", "client executed a service-role RPC!");
    }

    // ── draft artifact visibility ───────────────────────────────────────────
    {
      const { data } = await anon.from("artifacts").select("id").eq("id", artifactId).maybeSingle();
      !data ? pass("artifacts: draft invisible to anon") : fail("artifacts: draft invisible to anon", "draft leaked!");
      const { data: strangerRead } = await stranger.asUser.from("artifacts").select("id").eq("id", artifactId).maybeSingle();
      !strangerRead ? pass("artifacts: draft invisible to stranger") : fail("artifacts: draft invisible to stranger", "draft leaked!");
      const { data: ownerRead } = await owner.asUser.from("artifacts").select("id").eq("id", artifactId).maybeSingle();
      ownerRead ? pass("artifacts: draft visible to its run's owner") : fail("artifacts: draft visible to its run's owner", "owner blocked");
      const { data: modRead } = await mod.asUser.from("artifacts").select("id").eq("id", artifactId).maybeSingle();
      modRead ? pass("artifacts: draft visible to moderator") : fail("artifacts: draft visible to moderator", "moderator blocked");
    }
    {
      const { data } = await owner.asUser.from("artifacts").update({ is_public: true, status: "published" }).eq("id", artifactId).select("id");
      (data ?? []).length === 0 ? pass("artifacts: client role cannot self-publish via UPDATE") : fail("artifacts: client role cannot self-publish via UPDATE", "client flipped is_public!");
    }
    {
      const { error } = await owner.asUser.rpc("publish_artifact", { p_artifact_id: artifactId, p_published_by: owner.userId });
      error ? pass("rpc: client role cannot call publish_artifact", error.message)
            : fail("rpc: client role cannot call publish_artifact", "client published an artifact!");
    }

    // ── publication gating on input version state ───────────────────────────
    {
      // Build a run+artifact over the UNPUBLISHED draft version; publishing must fail.
      const { data: draftRun, error: draftRunErr } = await service.rpc("create_capability_run_with_inputs", {
        p_capability_key: "verify.lean", p_provider_key: "axle", p_requested_by: owner.userId,
        p_configuration: {}, p_input_hash: sha256("draftrun"), p_idempotency_key: `rls-draft-${Date.now()}`,
        p_inputs: [{ object_type: "solution_version", object_id: solutionId, version_id: draftVersion.id, role: "proof_source", content_hash: sha256("d"), snapshot: {} }],
      });
      if (draftRunErr || !draftRun) throw new Error(`draft run: ${draftRunErr?.message}`);
      const { data: draftArtifact, error: daErr } = await service.rpc("create_artifact_bundle", {
        p_kind: "verification_report", p_schema_version: 1, p_run_id: draftRun as string, p_provider_key: "axle",
        p_producer_version: null, p_payload: {}, p_summary: "", p_created_by: owner.userId,
        p_relations: [{ relation: "verifies", target_type: "solution_version", target_id: draftVersion.id }],
        p_evidence: [],
      });
      if (daErr || !draftArtifact) throw new Error(`draft artifact: ${daErr?.message}`);

      const { error: pubErr } = await service.rpc("publish_artifact", { p_artifact_id: draftArtifact as string, p_published_by: mod.userId });
      pubErr && /not published/.test(pubErr.message)
        ? pass("publish: blocked while an input version is unpublished", pubErr.message)
        : fail("publish: blocked while an input version is unpublished", pubErr?.message ?? "published over a private draft version!");
    }
    {
      // The original artifact's input version IS published — publish must work and be idempotent.
      const { error } = await service.rpc("publish_artifact", { p_artifact_id: artifactId, p_published_by: mod.userId });
      !error ? pass("publish: succeeds when all input versions are published") : fail("publish: succeeds when all input versions are published", error.message);
      const { error: again } = await service.rpc("publish_artifact", { p_artifact_id: artifactId, p_published_by: mod.userId });
      !again ? pass("publish: idempotent on an already-published artifact") : fail("publish: idempotent on an already-published artifact", again.message);
      const { data: after } = await service.from("artifacts").select("status, is_public, published_at, published_by").eq("id", artifactId).single();
      after && after.status === "published" && after.is_public && after.published_at && after.published_by === mod.userId
        ? pass("publish: status/is_public/published_at/published_by all set atomically")
        : fail("publish: status/is_public/published_at/published_by all set atomically", JSON.stringify(after));
    }

    // ── published artifact public surface ───────────────────────────────────
    {
      const { data } = await anon.from("artifacts").select("*").eq("id", artifactId).maybeSingle();
      data ? pass("artifacts: published+public artifact readable by anon") : fail("artifacts: published+public artifact readable by anon", "no row");
      const { data: rel } = await anon.from("artifact_relations").select("relation, target_type, target_id").eq("artifact_id", artifactId);
      (rel ?? []).some((r) => r.relation === "verifies" && r.target_id === publishedVersion.id)
        ? pass("artifacts: verifies relation readable and points at the exact version")
        : fail("artifacts: verifies relation readable and points at the exact version", JSON.stringify(rel));
      const { data: publicEv } = await anon.from("evidence").select("kind").eq("artifact_id", artifactId);
      const kinds = (publicEv ?? []).map((e) => e.kind);
      kinds.includes("lean_proof") && !kinds.includes("provider_trace")
        ? pass("evidence: anon sees lean_proof but NEVER provider_trace")
        : fail("evidence: anon sees lean_proof but NEVER provider_trace", `anon sees: ${kinds.join(", ")}`);
    }
    {
      const { data } = await owner.asUser.from("evidence").insert({
        artifact_id: artifactId, kind: "manual_review", payload: { forged: true }, is_public: true,
      }).select("id").maybeSingle();
      !data ? pass("evidence: client role cannot INSERT evidence") : fail("evidence: client role cannot INSERT evidence", "forged evidence!");
    }
    {
      const { error } = await service.from("evidence").insert({
        artifact_id: artifactId, kind: "provider_trace", payload: {}, is_public: true,
      });
      error ? pass("evidence: CHECK rejects a public provider_trace even from service role", error.message)
            : fail("evidence: CHECK rejects a public provider_trace even from service role", "inserted a public trace!");
    }
  } catch (err) {
    fail("unexpected error", err instanceof Error ? err.message : String(err));
  } finally {
    for (const fn of cleanup.reverse()) {
      try { await fn(); } catch (e) { console.error("cleanup:", e); }
    }
  }

  printResults();
  process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
