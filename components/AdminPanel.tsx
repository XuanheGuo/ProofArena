"use client";

import Link from "next/link";
import {
  ShieldCheck,
  Trophy,
  NetworkIcon,
  Hammer,
  Archive,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  TrendingUp,
  Users,
  BookOpen,
} from "lucide-react";

interface AdminStats {
  submissions: {
    pending: number;
    approved: number;
    rejected: number;
    needsRevision: number;
    total: number;
  };
  problems: {
    total: number;
  };
  drafts: {
    drafting: number;
    promoted: number;
    total: number;
  };
  contests: {
    total: number;
    active: number;
    draft: number;
  };
}

interface AdminPanelProps {
  stats: AdminStats;
  userEmail?: string;
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">{label}</span>
        <Icon className={`size-4 ${accent}`} />
      </div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function EntryCard({
  href,
  icon: Icon,
  title,
  description,
  accent,
  badge,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent: string;
  badge?: { label: string; color: string };
}) {
  return (
    <Link
      href={href}
      className={`group flex min-h-20 items-center gap-4 border border-white/10 bg-black/20 px-4 py-3 transition hover:border-white/20 hover:bg-white/[0.03]`}
    >
      <span className={`grid size-10 shrink-0 place-items-center border border-white/10 bg-zinc-950 ${accent}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{title}</span>
          {badge && (
            <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${badge.color}`}>
              {badge.label}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs leading-5 text-zinc-500">{description}</p>
      </div>
      <span className="shrink-0 text-zinc-700 transition group-hover:text-zinc-400">→</span>
    </Link>
  );
}

export function AdminPanel({ stats, userEmail }: AdminPanelProps) {
  return (
    <div className="mx-auto max-w-4xl py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">管理面板</h1>
        {userEmail && (
          <p className="mt-1 text-sm text-zinc-500">
            以 <span className="text-zinc-300">{userEmail}</span> 身份登录
          </p>
        )}
      </div>

      {/* Stats */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500">数据概览</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            label="待审投稿"
            value={stats.submissions.pending}
            icon={Clock}
            accent="text-amber-400"
          />
          <StatCard
            label="已发布投稿"
            value={stats.submissions.approved}
            icon={CheckCircle}
            accent="text-emerald-400"
          />
          <StatCard
            label="公开题目"
            value={stats.problems.total}
            icon={BookOpen}
            accent="text-cyan-400"
          />
          <StatCard
            label="题目草稿"
            value={stats.drafts.drafting}
            icon={FileText}
            accent="text-violet-400"
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            label="需要修改"
            value={stats.submissions.needsRevision}
            icon={RotateCcw}
            accent="text-orange-400"
          />
          <StatCard
            label="已驳回投稿"
            value={stats.submissions.rejected}
            icon={XCircle}
            accent="text-red-400"
          />
          <StatCard
            label="总比赛数"
            value={stats.contests.total}
            icon={Trophy}
            accent="text-yellow-400"
          />
          <StatCard
            label="进行中比赛"
            value={stats.contests.active}
            icon={TrendingUp}
            accent="text-emerald-400"
          />
        </div>
      </section>

      {/* Entry cards */}
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500">功能入口</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <EntryCard
            href="/admin/submissions"
            icon={ShieldCheck}
            title="投稿审核"
            description="审核、编辑、批准或驳回用户提交的解法"
            accent="text-cyan-300"
            badge={
              stats.submissions.pending > 0
                ? { label: `${stats.submissions.pending} 待审`, color: "bg-amber-400/15 text-amber-300" }
                : undefined
            }
          />
          <EntryCard
            href="/admin/contests"
            icon={Trophy}
            title="比赛管理"
            description="创建和管理比赛、控制赛程状态和奖项"
            accent="text-yellow-300"
            badge={
              stats.contests.active > 0
                ? { label: `${stats.contests.active} 进行中`, color: "bg-emerald-400/15 text-emerald-300" }
                : undefined
            }
          />
          <EntryCard
            href="/admin/problem-vault"
            icon={Archive}
            title="题目草稿箱"
            description="管理未公开题目，编辑草稿并发布到公开题库"
            accent="text-violet-300"
            badge={
              stats.drafts.drafting > 0
                ? { label: `${stats.drafts.drafting} 草稿`, color: "bg-violet-400/15 text-violet-300" }
                : undefined
            }
          />
          <EntryCard
            href="/admin/proof-graph"
            icon={NetworkIcon}
            title="推理图谱"
            description="编辑题目的推理图谱节点、变换路径和方法边界"
            accent="text-violet-300"
          />
          <EntryCard
            href="/studio"
            icon={Hammer}
            title="Studio"
            description="内容创作工作台"
            accent="text-cyan-300"
          />
          <EntryCard
            href="/admin/users"
            icon={Users}
            title="用户管理"
            description="查看用户角色和权限（即将支持）"
            accent="text-zinc-500"
          />
        </div>
      </section>
    </div>
  );
}
