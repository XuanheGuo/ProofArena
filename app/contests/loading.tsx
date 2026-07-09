export default function ContestsLoading() {
  return (
    <main className="grid-surface min-h-screen" aria-hidden="true">
      <section className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
          <div className="grid animate-pulse gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div>
              <div className="h-9 w-40  bg-white/10 md:h-11" />
              <div className="mt-4 h-4 w-72 max-w-full  bg-white/5" />
            </div>
            <div className="surface-panel grid grid-cols-3 overflow-hidden text-center">
              <div className="border-r border-white/10 p-3">
                <div className="mx-auto h-6 w-6  bg-white/10" />
              </div>
              <div className="border-r border-white/10 p-3">
                <div className="mx-auto h-6 w-6  bg-white/10" />
              </div>
              <div className="p-3">
                <div className="mx-auto h-6 w-6  bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <div className="grid animate-pulse gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="surface-panel h-40" />
          ))}
        </div>
      </div>
    </main>
  );
}
