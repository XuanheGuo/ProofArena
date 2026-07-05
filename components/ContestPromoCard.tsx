"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Trophy, X } from "lucide-react";

type ContestPromoCardProps = {
  slug: string;
  title: string;
};

const STORAGE_PREFIX = "proofarena:contest-promo-dismissed:";

export function ContestPromoCard({ slug, title }: ContestPromoCardProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(`${STORAGE_PREFIX}${slug}`) === "1");
  }, [slug]);

  if (dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 sm:bottom-5 sm:right-5">
      <Link
        href={`/contests/${slug}`}
        className="flex items-center gap-2 border border-amber-400/25 bg-zinc-950/95 py-2 pl-2 pr-3 shadow-2xl shadow-black/30 transition hover:border-amber-300/50"
      >
        <span className="grid size-7 shrink-0 place-items-center bg-amber-300 text-zinc-950">
          <Trophy className="size-3.5" />
        </span>
        <span className="max-w-[8rem] truncate text-xs font-bold text-white sm:max-w-[14rem]">
          {title}
        </span>
        <ArrowRight className="size-3.5 shrink-0 text-zinc-500" />
      </Link>
      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem(`${STORAGE_PREFIX}${slug}`, "1");
          setDismissed(true);
        }}
        aria-label="关闭比赛推广"
        className="grid size-7 shrink-0 place-items-center border border-white/10 bg-zinc-950/95 text-zinc-500 transition hover:text-white"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
