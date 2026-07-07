"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, ExternalLink, ArrowUpRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { promoteProblemDraft } from "@/lib/promote-problem-draft";

type DraftStatus = "drafting" | "promoted";

interface ProblemDraft {
  id: string;
  title: string;
  year: number;
  region: string;
  paper: string;
  number: string;
  difficulty: string;
  status: DraftStatus;
  promoted_problem_id: string | null;
  created_at: string;
}

function draftSourceLabel(draft: Pick<ProblemDraft, "year" | "region" | "paper" | "number">) {
  return [
    draft.region,
    draft.paper,
    draft.number,
    draft.year ? String(draft.year) : "",
  ].filter(Boolean).join(" · ");
}

export function ProblemVaultView() {
  const [drafts, setDrafts] = useState<ProblemDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);

  const supabase = createClient();

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("problem_drafts")
      .select("id, title, year, region, paper, number, difficulty, status, promoted_problem_id, created_at")
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      setDrafts((data ?? []) as ProblemDraft[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePromote(id: string) {
    if (!confirm("确认将此草稿发布到公开题库？此操作不可逆。")) return;
    setPromoting(id);
    try {
      const result = await promoteProblemDraft(id);
      if (result.error) {
        setError(result.error);
      } else {
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "发布失败");
    } finally {
      setPromoting(null);
    }
  }

  const draftingCount = drafts.filter((d) => d.status === "drafting").length;
  const promotedCount = drafts.filter((d) => d.status === "promoted").length;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Archive className="size-5 text-violet-400" />
            <h2 className="text-xl font-black text-white">题目草稿箱</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {draftingCount > 0 ? `${draftingCount} 个草稿` : "暂无草稿"}
            {promotedCount > 0 ? ` · ${promotedCount} 个已发布` : ""}
          </p>
        </div>
        <Link
          href="/admin/problem-vault/new"
          className="inline-flex items-center gap-2 border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-bold text-violet-200 transition hover:border-violet-400/50 hover:bg-violet-500/20"
        >
          <Plus className="size-4" />
          新建草稿题目
        </Link>
      </div>

      {error && (
        <div className="mb-4 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : drafts.length === 0 ? (
        <div className="border border-white/10 bg-black/20 p-8 text-center">
          <Archive className="mx-auto mb-3 size-8 text-zinc-600" />
          <p className="text-sm text-zinc-500">草稿箱为空</p>
          <p className="mt-1 text-xs text-zinc-600">
            在{" "}
            <Link href="/admin/contests" className="text-violet-400 hover:underline">
              比赛管理
            </Link>
            {" "}中的「未公开题库」区域创建草稿题目
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="flex flex-col gap-3 border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white">{draft.title || <span className="text-zinc-500">（无标题）</span>}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {draftSourceLabel(draft)}
                  {draft.difficulty ? ` · ${draft.difficulty}` : ""}
                  <span className="ml-2 font-mono text-zinc-600">{draft.id}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`border px-2 py-0.5 text-xs font-bold ${
                    draft.status === "promoted"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-amber-400/30 bg-amber-400/10 text-amber-300"
                  }`}
                >
                  {draft.status === "promoted" ? "已发布" : "草稿中"}
                </span>
                {draft.status === "promoted" && draft.promoted_problem_id ? (
                  <Link
                    href={`/problems/${draft.promoted_problem_id}`}
                    className="inline-flex items-center gap-1 border border-white/10 px-2 py-1 text-xs text-zinc-400 transition hover:text-white"
                  >
                    查看 <ExternalLink className="size-3" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePromote(draft.id)}
                    disabled={promoting === draft.id}
                    className="inline-flex items-center gap-1 border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs font-bold text-violet-300 transition hover:border-violet-400/50 hover:bg-violet-500/20 disabled:opacity-50"
                  >
                    {promoting === draft.id ? "发布中…" : <>发布 <ArrowUpRight className="size-3" /></>}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-zinc-600">
        比赛题目排期请前往{" "}
        <Link href="/admin/contests" className="text-violet-400 hover:underline">
          比赛管理
        </Link>
        {" "}中的「未公开题库」区域进行配置
      </p>
    </div>
  );
}
