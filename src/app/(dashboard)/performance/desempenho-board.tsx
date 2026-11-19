"use client";

import { useState } from "react";
import Link from "next/link";
import { Lede, Secao } from "@/components/lede";
import { GraficoDeLinhas } from "@/components/grafico-de-linhas";
import { pagina } from "@/components/ui";
import { cn } from "@/lib/utils";
import { diaCurto } from "@/lib/grafico";
import {
  PERIODOS,
  porcento,
  umaCasa,
  type LinhaDoGoogle,
  type Periodo,
} from "@/lib/google/desempenho";
import type { Escopo, TelaDeDesempenho } from "./dados";

// O relatório de desempenho do Search Console, dentro do painel: a agência
// não precisa de duas abas abertas para responder "o Google está mandando
// gente?".
//
// A diferença deliberada para o original: uma métrica por vez no gráfico.
// Lá, cliques e impressões dividem o desenho em duas escalas e as linhas se
// cruzam em pontos que não significam nada.

type Metrica = "cliques" | "impressoes" | "ctr" | "posicao";

const inteiro = (n: number) => n.toLocaleString("pt-BR");

export function DesempenhoBoard({
  tela,
  periodo,
  escopo,
  propriedade,
  enderecoDoBlog,
}: {
  tela: TelaDeDesempenho;
  periodo: Periodo;
  escopo: Escopo;
  /** "sc-domain:cliente.com" - de onde o dado vem, escrito na tela. */
  propriedade: string;
  /** Null quando o blog não mora no site do cliente: some o filtro. */
  enderecoDoBlog: string | null;
}) {
  const [metrica, setMetrica] = useState<Metrica>("cliques");
  const { desempenho: d, consultas, paginas } = tela;

  const METRICAS: {
    chave: Metrica;
    nome: string;
    total: string;
    valores: (number | null)[];
    formatar: (n: number) => string;
    passoMinimo: number;
    invertido?: boolean;
  }[] = [
    { chave: "cliques", nome: "Cliques", total: inteiro(d.total.cliques), valores: d.cliques, formatar: inteiro, passoMinimo: 1 },
    { chave: "impressoes", nome: "Impressões", total: inteiro(d.total.impressoes), valores: d.impressoes, formatar: inteiro, passoMinimo: 1 },
    { chave: "ctr", nome: "CTR médio", total: porcento(d.total.ctr), valores: d.ctr, formatar: porcento, passoMinimo: 0.1 },
    {
      chave: "posicao",
      nome: "Posição média",
      total: d.total.posicao === null ? "-" : umaCasa(d.total.posicao),
      valores: d.posicao,
      formatar: umaCasa,
      passoMinimo: 1,
      invertido: true,
    },
  ];
  const escolhida = METRICAS.find((m) => m.chave === metrica)!;

  const link = (p: Periodo, e: Escopo) => `/performance?periodo=${p}&escopo=${e}`;
  const nomeDoPeriodo = PERIODOS.find((p) => p.dias === periodo)!.rotulo;

  return (
    <div className={pagina()}>
      <Lede
        apoio={
          <>
            Dado do Search Console ({propriedade.replace(/^sc-domain:/, "")})
            {d.ate ? `, fechado até ${diaCurto(d.ate)}` : ""}. O Google leva de
            dois a três dias para fechar cada dia.
          </>
        }
      >
        {d.ate
          ? `${inteiro(d.total.cliques)} ${d.total.cliques === 1 ? "clique" : "cliques"} e ${inteiro(d.total.impressoes)} impressões no Google em ${nomeDoPeriodo}.`
          : `O Google não registrou nenhuma impressão em ${nomeDoPeriodo}.`}
      </Lede>

      {/* Os filtros numa linha só, acima de tudo o que eles recortam. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <nav aria-label="Período" className="flex gap-1">
          {PERIODOS.map((p) => (
            <Link
              key={p.dias}
              href={link(p.dias, escopo)}
              aria-current={p.dias === periodo ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm pointer-coarse:min-h-11 pointer-coarse:py-2.5",
                p.dias === periodo
                  ? "bg-white font-medium text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
                  : "text-slate-600 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-800/70",
              )}
            >
              {p.rotulo}
            </Link>
          ))}
        </nav>
        {enderecoDoBlog && (
          <nav aria-label="Recorte" className="flex gap-1">
            {(
              [
                ["site", "Site inteiro"],
                ["blog", "Só o blog"],
              ] as [Escopo, string][]
            ).map(([e, rotulo]) => (
              <Link
                key={e}
                href={link(periodo, e)}
                aria-current={e === escopo ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm pointer-coarse:min-h-11 pointer-coarse:py-2.5",
                  e === escopo
                    ? "bg-white font-medium text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
                    : "text-slate-600 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-800/70",
                )}
              >
                {rotulo}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800 sm:grid-cols-4 sm:divide-x sm:divide-slate-200 sm:dark:divide-slate-800">
          {METRICAS.map((m) => {
            const ligada = m.chave === metrica;
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
                    "block text-sm",
                    ligada ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400",
                  )}
                >
                  {m.nome}
                </span>
                <span className="tabular font-display mt-1 block text-2xl text-slate-900 dark:text-slate-100">
                  {m.total}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-5">
          {d.dias.length > 1 ? (
            <>
              {escolhida.invertido && (
                <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                  Posição 1 é o topo da busca: quanto mais alta a linha, melhor.
                </p>
              )}
              <GraficoDeLinhas
                dias={d.dias}
                titulo={`${escolhida.nome} por dia no Google`}
                formatar={escolhida.formatar}
                passoMinimo={escolhida.passoMinimo}
                invertido={escolhida.invertido}
                series={[
                  { chave: escolhida.chave, nome: escolhida.nome, valores: escolhida.valores, cor: "cobalto" },
                ]}
              />
            </>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Ainda não há dias suficientes para desenhar a linha neste recorte.
            </p>
          )}
        </div>
      </div>

      <Tabela titulo="Consultas" coluna="O que as pessoas buscaram" linhas={consultas} />
      <Tabela titulo="Páginas" coluna="Onde elas chegaram" linhas={paginas} ehEndereco />
    </div>
  );
}

function Tabela({
  titulo,
  coluna,
  linhas,
  ehEndereco = false,
}: {
  titulo: string;
  coluna: string;
  linhas: LinhaDoGoogle[];
  ehEndereco?: boolean;
}) {
  return (
    <>
      <Secao>{titulo}</Secao>
      {linhas.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Nada neste recorte.
        </p>
      ) : (
        // A tabela rola dentro da própria caixa; a página nunca rola de lado.
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th scope="col" className="py-2 pr-4 font-medium">{coluna}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Cliques</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Impressões</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">CTR</th>
                <th scope="col" className="py-2 pl-3 text-right font-medium">Posição</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.chave} className="border-b border-slate-200 last:border-0 dark:border-slate-800">
                  <td className="max-w-0 py-2.5 pr-4 text-slate-800 dark:text-slate-200">
                    {ehEndereco ? (
                      <a
                        href={l.chave}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={l.chave}
                        className="block truncate hover:underline"
                      >
                        {l.chave.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      <span className="block truncate" title={l.chave}>{l.chave}</span>
                    )}
                  </td>
                  <td className="tabular font-display px-3 py-2.5 text-right text-slate-900 dark:text-slate-100">{inteiro(l.cliques)}</td>
                  <td className="tabular font-display px-3 py-2.5 text-right text-slate-900 dark:text-slate-100">{inteiro(l.impressoes)}</td>
                  <td className="tabular font-display px-3 py-2.5 text-right text-slate-600 dark:text-slate-400">{porcento(l.ctr * 100)}</td>
                  <td className="tabular font-display py-2.5 pl-3 text-right text-slate-600 dark:text-slate-400">{umaCasa(l.posicao)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
