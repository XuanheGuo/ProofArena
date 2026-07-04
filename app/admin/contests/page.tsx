import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminContestsView } from "@/components/AdminContestsView";
import { createClient } from "@/lib/supabase-server";
import { getProblems } from "@/lib/db";

function canManageContests(role?: string | null) {
  return role === "admin" || role === "moderator";
}

export default async function AdminContestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!canManageContests(profile?.role)) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-black text-white">无访问权限</h1>
          <p className="mt-4 text-zinc-400">此页面仅限管理员访问。</p>
        </div>
      </main>
    );
  }

  const problems = await getProblems();
  const problemOptions = problems.map((problem) => ({
    id: problem.id,
    title: problem.title,
    source: `${problem.year} ${problem.region} · ${problem.paper}${problem.number ? ` · ${problem.number}` : ""}`,
  }));

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 md:px-6">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin/submissions" className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white">
          <ArrowLeft className="size-4" />
          返回投稿审核
        </Link>
        <AdminContestsView problems={problemOptions} />
      </div>
    </main>
  );
}
