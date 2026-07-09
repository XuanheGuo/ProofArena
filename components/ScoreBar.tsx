interface ScoreBarProps {
  label: string;
  value: number;
  tone?: "cyan" | "red" | "amber";
}

const tones = {
  cyan: "bg-cyan-400",
  red: "bg-red-500",
  amber: "bg-amber-400",
};

export function ScoreBar({ label, value, tone = "cyan" }: ScoreBarProps) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr_2.4rem] items-center gap-3 text-sm">
      <span className="text-zinc-400">{label}</span>
      <div className="h-1.5 overflow-hidden bg-zinc-800">
        <div
          className={`h-full ${tones[tone]}`}
          style={{ width: `${Math.min(100, value * 10)}%` }}
        />
      </div>
      <span className="font-mono text-xs font-semibold tabular-nums text-zinc-100">
        {value.toFixed(1)}
      </span>
    </div>
  );
}
