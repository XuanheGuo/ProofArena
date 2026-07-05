import { Target } from "lucide-react";
import { ProblemExplorerSkeleton } from "@/components/ProblemCardSkeleton";

export default function ProblemsLoading() {
  return (
    <main className="grid-surface min-h-screen" aria-hidden="true">
      <section className="border-b border-white/10 bg-zinc-950/80">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan-300">
            <Target className="size-4" />
            2026 赛季
          </div>
          <div className="mt-4 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="animate-pulse">
              <div className="h-9 w-40 bg-white/10 md:h-11" />
              <div className="mt-4 h-4 w-64 max-w-full bg-white/5" />
            </div>
            <div className="grid w-full animate-pulse grid-cols-3 border border-white/10 bg-zinc-950 sm:w-64">
              <div className="border-r border-white/10 p-4">
                <div className="h-5 w-6 bg-white/10" />
              </div>
              <div className="border-r border-white/10 p-4">
                <div className="h-5 w-6 bg-white/10" />
              </div>
              <div className="p-4">
                <div className="h-5 w-6 bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      </section>
      <ProblemExplorerSkeleton />
    </main>
  );
}
