import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModerator } from "@/lib/require-moderator";
import { getProblems } from "@/lib/db";
import { SubmitForm } from "@/components/SubmitForm";

export default async function NewProblemDraftPage() {
  const moderator = await requireModerator();

  if (!moderator.ok) {
    if (moderator.reason === "unauthenticated") redirect("/auth/login");
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
  const problemOptions = problems.map((p) => ({
    id: p.id,
    title: p.title,
    source: `${p.year} ${p.region} · ${p.paper}${p.number ? ` · ${p.number}` : ""}`,
  }));

  return (
    <main className="grid-surface min-h-screen">
      <section className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
          <Link
            href="/admin/problem-vault"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
          >
            <ArrowLeft className="size-4" />
            返回草稿箱
          </Link>
          <h1 className="mt-6 text-3xl font-black text-white">新建草稿题目</h1>
          <p className="mt-2 text-sm text-zinc-400">
            填写题目信息并存入草稿箱。支持原创、改编或无严格出处的比赛题；草稿不对外公开。
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <div className="border border-white/10 bg-black/20 p-5 md:p-7">
          <SubmitForm problems={problemOptions} vaultMode={true} />
        </div>
      </div>
    </main>
  );
}
