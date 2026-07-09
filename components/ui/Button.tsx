import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type ButtonTone =
  "primary" | "secondary" | "ghost" | "success" | "warning" | "danger";
type ButtonSize = "sm" | "md" | "icon";

const toneClass: Record<ButtonTone, string> = {
  primary: "bg-cyan-400 text-zinc-950 hover:bg-cyan-300",
  secondary:
    "border border-white/15 bg-black/20 text-zinc-300 hover:border-cyan-400/35 hover:text-white",
  ghost: "text-zinc-400 hover:bg-white/[0.06] hover:text-white",
  success: "bg-emerald-400 text-zinc-950 hover:bg-emerald-300",
  warning: "bg-amber-400 text-zinc-950 hover:bg-amber-300",
  danger: "border border-red-400/30 text-red-300 hover:bg-red-400/10",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  icon: "size-9",
};

export function Button({
  tone = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        "pressable pill-button inline-flex shrink-0 items-center justify-center gap-2 font-bold disabled:cursor-not-allowed disabled:opacity-50",
        toneClass[tone],
        sizeClass[size],
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  tone = "secondary",
  size = "md",
  className,
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  tone?: ButtonTone;
  size?: ButtonSize;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "pressable pill-button inline-flex shrink-0 items-center justify-center gap-2 font-bold",
        toneClass[tone],
        sizeClass[size],
        className,
      )}
      {...props}
    />
  );
}
