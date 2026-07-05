export default function ProblemDetailLoading() {
  return (
    <main className="grid-surface min-h-screen" aria-hidden="true">
      <section className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
          <div className="h-4 w-24 animate-pulse bg-white/5" />
          <div className="mt-5 grid animate-pulse gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
            <div>
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-white/10" />
                <div className="h-6 w-28 bg-white/5" />
                <div className="h-6 w-14 bg-white/5" />
              </div>
              <div className="mt-4 h-10 w-3/4 bg-white/10 md:h-12" />
            </div>
            <div className="grid grid-cols-3 border border-white/10 bg-black/20 text-center">
              <div className="border-r border-white/10 p-3">
                <div className="mx-auto h-6 w-6 bg-white/10" />
              </div>
              <div className="border-r border-white/10 p-3">
                <div className="mx-auto h-6 w-6 bg-white/10" />
              </div>
              <div className="p-3">
                <div className="mx-auto h-6 w-6 bg-white/10" />
              </div>
            </div>
          </div>
          <div className="mt-6 grid animate-pulse gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="h-40 border border-white/10 bg-zinc-950 p-5" />
            <div className="h-40 border border-white/10 bg-zinc-950 p-4" />
          </div>
        </div>
      </section>
      <nav className="sticky top-16 z-40 border-b border-white/10 bg-zinc-950/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl animate-pulse gap-2 px-4 py-2 md:px-6">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 w-16 shrink-0 bg-white/5" />
          ))}
        </div>
      </nav>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div className="grid animate-pulse gap-4">
          <div className="h-32 border border-white/10 bg-zinc-950" />
          <div className="h-32 border border-white/10 bg-zinc-950" />
        </div>
      </div>
    </main>
  );
}
