"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChaveDaSerie,
  GraficoDeLinhas,
  type CorDaSerie,
} from "@/components/grafico-de-linhas";
import type { Assistente, MetricaDeIA, SerieDeIA } from "@/lib/ia-trafego";

// O painel dos assistentes, no formato que o dono reconheceu no Search
// Console: a métrica escolhida em cima, o gráfico por dia embaixo. A
// diferença são as caixas - aqui se escolhe de quais assistentes ver a
// linha.

// A cor segue o assistente, em ordem fixa: desmarcar o Claude não repinta
// o ChatGPT de cobalto.
const COR: Partial<Record<Assistente, CorDaSerie>> = {
  claude: "cobalto",
  chatgpt: "laranja",
  perplexity: "agua",
};

const METRICAS: { chave: MetricaDeIA; nome: string; ajuda: string }[] = [
  {
    chave: "leituras",
    nome: "Leituras para responder",
    ajuda: "O assistente abriu um artigo seu porque alguém perguntou algo a ele.",
  },
  {
    chave: "cliques",
    nome: "Cliques",
    ajuda: "Pessoas que clicaram no link da resposta e chegaram ao blog.",
  },
  {
    chave: "indexacoes",
    nome: "Indexação",
    ajuda: "O assistente passando para conhecer a página. Vem antes de ele usá-la.",
  },
];

const soma = (valores: (number | null)[]) =>
  valores.reduce<number>((s, v) => s + (v ?? 0), 0);

export function GraficoDeIA({
  dias,
  series,
  ligadaEm,
}: {
  dias: string[];
  series: SerieDeIA[];
  /** Dia em que a contagem começou, para marcar no eixo. */
  ligadaEm: string;
}) {
  const [metrica, setMetrica] = useState<MetricaDeIA>("leituras");
  const [visiveis, setVisiveis] = useState<Set<Assistente>>(
    () => new Set(series.map((s) => s.assistente)),
  );

  const alternar = (a: Assistente) =>
    setVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(a)) novo.delete(a);
      else novo.add(a);
      return novo;
    });

  const escolhida = METRICAS.find((m) => m.chave === metrica)!;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* As métricas, como no Search Console: clicar troca o que o gráfico
          mostra. Uma por vez - três escalas no mesmo eixo não se leem. */}
      <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {METRICAS.map((m) => {
          const ligada = m.chave === metrica;
          const total = series.reduce((s, x) => s + soma(x[m.chave]), 0);
          return (
            <button
              key={m.chave}
              type="button"
              aria-pressed={ligada}
              onClick={() => setMetrica(m.chave)}
              className={cn(
                "border-b-2 px-4 py-3 text-left transition-colors duration-150 motion-reduce:transition-none sm:px-5",
                ligada
                  ? "border-cobalto-600 dark:border-cobalto-400"
                  : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60",
              )}
            >
              <span
                className={cn(
                  "block text-xs sm:text-sm",
                  ligada
                    ? "text-slate-900 dark:text-slate-100"
                    : "text-slate-500 dark:text-slate-400",
                )}
              >
                {m.nome}
              </span>
              <span className="tabular font-display mt-1 block text-2xl text-slate-900 dark:text-slate-100">
                {total.toLocaleString("pt-BR")}
              </span>
            </button>
          );
        })}
      </div>

      <div className="p-4 sm:p-5">
        <p className="text-sm text-slate-600 dark:text-slate-400">{escolhida.ajuda}</p>

        <fieldset className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          <legend className="sr-only">Assistentes no gráfico</legend>
          {series.map((s) => (
            <label
              key={s.assistente}
              className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-slate-700 pointer-coarse:min-h-11 dark:text-slate-300"
            >
              <input
                type="checkbox"
                checked={visiveis.has(s.assistente)}
                onChange={() => alternar(s.assistente)}
                className="size-4 accent-cobalto-600"
              />
              <ChaveDaSerie cor={COR[s.assistente] ?? "cobalto"} />
              {s.nome}
              <span className="tabular font-display text-slate-900 dark:text-slate-100">
                {soma(s[metrica]).toLocaleString("pt-BR")}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-4">
          <GraficoDeLinhas
            dias={dias}
            titulo={`${escolhida.nome} por dia, por assistente`}
            marco={{ dia: ligadaEm, rotulo: "contagem ligada" }}
            series={series
              .filter((s) => visiveis.has(s.assistente))
              .map((s) => ({
                chave: s.assistente,
                nome: s.nome,
                valores: s[metrica],
                cor: COR[s.assistente] ?? "cobalto",
              }))}
          />
        </div>
      </div>
    </div>
  );
}
