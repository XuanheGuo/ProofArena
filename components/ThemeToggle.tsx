"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type ThemeMode = "system" | "light" | "dark";

const options = [
  { mode: "system" as const, label: "跟随系统", icon: Monitor },
  { mode: "light" as const, label: "浅色主题", icon: Sun },
  { mode: "dark" as const, label: "深色主题", icon: Moon },
];

function applyTheme(mode: ThemeMode) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = mode === "system" ? (systemDark ? "dark" : "light") : mode;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.style.colorScheme = resolved;
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const saved = localStorage.getItem("proofarena-theme");
    const initialMode: ThemeMode =
      saved === "light" || saved === "dark" || saved === "system" ? saved : "light";
    setMode(initialMode);
    applyTheme(initialMode);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if ((localStorage.getItem("proofarena-theme") ?? "light") === "system") {
        applyTheme("system");
      }
    };
    media.addEventListener("change", handleSystemChange);
    return () => media.removeEventListener("change", handleSystemChange);
  }, []);

  function selectMode(nextMode: ThemeMode) {
    setMode(nextMode);
    localStorage.setItem("proofarena-theme", nextMode);
    applyTheme(nextMode);
  }

  return (
    <div
      className="flex items-center border border-white/10 bg-black/20 p-0.5"
      role="group"
      aria-label="主题设置"
    >
      {options.map(({ mode: optionMode, label, icon: Icon }) => {
        const active = mode === optionMode;
        return (
          <button
            key={optionMode}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => selectMode(optionMode)}
            className={`grid size-7 place-items-center transition ${
              active
                ? "bg-cyan-400 text-zinc-950"
                : "text-zinc-500 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
