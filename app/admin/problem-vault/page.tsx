import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import {
  type ContestAuditOption,
  ProblemVaultView,
  type DraftContestRef,
  type ProblemDraft,
} from "@/components/ProblemVaultView";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

function canAccessAdmin(role?: string | null) {
  return role === "admin" || role === "moderator";
}

type ContestRefRow = {
  id: string;
  draft_problem_id: string;
  day_index: number;
  problem_phase: string | null;
  title: string | null;
  answer_type: string | null;
  timed_mode_enabled: boolean | null;
  contests:
    { slug: string; title: string } | { slug: string; title: string }[] | null;
};

export default async function ProblemVaultPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!canAccessAdmin(profile?.role)) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-black text-white">无访问权限</h1>
          <p className="mt-4 text-zinc-400">此页面仅限管理员访问。</p>
        </div>
      </main>
    );
  }

  // Service-role reads (bypass RLS) are only reached AFTER the admin/moderator
  // check above — draft content must never serialize into a non-admin page.
  const serviceSupabase = createServiceClient();
  const [
    { data: drafts, error: draftsError },
    { data: refRows },
    { data: contestRows },
  ] = await Promise.all([
    serviceSupabase
      .from("problem_drafts")
      .select(
        "id, title, year, region, paper, number, difficulty, question_type, tags, statement, answer, source_pdf, source_page, answer_pdf, learning_guide, notes, status, promoted_problem_id, created_at, updated_at",
      )
      .order("created_at", { ascending: false }),
    serviceSupabase
      .from("contest_problems")
      .select(
        "id, draft_problem_id, day_index, problem_phase, title, answer_type, timed_mode_enabled, contests(slug, title)",
      )
      .not("draft_problem_id", "is", null),
    serviceSupabase
      .from("contests")
      .select("slug, title")
      .order("start_at", { ascending: false }),
  ]);

  // Existence-only check on answer keys: select just the id column, never
  // answer_key itself, so key content can't leak into the serialized page.
  const contestProblemIds = (refRows ?? []).map((row) => row.id as string);
  let keyedIds = new Set<string>();
  if (contestProblemIds.length > 0) {
    const { data: keyRows } = await serviceSupabase
      .from("contest_problem_answer_keys")
      .select("contest_problem_id")
      .in("contest_problem_id", contestProblemIds);
    keyedIds = new Set(
      (keyRows ?? []).map((row) => row.contest_problem_id as string),
    );
  }

  const contestRefs: DraftContestRef[] = (
    (refRows ?? []) as unknown as ContestRefRow[]
  ).map((row) => {
    const contest = Array.isArray(row.contests)
      ? row.contests[0]
      : row.contests;
    return {
      contestProblemId: row.id,
      draftId: row.draft_problem_id,
      contestSlug: contest?.slug ?? "",
      contestTitle: contest?.title ?? "",
      dayIndex: row.day_index,
      phase: row.problem_phase ?? "daily",
      slotTitle: row.title ?? "",
      answerType: row.answer_type ?? null,
      timedModeEnabled: Boolean(row.timed_mode_enabled),
      hasAnswerKey: keyedIds.has(row.id),
    };
  });

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 md:px-6">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft className="size-4" />
          返回管理面板
        </Link>
        {draftsError && (
          <div className="mt-6 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            读取草稿箱失败：{draftsError.message}
          </div>
        )}
        <div className="mt-6">
          <ProblemVaultView
            initialDrafts={(drafts ?? []) as ProblemDraft[]}
            contestRefs={contestRefs}
            contests={(contestRows ?? []) as ContestAuditOption[]}
          />
        </div>
      </div>
    </main>
  );
}
