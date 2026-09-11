"use client";

import { botao, campo, pagina } from "@/components/ui";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Lede, Linha, NotaCard, Secao } from "@/components/lede";
import { resumirComparacao, type Comparacao } from "@/lib/audit/comparar";
import type { AuditRow, FindingRow } from "./page";
import type { Jornada } from "@/lib/audit/jornada";
import { JornadaDoSite, ProximaVerificacaoCard } from "./jornada-do-site";

const SEVERITY_ORDER = ["critical", "high", "medium", "quick_win", "info"];

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  quick_win: "Ganho rápido",
  info: "Informativo",
};

// Fundo neutro em todas: a severidade fica na palavra e na cor do texto.
// Antes cada pílula trazia seu próprio fundo colorido e a lista virava
// confete - com quatro cores brigando, nenhuma chamava atenção.
const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-slate-100 dark:bg-slate-800 text-nota-critico",
  high: "bg-slate-100 dark:bg-slate-800 text-nota-atencao",
  medium: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  quick_win: "bg-slate-100 dark:bg-slate-800 text-nota-excelente",
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

export function AuditBoard({
  blogId,
  audits,
  latest,
  findings,
  anterior,
  comparacao,
  acompanhamentoAtivo,
  jornada = null,
}: {
  blogId: string;
  audits: AuditRow[];
  latest: AuditRow | null;
  findings: FindingRow[];
  anterior: AuditRow | null;
  comparacao: Comparacao | null;
  acompanhamentoAtivo: boolean;
  jornada?: Jornada | null;
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

    // Sem try/catch, uma auditoria que estourasse o tempo limite deixava o
    // botão preso em "Analisando..." até recarregar a página - e estourar é
    // plausível: site grande com sitemap lento chega perto dos 120s.
    try {
      const res = await fetch("/api/audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogId, siteUrl }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Algo deu errado. Tente de novo.");
      else router.refresh();
    } catch {
      setError(
        "A auditoria demorou mais do que o limite ou a conexão caiu. Tente de novo; se repetir, o site pode estar lento para responder.",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className={pagina()}>
      <Lede
        apoio={
          latest
            ? `${comparacao ? `${resumirComparacao(comparacao)} ` : ""}${findings.length} ${findings.length === 1 ? "achado" : "achados"} em ${latest.pages_analyzed} ${latest.pages_analyzed === 1 ? "página" : "páginas"} de ${latest.site_url}.`
            : "Lemos robots, sitemap e até 25 páginas para dizer o que trava o site no Google e na IA."
        }
      >
        {latest
          ? `O site tira ${latest.score_google} de 100 no Google e ${latest.score_ai} de 100 na prontidão para IA.`
          : "Nenhum site auditado ainda. A análise leva menos de um minuto."}
      </Lede>

      {/* Bloco de ação em fundo azul competia com a frase de abertura: numa
          tela só, duas coisas gritando é o mesmo que nenhuma. O formulário
          fica neutro; a ousadia é do veredito. */}
      <form onSubmit={handleRun} className="mb-8">
        <div className="flex gap-2">
          <input
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="suaempresa.com"
            className={cn(campo(), "flex-1")}
          />
          <button
            type="submit"
            disabled={running}
            className={botao("primario")}
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
          <p className="mt-3 text-nota-critico">
            {error}
          </p>
        )}
      </form>

      {latest && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NotaCard
              label="Nota Google"
              score={latest.score_google}
              hint="Rastreamento, indexação, on-page e conteúdo"
            />
            <NotaCard
              label="Nota IA"
              score={latest.score_ai}
              hint="Prontidão para ser citado por ChatGPT e afins"
            />
            {jornada ? (
              <ProximaVerificacaoCard proxima={jornada.proxima} />
            ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Páginas analisadas
              </p>
              <p className="tabular mt-2 font-display text-5xl leading-none text-slate-900 dark:text-slate-100">
                {latest.pages_analyzed}
              </p>
              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {latest.site_url}
              </p>
            </div>
            )}
          </div>

          {jornada && <JornadaDoSite jornada={jornada} />}

          {/* O que transforma a auditoria de coisa que se roda três vezes em
              coisa que se acompanha. SEO não muda na hora; sem comparação,
              cada auditoria nova é uma lista parecida com a anterior e a
              pergunta "adiantou alguma coisa?" fica sem resposta. */}
          {comparacao && anterior && (
            <>
              <Secao>
                O que mudou desde{" "}
                {new Date(anterior.created_at).toLocaleDateString("pt-BR")}
              </Secao>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Nota Google{" "}
                <span className="tabular font-display text-slate-900 dark:text-slate-100">
                  {anterior.score_google} → {latest.score_google}
                </span>
                {" · "}Nota IA{" "}
                <span className="tabular font-display text-slate-900 dark:text-slate-100">
                  {anterior.score_ai} → {latest.score_ai}
                </span>
                . Correção de SEO leva de uma a duas semanas para aparecer aqui.
              </p>

              {comparacao.resolvidos.length +
                comparacao.novos.length +
                comparacao.persistem.filter((p) => p.melhorou || p.piorou)
                  .length ===
              0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Os mesmos achados, atingindo as mesmas páginas.
                </p>
              ) : (
                <ul className="mt-3">
                  {comparacao.resolvidos.map((f) => (
                    <Linha key={`resolvido-${f.code}`}>
                      <p className="flex items-start gap-2 text-sm">
                        <Check
                          size={16}
                          className="mt-0.5 shrink-0 text-nota-excelente"
                        />
                        <span>
                          <span className="font-medium text-nota-excelente">
                            Resolvido
                          </span>{" "}
                          <span className="text-slate-700 dark:text-slate-300">
                            {f.title}
                          </span>
                        </span>
                      </p>
                    </Linha>
                  ))}
                  {comparacao.novos.map((f) => (
                    <Linha key={`novo-${f.code}`}>
                      <p className="text-sm">
                        <span className="font-medium text-nota-critico">
                          Novo
                        </span>{" "}
                        <span className="text-slate-700 dark:text-slate-300">
                          {f.title}
                        </span>
                      </p>
                    </Linha>
                  ))}
                  {comparacao.persistem
                    .filter((p) => p.melhorou || p.piorou)
                    .map((p) => (
                      <Linha key={`mudou-${p.atual.code}`}>
                        <p className="text-sm">
                          <span
                            className={cn(
                              "font-medium",
                              p.melhorou
                                ? "text-nota-excelente"
                                : "text-nota-atencao",
                            )}
                          >
                            {p.melhorou ? "Diminuindo" : "Aumentando"}
                          </span>{" "}
                          <span className="text-slate-700 dark:text-slate-300">
                            {p.atual.title}
                          </span>{" "}
                          {/* Mono só nos números: com a frase inteira em
                              mono, "páginas" virava fantasia de técnico. */}
                          <span className="text-slate-500 dark:text-slate-400">
                            (
                            <span className="tabular font-display">
                              {p.anterior.affected_count} →{" "}
                              {p.atual.affected_count}
                            </span>{" "}
                            páginas)
                          </span>
                        </p>
                      </Linha>
                    ))}
                </ul>
              )}
            </>
          )}

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
                                Evidência
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
                          {f.affected_urls.length > 0 && (
                            <div>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
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

      {(audits.length > 1 || acompanhamentoAtivo) && latest && (
        <>
          <Secao>Histórico</Secao>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {acompanhamentoAtivo
              ? "Reauditamos este site toda segunda-feira, sem você precisar clicar, e mostramos aqui o que mudou. As rodadas automáticas aparecem marcadas."
              : "Cada auditoria fica guardada para ser comparada com a próxima."}
          </p>
          <ul className="mt-3">
            {audits.slice(0, 10).map((a) => (
              <Linha key={a.id}>
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="min-w-0 truncate text-slate-600 dark:text-slate-400">
                    {new Date(a.created_at).toLocaleDateString("pt-BR")} ·{" "}
                    {a.site_url}
                    {a.origem === "agendada" && " · semanal"}
                  </span>
                  <span className="tabular shrink-0 font-display text-slate-900 dark:text-slate-100">
                    {a.status === "done"
                      ? `${a.score_google} · IA ${a.score_ai}`
                      : a.status === "error"
                        ? "falhou"
                        : "rodando"}
                  </span>
                </div>
              </Linha>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
