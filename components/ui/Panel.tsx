import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type PanelTone = "default" | "subtle";

const toneClass: Record<PanelTone, string> = {
  default: "surface-panel",
  subtle: "surface-panel-subtle",
};

export function Panel({
  tone = "default",
  interactive = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: PanelTone;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        interactive && "interactive-lift",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}

export function SectionPanel({
  tone = "default",
  interactive = false,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  tone?: PanelTone;
  interactive?: boolean;
}) {
  return (
    <section
      className={cn(
        interactive && "interactive-lift",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}
