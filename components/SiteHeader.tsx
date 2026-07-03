import Link from "next/link";
import { BookOpenCheck, Code2, Crosshair, Hammer, Info, Send, Swords } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";

const navigation = [
  { href: "/problems", label: "题目", icon: Swords, mobile: true },
  { href: "/library", label: "思路库", icon: BookOpenCheck, mobile: true },
  { href: "/studio", label: "Studio", icon: Hammer, badge: "内部" },
  { href: "/submit", label: "投稿", icon: Send, mobile: true },
  { href: "/about", label: "关于", icon: Info },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 md:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center bg-cyan-400 text-zinc-950">
            <Crosshair className="size-5" />
          </span>
          <span className="font-display truncate text-base font-black tracking-wide text-white sm:text-lg">ProofArena</span>
          <span className="hidden border-l border-white/10 pl-3 text-xs text-zinc-500 sm:inline">
            高中数学解法竞技场
          </span>
        </Link>
        <nav className="flex min-w-0 items-center gap-1 text-sm">
          {navigation.map(({ href, label, icon: Icon, badge, mobile }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              className={`${mobile ? "inline-flex" : "hidden md:inline-flex"} size-9 shrink-0 items-center justify-center text-zinc-400 transition hover:bg-white/[0.03] hover:text-white md:w-auto md:gap-2 md:px-3`}
            >
              <Icon className="size-4" />
              <span className="hidden md:inline">{label}</span>
              {badge && <span className="hidden border border-cyan-400/20 px-1.5 py-0.5 font-mono text-[9px] uppercase text-cyan-300 lg:inline">{badge}</span>}
            </Link>
          ))}
          <AuthButton />
          <ThemeToggle />
          <a
            href="https://github.com/XuanheGuo/ProofArena"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            title="GitHub"
            className="hidden size-9 place-items-center text-zinc-500 transition hover:text-white sm:grid"
          >
            <Code2 className="size-4" />
          </a>
        </nav>
      </div>
    </header>
  );
}
