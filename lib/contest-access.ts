import type { Contest, ContestRegistration } from "@/lib/types";

export type ContestSubmitAccess = {
  canSubmit: boolean;
  label: string;
  description: string;
};

const BLOCKING_STATUS_LABEL: Record<string, string> = {
  rejected: "报名被拒绝",
  removed: "已被移出比赛",
  suspended: "提交权限已被暂停",
};

// Mirrors the registration-status gate added to enforce_contest_submission_window()
// in 021_contest_submission_registration_gate.sql. This is UI-only — it exists so
// the submit form can explain *why* before the user tries, not to replace the DB
// trigger, which is the actual enforcement.
export function computeContestSubmitAccess(
  contest: Pick<Contest, "accessMode">,
  registration: ContestRegistration | null,
  isLoggedIn: boolean,
): ContestSubmitAccess {
  if (!isLoggedIn) {
    return {
      canSubmit: false,
      label: "需要登录",
      description: "登录后才能申请参赛或提交解法。",
    };
  }

  if (registration && registration.status in BLOCKING_STATUS_LABEL) {
    return {
      canSubmit: false,
      label: BLOCKING_STATUS_LABEL[registration.status],
      description: registration.note || "如有疑问请联系比赛管理员。",
    };
  }

  if (contest.accessMode === "open") {
    return { canSubmit: true, label: "可以提交", description: "" };
  }

  if (registration && (registration.status === "approved" || registration.status === "invited")) {
    return { canSubmit: true, label: "可以提交", description: "" };
  }

  if (registration?.status === "pending") {
    return {
      canSubmit: false,
      label: "等待审核",
      description: "报名申请正在等待管理员审核，通过后即可提交。",
    };
  }

  if (contest.accessMode === "approval") {
    return {
      canSubmit: false,
      label: "需要先报名",
      description: "这场比赛需要先申请参赛并通过审核才能提交。",
    };
  }

  return {
    canSubmit: false,
    label: "仅限受邀参赛",
    description: "这场比赛仅限被邀请的用户参赛，请联系管理员。",
  };
}

// Whether the "申请参赛" self-serve button should be shown at all — only
// meaningful for approval-mode contests where no registration row exists
// yet (invite mode has no self-serve request path; open mode needs none).
export function canRequestContestRegistration(
  contest: Pick<Contest, "accessMode">,
  registration: ContestRegistration | null,
  isLoggedIn: boolean,
): boolean {
  return isLoggedIn && contest.accessMode === "approval" && !registration;
}
