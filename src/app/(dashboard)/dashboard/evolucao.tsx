"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FASES, faseAtual, mesesDesde } from "@/lib/fases";

// Régua de expectativa: onde o blog está na linha do tempo de SEO/GEO.
//
// É uma sequência real (uma fase depende da anterior), por isso ganha
// marcadores em ordem - ao contrário do resto do painel, onde numerar seria
// enfeite. A régua contínua carrega a informação: cheia até onde chegou,
// filete fino no que ainda vem.
export function EvolucaoDosArtigos({
  primeiraPublicacao,
}: {
  primeiraPublicacao: string | null;
}) {
  const [aberta, setAberta] = useState(false);

  const atual = faseAtual(primeiraPublicacao);
  if (atual < 0) return null;

  const meses = primeiraPublicacao ? mesesDesde(primeiraPublicacao) : 0;
  const progresso = (atual / (FASES.length - 1)) * 100;

  return (
    <section className="mt-12">
      <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">
        Evolução dos artigos
      </h2>
      <p className="mt-1 text-slate-600 dark:text-slate-400">
        {meses === 0
          ? "Primeiro mês no ar. Cada fase abaixo tem um prazo típico, contado a partir da primeira publicação."
          : `${meses} ${meses === 1 ? "mês" : "meses"} desde a primeira publicação.`}
      </p>

      {/* Uma lista só, que muda de forma por CSS: empilhada no celular (cinco
          rótulos lado a lado numa tela estreita viram sopa de letra) e régua
          horizontal a partir de sm. Antes eram duas cópias no DOM, e a
          escondida seguia visível para leitor de tela. */}
      <div className="relative mt-6 sm:mt-8">
        <div className="absolute left-0 right-0 top-[7px] hidden h-px bg-slate-300 sm:block dark:bg-slate-700" />
        <div
          className="absolute left-0 top-[6px] hidden h-0.5 bg-cobalto-600 sm:block dark:bg-cobalto-500"
          style={{ width: `${progresso}%` }}
        />

        <ol className="relative sm:flex sm:justify-between">
          {FASES.map((fase, i) => {
            const alcancada = i <= atual;
            return (
              <li
                key={fase.chave}
                className="flex items-baseline gap-3 border-b border-slate-200 py-3 last:border-0 dark:border-slate-800 sm:flex-1 sm:flex-col sm:items-start sm:gap-0 sm:border-0 sm:py-0 sm:last:flex-none"
              >
                <span
                  className={cn(
                    "mt-1 block size-2.5 shrink-0 rounded-full sm:mt-0 sm:size-3.5 sm:border-2",
                    alcancada
                      ? "bg-cobalto-600 sm:border-cobalto-600 dark:bg-cobalto-500 dark:sm:border-cobalto-500"
                      : "bg-slate-300 sm:border-slate-300 sm:bg-slate-100 dark:bg-slate-700 dark:sm:border-slate-700 dark:sm:bg-slate-900",
                  )}
                />
                <span
                  className={cn(
                    "flex-1 sm:mt-3 sm:flex-none sm:text-sm",
                    alcancada
                      ? "text-slate-900 dark:text-slate-100"
                      : "text-slate-400 dark:text-slate-500",
                  )}
                >
                  {fase.nome}
                </span>
                <span className="text-sm text-slate-400 dark:text-slate-500">
                  {fase.mes === 0 ? "1º dia" : `mês ${fase.mes}`}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        className="mt-6 flex items-center gap-1.5 text-cobalto-700 dark:text-cobalto-300 hover:underline"
      >
        {aberta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        Por que os dados aparecem aos poucos
      </button>

      {aberta && (
        <div className="mt-4 border-l-2 border-slate-200 dark:border-slate-800 pl-5">
          <p className="max-w-[62ch] text-slate-600 dark:text-slate-400">
            SEO e GEO não são interruptor, são juros compostos. Cada fase
            abaixo tem um prazo típico, contado a partir do seu primeiro
            artigo publicado.
          </p>

          <dl className="mt-5">
            {FASES.map((fase, i) => (
              <div
                key={fase.chave}
                className="border-b border-slate-200 dark:border-slate-800 py-4 last:border-0"
              >
                <dt className="flex items-baseline justify-between gap-4">
                  <span
                    className={
                      i <= atual
                        ? "text-slate-900 dark:text-slate-100"
                        : "text-slate-500 dark:text-slate-400"
                    }
                  >
                    {fase.nome}
                    {i === atual && (
                      <span className="ml-2 text-cobalto-700 dark:text-cobalto-300">
                        você está aqui
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm text-slate-400 dark:text-slate-500">
                    {fase.mes === 0 ? "desde o 1º dia" : `mês ${fase.mes}`}
                  </span>
                </dt>
                <dd className="mt-1 max-w-[62ch] text-slate-600 dark:text-slate-400">
                  {fase.descricao}
                </dd>
              </div>
            ))}
          </dl>

          {/* Honestidade obrigatória: a régua conta tempo, não mede
              indexação nem posição - não temos Search Console ligado. */}
          <p className="mt-5 max-w-[62ch] text-slate-500 dark:text-slate-400">
            Estes prazos são a expectativa realista, não uma trava, e nenhuma
            fase é medida por aqui: a régua conta o tempo desde a sua
            primeira publicação. Se o blog indexar ou ranquear antes, melhor
            para você.
          </p>
        </div>
      )}
    </section>
  );
}
