import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { AdminSubmissionsView } from '@/components/AdminSubmissionsView';

export default async function AdminSubmissionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Check if user is admin (for now, check if email matches admin list)
  // In production, you'd check a role field in user_profiles table
  const adminEmails = ['xuanheguo@icloud.com']; // Configure this in .env later
  const isAdmin = adminEmails.includes(user.email || '');

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-black text-white">无访问权限</h1>
          <p className="mt-4 text-zinc-400">此页面仅限管理员访问。</p>
        </div>
      </div>
    );
  }

  return <AdminSubmissionsView />;
}
