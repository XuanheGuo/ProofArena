"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Clock, ImageIcon, MessageSquareText, RefreshCw, Send, Star } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { MathBlock } from "@/components/MathBlock";
import { MAX_COMMENT_CHARS, clampText } from "@/lib/security";
import type { ContestThoughtEntry } from "@/lib/contests";
import type { Contest } from "@/lib/types";
import { formatContestDateTime } from "@/lib/format-contest-time";

// ─── Types ────────────────────────────────────────────────────────────────────

type RatingDraft = { clarity: number; insight: number; potential: number };
type SortMode = "score" | "newest";
const MAX_VISIBLE_THOUGHTS_PER_PROBLEM = 1;

const ratingDims: Array<{ key: keyof RatingDraft; label: string }> = [
  { key: "clarity", label: "清晰" },
  { key: "insight", label: "启发" },
  { key: "potential", label: "潜力" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDiscussionOpen(contest: Contest) {
  if (!contest.discussionStartAt || !contest.discussionEndAt)
    return contest.status === "judging" || contest.status === "finished";
  const now = Date.now();
  return (
    now >= new Date(contest.discussionStartAt).getTime() &&
    now <= new Date(contest.discussionEndAt).getTime()
  );
}

function localizeError(msg: string): string {
  if (!msg) return "操作失败，请稍后重试。";
  if (msg.includes("unique constraint") || msg.includes("duplicate")) return "你已经评过分了，可以直接更新。";
  if (msg.includes("foreign key") || msg.includes("not found")) return "找不到对应的投稿，可能已被删除。";
  if (msg.includes("permission") || msg.includes("row-level")) return "没有操作权限，请刷新后重试。";
  if (msg.includes("network") || msg.toLowerCase().includes("fetch")) return "网络异常，请检查连接后重试。";
  if (msg.length > 80) return "操作失败，请稍后重试。";
  return msg;
}

function getProblemLabel(
  thought: ContestThoughtEntry,
  problemTitles: Record<string, string>,
): string {
  if (thought.problemId) return problemTitles[thought.problemId] ?? thought.problemId;
  if (thought.draftProblemId) return problemTitles[thought.draftProblemId] ?? "未公开新题";
  return "未知题目";
}

function getThoughtProblemKey(thought: ContestThoughtEntry): string {
  return thought.draftProblemId ?? thought.problemId ?? thought.contestProblemKey ?? thought.id;
}

// ─── Per-card state ───────────────────────────────────────────────────────────

type CardState = {
  commentText: string;
  commentOpen: boolean;
  showAllComments: boolean;
  savingRating: boolean;
  savingComment: boolean;
  cardMessage: string;
  cardError: string;
  myRatingLoaded: boolean;
};

const emptyCardState = (): CardState => ({
  commentText: "",
  commentOpen: false,
  showAllComments: false,
  savingRating: false,
  savingComment: false,
  cardMessage: "",
  cardError: "",
  myRatingLoaded: false,
});

// ─── Main component ───────────────────────────────────────────────────────────

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
  const [ratingDrafts, setRatingDrafts] = useState<Record<string, RatingDraft>>({});
  const [myRatings, setMyRatings] = useState<Record<string, RatingDraft>>({});
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  const [activeTab, setActiveTab] = useState<"all" | string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("score");
  const discussionOpen = isDiscussionOpen(contest);
  const userIdRef = useRef<string | null>(null);

  // Load current user once for rating echo.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });
  }, [supabase]);

  // Load my existing ratings for all visible items when discussion opens.
  useEffect(() => {
    if (!discussionOpen) return;
    const visibleIds = items.filter((t) => !t.isRedacted && !t.hideFromArena).map((t) => t.id);
    if (visibleIds.length === 0) return;
    supabase
      .from("contest_submission_ratings")
      .select("submission_id, clarity, insight, potential")
      .eq("user_id", userIdRef.current ?? "")
      .in("submission_id", visibleIds)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, RatingDraft> = {};
        for (const r of data) {
          map[r.submission_id as string] = {
            clarity: Number(r.clarity),
            insight: Number(r.insight),
            potential: Number(r.potential),
          };
        }
        setMyRatings(map);
        setRatingDrafts((current) => ({ ...map, ...current }));
        setCardStates((current) => {
          const next = { ...current };
          for (const id of Object.keys(map)) {
            next[id] = { ...(next[id] ?? emptyCardState()), myRatingLoaded: true };
          }
          return next;
        });
      });
  }, [discussionOpen, items, supabase]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function cardState(id: string): CardState {
    return cardStates[id] ?? emptyCardState();
  }

  function updateCard(id: string, patch: Partial<CardState>) {
    setCardStates((current) => ({
      ...current,
      [id]: { ...(current[id] ?? emptyCardState()), ...patch },
    }));
  }

  function ratingDraftFor(id: string): RatingDraft {
    return ratingDrafts[id] ?? { clarity: 0, insight: 0, potential: 0 };
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function submitRating(thought: ContestThoughtEntry) {
    const cs = cardState(thought.id);
    if (cs.savingRating) return;
    updateCard(thought.id, { savingRating: true, cardError: "", cardMessage: "" });

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      updateCard(thought.id, { savingRating: false, cardError: "请先登录再评分。" });
      return;
    }
    if (thought.userId === user.id) {
      updateCard(thought.id, { savingRating: false, cardError: "不能给自己的思路评分。" });
      return;
    }

    const draft = ratingDraftFor(thought.id);
    if (ratingDims.some((d) => !Number.isInteger(draft[d.key]) || draft[d.key] < 1 || draft[d.key] > 5)) {
      updateCard(thought.id, { savingRating: false, cardError: "请把三个维度都打完分（1–5）。" });
      return;
    }

    const { error } = await supabase.from("contest_submission_ratings").upsert(
      { submission_id: thought.id, user_id: user.id, ...draft, updated_at: new Date().toISOString() },
      { onConflict: "submission_id,user_id" },
    );

    if (error) {
      updateCard(thought.id, { savingRating: false, cardError: localizeError(error.message) });
    } else {
      setMyRatings((current) => ({ ...current, [thought.id]: draft }));
      updateCard(thought.id, {
        savingRating: false,
        myRatingLoaded: true,
        cardMessage: "评分已保存，刷新后进入汇总均分。",
      });
    }
  }

  async function submitComment(thought: ContestThoughtEntry) {
    const cs = cardState(thought.id);
    if (cs.savingComment) return;
    const content = clampText(cs.commentText, MAX_COMMENT_CHARS);
    if (!content) return;

    updateCard(thought.id, { savingComment: true, cardError: "", cardMessage: "" });

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      updateCard(thought.id, { savingComment: false, cardError: "请先登录再讨论。" });
      return;
    }

    const { data, error } = await supabase
      .from("comments")
      .insert({ target_type: "submission", target_id: thought.id, user_id: user.id, content })
      .select("id, user_id, content, created_at")
      .single();

    if (error || !data) {
      updateCard(thought.id, { savingComment: false, cardError: localizeError(error?.message ?? "") });
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === thought.id
          ? {
              ...item,
              comments: [
                ...item.comments,
                { id: data.id as string, userId: data.user_id as string, author: "我", content: data.content as string, createdAt: data.created_at as string },
              ],
            }
          : item,
      ),
    );
    updateCard(thought.id, { savingComment: false, commentText: "", cardMessage: "补充已发布。" });
  }

  // ── Day tabs ──────────────────────────────────────────────────────────────

  const dayGroups = useMemo(() => {
    const map = new Map<string, ContestThoughtEntry[]>();
    for (const t of items) {
      const key = t.draftProblemId ?? t.problemId ?? t.contestProblemKey ?? "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    // Attach label from contest.problems order
    return contest.problems
      .map((cp) => {
        const key = cp.draftProblemId ?? cp.problemId ?? cp.id;
        const entries = map.get(key) ?? map.get(cp.id) ?? [];
        return { dayIndex: cp.dayIndex, title: cp.title, key, entries };
      })
      .filter((g) => g.entries.length > 0);
  }, [items, contest.problems]);

  const sortedItems = useMemo(() => {
    let result = activeTab === "all" ? items : items.filter((t) => {
      const key = getThoughtProblemKey(t);
      return key === activeTab;
    });

    if (sortMode === "newest") {
      result = [...result].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else {
      result = [...result].sort(
        (a, b) => (b.rating?.total ?? 0) - (a.rating?.total ?? 0) || b.createdAt.localeCompare(a.createdAt),
      );
    }
    return result;
  }, [items, activeTab, sortMode]);

  const displayCandidates = useMemo(
    () => sortedItems.filter((thought) => thought.isRedacted || !thought.hideFromArena),
    [sortedItems],
  );

  const visibleItems = useMemo(() => {
    const counts = new Map<string, number>();
    return displayCandidates.filter((thought) => {
      if (thought.isRedacted) return true;
      const key = getThoughtProblemKey(thought);
      const count = counts.get(key) ?? 0;
      if (count >= MAX_VISIBLE_THOUGHTS_PER_PROBLEM) return false;
      counts.set(key, count + 1);
      return true;
    });
  }, [displayCandidates]);

  const totalNonRedacted = items.filter((t) => !t.isRedacted).length;
  const selectedNonRedactedCount = sortedItems.filter((t) => !t.isRedacted).length;
  const visibleNonRedactedCount = visibleItems.filter((t) => !t.isRedacted).length;
  const displayCandidateCount = displayCandidates.filter((t) => !t.isRedacted).length;
  const hiddenByLimitCount = displayCandidateCount - visibleNonRedactedCount;
  const hasImages = visibleItems.some((t) => !t.isRedacted && t.imageUrls.length > 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section id="thoughts" className="scroll-mt-24 border border-amber-400/25 bg-amber-400/[0.04] p-5 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-amber-100">
            <MessageSquareText className="size-4 text-amber-300" />
            比赛思路专区
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            这里保留低门槛投稿：一个入口、一个观察、一张草稿图都可以先放进来。当前每题展示 {MAX_VISIBLE_THOUGHTS_PER_PROBLEM} 条，默认优先显示评分最高的思路。
          </p>
        </div>
        <div className="border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
          {contest.discussionStartAt && contest.discussionEndAt
            ? `${formatContestDateTime(contest.discussionStartAt)} - ${formatContestDateTime(contest.discussionEndAt)}（北京时间）`
            : "评审/结束阶段开放讨论"}
        </div>
      </div>

      {/* Tabs + sort */}
      {(dayGroups.length > 1 || items.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")} label={`全部 (${totalNonRedacted})`} />
            {dayGroups.map((g) => (
              <TabButton
                key={g.key}
                active={activeTab === g.key}
                onClick={() => setActiveTab(g.key)}
                label={`Day ${g.dayIndex} (${g.entries.filter((e) => !e.isRedacted).length})`}
              />
            ))}
          </div>
          <div className="flex gap-1">
            {(["score", "newest"] as SortMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSortMode(mode)}
                className={`h-7 border px-2.5 text-xs transition ${sortMode === mode ? "border-zinc-400 bg-zinc-700 text-white" : "border-white/10 text-zinc-500 hover:text-zinc-300"}`}
              >
                {mode === "score" ? "评分最高" : "最新"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Items */}
      {visibleItems.length === 0 ? (
        <div className="mt-5 border border-white/10 bg-zinc-950 px-6 py-10 text-center">
          <p className="text-sm font-bold text-white">
            {selectedNonRedactedCount > 0 ? "暂无可公开展示的比赛思路" : "还没有通过审核的比赛思路"}
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {selectedNonRedactedCount > 0
              ? "已收到的投稿仍会参与审核和比赛记录；勾选不展示的内容不会出现在公开卡片里。"
              : "比赛投稿通过后会先进入这里，而不是立刻变成正式题解。"}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {hiddenByLimitCount > 0 && (
            <p className="border border-white/10 bg-black/20 px-4 py-2 text-xs text-zinc-500">
              已按每题精选规则收起 {hiddenByLimitCount} 条思路，可切换排序查看每题最新或最高分代表。
            </p>
          )}
          {visibleItems.map((thought, index) => {
            if (thought.isRedacted) {
              const label = getProblemLabel(thought, problemTitles);
              return (
                <div key={thought.id} className="flex items-start gap-3 border border-amber-400/20 bg-amber-400/[0.04] px-5 py-4">
                  <Clock className="mt-0.5 size-4 shrink-0 text-amber-400" />
                  <div>
                    <p className="text-sm font-bold text-amber-200">
                      {label} 已收到 {thought.redactedCount ?? 0} 份思路，题目关闭后开放讨论
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      提交窗口关闭或比赛进入评审后，允许展示的思路正文、图片和评分会在此处公开。
                    </p>
                  </div>
                </div>
              );
            }

            const cs = cardState(thought.id);
            const draft = ratingDraftFor(thought.id);
            const hasMyRating = Boolean(myRatings[thought.id]);
            const visibleComments = cs.showAllComments
              ? thought.comments
              : thought.comments.slice(-3);

            return (
              <article key={thought.id} className="border border-white/10 bg-zinc-950">
                <div className="p-4 md:p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-zinc-600">#{index + 1}</span>
                    {(thought.problemId || thought.draftProblemId) && (
                      <span className="border border-cyan-400/25 bg-cyan-400/[0.06] px-2 py-0.5 text-cyan-300">
                        {getProblemLabel(thought, problemTitles)}
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

                {/* Per-card message/error */}
                {cs.cardMessage && (
                  <div className="mx-4 mb-2 flex items-center gap-2 border border-emerald-400/30 bg-emerald-400/[0.06] px-3 py-2 text-xs text-emerald-300">
                    <CheckCircle2 className="size-3.5 shrink-0" />
                    {cs.cardMessage}
                  </div>
                )}
                {cs.cardError && (
                  <p className="mx-4 mb-2 border border-red-400/30 bg-red-400/[0.06] px-3 py-2 text-xs text-red-300">
                    {cs.cardError}
                  </p>
                )}

                <div className="grid gap-0 border-t border-white/[0.07] lg:grid-cols-[minmax(0,1fr)_20rem]">
                  {/* Rating */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
                      <Star className="size-3.5 text-amber-300" />
                      思路评分
                      {thought.rating && (
                        <span className="font-normal text-zinc-600">
                          {thought.rating.count} 人 · {thought.rating.total.toFixed(1)} / 15
                        </span>
                      )}
                      {hasMyRating && <span className="text-amber-400/60">（已评）</span>}
                    </div>
                    {discussionOpen ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        {ratingDims.map((dim) => (
                          <label key={dim.key} className="grid gap-1 text-xs">
                            <span className="text-zinc-500">{dim.label}</span>
                            <select
                              value={draft[dim.key]}
                              onChange={(event) =>
                                setRatingDrafts((current) => ({
                                  ...current,
                                  [thought.id]: { ...draft, [dim.key]: Number(event.target.value) },
                                }))
                              }
                              className="h-8 border border-white/10 bg-black/20 px-2 text-zinc-200 outline-none"
                            >
                              <option value={0}>未评分</option>
                              {[1, 2, 3, 4, 5].map((score) => (
                                <option key={score} value={score}>{score}</option>
                              ))}
                            </select>
                          </label>
                        ))}
                        <button
                          type="button"
                          onClick={() => submitRating(thought)}
                          disabled={cs.savingRating}
                          className="h-8 border border-amber-400/35 bg-amber-400/10 px-3 text-xs font-bold text-amber-300 transition hover:bg-amber-400/15 disabled:opacity-50 sm:self-end"
                        >
                          {cs.savingRating ? (
                            <RefreshCw className="mx-auto size-3.5 animate-spin" />
                          ) : hasMyRating ? (
                            "更新评分"
                          ) : (
                            "保存评分"
                          )}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs leading-5 text-zinc-600">讨论时间开放后可以评分。</p>
                    )}
                  </div>

                  {/* Comments */}
                  <div className="border-t border-white/[0.07] p-4 lg:border-l lg:border-t-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-zinc-400">讨论补充</span>
                      <button
                        type="button"
                        onClick={() => updateCard(thought.id, { commentOpen: !cs.commentOpen })}
                        className="text-xs font-bold text-cyan-300"
                      >
                        {cs.commentOpen ? "收起" : "补充"}
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {thought.comments.length > 3 && !cs.showAllComments && (
                        <button
                          type="button"
                          onClick={() => updateCard(thought.id, { showAllComments: true })}
                          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
                        >
                          <ChevronDown className="size-3" />
                          查看全部 {thought.comments.length} 条
                        </button>
                      )}
                      {visibleComments.map((comment) => (
                        <div key={comment.id} className="border-l border-white/10 pl-3">
                          <p className="text-xs text-zinc-500">{comment.author} · {formatContestDateTime(comment.createdAt)}</p>
                          <p className="mt-1 text-xs leading-5 text-zinc-300">{comment.content}</p>
                        </div>
                      ))}
                      {thought.comments.length === 0 && (
                        <p className="text-xs text-zinc-600">还没有补充讨论。</p>
                      )}
                    </div>
                    {cs.commentOpen && discussionOpen && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={cs.commentText}
                          onChange={(e) => updateCard(thought.id, { commentText: e.target.value })}
                          maxLength={MAX_COMMENT_CHARS}
                          rows={3}
                          placeholder="补充一个观察、指出一个漏洞，或接着推一步。"
                          className="w-full resize-y border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-white outline-none focus:border-cyan-400/50"
                        />
                        <button
                          type="button"
                          onClick={() => submitComment(thought)}
                          disabled={cs.savingComment || !cs.commentText.trim()}
                          className="inline-flex h-8 items-center gap-2 bg-cyan-400 px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"
                        >
                          {cs.savingComment ? (
                            <RefreshCw className="size-3.5 animate-spin" />
                          ) : (
                            <Send className="size-3.5" />
                          )}
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

      {hasImages && (
        <p className="mt-4 inline-flex items-center gap-2 text-xs text-zinc-600">
          <ImageIcon className="size-3.5" />
          图片来自投稿者上传，点击可查看原图。
        </p>
      )}
    </section>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 border px-3 text-xs font-bold transition ${
        active
          ? "border-amber-400/60 bg-amber-400/15 text-amber-200"
          : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}
