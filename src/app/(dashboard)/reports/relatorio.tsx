import Image from "next/image";
import Link from "next/link";
import { Lede, Linha, Secao } from "@/components/lede";
import { botao, campo, pagina } from "@/components/ui";
import { urlDoArtigo } from "@/lib/blog-endereco";
import {
  PRESETS,
  comparar,
  conversasTxt,
  fraseVariacao,
  manchete,
  resumoDoPeriodo,
  variacao,
  visitasTxt,
  type Evento,
  type Periodo,
  type Variacao,
} from "@/lib/relatorio";
import { formatDate, cn } from "@/lib/utils";
import type { Blog } from "@/types";
import { AcoesDoRelatorio } from "./acoes";
import type { ArtigoDoRelatorio } from "./dados";

// O mesmo relatório no painel (/reports) e no link do cliente (/r/<token>).
// `publico` tira tudo o que leva ao painel: seletor de período, link para o
// editor do artigo e o aviso de configuração.

// Impressão: a barra lateral e a moldura h-screen/overflow do painel moram
// no layout, fora deste relatório. Sem esta regra o PDF sairia com o menu e
// cortado na altura de uma tela. `print-color-adjust` mantém o fundo escuro
// de quem imprime no modo escuro - sem ele, texto claro sobre papel branco.
const FOLHA_DE_IMPRESSAO = `@media print {
  aside, header:has(~ aside) { display: none !important; }
  div:has(> main), main { height: auto !important; overflow: visible !important; }
  body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}`;

function curta(v: Variacao, semBase: boolean) {
  if (semBase || v.delta === 0) return null;
  const s = v.delta > 0 ? "+" : "−";
  return `${s}${Math.abs(v.delta)}${v.pct === null ? "" : ` (${s}${Math.abs(v.pct)}%)`}`;
}

