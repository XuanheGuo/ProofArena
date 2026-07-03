'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleSection({ title, subtitle, icon, badge, children, footer, defaultOpen = false }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border border-white/10 bg-zinc-950">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.02] md:px-7"
      >
        <div className="flex items-center gap-3">
          {icon && icon}
          <div>
            <span className="font-bold text-white">{title}</span>
            {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
          </div>
          {badge && <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{badge}</span>}
        </div>
        {open
          ? <ChevronUp className="size-4 shrink-0 text-zinc-500" />
          : <ChevronDown className="size-4 shrink-0 text-zinc-500" />
        }
      </button>

      {open && (
        <>
          <div className="border-t border-white/10">
            {children}
          </div>
          {footer && (
            <div className="border-t border-white/10 px-5 py-4 md:px-7">
              {footer}
            </div>
          )}
        </>
      )}
    </section>
  );
}
