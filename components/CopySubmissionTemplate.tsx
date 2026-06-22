"use client";

import { Check, ClipboardCopy } from "lucide-react";
import { useState } from "react";

export const submissionTemplate = `## 题目来源

## 解法标题

## 思路来源

## 关键转化

## 完整过程

## 易错点

## 五维自评
- 正确性：
- 考场性：
- 优雅度：
- 计算量：
- 讲解友好：

## 可验证步骤

## 是否使用超纲工具
`;

export function CopySubmissionTemplate() {
  const [copied, setCopied] = useState(false);

  async function copyTemplate() {
    await navigator.clipboard.writeText(submissionTemplate);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copyTemplate}
      className="inline-flex h-12 w-full items-center justify-center gap-2 border border-white/20 px-5 text-sm font-bold text-white transition hover:border-cyan-400/50 hover:text-cyan-300 sm:w-auto"
    >
      {copied ? <Check className="size-4 text-emerald-400" /> : <ClipboardCopy className="size-4" />}
      {copied ? "已复制投稿模板" : "复制投稿模板"}
    </button>
  );
}
