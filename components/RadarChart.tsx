interface RadarDatum {
  key: string;
  label: string;
  value: number;
}

export interface RadarSeries {
  data: RadarDatum[];
  color: string;
  label?: string;
}

interface RadarChartProps {
  data: RadarDatum[];
  max?: number;
  color?: string;
  series?: RadarSeries[];
  className?: string;
}

const SIZE = 300;
const CENTER = SIZE / 2;
const MAX_RADIUS = 90;
const RING_RATIOS = [0.25, 0.5, 0.75, 1];

function pointFor(index: number, count: number, ratio: number) {
  const angle = -90 + (index * 360) / count;
  const radians = (angle * Math.PI) / 180;
  return {
    x: CENTER + MAX_RADIUS * ratio * Math.cos(radians),
    y: CENTER + MAX_RADIUS * ratio * Math.sin(radians),
  };
}

// Lightweight dependency-free SVG radar chart for the 5-dimension solution
// scores — replaces a same-color stacked-bar list so a solution's shape
// (strong/weak axes) reads at a glance. See docs/UI_UX_AUDIT.md item 3.
export function RadarChart({
  data,
  max = 10,
  color = "var(--accent)",
  series,
  className,
}: RadarChartProps) {
  const count = data.length;
  const chartSeries = series?.length ? series : [{ data, color }];

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={`overflow-visible ${className ?? "mx-auto w-full max-w-72"}`}
      role="img"
      aria-label={chartSeries
        .map((item) =>
          `${item.label ? `${item.label}：` : ""}${item.data
            .map((d) => `${d.label} ${d.value.toFixed(1)}`)
            .join("，")}`,
        )
        .join("，")}
    >
      {RING_RATIOS.map((ratio) => (
        <polygon
          key={ratio}
          points={data
            .map((_, i) => {
              const p = pointFor(i, count, ratio);
              return `${p.x},${p.y}`;
            })
            .join(" ")}
          fill="none"
          stroke="var(--foreground)"
          strokeOpacity={0.1}
        />
      ))}
      {data.map((d, i) => {
        const p = pointFor(i, count, 1);
        return (
          <line
            key={d.key}
            x1={CENTER}
            y1={CENTER}
            x2={p.x}
            y2={p.y}
            stroke="var(--foreground)"
            strokeOpacity={0.1}
          />
        );
      })}
      {chartSeries.map((item, seriesIndex) => {
        const dataPoints = item.data.map((d, i) =>
          pointFor(i, count, Math.max(0, Math.min(max, d.value)) / max),
        );
        const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

        return (
          <g key={item.label ?? seriesIndex}>
            <polygon
              points={dataPolygon}
              fill={item.color}
              fillOpacity={0.14}
              stroke={item.color}
              strokeWidth={2}
              strokeDasharray={seriesIndex ? "5 3" : undefined}
            />
            {dataPoints.map((p, i) => (
              <circle
                key={item.data[i].key}
                cx={p.x}
                cy={p.y}
                r={3.5}
                fill={item.color}
              />
            ))}
          </g>
        );
      })}
      {data.map((d, i) => {
        const p = pointFor(i, count, 1.2);
        const anchor =
          p.x > CENTER + 4 ? "start" : p.x < CENTER - 4 ? "end" : "middle";
        return (
          <text
            key={d.key}
            x={p.x}
            y={p.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={12}
            fill="var(--foreground)"
            fillOpacity={0.65}
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

export function RadarChartLegend({
  data,
  max = 10,
  color = "var(--accent)",
}: {
  data: RadarDatum[];
  max?: number;
  color?: string;
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
      {data.map((d) => (
        <div key={d.key} className="flex items-center justify-between gap-2">
          <dt className="text-zinc-500">{d.label}</dt>
          <dd
            className="font-mono font-semibold tabular-nums"
            style={{ color }}
          >
            {d.value.toFixed(1)} / {max}
          </dd>
        </div>
      ))}
    </dl>
  );
}
