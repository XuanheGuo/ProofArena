import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModerator } from "@/lib/require-moderator";
import { redirect } from "next/navigation";
import { AdminSubmissionsView } from "@/components/AdminSubmissionsView";

export default async function AdminSubmissionsPage() {
  const moderator = await requireModerator();

  if (!moderator.ok) {
    if (moderator.reason === "unauthenticated") redirect("/auth/login");
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-black text-white">无访问权限</h1>
          <p className="mt-4 text-zinc-400">此页面仅限管理员访问。</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 md:px-6">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft className="size-4" />
          返回管理面板
        </Link>
        <AdminSubmissionsView />
      </div>
    </main>
  );
}
