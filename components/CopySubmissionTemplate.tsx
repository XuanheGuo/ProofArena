"use client";

import { Check, ClipboardCopy } from "lucide-react";
import { useState } from "react";

export const submissionTemplate = `## 题目来源

## 解法标题

## 作者署名

## 解法类型标签

## 思路来源

## 关键转化

## 完整过程

## 启发点

## 迁移价值

## 适用场景

## 代价与局限

## 易错点

## 五维自评
- 正确性：
- 考场性：
- 结构美感：
- 计算量：
- 讲解友好：

## 可验证步骤

## 是否使用超纲工具
`;

export function CopySubmissionTemplate() {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  function fallbackCopy() {
    const textarea = document.createElement("textarea");
    textarea.value = submissionTemplate;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  }

  async function copyTemplate() {
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(submissionTemplate);
        } catch {
          if (!fallbackCopy()) throw new Error("Copy command failed");
        }
      } else {
        if (!fallbackCopy()) throw new Error("Copy command failed");
      }
      setStatus("copied");
    } catch {
      setStatus("failed");
    }

    window.setTimeout(() => setStatus("idle"), 1800);
  }

  return (
    <button
      type="button"
      onClick={copyTemplate}
      className="inline-flex h-12 w-full items-center justify-center gap-2 border border-white/20 px-5 text-sm font-bold text-white transition hover:border-cyan-400/50 hover:text-cyan-300 sm:w-auto"
    >
      {status === "copied" ? (
        <Check className="size-4 text-emerald-400" />
      ) : (
        <ClipboardCopy className="size-4" />
      )}
      {status === "copied"
        ? "已复制模板"
        : status === "failed"
          ? "复制失败，请手动复制"
          : "复制模板"}
    </button>
  );
}
