'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasSupabasePublicEnv } from '@/lib/supabase-env';

function disabledResult() {
  return Promise.resolve({
    data: null,
    error: { message: 'Supabase is not configured.' },
  });
}

function createDisabledQuery() {
  const query: Record<string, unknown> = {
    select: () => query,
    insert: () => query,
    update: () => query,
    upsert: () => query,
    delete: () => query,
    eq: () => query,
    neq: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
    single: disabledResult,
    maybeSingle: disabledResult,
    then: (resolve: (value: Awaited<ReturnType<typeof disabledResult>>) => unknown) => disabledResult().then(resolve),
  };

  return query;
}

function createDisabledClient() {
  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
      signInWithPassword: () => disabledResult(),
      signUp: () => disabledResult(),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => createDisabledQuery(),
  };
}

export function createClient(): SupabaseClient {
  if (!hasSupabasePublicEnv()) {
    return createDisabledClient() as unknown as SupabaseClient;
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
