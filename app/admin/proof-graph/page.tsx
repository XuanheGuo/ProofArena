import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { requireProofGraphEditor } from "@/lib/proof-graph-admin-auth";
import { ProofGraphEditor } from "@/components/ProofGraphEditor";
import type { ProofGraphV1 } from "@/lib/types";

export type ProblemSummary = {
  id: string;
  title: string;
  region: string;
  year: number;
  number: string;
  proofGraph: ProofGraphV1 | null;
};

export default async function AdminProofGraphPage() {
  const auth = await requireProofGraphEditor();
  if (!auth.ok && auth.reason === "unauthenticated") redirect("/auth/login");

  if (!auth.ok) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-black text-white">无访问权限</h1>
          <p className="mt-4 text-zinc-400">此页面仅限管理员访问。</p>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("problems")
    .select("id, title, region, year, number, proof_graph")
    .order("year", { ascending: false });

  const problems: ProblemSummary[] = (rows ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    region: String(row.region),
    year: Number(row.year),
    number: String(row.number),
    proofGraph: (row.proof_graph ?? null) as ProofGraphV1 | null,
  }));

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 md:px-6">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/admin/submissions"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft className="size-4" />
          返回投稿审核
        </Link>
        <div className="mt-6">
          <h1 className="text-2xl font-black text-white">推理图谱编辑器</h1>
          <p className="mt-2 text-sm text-zinc-500">
            直接编辑题目的 proof_graph 字段。JSON 必须符合 ProofGraphV1 结构。
          </p>
        </div>
        <div className="mt-8">
          <ProofGraphEditor problems={problems} />
        </div>
      </div>
    </main>
  );
}
