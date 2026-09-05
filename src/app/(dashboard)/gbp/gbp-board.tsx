"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Lede, NotaCard, Secao } from "@/components/lede";
import type { GbpAuditRow, GbpFindingRow } from "./page";

const SEVERITY_ORDER = ["critical", "high", "medium", "quick_win", "info"];

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  quick_win: "Ganho rápido",
  info: "Informativo",
};

// Mesmo padrão da auditoria de site: fundo neutro em toda pílula, a
// severidade fica na cor do texto - evita a lista virar confete.
const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-slate-100 dark:bg-slate-800 text-nota-critico",
  high: "bg-slate-100 dark:bg-slate-800 text-nota-atencao",
  medium: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  quick_win: "bg-slate-100 dark:bg-slate-800 text-nota-excelente",
  info: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
};

export function GbpBoard({
  blogId,
  latest,
  findings,
}: {
  blogId: string;
  latest: GbpAuditRow | null;
  findings: GbpFindingRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState(latest?.query ?? "");
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
    if (!query.trim()) return;
    setRunning(true);
    setError(null);

    const res = await fetch("/api/gbp/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blogId, query }),
    });
    const data = await res.json();
    setRunning(false);

    if (!res.ok) setError(data.error ?? "Algo deu errado. Tente de novo.");
    else router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <Lede
        apoio={
          latest?.status === "done"
            ? `Encontramos ${latest.place_name} — ${latest.place_address ?? "endereço não informado"}. Não é o negócio certo? Refine a busca abaixo com bairro ou cidade.`
            : "Buscamos o perfil público no Google (sem você conectar nada) e dizemos o que trava o negócio no mapa."
        }
      >
        {latest?.status === "done"
          ? `O perfil no Google tira ${latest.score} de 100.`
          : "Nenhum perfil auditado ainda. Digite o nome do negócio e a cidade."}
      </Lede>

      <form onSubmit={handleRun} className="mb-8">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome do negócio, cidade"
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cobalto-500 dark:focus:border-cobalto-400"
          />
          <button
            type="submit"
            disabled={running}
            className="whitespace-nowrap rounded-lg bg-cobalto-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cobalto-700 disabled:opacity-50"
          >
            {running ? "Buscando..." : "Analisar"}
          </button>
        </div>
        {error && <p className="mt-3 text-nota-critico">{error}</p>}
      </form>

      {latest?.status === "done" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NotaCard
              label="Perfil no Google"
              score={latest.score}
              hint="Completude e reputação, com o que é público sem login"
            />
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Negócio encontrado
              </p>
              <p className="mt-2 font-display text-2xl leading-snug text-slate-900 dark:text-slate-100">
                {latest.place_name}
              </p>
              {latest.maps_uri && (
                <a
                  href={latest.maps_uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm text-cobalto-600 dark:text-cobalto-400 hover:underline"
                >
                  Ver no Google Maps <ExternalLink size={13} />
                </a>
              )}
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

          <Secao>Achados</Secao>
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            {sorted.length === 0 ? (
              <p className="p-8 text-center text-slate-500 dark:text-slate-400">
                Nenhum problema encontrado no que é público. O perfil está
                completo.
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
                          <span
                            className={cn(
                              "inline-block rounded-full px-2 py-0.5 text-xs font-semibold",
                              SEVERITY_STYLE[f.severity],
                            )}
                          >
                            {SEVERITY_LABEL[f.severity]}
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
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                Por que importa
                              </p>
                              <p className="mt-0.5 text-slate-700 dark:text-slate-300">
                                {f.impact}
                              </p>
                            </div>
                          )}
                          {f.evidence && (
                            <div>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                O que encontramos
                              </p>
                              <p className="mt-0.5 text-slate-700 dark:text-slate-300">
                                {f.evidence}
                              </p>
                            </div>
                          )}
                          {f.fix && (
                            <div>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                Como corrigir
                              </p>
                              <p className="mt-0.5 text-slate-700 dark:text-slate-300">
                                {f.fix}
                              </p>
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
    </div>
  );
}
