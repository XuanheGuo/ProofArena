"use client";

import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";
import { LayoutDashboard, LogIn, User as UserIcon, LogOut } from "lucide-react";
import { hasSupabasePublicEnv } from "@/lib/supabase-env";
import { isModerator } from "@/lib/is-moderator";

type UserRole = "user" | "contributor" | "moderator" | "admin";

export function AuthButton({
  variant = "icon",
}: {
  variant?: "icon" | "menu";
}) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const communityEnabled = hasSupabasePublicEnv();
  const [loading, setLoading] = useState(communityEnabled);
  const supabase = communityEnabled ? createClient() : null;

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;

    async function loadUserRole(userId: string) {
      const { data } = await client
        .from("user_profiles")
        .select("role")
        .eq("id", userId)
        .single();

      setRole((data?.role as UserRole | undefined) ?? null);
    }

    client.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        void loadUserRole(data.user.id);
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        void loadUserRole(nextUser.id);
      } else {
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase?.auth.signOut();
  };

  if (loading) {
    return (
      <div
        className={
          variant === "menu"
            ? "h-11 w-full animate-pulse  bg-white/5"
            : "size-9 shrink-0 animate-pulse  bg-white/5"
        }
      />
    );
  }

  if (user) {
    const canReview = isModerator({ role, email: user.email });

    if (variant === "menu") {
      return (
        <div className="grid gap-2">
          {canReview && (
            <Link
              href="/admin"
              className="pressable surface-panel-subtle flex min-h-11 items-center gap-3 px-3 text-sm font-bold text-zinc-300 hover:border-cyan-400/35 hover:text-cyan-200"
            >
              <LayoutDashboard className="size-4 shrink-0 text-cyan-300" />
              <span>管理面板</span>
            </Link>
          )}
          <Link
            href="/profile"
            className="pressable surface-panel-subtle flex min-h-11 items-center gap-3 px-3 text-sm font-bold text-zinc-300 hover:border-cyan-400/35 hover:text-white"
          >
            <UserIcon className="size-4 shrink-0 text-zinc-500" />
            <span className="min-w-0 flex-1 truncate">
              {user.email || "个人主页"}
            </span>
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="pressable surface-panel-subtle flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm font-bold text-zinc-300 hover:border-red-400/35 hover:text-red-300"
          >
            <LogOut className="size-4 shrink-0 text-red-400" />
            <span>退出登录</span>
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        {canReview && (
          <Link
            href="/admin"
            className="pressable inline-flex size-9 items-center justify-center  text-zinc-400 hover:bg-white/[0.06] hover:text-cyan-300"
            title="管理面板"
          >
            <LayoutDashboard className="size-4" />
          </Link>
        )}
        <Link
          href="/profile"
          className="pressable hidden size-9 items-center justify-center  text-zinc-400 hover:bg-white/[0.06] hover:text-white sm:inline-flex"
          title={user.email || "用户"}
        >
          <UserIcon className="size-4" />
        </Link>
        <button
          onClick={handleSignOut}
          className="pressable inline-flex size-9 shrink-0 items-center justify-center  text-zinc-400 hover:bg-white/[0.06] hover:text-red-400"
          title="退出登录"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    );
  }

  if (variant === "menu") {
    if (!communityEnabled) {
      return (
        <div className="surface-panel-subtle border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-xs leading-5 text-amber-200">
          社区登录暂不可用，当前使用静态题库。
        </div>
      );
    }

    return (
      <Link
        href="/auth/login"
        className="pressable surface-panel-subtle flex min-h-11 items-center gap-3 px-3 text-sm font-bold text-zinc-300 hover:border-cyan-400/35 hover:text-white"
      >
        <LogIn className="size-4 shrink-0 text-cyan-300" />
        <span>登录 / 注册</span>
      </Link>
    );
  }

  return (
    <Link
      href="/auth/login"
      className="pressable inline-flex size-9 shrink-0 items-center justify-center  text-zinc-400 hover:bg-white/[0.06] hover:text-white"
      title="登录"
    >
      <LogIn className="size-4" />
    </Link>
  );
}
