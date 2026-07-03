'use client';

import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-client';
import Link from 'next/link';
import { LogIn, User as UserIcon, LogOut, ShieldCheck } from 'lucide-react';

type UserRole = 'user' | 'contributor' | 'moderator' | 'admin';

function canReviewSubmissions(role?: UserRole | null) {
  return role === 'admin' || role === 'moderator';
}

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadUserRole(userId: string) {
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();

      setRole((data?.role as UserRole | undefined) ?? null);
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        void loadUserRole(data.user.id);
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
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
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="size-9 shrink-0 animate-pulse rounded bg-white/5" />
    );
  }

  if (user) {
    const canReview = canReviewSubmissions(role);

    return (
      <div className="flex items-center gap-2">
        {canReview && (
          <Link
            href="/admin/submissions"
            className="inline-flex size-9 items-center justify-center rounded text-zinc-400 transition hover:bg-white/[0.03] hover:text-cyan-300"
            title="投稿审核"
          >
            <ShieldCheck className="size-4" />
          </Link>
        )}
        <Link
          href="/profile"
          className="hidden size-9 items-center justify-center rounded text-zinc-400 transition hover:bg-white/[0.03] hover:text-white sm:inline-flex"
          title={user.email || '用户'}
        >
          <UserIcon className="size-4" />
        </Link>
        <button
          onClick={handleSignOut}
          className="size-9 shrink-0 items-center justify-center rounded text-zinc-400 transition hover:bg-white/[0.03] hover:text-red-400 inline-flex"
          title="退出登录"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/auth/login"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded text-zinc-400 transition hover:bg-white/[0.03] hover:text-white"
      title="登录"
    >
      <LogIn className="size-4" />
    </Link>
  );
}
