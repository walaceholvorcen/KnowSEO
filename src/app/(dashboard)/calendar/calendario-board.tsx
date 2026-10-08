"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { botao, campo, folha, pagina } from "@/components/ui";
import { Lede, Secao } from "@/components/lede";
import { cn } from "@/lib/utils";
import { mesVizinho, paraInput, semanasDoMes } from "@/lib/calendario";
import { agendarArtigo, distribuirNoMes } from "../acoes";

// O calendário de publicação: um dia de trabalho virando um mês de cadência.
//
// A tela existe porque o campo `scheduled_at` estava no banco desde o
// primeiro dia sem nada que o preenchesse - e três rascunhos ficaram prontos,
// sem data, esperando alguém lembrar deles.

export type ItemDoDia = {
  id: string;
  titulo: string;
  estado: "agendado" | "publicado" | "atrasado";
};

// O estado vira cor de texto, não pílula com fundo: uma pílula por item e a
// tela viraria confete (mesma decisão da lista de Conteúdos).
const COR: Record<ItemDoDia["estado"], string> = {
  agendado: "text-cobalto-700 dark:text-cobalto-300",
  publicado: "text-nota-excelente",
  atrasado: "text-nota-critico",
};

const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

function rotuloDoMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, m - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function CalendarioBoard({
  mes,
  hoje,
  veredito,
  porDia,
  semData,
}: {
  mes: string;
  /** "2026-10-06", calculado no servidor: relógio no corpo do componente é
   *  impuro e o lint recusa, com razão. */
  hoje: string;
  veredito: string;
  porDia: Record<string, ItemDoDia[]>;
  semData: { id: string; titulo: string }[];
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const semanas = semanasDoMes(mes, new Date(`${hoje}T00:00:00.000Z`));
  const comAlgo = Object.entries(porDia).sort(([a], [b]) => a.localeCompare(b));

  // O que ainda dá para remarcar: publicado não volta atrás. Sai da mesma
  // estrutura que desenha a grade - um artigo agendado já está lá, com a
  // data como chave, e uma segunda lista vinda do servidor podia divergir.
  const agendados = comAlgo.flatMap(([dia, itens]) =>
    itens.filter((i) => i.estado !== "publicado").map((i) => ({ ...i, dia })),
  );

  async function chamar(acao: () => Promise<{ erro: string | null }>) {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const r = await acao();
      if (r.erro) setErro(r.erro);
      else router.refresh();
    } catch {
      setErro("Não deu para salvar agora. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className={pagina()}>
      <Lede
        apoio="O robô publica uma vez por dia, às 8h. A data vale o dia inteiro - não existe hora marcada, e prometer isso seria mentira."
        acao={
          semData.length > 0 ? (
            <button
              type="button"
              disabled={ocupado}
              onClick={() =>
                chamar(() => distribuirNoMes(semData.map((d) => d.id), mes))
              }
              className={botao("primario")}
            >
              {ocupado ? "Distribuindo..." : `Distribuir ${semData.length} no mês`}
            </button>
          ) : undefined
        }
      >
        {veredito}
      </Lede>

      {erro && <p className="mb-6 text-sm text-nota-critico">{erro}</p>}

      <div className="mb-3 flex items-center justify-between gap-4">
        <Link
          href={`/calendar?mes=${mesVizinho(mes, -1)}`}
          className={botao("fantasma", "sm")}
          aria-label="Mês anterior"
        >
          <ChevronLeft size={14} aria-hidden />
        </Link>
        <p className="font-display text-sm text-slate-700 dark:text-slate-300">
          {rotuloDoMes(mes)}
        </p>
        <Link
          href={`/calendar?mes=${mesVizinho(mes, 1)}`}
          className={botao("fantasma", "sm")}
          aria-label="Mês seguinte"
        >
          <ChevronRight size={14} aria-hidden />
        </Link>
      </div>

      {/* Grade do mês. Tabela, e não grid de divs: um calendário é dado
          tabular, e o leitor de tela precisa do cabeçalho do dia da semana. */}
      <table className="hidden w-full table-fixed border-collapse overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:table dark:border-slate-800 dark:bg-slate-800">
        <thead>
          <tr>
            {DIAS.map((d) => (
              <th
                key={d}
                scope="col"
                className="bg-white p-2 text-left text-xs font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-400"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanas.map((semana) => (
            <tr key={semana[0].dia.toISOString()}>
              {semana.map((celula) => {
                const chave = paraInput(celula.dia);
                const itens = porDia[chave] ?? [];
                return (
                  <td
                    key={chave}
                    className={cn(
                      "h-24 max-w-0 align-top bg-white p-2 dark:bg-slate-900",
                      !celula.doMes && "bg-slate-50 dark:bg-slate-950",
                      // Fim de semana recebe o mesmo tom do mês vizinho: a
                      // distribuição não usa esses dias, e a tela diz isso
                      // sem precisar de legenda.
                      celula.doMes && !celula.util && "bg-slate-50 dark:bg-slate-950",
                    )}
                  >
                    <span
                      className={cn(
                        "tabular font-display text-xs",
                        celula.hoje
                          ? "rounded bg-cobalto-600 px-1.5 py-0.5 text-white"
                          : celula.doMes
                            ? "text-slate-500 dark:text-slate-400"
                            : "text-slate-400 dark:text-slate-600",
                      )}
                    >
                      {celula.dia.getUTCDate()}
                    </span>
                    <ul className="mt-1 space-y-1">
                      {itens.map((item) => (
                        <li key={item.id} className="truncate">
                          <Link
                            href={`/contents/${item.id}`}
                            title={item.titulo}
                            className={cn(
                              "block truncate text-xs hover:underline",
                              COR[item.estado],
                            )}
                          >
                            {item.titulo}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* No celular a grade de sete colunas fica ilegível: vira agenda, só
          com os dias que têm algo. */}
      <div className="sm:hidden">
        {comAlgo.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Nada agendado nem publicado em {rotuloDoMes(mes)}.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {comAlgo.map(([dia, itens]) => (
              <li key={dia} className="flex gap-3 p-3">
                <span className="tabular font-display w-10 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                  {dia.slice(8)}/{dia.slice(5, 7)}
                </span>
                <ul className="min-w-0 space-y-1">
                  {itens.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/contents/${item.id}`}
                        className={cn("text-sm hover:underline", COR[item.estado])}
                      >
                        {item.titulo}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Remarcar e desmarcar. Não vai dentro da célula da grade: a célula
          tem 24px de altura útil e um campo de data não caberia sem virar
          popover - peça nova, para um botão que se usa de vez em quando.
          Lista com o mesmo formato do bloco de baixo, que a pessoa já sabe
          usar: título, campo de data, e um jeito de desfazer. */}
      {agendados.length > 0 && (
        <>
          <Secao>Agendados ({agendados.length})</Secao>
          <div className={folha()}>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Trocar a data é mudar o campo. &quot;Tirar data&quot; devolve o
              rascunho para a lista de baixo - o texto fica inteiro, só deixa
              de ter dia marcado.
            </p>
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {agendados.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <Link
                    href={`/contents/${item.id}`}
                    className={cn(
                      "w-full min-w-0 truncate text-sm hover:underline sm:w-auto sm:flex-1",
                      COR[item.estado],
                    )}
                  >
                    {item.titulo}
                  </Link>
                  <div className="flex items-center gap-2">
                    <input
                      // A chave carrega a data: depois de salvar, o campo
                      // precisa nascer de novo com o valor novo, e um
                      // defaultValue não se atualiza sozinho.
                      key={item.dia}
                      type="date"
                      defaultValue={item.dia}
                      min={hoje}
                      disabled={ocupado}
                      aria-label={`Data de publicação de ${item.titulo}`}
                      className={cn(campo(), "w-40")}
                      onChange={(e) =>
                        e.target.value &&
                        chamar(() => agendarArtigo(item.id, e.target.value))
                      }
                    />
                    <button
                      type="button"
                      disabled={ocupado}
                      className={botao("fantasma", "sm")}
                      onClick={() => chamar(() => agendarArtigo(item.id, null))}
                    >
                      Tirar data
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <Secao>Esperando data ({semData.length})</Secao>
      {semData.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Nenhum rascunho solto. Quando a IA escrever o próximo, ele aparece
          aqui para receber data.
        </p>
      ) : (
        <div className={folha()}>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Rascunhos prontos, sem data. &quot;Distribuir no mês&quot; espalha
            todos pelos dias úteis que ainda restam - ou escolha uma data de
            cada vez.
          </p>
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {semData.map((rascunho) => (
              <li
                key={rascunho.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <Link
                  href={`/contents/${rascunho.id}`}
                  className="w-full min-w-0 truncate text-sm text-slate-700 hover:underline sm:w-auto sm:flex-1 dark:text-slate-300"
                >
                  {rascunho.titulo}
                </Link>
                <input
                  type="date"
                  min={hoje}
                  disabled={ocupado}
                  aria-label={`Data de publicação de ${rascunho.titulo}`}
                  className={cn(campo(), "w-40")}
                  onChange={(e) =>
                    e.target.value &&
                    chamar(() => agendarArtigo(rascunho.id, e.target.value))
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
