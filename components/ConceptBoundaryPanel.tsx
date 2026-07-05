import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  ChevronsUpDown,
  GitCompare,
  Link2,
  RouteOff,
} from "lucide-react";
import type { ConceptContrast, ConceptLink, ContrastProblem, BoundaryNote, WhyNotMethod } from "@/lib/types";
import { getKnowledgeNode } from "@/data/knowledge";
import { MathBlock } from "@/components/MathBlock";

interface ConceptBoundaryPanelProps {
  id?: string;
  title: string;
  eyebrow?: string;
  description?: string;
  conceptLinks?: ConceptLink[];
  conceptContrasts?: ConceptContrast[];
  boundaryNotes?: BoundaryNote[];
  contrastProblems?: ContrastProblem[];
  whyNotMethods?: WhyNotMethod[];
  compact?: boolean;
  className?: string;
  problemLookup?: Record<string, { number: string; title: string }>;
}

function hasAnyContent({
  conceptLinks,
  conceptContrasts,
  boundaryNotes,
  contrastProblems,
  whyNotMethods,
}: Pick<
  ConceptBoundaryPanelProps,
  "conceptLinks" | "conceptContrasts" | "boundaryNotes" | "contrastProblems" | "whyNotMethods"
>) {
  return Boolean(
    conceptLinks?.length ||
      conceptContrasts?.length ||
      boundaryNotes?.length ||
      contrastProblems?.length ||
      whyNotMethods?.length
  );
}

function linkedConceptHref(link: ConceptLink) {
  return link.conceptId && getKnowledgeNode(link.conceptId) ? `/library/${link.conceptId}` : undefined;
}

