import { createClient } from "@/lib/supabase-server";
import type { ContestRegistration } from "@/lib/types";

type ContestRegistrationRow = {
  id: string;
  contest_id: string;
  user_id: string;
  status: ContestRegistration["status"];
  role: ContestRegistration["role"];
  note: string;
  invited_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
};

function toContestRegistration(row: ContestRegistrationRow): ContestRegistration {
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

// Server-only, session-scoped: the signed-in caller's own contest_registrations
// row (RLS "Users can view own contest registration" already restricts this to
// the caller's own row or a moderator). Deliberately not exposed through
// lib/contests.ts, which CLAUDE.md documents as the cookie-free/ISR-safe public
// read path — this depends on the request's session and must never be cached
// across users.
export async function getMyContestRegistration(contestId: string): Promise<ContestRegistration | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("contest_registrations")
    .select("*")
    .eq("contest_id", contestId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return toContestRegistration(data as ContestRegistrationRow);
}
