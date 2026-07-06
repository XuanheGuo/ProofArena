"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock, ImageIcon, MessageSquareText, Send, Star } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { MathBlock } from "@/components/MathBlock";
import { MAX_COMMENT_CHARS, clampText } from "@/lib/security";
import type { ContestThoughtEntry } from "@/lib/contests";
import type { Contest } from "@/lib/types";
import { formatContestDateTime } from "@/lib/format-contest-time";

type RatingDraft = {
  clarity: number;
  insight: number;
  potential: number;
};

const ratingDims: Array<{ key: keyof RatingDraft; label: string }> = [
  { key: "clarity", label: "清晰" },
  { key: "insight", label: "启发" },
  { key: "potential", label: "潜力" },
];

function isDiscussionOpen(contest: Contest) {
  if (!contest.discussionStartAt || !contest.discussionEndAt) return contest.status === "judging" || contest.status === "finished";
  const now = Date.now();
  return now >= new Date(contest.discussionStartAt).getTime() && now <= new Date(contest.discussionEndAt).getTime();
}

export function ContestThoughtArena({
  contest,
  thoughts,
  problemTitles,
}: {
  contest: Contest;
  thoughts: ContestThoughtEntry[];
  problemTitles: Record<string, string>;
}) {
  const supabase = createClient();
  const [items, setItems] = useState(thoughts);
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [ratingDrafts, setRatingDrafts] = useState<Record<string, RatingDraft>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const discussionOpen = isDiscussionOpen(contest);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (b.rating?.total ?? 0) - (a.rating?.total ?? 0) || a.createdAt.localeCompare(b.createdAt)),
    [items],
  );

  function draftFor(id: string) {
    return ratingDrafts[id] ?? { clarity: 0, insight: 0, potential: 0 };
  }

  async function submitRating(thought: ContestThoughtEntry) {
    setError("");
    setMessage("");
    if (!discussionOpen) {
      setError("讨论时间尚未开放。");
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setError("请先登录再评分。");
      return;
    }
    if (thought.userId === user.id) {
      setError("不能给自己的思路评分。");
      return;
    }

    const draft = draftFor(thought.id);
    if (ratingDims.some((dim) => !Number.isInteger(draft[dim.key]) || draft[dim.key] < 1 || draft[dim.key] > 5)) {
      setError("请把三个维度都打完分。");
      return;
    }

    const { error: ratingError } = await supabase
      .from("contest_submission_ratings")
      .upsert({
        submission_id: thought.id,
        user_id: user.id,
        ...draft,
        updated_at: new Date().toISOString(),
      }, { onConflict: "submission_id,user_id" });

    if (ratingError) {
      setError(ratingError.message || "评分失败。");
      return;
    }

    setMessage("评分已保存。刷新后会进入汇总均分。");
  }

  async function submitComment(thought: ContestThoughtEntry) {
    setError("");
    setMessage("");
    if (!discussionOpen) {
      setError("讨论时间尚未开放。");
      return;
    }
    const content = clampText(commentText, MAX_COMMENT_CHARS);
    if (!content) return;

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setError("请先登录再讨论。");
      return;
    }

    const { data, error: commentError } = await supabase
      .from("comments")
      .insert({
        target_type: "submission",
        target_id: thought.id,
        user_id: user.id,
        content,
      })
      .select("id, user_id, content, created_at")
      .single();

    if (commentError || !data) {
      setError(commentError?.message || "评论失败。");
      return;
    }

    setItems((current) => current.map((item) => item.id === thought.id
      ? {
          ...item,
          comments: [
            ...item.comments,
            {
              id: data.id as string,
              userId: data.user_id as string,
              author: "我",
              content: data.content as string,
              createdAt: data.created_at as string,
            },
          ],
        }
      : item));
    setCommentText("");
    setMessage("补充已发布。");
  }

  return (
    <section id="thoughts" className="scroll-mt-24 border border-amber-400/25 bg-amber-400/[0.04] p-5 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-amber-100">
            <MessageSquareText className="size-4 text-amber-300" />
            比赛思路专区
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            这里保留低门槛投稿：一个入口、一个观察、一张草稿图都可以先放进来。讨论和评分会帮助优秀思路慢慢沉淀成正式题解。
          </p>
        </div>
        <div className="border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
          {contest.discussionStartAt && contest.discussionEndAt
            ? `${formatContestDateTime(contest.discussionStartAt)} - ${formatContestDateTime(contest.discussionEndAt)}（北京时间）`
            : "评审/结束阶段开放讨论"}
        </div>
      </div>

      {message && (
        <p className="mt-4 inline-flex items-center gap-2 border border-emerald-400/30 bg-emerald-400/[0.06] px-3 py-2 text-sm text-emerald-300">
          <CheckCircle2 className="size-4" />
          {message}
        </p>
      )}
      {error && <p className="mt-4 border border-red-400/30 bg-red-400/[0.06] px-3 py-2 text-sm text-red-300">{error}</p>}

      {sortedItems.length === 0 ? (
        <div className="mt-5 border border-white/10 bg-zinc-950 px-6 py-10 text-center">
          <p className="text-sm font-bold text-white">还没有通过审核的比赛思路</p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">比赛投稿通过后会先进入这里，而不是立刻变成正式题解。</p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {sortedItems.map((thought, index) => {
            const draft = draftFor(thought.id);

            // Redacted: this contest problem is still open. Show count only.
            if (thought.isRedacted) {
              const problemLabel = thought.problemId
                ? (problemTitles[thought.problemId] ?? thought.problemId)
                : thought.draftProblemId
                  ? (problemTitles[thought.draftProblemId] ?? "本题")
                  : "本题";
              return (
                <div key={thought.id} className="flex items-start gap-3 border border-amber-400/20 bg-amber-400/[0.04] px-5 py-4">
                  <Clock className="mt-0.5 size-4 shrink-0 text-amber-400" />
                  <div>
                    <p className="text-sm font-bold text-amber-200">
                      {problemLabel} 已收到 {thought.redactedCount ?? 0} 份思路，题目关闭后开放讨论
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      提交窗口关闭或比赛进入评审后，全部思路的正文、图片和评分将在此处公开。
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <article key={thought.id} className="border border-white/10 bg-zinc-950">
                <div className="p-4 md:p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-zinc-600">#{index + 1}</span>
                    {(thought.problemId || thought.draftProblemId) && (
                      <span className="border border-cyan-400/25 bg-cyan-400/[0.06] px-2 py-0.5 text-cyan-300">
                        {thought.problemId
                          ? (problemTitles[thought.problemId] ?? thought.problemId)
                          : (problemTitles[thought.draftProblemId!] ?? "未公开新题")}
                      </span>
                    )}
                    {thought.isPostContest && <span className="border border-zinc-600 px-2 py-0.5 text-zinc-400">赛后补充</span>}
                    <span className="text-zinc-600">{formatContestDateTime(thought.createdAt)} · {thought.author}</span>
                  </div>
                  <h3 className="mt-3 text-base font-bold text-white">{thought.title}</h3>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                    <MathBlock>{thought.contentText}</MathBlock>
                  </div>

                  {thought.imageUrls.length > 0 && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {thought.imageUrls.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden border border-white/10 bg-black/30">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="比赛投稿图片" className="max-h-96 w-full object-contain" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-0 border-t border-white/[0.07] lg:grid-cols-[minmax(0,1fr)_20rem]">
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
                      <Star className="size-3.5 text-amber-300" />
                      思路评分
                      {thought.rating && <span className="font-normal text-zinc-600">{thought.rating.count} 人 · {thought.rating.total.toFixed(1)} / 15</span>}
                    </div>
                    {discussionOpen ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        {ratingDims.map((dim) => (
                          <label key={dim.key} className="grid gap-1 text-xs">
                            <span className="text-zinc-500">{dim.label}</span>
                            <select
                              value={draft[dim.key]}
                              onChange={(event) => setRatingDrafts((current) => ({
                                ...current,
                                [thought.id]: { ...draft, [dim.key]: Number(event.target.value) },
                              }))}
                              className="h-8 border border-white/10 bg-black/20 px-2 text-zinc-200 outline-none"
                            >
                              <option value={0}>未评分</option>
                              {[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}</option>)}
                            </select>
                          </label>
                        ))}
                        <button
                          type="button"
                          onClick={() => submitRating(thought)}
                          className="h-8 border border-amber-400/35 bg-amber-400/10 px-3 text-xs font-bold text-amber-300 transition hover:bg-amber-400/15 sm:self-end"
                        >
                          保存评分
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs leading-5 text-zinc-600">讨论时间开放后可以评分。</p>
                    )}
                  </div>

                  <div className="border-t border-white/[0.07] p-4 lg:border-l lg:border-t-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-zinc-400">讨论补充</span>
                      <button
                        type="button"
                        onClick={() => setOpenCommentId(openCommentId === thought.id ? null : thought.id)}
                        className="text-xs font-bold text-cyan-300"
                      >
                        {openCommentId === thought.id ? "收起" : "补充"}
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {thought.comments.slice(-3).map((comment) => (
                        <div key={comment.id} className="border-l border-white/10 pl-3">
                          <p className="text-xs text-zinc-500">{comment.author} · {formatContestDateTime(comment.createdAt)}</p>
                          <p className="mt-1 text-xs leading-5 text-zinc-300">{comment.content}</p>
                        </div>
                      ))}
                      {thought.comments.length === 0 && <p className="text-xs text-zinc-600">还没有补充讨论。</p>}
                    </div>
                    {openCommentId === thought.id && discussionOpen && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={commentText}
                          onChange={(event) => setCommentText(event.target.value)}
                          maxLength={MAX_COMMENT_CHARS}
                          rows={3}
                          placeholder="补充一个观察、指出一个漏洞，或接着推一步。"
                          className="w-full resize-y border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-white outline-none focus:border-cyan-400/50"
                        />
                        <button
                          type="button"
                          onClick={() => submitComment(thought)}
                          className="inline-flex h-8 items-center gap-2 bg-cyan-400 px-3 text-xs font-bold text-zinc-950"
                        >
                          <Send className="size-3.5" />
                          发布补充
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {thoughts.some((thought) => thought.imageUrls.length > 0) && (
        <p className="mt-4 inline-flex items-center gap-2 text-xs text-zinc-600">
          <ImageIcon className="size-3.5" />
          图片来自投稿者上传，点击可查看原图。
        </p>
      )}
    </section>
  );
}
