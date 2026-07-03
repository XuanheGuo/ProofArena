"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, Code2, Crosshair, Hammer, Info, Menu, Send, Swords, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";

const navigation = [
  { href: "/problems", label: "题目", description: "浏览真题并进入解法对比", icon: Swords },
  { href: "/library", label: "思路库", description: "查看知识点、方法边界和关联题", icon: BookOpenCheck },
  { href: "/studio", label: "Studio", description: "内部内容整理工作台", icon: Hammer, badge: "内部" },
  { href: "/submit", label: "投稿", description: "提交题目、解法或改进建议", icon: Send },
  { href: "/about", label: "关于", description: "了解 ProofArena 的组织方式", icon: Info },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:px-4 md:px-6">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:flex-none">
          <span className="grid size-8 shrink-0 place-items-center bg-cyan-400 text-zinc-950">
            <Crosshair className="size-5" />
          </span>
          <span className="font-display min-w-fit text-base font-black text-white sm:text-lg">ProofArena</span>
          <span className="hidden border-l border-white/10 pl-3 text-xs text-zinc-500 sm:inline">
            高中数学解法竞技场
          </span>
        </Link>
        <nav className="hidden min-w-0 items-center gap-1 text-sm md:flex">
          {navigation.map(({ href, label, icon: Icon, badge }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              className="inline-flex size-9 shrink-0 items-center justify-center text-zinc-400 transition hover:bg-white/[0.03] hover:text-white md:w-auto md:gap-2 md:px-3"
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
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-site-menu"
          className="inline-flex h-10 shrink-0 items-center gap-2 border border-white/10 bg-black/20 px-3 text-sm font-bold text-zinc-200 transition hover:border-cyan-400/35 hover:text-white md:hidden"
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
          菜单
        </button>
      </div>
      {open && (
        <div id="mobile-site-menu" className="border-t border-white/10 bg-zinc-950/95 px-3 py-3 shadow-xl md:hidden">
          <div className="grid gap-2">
            {navigation.map(({ href, label, description, icon: Icon, badge }) => (
              <Link
                key={href}
                href={href}
                className="flex min-h-14 items-center gap-3 border border-white/10 bg-black/20 px-3 py-2 transition hover:border-cyan-400/35"
              >
                <span className="grid size-9 shrink-0 place-items-center border border-white/10 bg-zinc-950 text-cyan-300">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-bold text-white">
                    {label}
                    {badge && <span className="border border-cyan-400/20 px-1.5 py-0.5 font-mono text-[9px] uppercase text-cyan-300">{badge}</span>}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-zinc-500">{description}</span>
                </span>
              </Link>
            ))}
            <div className="grid gap-2 border-t border-white/10 pt-2">
              <AuthButton variant="menu" />
              <a
                href="https://github.com/XuanheGuo/ProofArena"
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center gap-3 border border-white/10 bg-black/20 px-3 text-sm font-bold text-zinc-300 transition hover:border-cyan-400/35 hover:text-white"
              >
                <Code2 className="size-4 shrink-0 text-zinc-500" />
                <span>GitHub 仓库</span>
              </a>
              <div className="flex items-center justify-between border border-white/10 bg-black/20 px-3 py-2">
                <span className="text-sm font-bold text-zinc-300">主题</span>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
