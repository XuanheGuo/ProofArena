import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createVerificationService } from "@/verification";
import { getVerificationActor, isVerificationAdmin } from "@/verification/api";
import { AdminVerificationsView } from "@/components/AdminVerificationsView";

export const dynamic = "force-dynamic";

export default async function AdminVerificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await getVerificationActor();
  if (!actor) redirect("/auth/login");
  if (!isVerificationAdmin(actor)) return <main className="min-h-screen bg-zinc-950 p-16 text-center text-white">无访问权限</main>;
  const params = await searchParams;
  const tasks = await createVerificationService().list(actor, {
    userId: params.userId, problemId: params.problemId, engine: params.engine,
    provider: params.provider, status: params.status as never, verdict: params.verdict as never, limit: 100,
  });
  return <main className="min-h-screen bg-zinc-950 px-4 py-10 md:px-6"><div className="mx-auto max-w-7xl">
    <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white"><ArrowLeft className="size-4" />返回管理面板</Link>
    <form className="mt-6 grid gap-2 border border-white/10 bg-black/20 p-3 sm:grid-cols-3 lg:grid-cols-7">
      <input name="userId" defaultValue={params.userId} placeholder="用户 ID" className="border border-white/10 bg-zinc-950 px-2 py-2 text-xs text-zinc-300" />
      <input name="problemId" defaultValue={params.problemId} placeholder="题目 ID" className="border border-white/10 bg-zinc-950 px-2 py-2 text-xs text-zinc-300" />
      <select name="engine" defaultValue={params.engine ?? ""} className="border border-white/10 bg-zinc-950 px-2 py-2 text-xs text-zinc-300"><option value="">全部引擎</option><option value="lean">lean</option><option value="cas">cas</option><option value="numerical">numerical</option><option value="z3">z3</option></select>
      <select name="provider" defaultValue={params.provider ?? ""} className="border border-white/10 bg-zinc-950 px-2 py-2 text-xs text-zinc-300"><option value="">全部 Provider</option><option value="axle">axle</option><option value="kimina">kimina</option><option value="internal">internal</option></select>
      <select name="status" defaultValue={params.status ?? ""} className="border border-white/10 bg-zinc-950 px-2 py-2 text-xs text-zinc-300"><option value="">全部状态</option>{["queued", "running", "completed", "failed", "cancelled"].map((value) => <option key={value}>{value}</option>)}</select>
      <select name="verdict" defaultValue={params.verdict ?? ""} className="border border-white/10 bg-zinc-950 px-2 py-2 text-xs text-zinc-300"><option value="">全部结论</option>{["accepted", "rejected", "invalid_request", "timeout", "rate_limited", "resource_limit", "provider_error", "cancelled"].map((value) => <option key={value}>{value}</option>)}</select>
      <button className="bg-cyan-400 px-3 py-2 text-xs font-bold text-zinc-950">筛选</button>
    </form>
    <AdminVerificationsView tasks={tasks} />
  </div></main>;
}
