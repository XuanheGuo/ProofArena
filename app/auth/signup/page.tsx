'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import Link from 'next/link';
import { Crosshair } from 'lucide-react';
import { hasSupabasePublicEnv } from '@/lib/supabase-env';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const communityEnabled = hasSupabasePublicEnv();
  const supabase = communityEnabled ? createClient() : null;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('社区数据库暂不可用，当前只能浏览静态题库。');
      return;
    }
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: username },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <span className="grid size-10 place-items-center bg-cyan-400 text-zinc-950 mx-auto">
            <Crosshair className="size-6" />
          </span>
          <h1 className="text-xl font-black text-white">请验证邮箱</h1>
          <p className="text-sm text-zinc-400">
            已向 <span className="text-white">{email}</span> 发送确认邮件，点击邮件中的链接即可完成注册。
          </p>
          <Link href="/auth/login" className="block text-sm text-cyan-400 hover:text-cyan-300">
            返回登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <span className="grid size-10 place-items-center bg-cyan-400 text-zinc-950">
            <Crosshair className="size-6" />
          </span>
          <h1 className="text-xl font-black tracking-wide text-white">注册 ProofArena</h1>
        </div>

        {!communityEnabled && (
          <div className="border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-100">
            社区数据库暂不可用，注册和投稿会暂时关闭；题库和解法仍可静态浏览。
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm text-zinc-400 mb-1.5">用户名</label>
            <input
              id="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-cyan-400/50 focus:bg-white/[0.07]"
              placeholder="你的用户名"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm text-zinc-400 mb-1.5">邮箱</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-cyan-400/50 focus:bg-white/[0.07]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-zinc-400 mb-1.5">密码</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-cyan-400/50 focus:bg-white/[0.07]"
              placeholder="至少 6 位"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !communityEnabled}
            className="w-full rounded bg-cyan-400 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300 disabled:opacity-50"
          >
            {loading ? '注册中…' : '注册'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          已有账号？{' '}
          <Link href="/auth/login" className="text-cyan-400 hover:text-cyan-300">
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
