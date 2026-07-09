import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[70vh] place-items-center px-4 text-center">
      <div>
        <span className="font-display text-7xl font-black text-cyan-300">
          404
        </span>
        <h1 className="mt-4 text-2xl font-bold text-white">这座擂台还没开放</h1>
        <Link
          href="/problems"
          className="mt-6 inline-block bg-white px-4 py-3 text-sm font-bold text-zinc-950"
        >
          返回题目列表
        </Link>
      </div>
    </main>
  );
}
