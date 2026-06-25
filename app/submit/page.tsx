import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  GitPullRequestArrow,
  Lightbulb,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Tags,
} from "lucide-react";
import { CopySubmissionTemplate, submissionTemplate } from "@/components/CopySubmissionTemplate";

export const metadata: Metadata = {
  title: "提交你的解法 | ProofArena",
  description: "向 ProofArena 提交可学习、可比较、可验证的高中数学解法。",
};

const submissionFields = [
  ["01", "题目来源", "卷别、年份、题号，或可核对的题目链接与完整题干。"],
  ["02", "解法标题", "用一句话说清这条路线的核心，例如“设斜率消元法”。"],
  ["03", "作者署名", "可以是真名、网名或“匿名投稿”，后续展示会尊重你的署名。"],
  ["04", "解法类型标签", "统一使用：标准解、启发解、稳健解、教学解。"],
  ["05", "思路来源", "解释你从哪些条件、图像或结构中想到这条路径。"],
  ["06", "关键转化", "指出真正改变问题形态、让后续推导成立的那一步。"],
  ["07", "完整过程", "写出可独立阅读的推理链，不跳过决定正确性的步骤。"],
  ["08", "启发点", "这条解法最值得别人学走的观察是什么。"],
  ["09", "迁移价值", "说明它还能迁移到哪些题型、模型或常见设问。"],
  ["10", "适用场景", "比如考场拿分、拓展思维、课堂讲解、技巧欣赏。"],
  ["11", "代价与局限", "诚实写出计算较重、思路难想、依赖图像等代价。"],
  ["12", "易错点", "标出符号、定义域、分类讨论、取等条件等风险位置。"],
  ["13", "五维自评", "正确性、考场性、结构美感、计算量、讲解友好，各给出简短依据。"],
  ["14", "可验证步骤", "列出可通过代入、作图、数值检查或 CAS 复核的关键结论。"],
  ["15", "是否使用超纲工具", "如使用微积分、复分析或竞赛定理，请明确标注用途。"],
];

const githubIssueUrl = "https://github.com/XuanheGuo/ProofArena/issues";

const acceptedSolutionTraits = [
  ["能复算", "关键步骤说清楚，读者不需要猜中间省略了什么。"],
  ["能比较", "写明它适合考场、讲解、迁移还是技巧欣赏。"],
  ["能验证", "给出可代入、作图、数值检查或 CAS 复核的位置。"],
  ["能迁移", "不只停在本题结论，还说明这条观察能带到哪里。"],
];

const exampleSubmission = `## 题目来源
2026 天津卷第 18 题，导数与参数问题。

## 解法标题
无量纲化转化法

## 作者署名
ProofArena 示例

## 解法类型标签
启发解、参数法、适合提思维

## 思路来源
目标含 x1x2 < 1/a^2，先尝试令 u = ax1, v = ax2，把参数 a 从根的位置里剥离出来。

## 关键转化
把原方程化成只含 u, v 的结构，再用根的分布关系讨论 uv。

## 完整过程
写出换元、方程变形、根的范围判断与最终不等式推导。每一步保留定义域和 a 的取值限制。

## 启发点
看到目标里同时出现根的乘积和参数平方时，可以先尝试把变量按参数缩放。

## 迁移价值
适合迁移到含 ax、ln x、根的乘积或根的范围估计的导数压轴题。

## 适用场景
拓展思维、技巧欣赏、复盘提炼

## 代价与局限
换元入口不够自然；第一次做题时不一定比标准导数法稳。

## 易错点
换元后的定义域；参数 a 的正负；由图像穿轴得到根位置时要说明单调区间。

## 五维自评
- 正确性：9
- 考场性：7
- 结构美感：9
- 计算量：8
- 讲解友好：8

## 可验证步骤
可用数值取 a = 2 检查根的位置和乘积结论；也可用图像验证穿轴次数。

## 是否使用超纲工具
未使用。`;

export default function SubmitPage() {
  return (
    <main className="grid-surface min-h-screen">
      <section className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6 md:py-16 lg:px-8">
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

      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-6 md:py-12 lg:px-8">
        <section className="border border-white/10 bg-zinc-950">
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4 md:px-7">
            <span className="grid size-9 place-items-center bg-red-500 text-white">
              <Lightbulb className="size-5" />
            </span>
            <div>
              <h2 className="font-bold text-white">ProofArena 收什么样的解法？</h2>
              <p className="mt-0.5 text-xs text-zinc-500">不是只收答案，而是收一条可以被学习、比较、验证的路线</p>
            </div>
          </div>
          <div className="grid gap-px bg-white/10 md:grid-cols-4">
            {acceptedSolutionTraits.map(([title, description]) => (
              <div key={title} className="bg-zinc-950 p-5 md:p-6">
                <h3 className="font-bold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-500">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 border border-white/10 bg-zinc-950">
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4 md:px-7">
            <span className="grid size-9 place-items-center bg-cyan-400 text-zinc-950">
              <FileText className="size-5" />
            </span>
            <div>
              <h2 className="font-bold text-white">投稿格式</h2>
              <p className="mt-0.5 text-xs text-zinc-500">这些字段会直接对应到解法卡片、解法画像和验证信息</p>
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
          <div className="border-t border-white/10 px-5 py-4 md:px-7">
            <CopySubmissionTemplate />
          </div>
        </section>

        <section className="mt-6 border border-white/10 bg-zinc-950">
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4 md:px-7">
            <span className="grid size-9 place-items-center bg-amber-300 text-zinc-950">
              <ClipboardList className="size-5" />
            </span>
            <div>
              <h2 className="font-bold text-white">示例投稿</h2>
              <p className="mt-0.5 text-xs text-zinc-500">不用写得花哨，但要让后来的人知道你是怎么想的</p>
            </div>
          </div>
          <pre className="math-scroll bg-black/20 p-5 text-sm leading-8 text-zinc-300 md:p-7">
            <code>{exampleSubmission}</code>
          </pre>
        </section>

        <section className="mt-6 border border-cyan-400/30 bg-cyan-400/[0.06] p-5 md:p-7">
          <div className="flex items-start gap-3">
            <MessageSquareText className="mt-0.5 size-5 shrink-0 text-cyan-300" />
            <div>
              <h2 className="font-bold text-white">当前支持的投稿方式</h2>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Demo 阶段先通过 GitHub Issue 共建。你可以复制模板，新建 Issue，把题目与解法贴进去；后续整理进站内数据时，会尽量保留原署名与讨论记录。
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
        </section>

        <section className="mt-6 border border-white/10 bg-zinc-950 p-5 md:p-7">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-300" />
            <div>
              <h2 className="font-bold text-white">版权与署名说明</h2>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                解法内容默认按 CC BY-SA 4.0 共享，程序代码按 AGPL-3.0 开源。投稿前请确认你有权分享这份内容；如果你的解法参考了老师讲义、同学讨论或公开资料，请在作者署名或思路来源里写清楚。
              </p>
              <p className="mt-4 flex items-center gap-2 text-xs text-zinc-600">
                <CheckCircle2 className="size-3.5" />
                好的署名不是麻烦，它会让高质量题解在传播时仍然有来处。
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {["Code: AGPL-3.0", "Content: CC BY-SA 4.0", "保留作者署名", "标注参考来源"].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5 border border-white/10 px-3 py-1.5 text-xs font-bold text-zinc-400">
                <Tags className="size-3" />
                {item}
              </span>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
