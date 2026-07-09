"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FlaskConical,
  Minus,
} from "lucide-react";
import { casCheckSteps, casCheckEquivalence } from "@/lib/cas-client";
import type { StepVerification } from "@/lib/cas-client";

interface CASVerifierProps {
  steps: string[];
  answerA?: string;
  answerB?: string;
}

type Status = "idle" | "loading" | "done" | "error";

const METHOD_LABEL: Record<string, string> = {
  symbolic: "符号",
  numeric: "数值",
  condition: "条件",
  derived: "代回",
  equivalent: "等价",
  no_math: "无数学",
  no_equation: "无等式",
  partial: "部分",
  mixed: "混合",
  undecidable: "不可判",
  parse_error: "解析错",
};

function StepRow({ v }: { v: StepVerification }) {
  const skipped =
    v.method === "no_math" ||
    v.method === "no_equation" ||
    v.method === "condition";

  const icon = skipped ? (
    <Minus className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
  ) : v.valid === true ? (
    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
  ) : v.valid === false ? (
    <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
  ) : (
    <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
  );

  const bg = skipped
    ? "bg-zinc-900/40 border-zinc-700"
    : v.valid === true
      ? "bg-green-950/30 border-green-800"
      : v.valid === false
        ? "bg-red-950/30 border-red-800"
        : "bg-yellow-950/20 border-yellow-800";

  return (
    <div className={`flex gap-2 p-2  border text-xs ${bg}`}>
      {icon}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[11px] text-gray-400">步骤 {v.index + 1}</span>
          <span className="text-[10px] text-gray-600 px-1  bg-black/20">
            {METHOD_LABEL[v.method] ?? v.method}
          </span>
        </div>
        <div className="text-gray-300 break-words">{v.step}</div>
        {v.detail && (
          <div
            className={`mt-0.5 text-[11px] ${v.valid === false ? "text-red-400" : "text-gray-500"}`}
          >
            {v.detail}
          </div>
        )}
        {v.error && (
          <div className="mt-0.5 text-[11px] text-red-400">{v.error}</div>
        )}
      </div>
    </div>
  );
}

export function CASVerifier({ steps, answerA, answerB }: CASVerifierProps) {
  const [stepsStatus, setStepsStatus] = useState<Status>("idle");
  const [verifications, setVerifications] = useState<StepVerification[]>([]);
  const [stepsSummary, setStepsSummary] = useState("");

  const [equivStatus, setEquivStatus] = useState<Status>("idle");
  const [equivResult, setEquivResult] = useState<{
    equivalent: boolean | null;
    method: string;
    error?: string;
  } | null>(null);

  const validSteps = steps.filter(Boolean);

  async function runStepsCheck() {
    if (!validSteps.length) return;
    setStepsStatus("loading");
    setVerifications([]);
    setStepsSummary("");
    try {
      const res = await casCheckSteps(validSteps);
      setVerifications(res.verifications);
      setStepsSummary(res.summary);
      setStepsStatus("done");
    } catch {
      setStepsSummary("连接 CAS 服务失败，请确认服务已启动。");
      setStepsStatus("error");
    }
  }

  async function runEquivCheck() {
    if (!answerA || !answerB) return;
    setEquivStatus("loading");
    setEquivResult(null);
    try {
      const res = await casCheckEquivalence(answerA, answerB);
      setEquivResult(res);
      setEquivStatus("done");
    } catch {
      setEquivResult({
        equivalent: null,
        method: "parse_error",
        error: "连接 CAS 服务失败",
      });
      setEquivStatus("error");
    }
  }

  return (
    <div className="space-y-3">
      {validSteps.length >= 1 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={runStepsCheck}
              disabled={stepsStatus === "loading"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium  bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {stepsStatus === "loading" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <FlaskConical className="w-3 h-3" />
              )}
              CAS 检查代数步骤
            </button>
            <span className="text-xs text-gray-400">
              {validSteps.length} 步
            </span>
          </div>
          {stepsStatus !== "idle" && (
            <div className="space-y-1.5">
              {verifications.map((v) => (
                <StepRow key={v.index} v={v} />
              ))}
              {stepsSummary && (
                <p className="text-xs text-gray-400 mt-1">{stepsSummary}</p>
              )}
            </div>
          )}
        </div>
      )}

      {answerA && answerB && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={runEquivCheck}
              disabled={equivStatus === "loading"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium  bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {equivStatus === "loading" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <FlaskConical className="w-3 h-3" />
              )}
              CAS 检查结论等价
            </button>
          </div>
          {equivResult && (
            <div
              className={`flex gap-2 items-start p-2  border text-xs ${
                equivResult.equivalent === true
                  ? "bg-green-950/30 border-green-800"
                  : equivResult.equivalent === false
                    ? "bg-red-950/30 border-red-800"
                    : "bg-yellow-950/20 border-yellow-800"
              }`}
            >
              {equivResult.equivalent === true ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              ) : equivResult.equivalent === false ? (
                <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-medium text-gray-200">
                  {equivResult.equivalent === true
                    ? "等价"
                    : equivResult.equivalent === false
                      ? "不等价"
                      : "无法判断"}
                </span>
                <span className="ml-1.5 text-gray-500 text-[11px]">
                  ({METHOD_LABEL[equivResult.method] ?? equivResult.method})
                </span>
                {equivResult.error && (
                  <p className="text-red-400 mt-0.5">{equivResult.error}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
