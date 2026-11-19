import Link from "next/link";
import { Bancada, Linha, Secao } from "@/components/lede";
import { formatarData } from "@/lib/datas";
import type { TrafegoDaTela } from "./trafego-dados";

const plural = (n: number, um: string, varios: string) =>
  `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

// O que os assistentes fizeram no blog, medido por nós.
//
// O Raio X pergunta e confere a resposta: é amostra, e só do Claude. Este
// bloco é a medição direta - o robô do assistente abrindo um artigo porque
// alguém perguntou. Claude, ChatGPT e Perplexity não oferecem painel ao
// dono do site; aqui é o único lugar em que esse número existe.
export function TrafegoDeIA({
  trafego,
  fuso,
}: {
  trafego: TrafegoDaTela;
  fuso: string;
}) {
  const { resumo, titulos, desde } = trafego;
  const nada = resumo.total.leituras === 0 && resumo.total.cliques === 0;

  return (
    <>
      <Secao>Assistentes lendo o seu blog</Secao>
      <p className="max-w-[70ch] text-sm text-slate-600 dark:text-slate-400">
        Desde {formatarData(desde, fuso, "curta")}. &quot;Leitura para
        responder&quot; conta cada vez que o assistente abriu um artigo seu
        porque alguém fez uma pergunta a ele - é o mais perto que existe de
        uma impressão. Não há registro anterior a essa data.
      </p>

      <Bancada colunas={3}>
        {resumo.assistentes.map((a) => (
          <div key={a.assistente} className="bg-white p-5 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">{a.nome}</p>
            <p className="mt-2">
              <span className="tabular font-display text-3xl text-slate-900 dark:text-slate-100">
                {a.leituras.toLocaleString("pt-BR")}
              </span>
              <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">
                {a.leituras === 1 ? "leitura para responder" : "leituras para responder"}
              </span>
            </p>
            <dl className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex justify-between gap-3">
                <dt>Pessoas que clicaram no link</dt>
                <dd className="tabular font-display text-slate-900 dark:text-slate-100">
                  {a.cliques.toLocaleString("pt-BR")}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Passagens de indexação</dt>
                <dd className="tabular font-display text-slate-900 dark:text-slate-100">
                  {a.indexacoes.toLocaleString("pt-BR")}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </Bancada>

      {nada ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Nenhum assistente abriu um artigo para responder alguém desde que a
          contagem foi ligada. Indexação costuma vir antes: o assistente
          primeiro conhece a página, depois passa a usá-la.
        </p>
      ) : (
        resumo.artigos.length > 0 && (
          <ul className="mt-3">
            {resumo.artigos.map((a) => (
              <Linha key={a.articleId}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <Link
                    href={`/contents/${a.articleId}`}
                    className="min-w-0 flex-1 basis-64 truncate text-sm text-slate-800 hover:underline dark:text-slate-200"
                  >
                    {titulos[a.articleId] ?? "Artigo removido"}
                  </Link>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {plural(a.leituras, "leitura", "leituras")},{" "}
                    {plural(a.cliques, "clique", "cliques")}
                  </span>
                </div>
              </Linha>
            ))}
          </ul>
        )
      )}
    </>
  );
}
