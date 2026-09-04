"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Stethoscope, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { scoreBand, type ScoreBand } from "@/lib/audit/rules";
import type { AuditRow, FindingRow } from "./page";

const BAND_LABEL: Record<ScoreBand, string> = {
  excelente: "Excelente",
  bom: "Bom",
  atencao: "Precisa atenção",
  critico: "Crítico",
};

const SEVERITY_ORDER = ["critical", "high", "medium", "quick_win", "info"];

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  quick_win: "Ganho rápido",
  info: "Informativo",
};

const SEVERITY_STYLE: Record<string, string> = {
  critical:
    "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
  high: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  medium:
    "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  quick_win:
    "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
  info: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
};

const CATEGORY_LABEL: Record<string, string> = {
  crawlability: "Rastreamento",
  indexation: "Indexação",
  onpage: "On-page",
  content: "Conteúdo",
  geo: "Visibilidade em IA",
  technical: "Técnico",
};

function ScoreCard({
  label,
  score,
  hint,
}: {
  label: string;
  score: number | null;
  hint: string;
}) {
  const band = score === null ? null : scoreBand(score);

  const color =
    band === null
      ? "text-slate-400 dark:text-slate-500"
      : band === "excelente" || band === "bom"
        ? "text-emerald-600 dark:text-emerald-400"
        : band === "atencao"
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-600 dark:text-red-400";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className={cn("mt-1 text-3xl font-bold", color)}>
        {score === null ? "—" : score}
        {score !== null && (
          <span className="text-lg text-slate-400 dark:text-slate-500">
            /100
          </span>
        )}
      </p>
      {band && (
        <p className={cn("text-sm font-semibold", color)}>{BAND_LABEL[band]}</p>
      )}
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

export function AuditBoard({
  blogId,
  audits,
  latest,
  findings,
}: {
  blogId: string;
  audits: AuditRow[];
  latest: AuditRow | null;
  findings: FindingRow[];
}) {
  const router = useRouter();
  const [siteUrl, setSiteUrl] = useState(latest?.site_url ?? "");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());

  const sorted = [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  const counts = SEVERITY_ORDER.map((s) => ({
    severity: s,
    count: findings.filter((f) => f.severity === s).length,
  })).filter((c) => c.count > 0);

  function toggle(id: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    if (!siteUrl) return;
    setRunning(true);
    setError(null);

    const res = await fetch("/api/audit/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blogId, siteUrl }),
    });
    const data = await res.json();
    setRunning(false);

    if (!res.ok) setError(data.error ?? "Error inesperado");
    else router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Auditoria do site
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          O que impede o site de ser encontrado — no Google e pela IA.
        </p>
      </div>

      <form
        onSubmit={handleRun}
        className="mb-6 rounded-xl border border-navy-200 dark:border-navy-700 bg-navy-50 dark:bg-navy-900/40 p-6"
      >
        <div className="mb-3 flex items-center gap-2">
          <Stethoscope size={18} className="text-navy-600 dark:text-navy-300" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Analisar um site
          </h3>
        </div>
        <div className="flex gap-2">
          <input
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="suempresa.com"
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-navy-500 dark:focus:border-navy-400"
          />
          <button
            type="submit"
            disabled={running}
            className="whitespace-nowrap rounded-lg bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
          >
            {running ? "Analisando..." : "Analisar"}
          </button>
        </div>
        {running && (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Lendo robots, sitemap e até 25 páginas. Pode levar até um minuto.
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </form>

      {latest && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ScoreCard
              label="Nota Google"
              score={latest.score_google}
              hint="Rastreamento, indexação, on-page e conteúdo"
            />
            <ScoreCard
              label="Nota IA"
              score={latest.score_ai}
              hint="Prontidão para ser citado por ChatGPT e afins"
            />
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Páginas analisadas
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
                {latest.pages_analyzed}
              </p>
              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {latest.site_url}
              </p>
            </div>
          </div>

          {counts.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {counts.map((c) => (
                <span
                  key={c.severity}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    SEVERITY_STYLE[c.severity],
                  )}
                >
                  {c.count} {SEVERITY_LABEL[c.severity]}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            {sorted.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Nenhum problema encontrado. O site está bem configurado.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {sorted.map((f) => {
                  const isOpen = open.has(f.id);
                  return (
                    <li key={f.id}>
                      <button
                        onClick={() => toggle(f.id)}
                        className="flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <span className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500">
                          {isOpen ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRight size={16} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-semibold",
                                SEVERITY_STYLE[f.severity],
                              )}
                            >
                              {SEVERITY_LABEL[f.severity]}
                            </span>
                            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400">
                              {CATEGORY_LABEL[f.category] ?? f.category}
                            </span>
                          </span>
                          <span className="mt-1.5 block font-medium text-slate-900 dark:text-slate-100">
                            {f.title}
                          </span>
                        </span>
                      </button>

                      {isOpen && (
                        <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 px-4 py-4 pl-11 text-sm">
                          {f.impact && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                Por que importa
                              </p>
                              <p className="mt-0.5 text-slate-700 dark:text-slate-300">
                                {f.impact}
                              </p>
                            </div>
                          )}
                          {f.evidence && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                Evidência
                              </p>
                              <p className="mt-0.5 text-slate-700 dark:text-slate-300">
                                {f.evidence}
                              </p>
                            </div>
                          )}
                          {f.fix && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                Como corrigir
                              </p>
                              <p className="mt-0.5 text-slate-700 dark:text-slate-300">
                                {f.fix}
                              </p>
                            </div>
                          )}
                          {f.affected_urls.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                Páginas afetadas
                              </p>
                              <ul className="mt-0.5 space-y-0.5">
                                {f.affected_urls.slice(0, 8).map((u) => (
                                  <li
                                    key={u}
                                    className="truncate text-xs text-slate-500 dark:text-slate-400"
                                  >
                                    {u}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {!latest && !running && (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center text-sm text-slate-500 dark:text-slate-400">
          Cole a URL de um site acima para receber o diagnóstico.
        </div>
      )}

      {audits.length > 1 && (
        <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Histórico
          </h3>
          <ul className="space-y-1.5">
            {audits.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="truncate text-slate-600 dark:text-slate-400">
                  {new Date(a.created_at).toLocaleDateString("pt-BR")} ·{" "}
                  {a.site_url}
                </span>
                <span className="shrink-0 font-medium text-slate-900 dark:text-slate-100">
                  {a.status === "done"
                    ? `${a.score_google}/100 · IA ${a.score_ai}/100`
                    : a.status === "error"
                      ? "falhou"
                      : "rodando"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
