"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, LogIn, Send, ShieldAlert, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { requestContestRegistration } from "@/lib/contest-registration-actions";
import { canRequestContestRegistration, computeContestSubmitAccess } from "@/lib/contest-access";
import type { Contest, ContestRegistration, ContestRegistrationStatus } from "@/lib/types";

type RegistrationRow = {
  id: string;
  contest_id: string;
  user_id: string;
  status: ContestRegistrationStatus;
  role: ContestRegistration["role"];
  note: string;
  invited_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
};

function toRegistration(row: RegistrationRow): ContestRegistration {
  return {
    id: row.id,
    contestId: row.contest_id,
    userId: row.user_id,
    status: row.status,
    role: row.role,
    note: row.note,
    invitedBy: row.invited_by,
    approvedBy: row.approved_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// contest_registrations has client-facing RLS ("Users can view own contest
// registration", 020_contest_access_control.sql), unlike contest_sprint_attempts
// — so this queries it directly instead of going through a server route the
// way ContestMyPanel does for sprint data.
export function ContestRegistrationPanel({ contest }: { contest: Contest }) {
  const supabase = createClient();
  const [user, setUser] = useState<{ id: string } | null | undefined>(undefined);
  const [registration, setRegistration] = useState<ContestRegistration | null>(null);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });
  }, []);

  const loadRegistration = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("contest_registrations")
      .select("*")
      .eq("contest_id", contest.id)
      .eq("user_id", user.id)
      .maybeSingle();
    setRegistration(data ? toRegistration(data as RegistrationRow) : null);
    setLoading(false);
  }, [user, contest.id]);

  useEffect(() => {
    loadRegistration();
  }, [loadRegistration]);

  const handleRequest = async () => {
    setRequesting(true);
    setRequestError("");
    const result = await requestContestRegistration(contest.id);
    if (!result.success) {
      setRequestError(result.error || "申请失败，请稍后重试。");
    } else {
      await loadRegistration();
    }
    setRequesting(false);
  };

  // Still checking auth, or nothing to show yet.
  if (user === undefined || loading) return null;

  if (user === null) {
    // Open contests don't need a banner for logged-out visitors — the
    // existing submit flow already prompts login. Only approval/invite
    // contests need to explain the extra registration step up front.
    if (contest.accessMode === "open") return null;
    return (
      <section className="border border-white/10 bg-zinc-950 p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <UserPlus className="size-4 text-zinc-400" />
          参赛资格
        </div>
        <div className="mt-4 flex items-center gap-3 border border-amber-400/20 bg-amber-400/[0.04] px-4 py-3">
          <LogIn className="size-4 shrink-0 text-amber-400" />
          <p className="text-sm text-zinc-400">
            <Link href="/auth/login" className="font-bold text-cyan-300 hover:underline">登录</Link>
            {" "}后可以
            {contest.accessMode === "approval" ? "申请参赛" : "查看参赛资格"}。
          </p>
        </div>
      </section>
    );
  }

  const access = computeContestSubmitAccess(contest, registration, true);
  const canRequest = canRequestContestRegistration(contest, registration, true);

  // Open contest, nothing blocking this user — no banner needed, matches
  // today's behavior of just showing the normal submit entry.
  if (contest.accessMode === "open" && access.canSubmit) return null;

  const isApproved = registration?.status === "approved" || registration?.status === "invited";

  return (
    <section className="border border-white/10 bg-zinc-950 p-5">
      <div className="flex items-center gap-2 text-sm font-bold text-white">
        <UserPlus className="size-4 text-cyan-300" />
        参赛资格
      </div>

      {isApproved ? (
        <div className="mt-4 flex items-center gap-3 border border-emerald-500/30 bg-emerald-500/[0.05] px-4 py-3">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-300" />
          <p className="text-sm text-zinc-300">
            {registration?.status === "invited" ? "你已被邀请参赛，" : "报名已通过，"}
            可以正常提交解法。
          </p>
        </div>
      ) : registration?.status === "pending" ? (
        <div className="mt-4 flex items-center gap-3 border border-amber-400/30 bg-amber-400/[0.05] px-4 py-3">
          <Clock className="size-4 shrink-0 text-amber-300" />
          <p className="text-sm text-zinc-300">{access.label}：{access.description}</p>
        </div>
      ) : !access.canSubmit ? (
        <div className="mt-4 flex items-center gap-3 border border-red-500/30 bg-red-500/[0.05] px-4 py-3">
          <ShieldAlert className="size-4 shrink-0 text-red-300" />
          <p className="text-sm text-zinc-300">{access.label}：{access.description}</p>
        </div>
      ) : null}

      {canRequest && (
        <div className="mt-4">
          <button
            type="button"
            onClick={handleRequest}
            disabled={requesting}
            className="inline-flex h-9 items-center gap-2 bg-cyan-400 px-4 text-xs font-bold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="size-3.5" />
            {requesting ? "提交申请中…" : "申请参赛"}
          </button>
          {requestError && <p className="mt-2 text-xs text-red-300">{requestError}</p>}
        </div>
      )}
    </section>
  );
}
