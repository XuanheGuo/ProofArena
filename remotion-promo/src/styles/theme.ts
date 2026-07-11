export const FPS = 30;
export const SECOND = FPS;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION_FRAMES = 60 * FPS;

export const scenes = {
  book: { start: 0, duration: 8 * SECOND },
  unfold: { start: 8 * SECOND, duration: 10 * SECOND },
  arena: { start: 18 * SECOND, duration: 12 * SECOND },
  matrix: { start: 30 * SECOND, duration: 9 * SECOND },
  graph: { start: 39 * SECOND, duration: 9 * SECOND },
  product: { start: 48 * SECOND, duration: 7 * SECOND },
  ending: { start: 55 * SECOND, duration: 5 * SECOND },
} as const;

export const theme = {
  colors: {
    background: "#050507",
    backgroundSoft: "#0b0d10",
    panel: "#101217",
    paper: "#f6f2e8",
    paperDim: "#d8d2c5",
    text: "#f8fafc",
    muted: "#9ca3af",
    subtle: "#3f3f46",
    line: "rgba(255,255,255,0.16)",
    lineStrong: "rgba(255,255,255,0.32)",
    cyan: "#67e8f9",
    amber: "#f6c76b",
    red: "#f87171",
    green: "#86efac",
    card: "rgba(255,255,255,0.065)",
    cardBorder: "rgba(255,255,255,0.16)",
    glow: "rgba(255,255,255,0.34)",
  },
  fonts: {
    sans: "Inter, SF Pro Display, Helvetica Neue, Arial, sans-serif",
    serif: "Noto Serif SC, Songti SC, Georgia, serif",
    mono: "JetBrains Mono, SFMono-Regular, Menlo, monospace",
  },
  radius: {
    panel: 18,
    card: 14,
  },
};

export const fade = (
  localFrame: number,
  inFrames = 24,
  outStart?: number,
  outFrames = 24,
) => {
  const fadeIn = Math.min(1, Math.max(0, localFrame / inFrames));
  if (outStart === undefined || localFrame < outStart) {
    return fadeIn;
  }
  return Math.min(fadeIn, Math.max(0, 1 - (localFrame - outStart) / outFrames));
};
