"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Linha, Secao } from "@/components/lede";
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
    <section>
      <Secao>Evolução dos artigos</Secao>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {/* A explicação dos prazos mora dentro do bloco que abre; repetir
            aqui em cima era a mesma frase duas vezes na mesma tela. */}
        {meses === 0
          ? "Primeiro mês no ar, contado desde a primeira publicação."
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
                      : "text-slate-500 dark:text-slate-400",
                  )}
                >
                  {fase.nome}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
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
        {aberta ? "Fechar" : "O que esperar em cada fase"}
      </button>

      {aberta && (
        <div className="mt-3">
          <p className="max-w-[68ch] text-slate-600 dark:text-slate-400">
            Conteúdo não tem botão de ligar. Entre publicar e aparecer existe um
            caminho que o Google percorre no ritmo dele, e cada fase abaixo tem
            um prazo típico contado a partir do seu primeiro artigo.
          </p>

          <ul className="mt-4">
            {FASES.map((fase, i) => (
              <Linha key={fase.chave}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span
                    className={cn(
                      "font-medium",
                      i <= atual
                        ? "text-slate-900 dark:text-slate-100"
                        : "text-slate-500 dark:text-slate-400",
                    )}
                  >
                    {fase.nome}
                    {i === atual && (
                      <span className="ml-2 font-normal text-cobalto-700 dark:text-cobalto-300">
                        você está aqui
                      </span>
                    )}
                  </span>
                  <span className="tabular font-display shrink-0 text-sm text-slate-500 dark:text-slate-400">
                    {fase.mes === 0 ? "1º dia" : `mês ${fase.mes}`}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-1 max-w-[68ch] text-sm",
                    i <= atual
                      ? "text-slate-600 dark:text-slate-400"
                      : "text-slate-500 dark:text-slate-400",
                  )}
                >
                  {fase.descricao}
                </p>
              </Linha>
            ))}
          </ul>

          {/* Honestidade obrigatória: a régua conta tempo, não mede
              indexação nem posição - não temos Search Console ligado. */}
          <p className="mt-4 max-w-[68ch] text-sm text-slate-500 dark:text-slate-400">
            Nada disso é medido aqui: esta régua conta o tempo desde a sua
            primeira publicação, não a posição nem a indexação. São prazos
            típicos, não promessa - se o seu blog andar mais rápido, melhor
            para você.
          </p>
        </div>
      )}

    </section>
  );
}
