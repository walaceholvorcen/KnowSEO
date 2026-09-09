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

      {/* Desktop: régua horizontal */}
      <div className="mt-8 hidden sm:block">
        <div className="relative">
          <div className="absolute left-0 right-0 top-[7px] h-px bg-slate-300 dark:bg-slate-700" />
          <div
            className="absolute left-0 top-[6px] h-0.5 bg-cobalto-600 dark:bg-cobalto-500"
            style={{ width: `${progresso}%` }}
          />

          <ol className="relative flex justify-between">
            {FASES.map((fase, i) => {
              const alcancada = i <= atual;
              return (
                <li
                  key={fase.chave}
                  className="flex flex-1 flex-col items-start last:flex-none"
                >
                  <span
                    className={cn(
                      "block h-3.5 w-3.5 rounded-full border-2",
                      alcancada
                        ? "border-cobalto-600 bg-cobalto-600 dark:border-cobalto-500 dark:bg-cobalto-500"
                        : "border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900",
                    )}
                  />
                  <span
                    className={cn(
                      "mt-3 text-sm",
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
      </div>

      {/* Celular: a mesma sequência, empilhada - cinco rótulos lado a lado
          numa tela estreita viram sopa de letra. */}
      <ol className="mt-6 sm:hidden">
        {FASES.map((fase, i) => {
          const alcancada = i <= atual;
          return (
            <li
              key={fase.chave}
              className="flex items-baseline gap-3 border-b border-slate-200 dark:border-slate-800 py-3 last:border-0"
            >
              <span
                className={cn(
                  "mt-1 block h-2.5 w-2.5 shrink-0 rounded-full",
                  alcancada
                    ? "bg-cobalto-600 dark:bg-cobalto-500"
                    : "bg-slate-300 dark:bg-slate-700",
                )}
              />
              <span
                className={cn(
                  "flex-1",
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