export function Relatorio({
  blog,
  periodo,
  eventos,
  artigos,
  publico = false,
  token = null,
}: {
  blog: Blog;
  periodo: Periodo;
  eventos: Evento[];
  artigos: ArtigoDoRelatorio[];
  publico?: boolean;
  /** Token do link público; null quando RELATORIO_SECRET não existe. */
  token?: string | null;
}) {
  const atual = resumoDoPeriodo(eventos, periodo.inicio, periodo.fim);
  const anterior = resumoDoPeriodo(eventos, periodo.anteriorInicio, periodo.inicio);
  const cmp = comparar(atual, anterior);

  // Artigo que só teve visita no período anterior continua na lista: a
  // queda é justamente o que o cliente precisa ver.
  const desempenho = artigos
    .map((a) => {
      const agora = atual.porArtigo[a.id] ?? { visitas: 0, conversas: 0 };
      const antes = anterior.porArtigo[a.id] ?? { visitas: 0, conversas: 0 };
      return {
        ...a,
        visitas: agora.visitas,
        conversas: agora.conversas,
        antes,
        teveAlgo: agora.visitas + agora.conversas + antes.visitas + antes.conversas > 0,
      };
    })
    .filter((a) => a.teveAlgo)
    .sort((a, b) => b.visitas - a.visitas || b.conversas - a.conversas);

  const veredito = manchete(
    atual,
    desempenho.map((a) => ({ titulo: a.title, conversas: a.conversas })),
    periodo.texto,
  );

  // fuso: trocar por formatarData quando src/lib/datas.ts existir
  const intervalo = `De ${formatDate(periodo.de)} a ${formatDate(periodo.ate)}`;
  const emitido = formatDate(new Date().toISOString());

  const metricas = [
    { rotulo: "Visitas", valor: String(atual.visitas), v: cmp.visitas, unidade: ["visita", "visitas"] as [string, string] },
    { rotulo: "Conversas", valor: String(atual.conversas), v: cmp.conversas, unidade: ["conversa", "conversas"] as [string, string] },
    {
      rotulo: "Taxa de conversa",
      valor: `${atual.taxa.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
      v: cmp.taxa,
      unidade: ["p.p.", "p.p."] as [string, string],
    },
  ];

  return (
    <div className={cn(pagina(), "print:max-w-none print:p-0")}>
      <style>{FOLHA_DE_IMPRESSAO}</style>

      {/* Cabeçalho do PDF: na tela o painel já diz de quem é o blog; no papel
          encaminhado adiante, não. */}
      <div className="mb-6 hidden items-center justify-between gap-6 border-b border-slate-300 pb-4 print:flex">
        {blog.theme.logo_url ? (
          <Image
            src={blog.theme.logo_url}
            alt={blog.name}
            width={200}
            height={56}
            unoptimized
            className="max-h-12 w-auto object-contain"
          />
        ) : (
          <p className="text-lg font-semibold">{blog.name}</p>
        )}
        <p className="text-right text-sm">
          {intervalo}
          <br />
          Emitido em {emitido}
        </p>
      </div>

      <Lede
        apoio={`${intervalo}, comparado com os ${periodo.dias} dias anteriores. Medido no próprio blog, sem Google Analytics nem cookie.`}
        acao={<AcoesDoRelatorio token={token} />}
      >
        {veredito}
      </Lede>

      {publico ? null : (
        <div className="-mt-4 mb-2 flex flex-wrap items-end gap-x-6 gap-y-3 print:hidden">
          <nav aria-label="Período" className="flex gap-1">
            {PRESETS.map((d) => (
              <Link
                key={d}
                href={`/reports?dias=${d}`}
                aria-current={periodo.preset === d ? "page" : undefined}
                className={botao(periodo.preset === d ? "primario" : "secundario", "sm")}
              >
                {d} dias
              </Link>
            ))}
          </nav>
          {/* Formulário GET, não estado: o período fica na URL e o link
              colado para um colega abre o mesmo recorte. */}
          <form action="/reports" className="flex flex-wrap items-end gap-2">
            <label className="text-sm text-slate-600 dark:text-slate-400">
              De
              <input type="date" name="de" required defaultValue={periodo.de} className={cn(campo("sm"), "mt-1 block")} />
            </label>
            <label className="text-sm text-slate-600 dark:text-slate-400">
              Até
              <input type="date" name="ate" required defaultValue={periodo.ate} className={cn(campo("sm"), "mt-1 block")} />
            </label>
            <button type="submit" className={botao(periodo.preset ? "secundario" : "primario", "sm")}>
              Aplicar
            </button>
          </form>
          {!token && (
            <p className="w-full text-sm text-slate-500 dark:text-slate-400">
              Defina RELATORIO_SECRET para compartilhar.
            </p>
          )}
        </div>
      )}

      <Secao>Contra os {periodo.dias} dias anteriores</Secao>
      <ul className="mt-2">
        {metricas.map((m) => (
          <Linha key={m.rotulo}>
            {/* Empilhado no celular: com flex-wrap, cada linha quebrava num
                ponto diferente conforme o tamanho da frase. */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <span className="text-slate-700 dark:text-slate-300">{m.rotulo}</span>
              <span className="sm:text-right">
                <span className="tabular text-slate-900 dark:text-slate-100">{m.valor}</span>
                <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">
                  {fraseVariacao(m.v, m.unidade, periodo.dias, cmp.semBase)}
                </span>
              </span>
            </div>
          </Linha>
        ))}
      </ul>

      {atual.conversas > 0 && (
        <>
          <Secao>De onde vieram as conversas</Secao>
          <ul className="mt-2">
            {[
              ["WhatsApp", atual.cliquesZap],
              ["Botão do artigo", atual.cliquesCta],
            ].map(([rotulo, n]) => (
              <Linha key={rotulo}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-slate-700 dark:text-slate-300">{rotulo}</span>
                  <span className="tabular text-slate-900 dark:text-slate-100">{conversasTxt(n as number)}</span>
                </div>
              </Linha>
            ))}
          </ul>
        </>
      )}

      <Secao>Qual pauta valeu a pena {periodo.texto}</Secao>
      {desempenho.length === 0 ? (
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Nada registrado neste período. Assim que alguém abrir um artigo, ele aparece aqui.
        </p>
      ) : (
        <ul className="mt-2">
          {desempenho.map((a) => {
            const dv = curta(variacao(a.visitas, a.antes.visitas), cmp.semBase);
            const dc = curta(variacao(a.conversas, a.antes.conversas), cmp.semBase);
            return (
              <Linha key={a.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span className="min-w-0">
                    {publico ? (
                      <span className="block text-slate-900 dark:text-slate-100 sm:truncate">{a.title}</span>
                    ) : (
                      <Link
                        href={`/contents/${a.id}`}
                        className="block text-slate-900 hover:text-cobalto-600 dark:text-slate-100 dark:hover:text-cobalto-400 sm:truncate"
                      >
                        {a.title}
                      </Link>
                    )}
                    <span className="block text-sm text-slate-500 dark:text-slate-400">
                      {a.keywords?.keyword ? `Pauta: ${a.keywords.keyword}` : "Sem pauta vinculada"}
                      {" · "}
                      <a
                        href={urlDoArtigo(blog, a.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cobalto-700 hover:underline dark:text-cobalto-300"
                      >
                        Ver página pública
                      </a>
                    </span>
                  </span>
                  <span className="tabular flex shrink-0 flex-wrap gap-x-4 text-sm text-slate-600 dark:text-slate-400">
                    <span className="text-slate-900 dark:text-slate-100">
                      {visitasTxt(a.visitas)}
                      {dv && <span className="ml-1 text-slate-500 dark:text-slate-400">{dv}</span>}
                    </span>
                    <span>
                      {conversasTxt(a.conversas)}
                      {dc && <span className="ml-1 text-slate-500 dark:text-slate-400">{dc}</span>}
                    </span>
                  </span>
                </div>
              </Linha>
            );
          })}
        </ul>
      )}
    </div>
  );
}
