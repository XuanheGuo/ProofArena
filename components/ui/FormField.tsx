import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function TextField({
  label,
  value,
  onChange,
  required,
  className,
  inputClassName,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputClassName?: string;
}) {
  return (
    <label className={cn("grid min-w-0 gap-2 text-sm", className)}>
      <span className="font-bold text-white">
        {label} {required && <span className="text-red-400">*</span>}
      </span>
      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-11 w-full min-w-0 border border-white/10 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-400/60",
          inputClassName,
        )}
        {...props}
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  required,
  className,
  textareaClassName,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textareaClassName?: string;
}) {
  return (
    <label className={cn("grid min-w-0 gap-2 text-sm", className)}>
      <span className="font-bold text-white">
        {label} {required && <span className="text-red-400">*</span>}
      </span>
      <textarea
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full min-w-0 resize-y border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-cyan-400/60",
          textareaClassName,
        )}
        {...props}
      />
    </label>
  );
}
