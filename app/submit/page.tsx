import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  GitPullRequestArrow,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { CopySubmissionTemplate, submissionTemplate } from "@/components/CopySubmissionTemplate";

export const metadata: Metadata = {
  title: "提交你的解法 | ProofArena",
  description: "向 ProofArena 提交可学习、可比较、可验证的高中数学解法。",
};

const submissionFields = [
  ["01", "题目来源", "卷别、年份、题号，或可核对的题目链接与完整题干。"],
  ["02", "解法标题", "用一句话说清这条路线的核心，例如“设斜率消元法”。"],
  ["03", "思路来源", "解释你从哪些条件、图像或结构中想到这条路径。"],
  ["04", "关键转化", "指出真正改变问题形态、让后续推导成立的那一步。"],
  ["05", "完整过程", "写出可独立阅读的推理链，不跳过决定正确性的步骤。"],
  ["06", "易错点", "标出符号、定义域、分类讨论、取等条件等风险位置。"],
  ["07", "五维自评", "正确性、考场性、优雅度、计算量、讲解友好，各给出简短依据。"],
  ["08", "可验证步骤", "列出可通过代入、作图、数值检查或 CAS 复核的关键结论。"],
  ["09", "是否使用超纲工具", "如使用微积分、复分析或竞赛定理，请明确标注用途。"],
];

const githubIssueUrl =
  "https://github.com/XuanheGuo/ProofArena/issues/new?title=%5B%E8%A7%A3%E6%B3%95%E6%8A%95%E7%A8%BF%5D%20&labels=solution-submission";

export default function SubmitPage() {
  return (
    <main className="grid-surface min-h-screen">
      <section className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-16">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white">
            <ArrowLeft className="size-4" />
            返回 ProofArena
          </Link>
          <div className="mt-10 max-w-3xl">
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan-300">
              <GitPullRequestArrow className="size-4" />
              Community submission
            </div>
            <h1 className="mt-4 text-4xl font-black text-white md:text-6xl">提交你的解法</h1>
            <p className="mt-5 text-base font-bold leading-8 text-zinc-200 md:text-lg">
              ProofArena 需要的不只是答案，而是可学习、可比较、可验证的解法。
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
              一条优秀投稿应让读者看懂“为什么会想到”，也能沿着完整步骤复算结果，并明确它在考场、讲解与迁移训练中的价值。
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        <section className="border border-white/10 bg-zinc-950">
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4 md:px-7">
            <span className="grid size-9 place-items-center bg-cyan-400 text-zinc-950">
              <FileText className="size-5" />
            </span>
            <div>
              <h2 className="font-bold text-white">投稿格式</h2>
              <p className="mt-0.5 text-xs text-zinc-500">九项信息，帮助解法进入可比较的同一套标准</p>
            </div>
          </div>
          <div className="grid gap-px bg-white/10 md:grid-cols-2">
            {submissionFields.map(([number, title, description]) => (
              <div key={number} className="grid grid-cols-[2.5rem_1fr] gap-3 bg-zinc-950 p-5 md:p-6">
                <span className="font-mono text-sm font-bold text-cyan-300">{number}</span>
                <div>
                  <h3 className="font-bold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 border border-white/10 bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 md:px-7">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-300" />
              <h2 className="font-bold text-white">Markdown 投稿模板</h2>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Ready to copy</span>
          </div>
          <pre className="math-scroll p-5 text-sm leading-8 text-zinc-300 md:p-7">
            <code>{submissionTemplate}</code>
          </pre>
        </section>

        <section className="mt-6 border border-cyan-400/30 bg-cyan-400/[0.06] p-5 md:p-7">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-cyan-300" />
            <div>
              <h2 className="font-bold text-white">投稿前检查</h2>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                请确认题干可核对、结论完整、超纲工具已标注。Demo 阶段暂不接收站内表单，投稿将通过 ProofArena 仓库的 GitHub Issue 整理。
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={githubIssueUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 w-full items-center justify-center gap-2 bg-cyan-400 px-5 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300 sm:w-auto"
            >
              <GitPullRequestArrow className="size-4" />
              通过 GitHub Issue 投稿
              <ArrowUpRight className="size-4" />
            </a>
            <CopySubmissionTemplate />
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-zinc-600">
            <CheckCircle2 className="size-3.5" />
            解法投稿默认按 CC BY-SA 4.0 协议共享，请只提交你有权授权的内容。
          </p>
        </section>
      </div>
    </main>
  );
}
