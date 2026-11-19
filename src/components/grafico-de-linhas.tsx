"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { diaCurto, marcasDoEixo, trechos } from "@/lib/grafico";

// Gráfico de linhas por dia. Serve ao tráfego de IA (uma linha por
// assistente) e ao desempenho no Google (uma métrica por vez).
//
// Um eixo só, sempre. O Search Console sobrepõe cliques e impressões em
// duas escalas, e o resultado é que as linhas se cruzam em pontos que não
// significam nada. Aqui se troca de métrica em vez de empilhar escalas.

export interface SerieDoGrafico {
  chave: string;
  nome: string;
  /** Um valor por dia. `null` = não há dado naquele dia (buraco na linha). */
  valores: (number | null)[];
  cor: CorDaSerie;
}

/**
 * As três cores de série, em ordem fixa, conferidas pelo validador da skill
 * de dataviz nos dois temas (daltonismo, luminosidade e contraste, todos os
 * pares): cobalto, laranja e água. A cor segue a entidade - o Claude é
 * sempre cobalto, com uma, duas ou três linhas na tela.
 *
 * O tracejado é a segunda codificação: a água fica abaixo de 3:1 no fundo
 * claro, e quem não separa as cores separa o traço.
 */
export type CorDaSerie = "cobalto" | "laranja" | "agua";

export const TRACO: Record<CorDaSerie, { linha: string; ponto: string; tracejado?: string }> = {
  cobalto: {
    linha: "stroke-cobalto-600 dark:stroke-[#7389f1]",
    ponto: "bg-cobalto-600 dark:bg-[#7389f1]",
  },
  laranja: {
    linha: "stroke-[#eb6834] dark:stroke-[#d95926]",
    ponto: "bg-[#eb6834] dark:bg-[#d95926]",
    tracejado: "7 4",
  },
  agua: {
    linha: "stroke-[#1baf7a] dark:stroke-[#199e70]",
    ponto: "bg-[#1baf7a] dark:bg-[#199e70]",
    tracejado: "2 4",
  },
};

/** A amostra de traço que acompanha o nome da série em legenda e dica. */
export function ChaveDaSerie({ cor }: { cor: CorDaSerie }) {
  const t = TRACO[cor];
  return (
    <svg width="18" height="8" aria-hidden="true" className="shrink-0">
      <line
        x1="1"
        y1="4"
        x2="17"
        y2="4"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={t.tracejado}
        className={t.linha}
      />
    </svg>
  );
}

