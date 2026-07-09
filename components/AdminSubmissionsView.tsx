"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { publishSubmission } from "@/lib/publish-submission";
import { createClient } from "@/lib/supabase-client";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  FileText,
  KeyRound,
  MessageSquareText,
  Route,
  Save,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import { CASVerifier } from "@/components/CASVerifier";
import { AdminContestScoringView } from "@/components/AdminContestScoringView";
import { MathBlock } from "@/components/MathBlock";
import { ScoreBar } from "@/components/ScoreBar";
import { convertPlainMathTextToLatex } from "@/lib/math-normalizer";
import { getSolutionKindMeta } from "@/lib/solution-kinds";
import { contestSolutionTypeMeta } from "@/lib/contest-meta";
import { clearSubmissionCooldown } from "@/lib/submission-rate-limit-actions";
import type { ContestAnswerType, SolutionScores } from "@/lib/types";
import { TextArea, TextField } from "@/components/ui";
import {
  ContestSubmissionReviewPreview,
  ReviewCardPreview,
  StandardAnswerHintPanel,
} from "@/components/admin-submissions/ReviewPreviews";
import {
  buildMarkdown,
  computeSubmissionScopeKey,
  contentFromForm,
  formFromSubmission,
  inlineScoreDraftFrom,
  isContestSubmission,
  isForkPR,
  kindLabels,
  normalizeScore,
  scoreLabels,
  splitList,
  type ContestProblemAnswerHint,
  type ContestProblemAnswerKeyRow,
  type ContestSubmissionScoreRow,
  type InlineScoreDraft,
  type ReviewForm,
  type ScoringContest,
  type SolutionKind,
  type Submission,
  type SubmissionStatus,
} from "@/components/admin-submissions/model";

