"use client";

import { useState } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-client";
import { AlertCircle, Settings } from "lucide-react";

const inputClassName =
  "w-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-cyan-400/50 focus:bg-white/[0.07]";

const submitButtonClassName =
  "inline-flex h-10 items-center justify-center gap-2 bg-cyan-400 px-5 text-sm font-bold text-zinc-950 transition active:translate-y-px hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60";

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 border border-red-400/30 bg-red-400/[0.06] px-4 py-3 text-sm text-red-300">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function SuccessBox({ message }: { message: string }) {
  return (
    <p className="border border-emerald-400/30 bg-emerald-400/[0.06] px-3 py-2 text-sm text-emerald-300">
      {message}
    </p>
  );
}

function UsernameForm({
  user,
  username,
  onUsernameUpdated,
}: {
  user: User;
  username: string;
  onUsernameUpdated: (next: string) => void;
}) {
  const [value, setValue] = useState(username);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const supabase = createClient();

  const trimmed = value.trim();
  const unchanged = trimmed === username;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!trimmed) {
      setError("用户名不能为空");
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 20) {
      setError("用户名长度需在 2-20 个字符之间");
      return;
    }
    if (unchanged) {
      return;
    }

    setSubmitting(true);
    const { data, error: updateError } = await supabase
      .from("user_profiles")
      .update({ username: trimmed })
      .eq("id", user.id)
      .select("username")
      .single();

    if (updateError) {
      if (updateError.code === "23505") {
        setError("该用户名已被占用，请换一个");
      } else {
        setError(updateError.message || "保存失败，请稍后再试。");
      }
      setSubmitting(false);
      return;
    }

    const nextUsername =
      (data as { username: string } | null)?.username ?? trimmed;
    setSuccess("用户名已更新");
    setSubmitting(false);
    onUsernameUpdated(nextUsername);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-sm font-bold text-white">修改用户名</h3>
      <div>
        <label
          htmlFor="settings-username"
          className="block text-sm text-zinc-400 mb-1.5"
        >
          用户名
        </label>
        <input
          id="settings-username"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={inputClassName}
          placeholder="你的用户名"
        />
      </div>

      {error && <ErrorBox message={error} />}
      {success && <SuccessBox message={success} />}

      <button
        type="submit"
        disabled={submitting || unchanged || !trimmed}
        className={submitButtonClassName}
      >
        {submitting ? "保存中…" : "保存用户名"}
      </button>
    </form>
  );
}

function PasswordForm({ user }: { user: User }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 6) {
      setError("新密码至少 6 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }
    if (!user.email) {
      setError("当前账号缺少邮箱信息，无法修改密码。");
      return;
    }

    setSubmitting(true);

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (reauthError) {
      setError("当前密码不正确");
      setSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message || "保存失败，请稍后再试。");
      setSubmitting(false);
      return;
    }

    setSuccess("密码已更新");
    setSubmitting(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-sm font-bold text-white">修改密码</h3>
      <div>
        <label
          htmlFor="settings-current-password"
          className="block text-sm text-zinc-400 mb-1.5"
        >
          当前密码
        </label>
        <input
          id="settings-current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={inputClassName}
          placeholder="输入当前密码"
        />
      </div>
      <div>
        <label
          htmlFor="settings-new-password"
          className="block text-sm text-zinc-400 mb-1.5"
        >
          新密码
        </label>
        <input
          id="settings-new-password"
          type="password"
          minLength={6}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClassName}
          placeholder="至少 6 位"
        />
      </div>
      <div>
        <label
          htmlFor="settings-confirm-password"
          className="block text-sm text-zinc-400 mb-1.5"
        >
          确认新密码
        </label>
        <input
          id="settings-confirm-password"
          type="password"
          minLength={6}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClassName}
          placeholder="再次输入新密码"
        />
      </div>

      {error && <ErrorBox message={error} />}
      {success && <SuccessBox message={success} />}

      <button
        type="submit"
        disabled={submitting}
        className={submitButtonClassName}
      >
        {submitting ? "保存中…" : "保存密码"}
      </button>
    </form>
  );
}

export function ProfileSettingsPanel({
  user,
  username,
  onUsernameUpdated,
}: {
  user: User;
  username: string;
  onUsernameUpdated: (next: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Settings className="size-4 text-zinc-400" />
          <h2 className="text-sm font-bold text-white">账号设置</h2>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex h-9 items-center gap-1.5 border border-cyan-400/30 px-3 text-xs font-bold text-cyan-300 transition hover:bg-cyan-400/10"
        >
          {expanded ? "收起" : "管理账号"}
        </button>
      </div>

      {expanded && (
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <UsernameForm
            user={user}
            username={username}
            onUsernameUpdated={onUsernameUpdated}
          />
          <PasswordForm user={user} />
        </div>
      )}
    </div>
  );
}
