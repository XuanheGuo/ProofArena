export function ProblemCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid min-h-72 animate-pulse overflow-hidden border border-white/10 bg-zinc-950/75 md:grid-cols-[5.25rem_1fr]"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 md:flex-col md:justify-center md:gap-3 md:border-b-0 md:border-r md:px-3">
        <div className="h-3 w-8 bg-white/10 md:hidden" />
        <div className="size-8 bg-white/10" />
      </div>
      <div className="flex flex-col p-5 md:p-6">
        <div className="flex flex-wrap gap-2">
          <div className="h-6 w-14 bg-white/10" />
          <div className="h-6 w-20 bg-white/5" />
          <div className="h-6 w-12 bg-white/5" />
        </div>
        <div className="mt-5 h-6 w-4/5 bg-white/10" />
        <div className="mt-3 h-4 w-full bg-white/5" />
        <div className="mt-2 h-4 w-2/3 bg-white/5" />
        <div className="mt-6 hidden h-28 border border-white/10 bg-white/[0.03] md:block" />
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/10 pt-4 md:mt-auto md:border-t-0 md:pt-8">
          <div className="h-4 w-20 bg-white/5" />
          <div className="h-4 w-16 bg-white/5" />
        </div>
      </div>
    </div>
  );
}

export function ProblemListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <ProblemCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function ProblemExplorerSkeleton() {
  return (
    <>
      <section className="border-b border-white/10 bg-zinc-950/80" aria-hidden="true">
        <div className="mx-auto max-w-7xl px-4 py-5 md:px-6">
          <div className="grid animate-pulse gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="h-11 border border-white/10 bg-zinc-950" />
            <div className="h-11 border border-white/10 bg-zinc-950 lg:w-40" />
            <div className="h-11 border border-white/10 bg-zinc-950 lg:w-40" />
          </div>
          <div className="mt-3 h-10 animate-pulse border border-white/10 bg-black/20" />
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mb-5 h-5 w-40 animate-pulse border-b border-white/10 pb-4" />
        <ProblemListSkeleton />
      </section>
    </>
  );
}