export function AdminSubmissionsView() {
  const searchParams = useSearchParams();
  const contestParam = searchParams.get("contest");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] =
    useState<Submission | null>(null);
  const [form, setForm] = useState<ReviewForm | null>(null);
  const [previewMode, setPreviewMode] = useState<
    "structured" | "card" | "markdown"
  >("structured");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<"all" | "regular" | "contest">(
    () => (contestParam ? "contest" : "all"),
  );
  const [contestSlugFilter, setContestSlugFilter] = useState<string>(
    contestParam ?? "",
  );
  const [contestProblemKeyFilter, setContestProblemKeyFilter] =
    useState<string>("");
  const [scoringContest, setScoringContest] = useState<ScoringContest | null>(
    null,
  );
  const [scoringLoading, setScoringLoading] = useState(false);
  const [scoringError, setScoringError] = useState("");
  // precheck_failed submissions never entered review — kept out of the
  // default queue view (they'd otherwise clutter the main list moderators
  // triage), visible via this toggle instead.
  const [showPrecheckFailed, setShowPrecheckFailed] = useState(false);
  const [rateLimitLookup, setRateLimitLookup] = useState<{
    consecutiveFailures: number;
    cooldownUntil: string | null;
  } | null>(null);
  const [clearingCooldown, setClearingCooldown] = useState(false);
  const [answerHints, setAnswerHints] = useState<
    Record<string, ContestProblemAnswerHint>
  >({});
  const [submissionScores, setSubmissionScores] = useState<
    Record<string, ContestSubmissionScoreRow>
  >({});
  const [inlineScoreDraft, setInlineScoreDraft] = useState<InlineScoreDraft>({
    rawScore: "",
    judgeNote: "",
  });
  const [inlineScoreSaving, setInlineScoreSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadSubmissions();
  }, []);

  useEffect(() => {
    if (scopeFilter !== "contest" || !contestSlugFilter) {
      setScoringContest(null);
      setScoringError("");
      setScoringLoading(false);
      return;
    }

    let cancelled = false;
    async function loadScoringContest() {
      setScoringLoading(true);
      setScoringError("");
      const { data, error: loadError } = await supabase
        .from("contests")
        .select(
          "id, slug, title, contest_problems(id, day_index, title, problem_phase, score_max, time_limit_seconds, problem_id, draft_problem_id)",
        )
        .eq("slug", contestSlugFilter)
        .single();

      if (cancelled) return;
      setScoringLoading(false);
      if (loadError || !data) {
        setScoringContest(null);
        setScoringError(loadError?.message || "加载比赛评分台失败。");
        return;
      }
      setScoringContest(data as ScoringContest);
    }

    void loadScoringContest();
    return () => {
      cancelled = true;
    };
  }, [scopeFilter, contestSlugFilter]);

  const loadSubmissions = async () => {
    const { data, error: loadError } = await supabase
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (!loadError && data) {
      const rows = data as Submission[];
      setSubmissions(rows);
      await loadContestAnswerHints(rows);
    }
    setLoading(false);
  };

  const loadContestAnswerHints = async (rows: Submission[]) => {
    const contestRows = rows.filter((submission) => submission.contest_slug);
    if (contestRows.length === 0) {
      setAnswerHints({});
      return;
    }

    const contestProblemIds = [
      ...new Set(
        contestRows
          .map((submission) => submission.contest_problem_key)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const problemIds = [
      ...new Set(
        contestRows
          .map((submission) => submission.problem_id)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const draftProblemIds = [
      ...new Set(
        contestRows
          .map((submission) => submission.draft_problem_id)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const [contestProblemsRes, answerKeysRes, problemsRes, draftsRes] =
      await Promise.all([
        contestProblemIds.length > 0
          ? supabase
              .from("contest_problems")
              .select(
                "id, contest_id, title, problem_id, draft_problem_id, problem_phase, score_max, answer_type, answer_format_note",
              )
              .in("id", contestProblemIds)
          : Promise.resolve({ data: [], error: null }),
        contestProblemIds.length > 0
          ? supabase
              .from("contest_problem_answer_keys")
              .select(
                "contest_problem_id, answer_type, answer_key, format_note",
              )
              .in("contest_problem_id", contestProblemIds)
          : Promise.resolve({ data: [], error: null }),
        problemIds.length > 0
          ? supabase.from("problems").select("id, answer").in("id", problemIds)
          : Promise.resolve({ data: [], error: null }),
        draftProblemIds.length > 0
          ? supabase
              .from("problem_drafts")
              .select("id, answer")
              .in("id", draftProblemIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (contestProblemsRes.error) {
      setAnswerHints({});
      return;
    }

    const contestProblems = (contestProblemsRes.data ?? []) as Array<{
      id: string;
      title: string;
      problem_id: string | null;
      draft_problem_id: string | null;
      answer_type: ContestAnswerType | null;
      answer_format_note: string | null;
      contest_id: string;
      problem_phase: string;
      score_max: number;
    }>;
    const answerKeys = new Map(
      ((answerKeysRes.data ?? []) as ContestProblemAnswerKeyRow[]).map(
        (row) => [row.contest_problem_id, row],
      ),
    );
    const problemAnswers = new Map(
      (
        (problemsRes.data ?? []) as Array<{ id: string; answer: string | null }>
      ).map((row) => [row.id, row.answer ?? ""]),
    );
    const draftAnswers = new Map(
      (
        (draftsRes.data ?? []) as Array<{ id: string; answer: string | null }>
      ).map((row) => [row.id, row.answer ?? ""]),
    );

    const contestProblemById = new Map(
      contestProblems.map((problem) => [problem.id, problem]),
    );
    const nextHints: Record<string, ContestProblemAnswerHint> = {};
    for (const submission of contestRows) {
      const contestProblem = submission.contest_problem_key
        ? contestProblemById.get(submission.contest_problem_key)
        : undefined;
      if (!contestProblem) continue;

      const answerKey = answerKeys.get(contestProblem.id);
      const referenceAnswer = contestProblem.draft_problem_id
        ? (draftAnswers.get(contestProblem.draft_problem_id) ?? "")
        : contestProblem.problem_id
          ? (problemAnswers.get(contestProblem.problem_id) ?? "")
          : "";

      nextHints[submission.id] = {
        contestProblemId: contestProblem.id,
        contestId: contestProblem.contest_id,
        contestProblemTitle: contestProblem.title,
        problemPhase: contestProblem.problem_phase,
        scoreMax: Number(contestProblem.score_max) || 100,
        answerType: answerKey?.answer_type ?? contestProblem.answer_type,
        answerFormatNote:
          answerKey?.format_note ?? contestProblem.answer_format_note ?? "",
        answerKey: answerKey?.answer_key,
        referenceAnswer,
      };
    }

    setAnswerHints(nextHints);

    const scoreRowsRes =
      contestProblemIds.length > 0
        ? await supabase
            .from("contest_submission_scores")
            .select(
              "id, contest_problem_id, submission_id, user_id, raw_score, judge_note, scored_at",
            )
            .in("contest_problem_id", contestProblemIds)
        : { data: [], error: null };

    if (scoreRowsRes.error) {
      setSubmissionScores({});
      return;
    }

    const scoreRows = (scoreRowsRes.data ?? []) as ContestSubmissionScoreRow[];
    const nextScores: Record<string, ContestSubmissionScoreRow> = {};
    for (const submission of contestRows) {
      const hint = nextHints[submission.id];
      if (!hint) continue;
      const score = scoreRows.find(
        (row) =>
          row.contest_problem_id === hint.contestProblemId &&
          (row.submission_id === submission.id ||
            row.user_id === submission.user_id),
      );
      if (score) nextScores[submission.id] = score;
    }
    setSubmissionScores(nextScores);
  };

  const openSubmission = (submission: Submission) => {
    setSelectedSubmission(submission);
    setForm(formFromSubmission(submission));
    setInlineScoreDraft(inlineScoreDraftFrom(submissionScores[submission.id]));
    setPreviewMode("structured");
    setMessage("");
    setError("");
  };

  const closeSubmission = () => {
    setSelectedSubmission(null);
    setForm(null);
    setInlineScoreDraft({ rawScore: "", judgeNote: "" });
    setMessage("");
    setError("");
  };

  const updateField = <K extends keyof ReviewForm>(
    key: K,
    value: ReviewForm[K],
  ) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setMessage("");
    setError("");
  };

  const updateScore = (key: keyof SolutionScores, value: number) => {
    setForm((current) =>
      current
        ? {
            ...current,
            scores: {
              ...current.scores,
              [key]: normalizeScore(value, current.scores[key]),
            },
          }
        : current,
    );
    setMessage("");
    setError("");
  };

  const updateInlineScoreDraft = <K extends keyof InlineScoreDraft>(
    key: K,
    value: InlineScoreDraft[K],
  ) => {
    setInlineScoreDraft((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  };

  const convertMathFields = () => {
    setForm((current) =>
      current
        ? {
            ...current,
            origin: convertPlainMathTextToLatex(current.origin),
            keyTransform: convertPlainMathTextToLatex(current.keyTransform),
            process: convertPlainMathTextToLatex(current.process),
            inspiration: convertPlainMathTextToLatex(current.inspiration),
            transferValue: convertPlainMathTextToLatex(current.transferValue),
            tradeoffs: convertPlainMathTextToLatex(current.tradeoffs),
            pitfalls: convertPlainMathTextToLatex(current.pitfalls),
            verifiableSteps: convertPlainMathTextToLatex(
              current.verifiableSteps,
            ),
            scoringReason: convertPlainMathTextToLatex(current.scoringReason),
            moderatorNotes: convertPlainMathTextToLatex(current.moderatorNotes),
          }
        : current,
    );
    setMessage("已把常见数学写法转成 LaTeX 片段，请快速检查一次。");
    setError("");
  };

  const saveReview = async (nextStatus?: SubmissionStatus) => {
    if (!selectedSubmission || !form) return;
    const contestSubmission = isContestSubmission(selectedSubmission);
    if (
      nextStatus &&
      !form.moderatorNotes.trim() &&
      (!contestSubmission ||
        nextStatus === "needs_revision" ||
        nextStatus === "rejected")
    ) {
      setError("请先填写审核评语，再给出通过、退回或拒绝结论。");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const patch = contestSubmission
      ? {
          moderator_notes: form.moderatorNotes.trim() || null,
          ...(nextStatus ? { status: nextStatus } : {}),
        }
      : {
          title: form.title,
          kind: form.kind,
          content: contentFromForm(selectedSubmission, form),
          moderator_notes: form.moderatorNotes.trim() || null,
          challenge_target_solution_id: form.challengeTargetSolutionId || null,
          challenge_claim: form.challengeClaim.trim() || null,
          challenge_advantages: splitList(form.challengeAdvantages),
          challenge_risk: form.challengeRisk.trim() || null,
          ...(nextStatus ? { status: nextStatus } : {}),
        };

    const { data, error: updateError } = await supabase
      .from("submissions")
      .update(patch)
      .eq("id", selectedSubmission.id)
      .select("*");

    setSaving(false);

    if (updateError) {
      setError(updateError.message || "保存失败，请稍后再试。");
      return;
    }

    if (!data || data.length === 0) {
      setError(
        "保存没有更新到任何投稿。请确认当前账号仍有管理员权限，或在 Supabase 中补齐 submissions 的 UPDATE RLS policy。",
      );
      await loadSubmissions();
      return;
    }

    const updated = data[0] as Submission;
    setSelectedSubmission(updated);
    setForm(formFromSubmission(updated));
    setSubmissions((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );

    if (nextStatus === "approved" && !updated.contest_slug) {
      const publishResult = await publishSubmission(selectedSubmission.id);
      if (!publishResult.success) {
        setMessage(
          "审核结论已保存，但发布到题库时出错：" +
            (publishResult.error ?? "未知错误"),
        );
      } else {
        setMessage(
          isForkPR(updated)
            ? "Fork PR 已合并到题库。"
            : "审核通过，已发布到题库。",
        );
      }
    } else if (nextStatus === "approved" && updated.contest_slug) {
      setMessage(
        "比赛投稿已通过，已进入比赛思路专区；暂不自动发布为正式题解。",
      );
    } else {
      setMessage(nextStatus ? "审核结论和评语已保存。" : "修改已保存。");
    }

    await loadSubmissions();
  };

  const saveInlineContestScore = async () => {
    if (!selectedSubmission || !selectedSubmission.user_id) return;
    const hint = answerHints[selectedSubmission.id];
    if (!hint) {
      setError("找不到当前投稿对应的赛题，无法保存评分。");
      return;
    }

    const rawScoreNum = Number(inlineScoreDraft.rawScore);
    if (inlineScoreDraft.rawScore.trim() === "" || Number.isNaN(rawScoreNum)) {
      setError("请输入有效的比赛分数。");
      return;
    }
    if (rawScoreNum < 0 || rawScoreNum > hint.scoreMax) {
      setError(`分数需要在 0 - ${hint.scoreMax} 之间。`);
      return;
    }

    setInlineScoreSaving(true);
    setError("");
    setMessage("");

    const { data: adminData } = await supabase.auth.getUser();
    const { data, error: upsertError } = await supabase
      .from("contest_submission_scores")
      .upsert(
        {
          contest_id: hint.contestId,
          contest_problem_id: hint.contestProblemId,
          submission_id: selectedSubmission.id,
          user_id: selectedSubmission.user_id,
          problem_phase: hint.problemPhase,
          raw_score: rawScoreNum,
          score_max: hint.scoreMax,
          rubric: {},
          judge_note:
            inlineScoreDraft.judgeNote.trim() ||
            form?.moderatorNotes.trim() ||
            "",
          scored_by: adminData.user?.id ?? null,
          scored_at: new Date().toISOString(),
        },
        { onConflict: "contest_problem_id,user_id" },
      )
      .select(
        "id, contest_problem_id, submission_id, user_id, raw_score, judge_note, scored_at",
      );

    setInlineScoreSaving(false);
    if (upsertError) {
      setError(upsertError.message || "保存比赛评分失败。");
      return;
    }

    const score = data?.[0] as ContestSubmissionScoreRow | undefined;
    if (score) {
      setSubmissionScores((current) => ({
        ...current,
        [selectedSubmission.id]: score,
      }));
      setInlineScoreDraft(inlineScoreDraftFrom(score));
    }
    setMessage("比赛评分已保存。");
  };

  const publishExisting = async (submissionId: string) => {
    setPublishing(submissionId);
    try {
      const target = submissions.find((s) => s.id === submissionId);
      const result = await publishSubmission(submissionId);
      if (!result.success) {
        alert("发布失败：" + (result.error ?? "未知错误"));
      } else {
        alert(
          target && isForkPR(target)
            ? "Fork PR 已合并到题库。"
            : "已成功发布到题库。",
        );
      }
    } catch (error) {
      console.error("Publish error:", error);
      alert(
        "发布时发生异常：" +
          (error instanceof Error ? error.message : String(error)),
      );
    } finally {
      setPublishing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "border-amber-400/30 bg-amber-400/[0.06] text-amber-300",
      approved: "border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300",
      rejected: "border-red-400/30 bg-red-400/[0.06] text-red-300",
      needs_revision: "border-cyan-400/30 bg-cyan-400/[0.06] text-cyan-300",
      precheck_failed:
        "border-orange-400/30 bg-orange-400/[0.06] text-orange-300",
    };
    const labels = {
      pending: "待审核",
      approved: "已通过",
      rejected: "已拒绝",
      needs_revision: "需修改",
      precheck_failed: "预筛未通过",
    };
    return (
      <span
        className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-bold ${styles[status as keyof typeof styles]}`}
      >
        {status === "pending" && <Clock className="size-3" />}
        {status === "approved" && <CheckCircle2 className="size-3" />}
        {status === "rejected" && <XCircle className="size-3" />}
        {status === "precheck_failed" && <AlertCircle className="size-3" />}
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getTypeLabel = (submission: Submission) =>
    submission.submission_type === "problem" ? "题目投稿" : "解法投稿";
  const getScopeLabel = (submission: Submission) => {
    if (!submission.contest_slug) return "普通投稿";
    const type = submission.contest_solution_type
      ? contestSolutionTypeMeta[submission.contest_solution_type]?.label
      : "参赛解法";
    return `${submission.is_post_contest ? "赛后补充" : "比赛投稿"} · ${type}`;
  };
  const getTargetLabel = (submission: Submission) => {
    if (submission.submission_type === "problem")
      return submission.problem_source ?? "新题";
    if (submission.problem_source) {
      const id =
        submission.problem_id ?? submission.draft_problem_id ?? "未绑定题目";
      const draftBadge = submission.draft_problem_id ? " [未公开]" : "";
      return `${submission.problem_source} · ${id}${draftBadge}`;
    }
    if (submission.draft_problem_id)
      return `未公开题目 · ${submission.draft_problem_id}`;
    return submission.problem_id ?? "未绑定题目";
  };

  const currentMarkdown = useMemo(() => {
    if (!selectedSubmission || !form) return "";
    return buildMarkdown(selectedSubmission, form);
  }, [selectedSubmission, form]);
  const visibleSubmissions = useMemo(() => {
    let result = submissions;
    if (!showPrecheckFailed)
      result = result.filter((s) => s.status !== "precheck_failed");
    if (scopeFilter === "regular")
      result = result.filter((s) => !s.contest_slug);
    else if (scopeFilter === "contest")
      result = result.filter((s) => Boolean(s.contest_slug));
    if (contestSlugFilter) {
      result = result.filter((s) => s.contest_slug === contestSlugFilter);
    }
    if (contestProblemKeyFilter) {
      result = result.filter(
        (s) => s.contest_problem_key === contestProblemKeyFilter,
      );
    }
    // In contest view, sort by slug → problem key → newest first for easier sequential review.
    if (scopeFilter === "contest") {
      result = [...result].sort((a, b) => {
        const slugCmp = (a.contest_slug ?? "").localeCompare(
          b.contest_slug ?? "",
        );
        if (slugCmp !== 0) return slugCmp;
        const keyCmp = (a.contest_problem_key ?? "").localeCompare(
          b.contest_problem_key ?? "",
        );
        if (keyCmp !== 0) return keyCmp;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
    }
    return result;
  }, [
    showPrecheckFailed,
    scopeFilter,
    submissions,
    contestSlugFilter,
    contestProblemKeyFilter,
  ]);

  const precheckFailedCount = useMemo(
    () => submissions.filter((s) => s.status === "precheck_failed").length,
    [submissions],
  );

  const loadRateLimitLookup = useCallback(
    async (submission: Submission) => {
      const { data } = await supabase
        .from("submission_rate_limits")
        .select("consecutive_failures, cooldown_until")
        .eq("user_id", submission.user_id)
        .eq("scope_key", computeSubmissionScopeKey(submission))
        .maybeSingle();
      setRateLimitLookup(
        data
          ? {
              consecutiveFailures: data.consecutive_failures as number,
              cooldownUntil: data.cooldown_until as string | null,
            }
          : null,
      );
    },
    [supabase],
  );

  useEffect(() => {
    if (!selectedSubmission) {
      setRateLimitLookup(null);
      return;
    }
    void loadRateLimitLookup(selectedSubmission);
  }, [selectedSubmission, loadRateLimitLookup]);

  async function handleClearCooldown() {
    if (!selectedSubmission) return;
    setClearingCooldown(true);
    const result = await clearSubmissionCooldown({
      userId: selectedSubmission.user_id,
      scopeKey: computeSubmissionScopeKey(selectedSubmission),
    });
    setClearingCooldown(false);
    if (!result.success) {
      setError(result.error || "解除冷却失败。");
      return;
    }
    setMessage("已解除冷却。");
    await loadRateLimitLookup(selectedSubmission);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-16">
        <div className="mx-auto max-w-6xl animate-pulse">
          <div className="mb-8 h-8 w-48 bg-white/5" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-0 py-8 sm:px-4 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 px-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:px-0">
          <div>
            <h1 className="text-2xl font-black text-white">投稿审核</h1>
            <p className="mt-2 text-sm text-zinc-500">
              先修改内容，再写审核评语，最后给出通过、退回或拒绝结论。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="/admin/contests"
                className="inline-flex border border-white/10 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-cyan-400/40 hover:text-cyan-200"
              >
                管理比赛
              </a>
              <a
                href="/admin/proof-graph"
                className="inline-flex border border-white/10 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-violet-400/40 hover:text-violet-200"
              >
                编辑推理图谱
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex gap-2 text-xs sm:justify-end">
              <span className="text-zinc-500">
                待审核{" "}
                <span className="font-bold text-amber-300">
                  {submissions.filter((s) => s.status === "pending").length}
                </span>
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-500">
                总计{" "}
                <span className="font-bold text-white">
                  {submissions.length}
                </span>
              </span>
            </div>
            {precheckFailedCount > 0 && (
              <button
                type="button"
                onClick={() => setShowPrecheckFailed((v) => !v)}
                className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-bold transition ${
                  showPrecheckFailed
                    ? "border-orange-400 bg-orange-400/10 text-orange-300"
                    : "border-white/10 text-zinc-500 hover:border-orange-400/30 hover:text-orange-300"
                }`}
              >
                <AlertCircle className="size-3" />
                {showPrecheckFailed ? "隐藏" : "显示"}预筛未通过（
                {precheckFailedCount}）
              </button>
            )}
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2 border-y border-white/10 bg-black/20 p-2 sm:border">
          {[
            ["all", "全部投稿"],
            ["regular", "普通投稿"],
            ["contest", "比赛投稿"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setScopeFilter(value as typeof scopeFilter);
                if (value !== "contest") {
                  setContestSlugFilter("");
                  setContestProblemKeyFilter("");
                }
              }}
              className={`h-9 border px-3 text-xs font-bold transition ${
                scopeFilter === value
                  ? "border-cyan-400 bg-cyan-400 text-zinc-950"
                  : "border-white/10 text-zinc-400 hover:border-cyan-400/30 hover:text-cyan-200"
              }`}
            >
              {label}
            </button>
          ))}
          {scopeFilter === "contest" &&
            (() => {
              const slugs = [
                ...new Set(
                  submissions
                    .filter((s) => s.contest_slug)
                    .map((s) => s.contest_slug as string),
                ),
              ];
              const keys = contestSlugFilter
                ? [
                    ...new Set(
                      submissions
                        .filter(
                          (s) =>
                            s.contest_slug === contestSlugFilter &&
                            s.contest_problem_key,
                        )
                        .map((s) => s.contest_problem_key as string),
                    ),
                  ]
                : [];
              return (
                <>
                  <select
                    value={contestSlugFilter}
                    onChange={(e) => {
                      setContestSlugFilter(e.target.value);
                      setContestProblemKeyFilter("");
                    }}
                    className="h-9 min-w-0 flex-1 border border-white/10 bg-zinc-900 px-2 text-xs text-zinc-300 outline-none sm:flex-none"
                    title="筛选比赛"
                  >
                    <option value="">全部比赛</option>
                    {slugs.map((slug) => (
                      <option key={slug} value={slug}>
                        {slug}
                      </option>
                    ))}
                  </select>
                  {keys.length > 0 && (
                    <select
                      value={contestProblemKeyFilter}
                      onChange={(e) =>
                        setContestProblemKeyFilter(e.target.value)
                      }
                      className="h-9 min-w-0 flex-1 border border-white/10 bg-zinc-900 px-2 text-xs text-zinc-300 outline-none sm:flex-none"
                      title="筛选赛题"
                    >
                      <option value="">全部赛题</option>
                      {keys.map((key) => (
                        <option key={key} value={key}>
                          {key.slice(0, 12)}…
                        </option>
                      ))}
                    </select>
                  )}
                </>
              );
            })()}
        </div>

        {scopeFilter === "contest" && (
          <div className="mb-5">
            {!contestSlugFilter ? (
              <section className="border border-amber-400/25 bg-amber-400/[0.05] p-4">
                <p className="text-sm font-bold text-amber-200">
                  选择一个比赛后，这里会显示评分台。
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  审核比赛投稿后，可以直接在同一页为参赛者录入分数。
                </p>
              </section>
            ) : scoringLoading ? (
              <section className="border border-white/10 bg-zinc-950 p-5">
                <div className="mb-3 h-4 w-28 animate-pulse bg-white/10" />
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-14 animate-pulse bg-white/[0.04]"
                    />
                  ))}
                </div>
              </section>
            ) : scoringError ? (
              <section className="border border-red-400/30 bg-red-400/[0.06] p-4 text-sm text-red-300">
                {scoringError}
              </section>
            ) : scoringContest ? (
              <AdminContestScoringView
                contestId={scoringContest.id}
                contestSlug={scoringContest.slug}
                contestProblems={scoringContest.contest_problems ?? []}
              />
            ) : null}
          </div>
        )}

        <div className="space-y-3 px-4 sm:px-0">
          {visibleSubmissions.map((sub) => (
            <div
              key={sub.id}
              className="border border-white/10 bg-white/[0.02] p-5 transition hover:bg-white/[0.04]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {getStatusBadge(sub.status)}
                    <span
                      className={`border px-2 py-1 text-xs font-bold ${sub.contest_slug ? "border-amber-400/30 bg-amber-400/[0.06] text-amber-300" : "border-white/10 text-zinc-500"}`}
                    >
                      {getScopeLabel(sub)}
                    </span>
                    {sub.contest_solution_type && (
                      <span className="border border-cyan-400/25 bg-cyan-400/[0.05] px-2 py-1 text-xs font-bold text-cyan-300">
                        {contestSolutionTypeMeta[sub.contest_solution_type]
                          ?.label ?? sub.contest_solution_type}
                      </span>
                    )}
                    {sub.draft_problem_id && !sub.problem_id && (
                      <span className="border border-violet-400/30 bg-violet-400/[0.06] px-2 py-1 text-xs font-bold text-violet-300">
                        未公开题目
                      </span>
                    )}
                    {isForkPR(sub) && (
                      <span className="inline-flex items-center gap-1 border border-violet-400/30 bg-violet-400/[0.06] px-2 py-1 text-xs font-bold text-violet-300">
                        <Route className="size-3" />
                        Fork PR
                      </span>
                    )}
                    <span className="text-xs text-zinc-600">
                      {new Date(sub.created_at).toLocaleDateString("zh-CN")}
                    </span>
                    {sub.moderator_notes && (
                      <span className="border border-white/10 px-2 py-1 text-xs text-zinc-500">
                        已有评语
                      </span>
                    )}
                    {answerHints[sub.id] && (
                      <span className="inline-flex items-center gap-1 border border-emerald-400/25 bg-emerald-400/[0.055] px-2 py-1 text-xs font-bold text-emerald-300">
                        <KeyRound className="size-3" />
                        有标准答案
                      </span>
                    )}
                  </div>
                  <h3 className="break-words font-bold text-white sm:truncate">
                    {sub.title}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {getTypeLabel(sub)} · {getTargetLabel(sub)} · 类型:{" "}
                    {kindLabels[sub.kind] ?? sub.kind}
                    {sub.contest_slug &&
                      ` · ${sub.contest_slug}${sub.contest_problem_key ? ` / ${sub.contest_problem_key}` : ""}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  {sub.status === "approved" && !sub.contest_slug && (
                    <button
                      type="button"
                      onClick={() => publishExisting(sub.id)}
                      disabled={publishing === sub.id}
                      className="inline-flex h-9 items-center gap-2 border border-emerald-400/30 px-4 text-sm text-emerald-300 transition hover:bg-emerald-400/10 disabled:opacity-50"
                    >
                      <CheckCircle2 className="size-4" />
                      {publishing === sub.id
                        ? "发布中..."
                        : sub.contest_slug
                          ? "发布为正式题解"
                          : isForkPR(sub)
                            ? "合并到题库"
                            : "发布到题库"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openSubmission(sub)}
                    className="inline-flex h-9 items-center justify-center gap-2 border border-white/10 px-4 text-sm text-zinc-400 transition hover:border-cyan-400/50 hover:text-cyan-400"
                  >
                    <Eye className="size-4" />
                    审核编辑
                  </button>
                </div>
              </div>
            </div>
          ))}

          {visibleSubmissions.length === 0 && (
            <div className="border border-white/10 bg-white/[0.02] p-12 text-center">
              <p className="text-zinc-500">暂无投稿</p>
            </div>
          )}
        </div>

        {selectedSubmission && form && (
          <div className="fixed inset-0 z-50 bg-black/80 p-0 sm:p-4">
            <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden border-white/10 bg-zinc-950 sm:border">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {getStatusBadge(selectedSubmission.status)}
                    <span
                      className={`border px-2 py-1 text-xs font-bold ${selectedSubmission.contest_slug ? "border-amber-400/30 bg-amber-400/[0.06] text-amber-300" : "border-white/10 text-zinc-500"}`}
                    >
                      {getScopeLabel(selectedSubmission)}
                    </span>
                    <span className="text-xs text-zinc-600">
                      {new Date(selectedSubmission.created_at).toLocaleString(
                        "zh-CN",
                      )}
                    </span>
                  </div>
                  <h2 className="line-clamp-2 text-lg font-black text-white sm:truncate sm:text-xl">
                    {form.title || selectedSubmission.title}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {getTypeLabel(selectedSubmission)} ·{" "}
                    {getTargetLabel(selectedSubmission)}
                  </p>
                  {rateLimitLookup &&
                    (rateLimitLookup.consecutiveFailures > 0 ||
                      rateLimitLookup.cooldownUntil) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 border border-orange-400/25 bg-orange-400/[0.05] px-2.5 py-1.5 text-xs text-orange-300">
                        <span>
                          连续预筛失败 {rateLimitLookup.consecutiveFailures} 次
                        </span>
                        {rateLimitLookup.cooldownUntil &&
                          new Date(rateLimitLookup.cooldownUntil).getTime() >
                            Date.now() && (
                            <span>
                              · 冷却至{" "}
                              {new Date(
                                rateLimitLookup.cooldownUntil,
                              ).toLocaleString("zh-CN")}
                            </span>
                          )}
                        <button
                          type="button"
                          onClick={handleClearCooldown}
                          disabled={clearingCooldown}
                          className="ml-1 inline-flex h-6 items-center border border-orange-400/30 px-2 font-bold text-orange-200 transition hover:bg-orange-400/10 disabled:opacity-50"
                        >
                          {clearingCooldown ? "处理中..." : "解除冷却"}
                        </button>
                      </div>
                    )}
                </div>
                <button
                  type="button"
                  onClick={closeSubmission}
                  className="inline-flex size-10 shrink-0 items-center justify-center border border-white/10 text-zinc-400 transition hover:border-white/30 hover:text-white"
                  aria-label="关闭"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="min-h-0 overflow-auto p-4 sm:p-5">
                  {!isContestSubmission(selectedSubmission) && (
                    <div className="mb-5 inline-flex border border-white/10 bg-black/20 p-1">
                      {[
                        ["structured", FileText, "图形化编辑"],
                        ["card", Eye, "真实卡片"],
                        ["markdown", MessageSquareText, "Markdown 预览"],
                      ].map(([value, Icon, label]) => {
                        const TabIcon = Icon as typeof FileText;
                        const active = previewMode === value;
                        return (
                          <button
                            key={value as string}
                            type="button"
                            onClick={() =>
                              setPreviewMode(value as typeof previewMode)
                            }
                            className={`inline-flex h-9 items-center gap-2 px-3 text-xs font-bold transition ${
                              active
                                ? "bg-cyan-400 text-zinc-950"
                                : "text-zinc-400 hover:text-white"
                            }`}
                          >
                            <TabIcon className="size-3.5" />
                            {label as string}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {isContestSubmission(selectedSubmission) ? (
                    <ContestSubmissionReviewPreview
                      submission={selectedSubmission}
                      answerHint={answerHints[selectedSubmission.id]}
                    />
                  ) : previewMode === "structured" ? (
                    <div className="space-y-5">
                      <section className="grid gap-4 md:grid-cols-2">
                        <TextField
                          label="解法标题"
                          value={form.title}
                          onChange={(value) => updateField("title", value)}
                        />
                        <label className="grid gap-2 text-sm">
                          <span className="font-bold text-white">解法类型</span>
                          <select
                            value={form.kind}
                            onChange={(event) =>
                              updateField(
                                "kind",
                                event.target.value as SolutionKind,
                              )
                            }
                            className="h-11 border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-cyan-400/60"
                          >
                            {Object.entries(kindLabels).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <div className="md:col-span-2">
                          <TextField
                            label="解法标签"
                            value={form.tags}
                            onChange={(value) => updateField("tags", value)}
                            placeholder="导数、切线、不等式"
                          />
                        </div>
                      </section>

                      {form.forkOf &&
                        (() => {
                          try {
                            const f = JSON.parse(form.forkOf) as {
                              solutionId?: string;
                              solutionTitle?: string;
                              solutionAuthor?: string;
                            };
                            return (
                              <section className="border border-violet-400/25 bg-violet-400/[0.055] p-3">
                                <p className="text-xs font-bold text-violet-200">
                                  Fork 来源（只读）
                                </p>
                                <p className="mt-1 text-xs leading-5 text-zinc-300">
                                  {f.solutionTitle ?? f.solutionId}
                                  {f.solutionAuthor && (
                                    <span className="ml-2 text-zinc-500">
                                      / {f.solutionAuthor}
                                    </span>
                                  )}
                                </p>
                              </section>
                            );
                          } catch {
                            return null;
                          }
                        })()}

                      {form.challengeTargetSolutionId && (
                        <section className="space-y-4 border border-amber-400/25 bg-amber-400/[0.055] p-4">
                          <div className="flex items-center gap-2">
                            <Route className="size-4 text-amber-300" />
                            <h3 className="text-sm font-bold text-white">
                              解法挑战
                            </h3>
                            <span className="text-xs text-zinc-600">
                              审核通过后会显示在正式题解卡片中
                            </span>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <TextField
                              label="挑战对象 ID"
                              value={form.challengeTargetSolutionId}
                              onChange={(value) =>
                                updateField("challengeTargetSolutionId", value)
                              }
                            />
                            <TextField
                              label="挑战对象标题"
                              value={form.challengeTargetSolutionTitle}
                              onChange={(value) =>
                                updateField(
                                  "challengeTargetSolutionTitle",
                                  value,
                                )
                              }
                            />
                            <TextField
                              label="挑战对象作者"
                              value={form.challengeTargetSolutionAuthor}
                              onChange={(value) =>
                                updateField(
                                  "challengeTargetSolutionAuthor",
                                  value,
                                )
                              }
                            />
                            <TextField
                              label="一句话优势"
                              value={form.challengeClaim}
                              onChange={(value) =>
                                updateField("challengeClaim", value)
                              }
                            />
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <TextArea
                              label="优势标签"
                              value={form.challengeAdvantages}
                              onChange={(value) =>
                                updateField("challengeAdvantages", value)
                              }
                              rows={4}
                            />
                            <TextArea
                              label="风险自评"
                              value={form.challengeRisk}
                              onChange={(value) =>
                                updateField("challengeRisk", value)
                              }
                              rows={4}
                            />
                          </div>
                        </section>
                      )}

                      <section className="grid gap-4 md:grid-cols-2">
                        <TextArea
                          label="思路来源"
                          value={form.origin}
                          onChange={(value) => updateField("origin", value)}
                          rows={5}
                        />
                        <TextArea
                          label="关键转化"
                          value={form.keyTransform}
                          onChange={(value) =>
                            updateField("keyTransform", value)
                          }
                          rows={5}
                        />
                        <TextArea
                          label="启发点"
                          value={form.inspiration}
                          onChange={(value) =>
                            updateField("inspiration", value)
                          }
                          rows={5}
                        />
                        <TextArea
                          label="迁移价值"
                          value={form.transferValue}
                          onChange={(value) =>
                            updateField("transferValue", value)
                          }
                          rows={5}
                        />
                      </section>

                      <TextArea
                        label="完整过程"
                        value={form.process}
                        onChange={(value) => updateField("process", value)}
                        rows={12}
                      />

                      {selectedSubmission.attachment_urls &&
                        selectedSubmission.attachment_urls.length > 0 && (
                          <section className="border border-white/10 bg-black/20 p-4">
                            <h3 className="text-sm font-bold text-white">
                              投稿图片
                            </h3>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              {selectedSubmission.attachment_urls.map((url) => (
                                <a
                                  key={url}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block overflow-hidden border border-white/10 bg-zinc-950"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt="投稿图片"
                                    className="max-h-80 w-full object-contain"
                                  />
                                </a>
                              ))}
                            </div>
                          </section>
                        )}

                      <section className="grid gap-4 md:grid-cols-3">
                        <TextArea
                          label="适用场景"
                          value={form.suitableFor}
                          onChange={(value) =>
                            updateField("suitableFor", value)
                          }
                          rows={5}
                        />
                        <TextArea
                          label="代价与局限"
                          value={form.tradeoffs}
                          onChange={(value) => updateField("tradeoffs", value)}
                          rows={5}
                        />
                        <TextArea
                          label="易错点"
                          value={form.pitfalls}
                          onChange={(value) => updateField("pitfalls", value)}
                          rows={5}
                        />
                      </section>

                      <TextArea
                        label="可验证步骤"
                        value={form.verifiableSteps}
                        onChange={(value) =>
                          updateField("verifiableSteps", value)
                        }
                        rows={4}
                      />
                      <CASVerifier steps={splitList(form.verifiableSteps)} />

                      <GraphDraftSection
                        form={form}
                        updateField={updateField}
                      />

                      <section className="space-y-4 border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center gap-2">
                          <SlidersHorizontal className="size-4 text-cyan-300" />
                          <h3 className="text-sm font-bold text-white">
                            五维评分
                          </h3>
                          <span className="text-xs text-zinc-600">
                            支持一位小数
                          </span>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          {scoreLabels.map(
                            ([key, label, description], index) => (
                              <div
                                key={key}
                                className="border border-white/10 bg-zinc-950 p-4"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-bold text-white">
                                      {label}
                                    </p>
                                    <p className="mt-1 text-xs text-zinc-600">
                                      {description}
                                    </p>
                                  </div>
                                  <strong className="font-display text-2xl text-cyan-300">
                                    {form.scores[key].toFixed(1)}
                                  </strong>
                                </div>
                                <input
                                  type="range"
                                  min="1"
                                  max="10"
                                  step="0.1"
                                  value={form.scores[key]}
                                  onChange={(event) =>
                                    updateScore(key, Number(event.target.value))
                                  }
                                  className="mt-4 w-full accent-cyan-400"
                                />
                                <div className="mt-3">
                                  <ScoreBar
                                    label={label}
                                    value={form.scores[key]}
                                    tone={
                                      index === 1
                                        ? "red"
                                        : index === 2
                                          ? "amber"
                                          : "cyan"
                                    }
                                  />
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                        <TextArea
                          label="评分理由"
                          value={form.scoringReason}
                          onChange={(value) =>
                            updateField("scoringReason", value)
                          }
                          rows={5}
                        />
                      </section>
                    </div>
                  ) : previewMode === "card" ? (
                    <ReviewCardPreview
                      submission={selectedSubmission}
                      form={form}
                    />
                  ) : (
                    <pre className="max-h-full overflow-auto border border-white/10 bg-black/20 p-4 text-xs leading-6 text-zinc-300">
                      <code>{currentMarkdown}</code>
                    </pre>
                  )}
                </div>

                <aside className="order-first max-h-[48vh] min-h-0 overflow-auto border-b border-white/10 p-4 sm:p-5 lg:order-none lg:max-h-none lg:border-b-0 lg:border-l">
                  <div className="space-y-5">
                    {isContestSubmission(selectedSubmission) && (
                      <StandardAnswerHintPanel
                        hint={answerHints[selectedSubmission.id]}
                        compact
                      />
                    )}

                    <TextArea
                      label="审核评语"
                      value={form.moderatorNotes}
                      onChange={(value) => updateField("moderatorNotes", value)}
                      rows={isContestSubmission(selectedSubmission) ? 4 : 6}
                      placeholder={
                        isContestSubmission(selectedSubmission)
                          ? "可选：给参赛者留一句审核说明。退回或拒绝时请写清原因。"
                          : "说明通过理由、需要修改的位置，或拒绝原因。审核结论必须带评语。"
                      }
                    />

                    {isContestSubmission(selectedSubmission) &&
                      answerHints[selectedSubmission.id] && (
                        <section className="border border-cyan-400/25 bg-cyan-400/[0.045] p-3">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-bold text-cyan-100">
                                当前投稿评分
                              </h3>
                              <p className="mt-1 text-xs text-zinc-500">
                                {
                                  answerHints[selectedSubmission.id]
                                    .contestProblemTitle
                                }
                              </p>
                            </div>
                            {submissionScores[selectedSubmission.id] && (
                              <span className="inline-flex items-center gap-1 border border-emerald-400/30 px-2 py-1 text-[11px] font-bold text-emerald-300">
                                <CheckCircle2 className="size-3" />
                                已评分
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                            <label className="grid gap-1 text-xs">
                              <span className="font-bold text-zinc-300">
                                分数
                              </span>
                              <input
                                type="number"
                                min="0"
                                max={
                                  answerHints[selectedSubmission.id].scoreMax
                                }
                                value={inlineScoreDraft.rawScore}
                                onChange={(event) =>
                                  updateInlineScoreDraft(
                                    "rawScore",
                                    event.target.value,
                                  )
                                }
                                className="h-10 border border-white/15 bg-black/20 px-3 text-sm text-white outline-none focus:border-cyan-400/60"
                                placeholder="0"
                              />
                            </label>
                            <span className="pb-2 text-xs text-zinc-500">
                              / {answerHints[selectedSubmission.id].scoreMax}
                            </span>
                          </div>
                          <label className="mt-3 grid gap-1 text-xs">
                            <span className="font-bold text-zinc-300">
                              评分备注
                            </span>
                            <textarea
                              rows={3}
                              value={inlineScoreDraft.judgeNote}
                              onChange={(event) =>
                                updateInlineScoreDraft(
                                  "judgeNote",
                                  event.target.value,
                                )
                              }
                              placeholder="可直接沿用审核评语；留空时保存会自动带入审核评语。"
                              className="resize-y border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={saveInlineContestScore}
                            disabled={inlineScoreSaving}
                            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 bg-cyan-400 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300 disabled:opacity-50"
                          >
                            <Save className="size-4" />
                            {inlineScoreSaving
                              ? "保存评分中..."
                              : "保存比赛评分"}
                          </button>
                        </section>
                      )}

                    {!isContestSubmission(selectedSubmission) ? (
                      <button
                        type="button"
                        onClick={convertMathFields}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 border border-amber-400/30 text-sm font-bold text-amber-300 transition hover:bg-amber-400/10"
                      >
                        自动转码公式
                      </button>
                    ) : (
                      <div className="border border-amber-400/25 bg-amber-400/[0.06] p-3 text-xs leading-5 text-amber-100">
                        比赛投稿审核只处理状态与评语；分数请到对应比赛的评分台录入。
                        {selectedSubmission.contest_slug && (
                          <a
                            href={`/admin/submissions?contest=${selectedSubmission.contest_slug}`}
                            className="mt-2 inline-flex font-bold text-amber-200 underline decoration-amber-300/40 underline-offset-4 hover:text-white"
                          >
                            打开本页评分台
                          </a>
                        )}
                      </div>
                    )}

                    {message && (
                      <p className="border border-emerald-400/30 bg-emerald-400/[0.06] px-3 py-2 text-sm text-emerald-300">
                        {message}
                      </p>
                    )}
                    {error && (
                      <p className="border border-red-400/30 bg-red-400/[0.06] px-3 py-2 text-sm text-red-300">
                        {error}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => saveReview()}
                      disabled={saving}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 border border-white/10 text-sm font-bold text-zinc-300 transition hover:border-cyan-400/40 hover:text-cyan-200 disabled:opacity-50"
                    >
                      <Save className="size-4" />
                      {saving
                        ? "保存中..."
                        : isContestSubmission(selectedSubmission)
                          ? "保存评语"
                          : "保存修改"}
                    </button>

                    <div className="space-y-3 border-t border-white/10 pt-5">
                      <button
                        type="button"
                        onClick={() => saveReview("approved")}
                        disabled={saving}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 bg-emerald-400 text-sm font-bold text-zinc-950 transition hover:bg-emerald-300 disabled:opacity-50"
                      >
                        <CheckCircle2 className="size-4" />
                        {isContestSubmission(selectedSubmission)
                          ? "通过比赛投稿"
                          : selectedSubmission && isForkPR(selectedSubmission)
                            ? "批准合并"
                            : "保存并通过"}
                      </button>
                      <button
                        type="button"
                        onClick={() => saveReview("needs_revision")}
                        disabled={saving}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 border border-cyan-400/30 text-sm font-bold text-cyan-300 transition hover:bg-cyan-400/10 disabled:opacity-50"
                      >
                        <Check className="size-4" />
                        保存并要求修改
                      </button>
                      <button
                        type="button"
                        onClick={() => saveReview("rejected")}
                        disabled={saving}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 border border-red-400/30 text-sm font-bold text-red-400 transition hover:bg-red-400/10 disabled:opacity-50"
                      >
                        <XCircle className="size-4" />
                        保存并拒绝
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GraphDraftSection({
  form,
  updateField,
}: {
  form: ReviewForm;
  updateField: <K extends keyof ReviewForm>(
    key: K,
    value: ReviewForm[K],
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasContent =
    form.graphObservationSignal ||
    form.graphObservationWhy ||
    form.graphTransformFrom ||
    form.graphTransformTo ||
    form.graphBoundaryName;

  return (
    <section
      className={`border ${hasContent ? "border-violet-400/25 bg-violet-400/[0.04]" : "border-white/10 bg-black/20"}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white">推理图谱草稿</h3>
          {hasContent && (
            <span className="border border-violet-400/30 px-2 py-0.5 text-[10px] text-violet-300">
              已填写
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">观察 / 转化 / 方法边界</span>
          <ChevronDown
            className={`size-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="space-y-5 border-t border-white/10 p-4">
          {/* Observation */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-cyan-400/70">
              观察入口
            </h4>
            <div className="grid gap-3 md:grid-cols-2">
              <TextArea
                label="信号（看到了什么条件）"
                value={form.graphObservationSignal}
                onChange={(v) => updateField("graphObservationSignal", v)}
                rows={3}
              />
              <TextArea
                label="为什么重要（这个条件触发了什么）"
                value={form.graphObservationWhy}
                onChange={(v) => updateField("graphObservationWhy", v)}
                rows={3}
              />
            </div>
          </div>

          {/* Transformation */}
          <div className="space-y-3 border-t border-white/10 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wide text-emerald-400/70">
              关键转化
            </h4>
            <div className="grid gap-3 md:grid-cols-2">
              <TextArea
                label="从"
                value={form.graphTransformFrom}
                onChange={(v) => updateField("graphTransformFrom", v)}
                rows={3}
              />
              <TextArea
                label="到"
                value={form.graphTransformTo}
                onChange={(v) => updateField("graphTransformTo", v)}
                rows={3}
              />
              <TextArea
                label="合法性说明"
                value={form.graphTransformJustification}
                onChange={(v) => updateField("graphTransformJustification", v)}
                rows={3}
              />
              <TextArea
                label="降低了什么复杂度"
                value={form.graphTransformComplexityReduction}
                onChange={(v) =>
                  updateField("graphTransformComplexityReduction", v)
                }
                rows={3}
              />
            </div>
          </div>

          {/* Method Boundary */}
          <div className="space-y-3 border-t border-white/10 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wide text-amber-400/70">
              方法边界（看起来能用但不优先）
            </h4>
            <TextField
              label="方法名称"
              value={form.graphBoundaryName}
              onChange={(v) => updateField("graphBoundaryName", v)}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <TextArea
                label="为什么看起来诱人"
                value={form.graphBoundaryWhyTempting}
                onChange={(v) => updateField("graphBoundaryWhyTempting", v)}
                rows={3}
              />
              <TextArea
                label="为什么不优先"
                value={form.graphBoundaryWhyNotPriority}
                onChange={(v) => updateField("graphBoundaryWhyNotPriority", v)}
                rows={3}
              />
              <TextArea
                label="在哪里卡住"
                value={form.graphBoundaryWhereItBreaks}
                onChange={(v) => updateField("graphBoundaryWhereItBreaks", v)}
                rows={3}
              />
              <TextArea
                label="什么时候变成好方法"
                value={form.graphBoundaryWhenItWorks}
                onChange={(v) => updateField("graphBoundaryWhenItWorks", v)}
                rows={3}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