export function ConceptBoundaryPanel(props: ConceptBoundaryPanelProps) {
  const {
    id,
    title,
    eyebrow = "concept boundary",
    description = "先看概念边界，再决定方法是否适用。",
    conceptLinks = [],
    conceptContrasts = [],
    boundaryNotes = [],
    contrastProblems = [],
    whyNotMethods = [],
    compact = false,
    className = "",
    problemLookup = {},
  } = props;

  if (!hasAnyContent(props)) return null;

  return (
    <section id={id} className={`scroll-mt-32 border border-amber-400/25 bg-zinc-950 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <GitCompare className="size-4 text-amber-300" />
          <div>
            <h2 className="text-sm font-bold text-white">{title}</h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{eyebrow}</span>
          </div>
        </div>
        <p className="max-w-xl text-xs leading-5 text-zinc-500">{description}</p>
      </div>

      <div className={`grid gap-px bg-white/10 ${compact ? "" : "xl:grid-cols-2"}`}>
        {conceptLinks.length > 0 && (
          <ConceptSection title="相关概念" icon={<Link2 className="size-4" />} tone="cyan" defaultOpen={false}>
            <div className="grid gap-3 sm:grid-cols-2">
              {conceptLinks.map((link) => {
                const href = linkedConceptHref(link);
                const body = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex max-w-full items-center gap-2 border border-cyan-400/20 bg-cyan-400/5 px-2.5 py-1.5 text-xs font-bold text-cyan-200">
                        <BookOpenCheck className="size-3.5 shrink-0" />
                        <span className="truncate">{link.label}</span>
                      </span>
                      {href && <ArrowUpRight className="size-3.5 shrink-0 text-zinc-600 group-hover:text-cyan-300" />}
                    </div>
                    <p className="mt-3 text-xs font-bold text-cyan-300">{link.relation}</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      <MathBlock>{link.note}</MathBlock>
                    </p>
                    {href && <p className="mt-3 text-[11px] text-zinc-600">进入节点查看完整知识网络</p>}
                  </>
                );
                return href ? (
                  <Link key={`${link.label}-${link.relation}`} href={href} className="group border border-cyan-400/20 bg-cyan-400/[0.04] p-4 transition hover:border-cyan-400/45">
                    {body}
                  </Link>
                ) : (
                  <div key={`${link.label}-${link.relation}`} className="border border-cyan-400/20 bg-cyan-400/[0.04] p-4">
                    {body}
                  </div>
                );
              })}
            </div>
          </ConceptSection>
        )}

        {conceptContrasts.length > 0 && (
          <ConceptSection title="易混概念" icon={<GitCompare className="size-4" />} tone="amber" defaultOpen={false}>
            <div className="space-y-3">
              {conceptContrasts.map((contrast) => (
                <div key={`${contrast.conceptA}-${contrast.conceptB}`} className="border border-amber-400/20 bg-amber-400/[0.04] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">{contrast.conceptA}</span>
                    <span className="font-mono text-[10px] text-zinc-600">VS</span>
                    <span className="text-sm font-bold text-white">{contrast.conceptB}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">
                    <MathBlock>{contrast.relationship}</MathBlock>
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <BoundaryCallout label="核心区别" tone="amber" text={contrast.keyDifference} />
                    <BoundaryCallout label="常见误用" tone="red" text={contrast.commonMistake} />
                  </div>
                  {contrast.exampleProblemIds.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {contrast.exampleProblemIds.map((problemId) => {
                        const problem = problemLookup[problemId];
                        return (
                          <Link key={problemId} href={`/problems/${problemId}`} className="border border-white/10 px-2.5 py-1.5 text-xs text-zinc-400 transition hover:border-amber-400/40 hover:text-amber-200">
                            {problem?.number ?? problemId} · {problem?.title ?? "对比题目"}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ConceptSection>
        )}

        {boundaryNotes.length > 0 && (
          <ConceptSection title="概念边界" icon={<BookOpenCheck className="size-4" />} tone="emerald" defaultOpen={false}>
            <div className="space-y-3">
              {boundaryNotes.map((note) => (
                <div key={note.title} className="border-l-2 border-emerald-400 bg-emerald-400/[0.04] p-4">
                  <h3 className="text-sm font-bold text-white"><MathBlock>{note.title}</MathBlock></h3>
                  <p className="mt-2 text-sm leading-7 text-zinc-300">
                    <MathBlock>{note.note}</MathBlock>
                  </p>
                  {note.typicalMisuse && (
                    <p className="mt-3 text-xs leading-5 text-red-300">
                      典型误用：<MathBlock>{note.typicalMisuse}</MathBlock>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ConceptSection>
        )}

        {contrastProblems.length > 0 && (
          <ConceptSection title="对比题目" icon={<ArrowUpRight className="size-4" />} tone="cyan" defaultOpen={false}>
            <div className="grid gap-3 sm:grid-cols-2">
              {contrastProblems.map((item) => {
                const problem = problemLookup[item.problemId];
                return (
                  <Link key={`${item.problemId}-${item.focus}`} href={`/problems/${item.problemId}`} className="group border border-white/10 bg-black/20 p-4 transition hover:border-cyan-400/35">
                    <div className="flex items-center justify-between gap-3">
                      <span className="border border-cyan-400/20 bg-cyan-400/5 px-2 py-1 text-[11px] font-bold text-cyan-300">
                        {item.role}
                      </span>
                      <ArrowUpRight className="size-3.5 shrink-0 text-zinc-600 group-hover:text-cyan-300" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-white">{problem?.title ?? item.problemId}</h3>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">
                      <MathBlock>{item.focus}</MathBlock>
                    </p>
                    <p className="mt-3 text-sm leading-6 text-zinc-300">
                      <MathBlock>{item.reason}</MathBlock>
                    </p>
                  </Link>
                );
              })}
            </div>
          </ConceptSection>
        )}

        {whyNotMethods.length > 0 && (
          <ConceptSection title="为什么不是这个方法？" icon={<RouteOff className="size-4" />} tone="red" defaultOpen={false} wide>
            <div className="grid gap-3 md:grid-cols-2">
              {whyNotMethods.map((method) => (
                <div key={method.methodName} className="border border-red-400/20 bg-red-500/[0.04] p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-red-300">
                    <AlertTriangle className="size-4" />
                    {method.methodName}
                  </div>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    <MathBlock>{method.reason}</MathBlock>
                  </p>
                  <div className="mt-4 border-t border-white/10 pt-3">
                    <p className="text-xs font-bold text-emerald-300">什么时候可以用</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      <MathBlock>{method.whenItWouldWork}</MathBlock>
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {method.relatedConcepts.map((concept) => (
                      <span key={concept} className="border border-white/10 px-2 py-1 text-[11px] text-zinc-500">
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ConceptSection>
        )}
      </div>
    </section>
  );
}

function ConceptSection({
  title,
  icon,
  tone,
  children,
  defaultOpen,
  wide = false,
}: {
  title: string;
  icon: ReactNode;
  tone: "cyan" | "amber" | "emerald" | "red";
  children: ReactNode;
  defaultOpen: boolean;
  wide?: boolean;
}) {
  const toneClass = {
    cyan: "text-cyan-300",
    amber: "text-amber-300",
    emerald: "text-emerald-300",
    red: "text-red-300",
  }[tone];

  return (
    <details open={defaultOpen} className={`group bg-zinc-950 ${wide ? "xl:col-span-2" : ""}`}>
      <summary className="flex min-h-14 list-none items-center justify-between gap-3 border-b border-white/10 px-5 py-4 marker:hidden">
        <span className={`flex items-center gap-2 text-xs font-bold ${toneClass}`}>
          {icon}
          {title}
        </span>
        <span className="flex items-center gap-2 text-[11px] text-zinc-600">
          点击展开
          <ChevronsUpDown className="size-3.5" />
        </span>
      </summary>
      <div className="p-5">{children}</div>
    </details>
  );
}

function BoundaryCallout({ label, tone, text }: { label: string; tone: "amber" | "red"; text: string }) {
  const className = tone === "amber" ? "border-amber-400/35 text-amber-300" : "border-red-400/35 text-red-300";

  return (
    <div className={`border-l ${className} pl-3`}>
      <p className="text-xs font-bold">{label}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-300">
        <MathBlock>{text}</MathBlock>
      </p>
    </div>
  );
}

