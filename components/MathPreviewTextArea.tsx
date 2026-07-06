"use client";

import { useRef, useState, useCallback } from "react";
import { Eye, EyeOff } from "lucide-react";
import { MathBlock } from "@/components/MathBlock";

const SNIPPETS: Array<{ label: string; insert: string; cursor?: number }> = [
  { label: "frac",   insert: "\\frac{{}}{{}}", cursor: 7 },
  { label: "sqrt",   insert: "\\sqrt{{}}", cursor: 6 },
  { label: "sum",    insert: "\\sum_{{i=1}}^{{n}}", cursor: 5 },
  { label: "int",    insert: "\\int_{{a}}^{{b}}", cursor: 5 },
  { label: "lim",    insert: "\\lim_{{x \\to }}", cursor: 12 },
  { label: "x^n",    insert: "x^{{}}", cursor: 3 },
  { label: "x_n",    insert: "x_{{}}", cursor: 3 },
  { label: "≤",      insert: "\\leq " },
  { label: "≥",      insert: "\\geq " },
  { label: "≠",      insert: "\\neq " },
  { label: "·",      insert: "\\cdot " },
  { label: "×",      insert: "\\times " },
  { label: "∞",      insert: "\\infty" },
  { label: "α",      insert: "\\alpha" },
  { label: "β",      insert: "\\beta" },
  { label: "θ",      insert: "\\theta" },
  { label: "π",      insert: "\\pi" },
  { label: "λ",      insert: "\\lambda" },
  { label: "$…$",    insert: "${{}}", cursor: 1 },
];

interface MathPreviewTextAreaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  required?: boolean;
}

export function MathPreviewTextArea({
  label,
  value,
  onChange,
  rows = 6,
  placeholder,
  required,
}: MathPreviewTextAreaProps) {
  const [showPreview, setShowPreview] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertSnippet = useCallback((insert: string, cursorOffset?: number) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    // If there's a selection and we're inserting a wrapper like ${}
    const inner = insert.replace("{{}}", `{${selected}}`);
    const next = value.slice(0, start) + inner + value.slice(end);
    onChange(next);
    // move cursor
    const pos = start + (cursorOffset ?? inner.length);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }, [value, onChange]);

  return (
    <div className="grid gap-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-bold text-white">
          {label} {required && <span className="text-red-400">*</span>}
        </span>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
        >
          {showPreview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {showPreview ? "隐藏预览" : "显示预览"}
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-1">
        {SNIPPETS.map(({ label: btnLabel, insert, cursor }) => (
          <button
            key={btnLabel}
            type="button"
            onClick={() => insertSnippet(insert, cursor)}
            className="h-7 rounded border border-white/10 bg-black/30 px-2 font-mono text-[11px] text-zinc-400 transition hover:border-cyan-400/40 hover:text-cyan-300"
          >
            {btnLabel}
          </button>
        ))}
      </div>

      <div className={showPreview ? "grid gap-2 xl:grid-cols-2" : ""}>
        <textarea
          ref={textareaRef}
          required={required}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full min-w-0 resize-y border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/50"
        />
        {showPreview && (
          <div className="min-h-[6rem] border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-zinc-200">
            {value.trim() ? (
              <MathBlock>{value}</MathBlock>
            ) : (
              <span className="text-zinc-600 italic">预览区域</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
