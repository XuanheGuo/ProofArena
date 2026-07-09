"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

// Minimal dependency-free replacement for the browser's native <select>,
// which renders with the OS's own /white chrome regardless of theme —
// this instead reuses the same border/surface language as the rest of the
// site (sharp corners, border-white/10, [data-theme] token colors) so it
// doesn't visually break from the surrounding UI.
export function Listbox<T extends string>({
  value,
  onChange,
  options,
  label,
  renderOption,
  className = "",
  buttonClassName,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly T[];
  label: string;
  renderOption?: (option: T) => React.ReactNode;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        className={
          buttonClassName ??
          "pressable pill-button flex h-11 w-full items-center justify-between border border-white/10 bg-zinc-950 pl-3 pr-3 text-sm text-zinc-300 outline-none hover:border-cyan-400/35 focus-visible:border-cyan-400/50"
        }
      >
        <span className="min-w-0 truncate">
          {renderOption ? renderOption(value) : value}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="surface-panel absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-72 overflow-y-auto py-1"
        >
          {options.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === value}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={`pressable flex h-9 w-full items-center justify-between gap-2 px-3 text-left text-sm ${
                  option === value
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="min-w-0 truncate">
                  {renderOption ? renderOption(option) : option}
                </span>
                {option === value && (
                  <Check className="size-3.5 shrink-0 text-cyan-300" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
