'use client';

import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-client';
import Link from 'next/link';
import { LogIn, User as UserIcon, LogOut } from 'lucide-react';

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
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
    return (
      <div className="flex items-center gap-2">
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
