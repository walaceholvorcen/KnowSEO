import Link from "next/link";
import { Linha, Secao } from "@/components/lede";
import { diaCurto } from "@/lib/grafico";
import { GraficoDeIA } from "./grafico-de-ia";
import type { TrafegoDaTela } from "./trafego-dados";

const plural = (n: number, um: string, varios: string) =>
  `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

// O que os assistentes fizeram no blog, medido por nós.
//
// O Raio X pergunta e confere a resposta: é amostra, e só do Claude. Este
// bloco é a medição direta - o robô do assistente abrindo um artigo porque
// alguém perguntou. Claude, ChatGPT e Perplexity não oferecem painel ao
// dono do site; aqui é o único lugar em que esse número existe.
export function TrafegoDeIA({ trafego }: { trafego: TrafegoDaTela }) {
  const { resumo, titulos, dias, series, ligadaEm } = trafego;

  return (
    <>
      <Secao>Assistentes lendo o seu blog</Secao>
      <p className="max-w-[70ch] text-sm text-slate-600 dark:text-slate-400">
        Últimos 28 dias, medido direto no seu blog. A contagem foi ligada em{" "}
        {diaCurto(ligadaEm)}; antes disso não há registro, e o gráfico fica
        vazio nesse trecho.
      </p>

      <GraficoDeIA dias={dias} series={series} ligadaEm={ligadaEm} />

      {resumo.artigos.length > 0 && (
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
      )}
    </>
  );
}
