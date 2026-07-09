import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  FilePlus2,
  Hammer,
  Lightbulb,
  MessageSquareText,
  ShieldCheck,
  Tags,
} from "lucide-react";
import { SubmitForm } from "@/components/SubmitForm";
import { getContest } from "@/lib/contests";
import { getMyContestRegistration } from "@/lib/contest-registration";
import { getProblems } from "@/lib/db";
import {
  adaptProblemDraftToProblem,
  getProblemDraftForContestDisplay,
} from "@/lib/problem-drafts";
import { isContestProblemLocked } from "@/lib/types";

export const metadata: Metadata = {
  title: "提交题目或解法 | ProofArena",
  description:
    "向 ProofArena 提交高中数学题目，或为已有题补充可学习、可比较、可验证的解法。",
};

const acceptedSolutionTraits = [
  ["能复算", "关键步骤说清楚，读者不需要猜中间省略了什么。"],
  ["能比较", "写明它适合考场、讲解、迁移还是技巧欣赏。"],
  ["能验证", "给出可代入、作图、数值检查或 CAS 复核的位置。"],
  ["能迁移", "不只停在本题结论，还说明这条观察能带到哪里。"],
];

export const dynamic = "force-dynamic";

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, problems] = await Promise.all([searchParams, getProblems()]);
  const contestSlug =
    typeof params.contest === "string" ? params.contest : undefined;
  const initialProblemId =
    typeof params.problem === "string" ? params.problem : undefined;
  const initialForkSolutionId =
    typeof params.fork === "string" ? params.fork : undefined;
  const contest = contestSlug ? await getContest(contestSlug) : undefined;
  const contestRegistration = contest
    ? await getMyContestRegistration(contest.id)
    : null;

  // A contest problem may be backed by either a public problem (problemId)
  // or a Problem Vault draft (draftProblemId).  Find the match either way.
  const contestProblem = contest?.problems.find(
    (item) =>
      item.problemId === initialProblemId ||
      item.draftProblemId === initialProblemId,
  );

  // Contest problems backed by Problem Vault drafts (not yet in the public
  // catalog) need their minimal data fetched via the service-role path so
  // participants can still pick them and submit. Offer every unlocked,
  // non-sprint draft-backed problem of the contest — not just the one from
  // the ?problem= param — so the contest page's generic "提交解法" entry
  // (which carries no problem id) also gets a full problem list.
  // isContestProblemLocked guards against premature reveal here just as it
  // does in the dedicated /contests/[slug]/problems/[id] route.
  let draftProblemOptions: Array<{
    id: string;
    title: string;
    source: string;
    solutions: never[];
  }> = [];
  if (contest) {
    const unlockedDraftIds = [
      ...new Set(
        contest.problems
          .filter(
            (item) =>
              item.draftProblemId &&
              item.problemPhase !== "sprint" &&
              !isContestProblemLocked(contest, item),
          )
          .map((item) => item.draftProblemId as string),
      ),
    ];
    const drafts = await Promise.all(
      unlockedDraftIds.map((id) => getProblemDraftForContestDisplay(id)),
    );
    draftProblemOptions = drafts
      .filter((draft): draft is NonNullable<typeof draft> => Boolean(draft))
      .map((draft) => {
        const adapted = adaptProblemDraftToProblem(draft);
        return {
          id: adapted.id,
          title: adapted.title,
          source: `${adapted.year} ${adapted.region}${adapted.number ? ` · ${adapted.number}` : ""}`,
          solutions: [],
        };
      });
  }

  const problemOptions = [
    ...draftProblemOptions,
    ...problems.map((problem) => ({
      id: problem.id,
      title: problem.title,
      source: `${problem.year} ${problem.region} · ${problem.paper}${problem.number ? ` · ${problem.number}` : ""}`,
      solutions: problem.solutions.map((solution) => ({
        id: solution.id,
        title: solution.title,
        author: solution.author,
        kind: solution.kind,
        scores: solution.scores,
        origin: solution.origin,
        keyTransform: solution.keyTransform,
        inspiration: solution.inspiration,
      })),
    })),
  ];

  return (
    <main className="grid-surface min-h-screen">
      <section className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 md:py-16 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white"
          >
            <ArrowLeft className="size-4" />
            返回 ProofArena
          </Link>
          <div className="mt-10">
            <h1 className="text-4xl font-black text-white md:text-5xl">
              提交题目或解法
            </h1>
            <p className="mt-4 text-base leading-7 text-zinc-400">
              新题和解法分开提交：题目先进入题库审核，解法则绑定到已有题目。
              不需要格式完美，把来源、题干、思路和步骤说清楚就行。
            </p>
            <p className="mt-3 text-sm text-zinc-600">
              想提交更完整的结构化解法？试试{" "}
              <Link
                href="/studio"
                className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
              >
                <Hammer className="size-3" />
                ProofArena Studio
              </Link>
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:px-6 md:py-12 lg:grid-cols-[16rem_minmax(0,1fr)_18rem] lg:px-8">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="border border-white/10 bg-zinc-950">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <Lightbulb className="size-4 text-amber-300" />
              <h2 className="text-sm font-bold text-white">解法要求</h2>
            </div>
            <div className="divide-y divide-white/10">
              {acceptedSolutionTraits.map(([title, description]) => (
                <div key={title} className="p-4">
                  <h3 className="text-sm font-bold text-white">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-white/10 bg-zinc-950 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <FilePlus2 className="size-4 text-cyan-300" />
              投稿流向
            </div>
            <ol className="mt-4 space-y-3 text-xs leading-5 text-zinc-500">
              {[
                "提交题目或解法",
                "进入人工审核",
                "补充标签与结构",
                "展示到题目页",
              ].map((item, index) => (
                <li key={item} className="grid grid-cols-[1.5rem_1fr] gap-2">
                  <span className="font-mono font-bold text-cyan-300">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>

        <section className="border border-cyan-400/30 bg-cyan-400/[0.04] p-5 md:p-7">
          <div className="mb-6 flex items-start gap-3">
            <MessageSquareText className="mt-0.5 size-5 shrink-0 text-cyan-300" />
            <div>
              <h2 className="font-bold text-white">在线投稿</h2>
              <p className="mt-1.5 text-sm text-zinc-400">
                选择上传题目或上传解法。审核通过后，题目会进入题库，解法会出现在对应题目页面。
              </p>
            </div>
          </div>
          <SubmitForm
            problems={problemOptions}
            initialProblemId={initialProblemId}
            initialForkSolutionId={initialForkSolutionId}
            contestContext={contest ? { contest, contestProblem } : undefined}
            contestRegistration={contestRegistration}
          />
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="border border-white/10 bg-zinc-950 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-300" />
              <div>
                <h2 className="text-sm font-bold text-white">版权与署名</h2>
                <p className="mt-2 text-xs leading-6 text-zinc-500">
                  解法内容默认按 CC BY-SA 4.0 共享，代码按 AGPL-3.0
                  开源。参考他人讨论或公开资料时，请在思路中注明。
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["CC BY-SA 4.0", "AGPL-3.0", "保留署名"].map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-zinc-400"
                >
                  <Tags className="size-3" />
                  {item}
                </span>
              ))}
            </div>
            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-zinc-600">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
              好的署名会让高质量题解在传播时仍然有来处。
            </p>
          </section>

          <section className="border border-cyan-400/20 bg-zinc-950 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Hammer className="size-4 text-cyan-300" />
              Studio
            </div>
            <p className="mt-2 text-xs leading-6 text-zinc-500">
              如果你想让解法像正式卡片一样预览、补五维评分和知识点匹配，用
              Studio 会更顺手。
            </p>
            <Link
              href="/studio"
              className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 bg-cyan-400 px-3 text-xs font-bold text-zinc-950 transition hover:bg-cyan-300"
            >
              打开 Studio
            </Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