export function GraficoDeLinhas({
  dias,
  series,
  titulo,
  formatar = (n) => n.toLocaleString("pt-BR"),
  passoMinimo = 1,
  invertido = false,
  marco,
}: {
  /** "AAAA-MM-DD", um por ponto do eixo horizontal. */
  dias: string[];
  series: SerieDoGrafico[];
  /** Nome do que o gráfico mostra - vira legenda da tabela para leitor de tela. */
  titulo: string;
  formatar?: (n: number) => string;
  passoMinimo?: number;
  /** Posição no Google: 1 é o melhor, então o eixo cresce para baixo. */
  invertido?: boolean;
  /** Um dia a marcar no eixo - "contagem ligada", por exemplo. */
  marco?: { dia: string; rotulo: string };
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const n = dias.length;
  if (n < 2) return null;

  const maior = Math.max(0, ...series.flatMap((s) => s.valores.filter((v): v is number => v !== null)));
  const marcas = marcasDoEixo(maior, passoMinimo);
  const topo = marcas[marcas.length - 1];
  const x = (i: number) => (i / (n - 1)) * 100;
  const y = (v: number) => (invertido ? (v / topo) * 100 : 100 - (v / topo) * 100);

  const iMarco = marco ? dias.indexOf(marco.dia) : -1;

  function mover(e: React.PointerEvent<HTMLDivElement>) {
    const caixa = e.currentTarget.getBoundingClientRect();
    const fracao = (e.clientX - caixa.left) / caixa.width;
    setAtivo(Math.min(n - 1, Math.max(0, Math.round(fracao * (n - 1)))));
  }

  function teclar(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const passo = e.key === "ArrowRight" ? 1 : -1;
      setAtivo((a) => Math.min(n - 1, Math.max(0, (a ?? (passo > 0 ? -1 : n)) + passo)));
    } else if (e.key === "Escape") {
      setAtivo(null);
    }
  }

  // A dica fica sempre ao lado da linha vertical, do lado que tem espaço:
  // centrada, ela cobria justamente o ponto que a pessoa estava lendo.
  const lado = ativo !== null && x(ativo) > 55 ? "direita" : "esquerda";

  return (
    <figure>
      <div className="flex gap-3">
        <div
          className="relative h-44 w-10 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400"
          aria-hidden="true"
        >
          {marcas.map((m) => (
            <span
              key={m}
              className="tabular absolute right-0 -translate-y-1/2"
              style={{ top: `${y(m)}%` }}
            >
              {formatar(m)}
            </span>
          ))}
        </div>

        <div
          tabIndex={0}
          role="group"
          aria-label={`${titulo}. Use as setas esquerda e direita para ler dia a dia.`}
          onPointerMove={mover}
          onPointerLeave={() => setAtivo(null)}
          onBlur={() => setAtivo(null)}
          onKeyDown={teclar}
          className="relative h-44 min-w-0 flex-1 touch-pan-y rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-cobalto-500/40"
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            aria-hidden="true"
          >
            {marcas.map((m) => (
              <line
                key={m}
                x1="0"
                x2="100"
                y1={y(m)}
                y2={y(m)}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                className={
                  m === 0
                    ? "stroke-slate-300 dark:stroke-slate-700"
                    : "stroke-slate-200 dark:stroke-slate-800"
                }
              />
            ))}
            {series.map((s) =>
              trechos(s.valores).map((trecho) => (
                <polyline
                  key={`${s.chave}-${trecho[0].i}`}
                  points={trecho.map((p) => `${x(p.i)},${y(p.v)}`).join(" ")}
                  fill="none"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={TRACO[s.cor].tracejado}
                  vectorEffect="non-scaling-stroke"
                  className={TRACO[s.cor].linha}
                />
              )),
            )}
          </svg>

          {iMarco > 0 && (
            <span
              className="absolute inset-y-0 w-px bg-slate-300 dark:bg-slate-700"
              style={{ left: `${x(iMarco)}%` }}
              aria-hidden="true"
            >
              <span
                className={cn(
                  "absolute top-0 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400",
                  x(iMarco) > 60 ? "right-1.5" : "left-1.5",
                )}
              >
                {marco!.rotulo}
              </span>
            </span>
          )}

          {/* Ponto no último dia com dado de cada série: é onde a linha
              está agora. Anel da cor do fundo para não se fundir com a linha
              vizinha. Sem ponto em todo dia - noventa bolinhas viram ruído. */}
          {series.map((s) => {
            let ultimo = -1;
            s.valores.forEach((v, i) => {
              if (v !== null) ultimo = i;
            });
            if (ultimo < 0) return null;
            return (
              <span
                key={s.chave}
                aria-hidden="true"
                className={cn(
                  "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-slate-900",
                  TRACO[s.cor].ponto,
                )}
                style={{ left: `${x(ultimo)}%`, top: `${y(s.valores[ultimo]!)}%` }}
              />
            );
          })}

          {ativo !== null && (
            <>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 w-px bg-slate-400 dark:bg-slate-500"
                style={{ left: `${x(ativo)}%` }}
              />
              <div
                role="status"
                className={cn(
                  "pointer-events-none absolute top-1 z-10 min-w-36 rounded-md bg-slate-900 px-3 py-2 text-xs text-white shadow-[0_4px_12px_rgb(21_25_28/0.18)] dark:bg-slate-100 dark:text-slate-900",
                  lado === "esquerda" ? "translate-x-2" : "-translate-x-[calc(100%+0.5rem)]",
                )}
                style={{ left: `${x(ativo)}%` }}
              >
                <span className="block text-slate-300 dark:text-slate-600">
                  {diaCurto(dias[ativo])}
                </span>
                {series.map((s) => (
                  <span key={s.chave} className="mt-1 flex items-center gap-2">
                    <ChaveDaSerie cor={s.cor} />
                    <span className="tabular font-display">
                      {s.valores[ativo] === null ? "sem dado" : formatar(s.valores[ativo]!)}
                    </span>
                    {series.length > 1 && (
                      <span className="text-slate-300 dark:text-slate-600">{s.nome}</span>
                    )}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div
        className="mt-2 flex justify-between pl-13 text-xs text-slate-500 dark:text-slate-400"
        aria-hidden="true"
      >
        <span>{diaCurto(dias[0])}</span>
        <span>{diaCurto(dias[Math.floor((n - 1) / 2)])}</span>
        <span>{diaCurto(dias[n - 1])}</span>
      </div>

      {/* Os mesmos números em tabela, para leitor de tela. A classe vai na
          caixa e não na tabela: tabela ignora `width: 1px` e, posta fora da
          tela direto, alargava a página em 7px no celular. */}
      <div className="sr-only">
      <table>
        <caption>{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            {series.map((s) => (
              <th key={s.chave} scope="col">
                {s.nome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dias.map((d, i) => (
            <tr key={d}>
              <td>{diaCurto(d)}</td>
              {series.map((s) => (
                <td key={s.chave}>
                  {s.valores[i] === null ? "sem dado" : formatar(s.valores[i]!)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
