export default function ContestDetailLoading() {
  return (
    <main className="grid-surface min-h-screen" aria-hidden="true">
      <section className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
          <div className="h-4 w-24 animate-pulse  bg-white/5" />
          <div className="mt-6 grid animate-pulse gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
            <div>
              <div className="h-6 w-24  bg-white/10" />
              <div className="mt-5 h-10 w-3/4  bg-white/10 md:h-12" />
              <div className="mt-4 h-4 w-full max-w-xl  bg-white/5" />
            </div>
            <div className="surface-panel-subtle grid grid-cols-3 divide-x divide-white/10 overflow-hidden bg-black/30">
              <div className="p-4">
                <div className="mx-auto h-6 w-6  bg-white/10" />
              </div>
              <div className="p-4">
                <div className="mx-auto h-6 w-6  bg-white/10" />
              </div>
              <div className="p-4">
                <div className="mx-auto h-6 w-6  bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto grid max-w-7xl animate-pulse gap-6 px-4 py-8 md:px-6 md:py-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <div className="surface-panel h-32" />
          <div className="surface-panel h-48" />
        </div>
        <div className="space-y-4">
          <div className="surface-panel h-24" />
          <div className="surface-panel h-24" />
        </div>
      </div>
    </main>
  );
}
