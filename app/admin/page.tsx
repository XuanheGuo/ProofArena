import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { AdminPanel } from "@/components/AdminPanel";

function canAccessAdmin(role?: string | null) {
  return role === "admin" || role === "moderator";
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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

  const [
    { count: pendingCount },
    { count: approvedCount },
    { count: rejectedCount },
    { count: needsRevisionCount },
    { count: totalSubmissions },
    { count: totalProblems },
    { count: draftingCount },
    { count: promotedCount },
    { count: totalDrafts },
    { count: totalContests },
    { count: activeContests },
    { count: draftContests },
  ] = await Promise.all([
    supabase.from("submissions").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("submissions").select("*", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("submissions").select("*", { count: "exact", head: true }).eq("status", "rejected"),
    supabase.from("submissions").select("*", { count: "exact", head: true }).eq("status", "needs_revision"),
    supabase.from("submissions").select("*", { count: "exact", head: true }),
    supabase.from("problems").select("*", { count: "exact", head: true }),
    supabase.from("problem_drafts").select("*", { count: "exact", head: true }).eq("status", "drafting"),
    supabase.from("problem_drafts").select("*", { count: "exact", head: true }).eq("status", "promoted"),
    supabase.from("problem_drafts").select("*", { count: "exact", head: true }),
    supabase.from("contests").select("*", { count: "exact", head: true }),
    supabase.from("contests").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("contests").select("*", { count: "exact", head: true }).eq("status", "draft"),
  ]);

  const stats = {
    submissions: {
      pending: pendingCount ?? 0,
      approved: approvedCount ?? 0,
      rejected: rejectedCount ?? 0,
      needsRevision: needsRevisionCount ?? 0,
      total: totalSubmissions ?? 0,
    },
    problems: {
      total: totalProblems ?? 0,
    },
    drafts: {
      drafting: draftingCount ?? 0,
      promoted: promotedCount ?? 0,
      total: totalDrafts ?? 0,
    },
    contests: {
      total: totalContests ?? 0,
      active: activeContests ?? 0,
      draft: draftContests ?? 0,
    },
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-4 md:px-6">
      <AdminPanel stats={stats} userEmail={user.email} />
    </main>
  );
}
