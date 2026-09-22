import Link from "next/link";
import Image from "next/image";
import { botao, pagina } from "@/components/ui";
import { Lede, Linha, Secao } from "@/components/lede";
import { formatarData } from "@/lib/datas";
import { versaoDaIdentidade } from "@/lib/blog-endereco";
import { NOME_IDIOMA } from "@/lib/idioma";
import type { Article, Blog } from "@/types";
import type { CodigoIdioma } from "@/lib/idioma";

const STATUS_LABEL: Record<Article["status"], string> = {
  draft: "Rascunho",
  scheduled: "Programado",
  published: "Publicado",
};

// O estado vira cor de texto, não pílula com fundo próprio: com uma pílula
// colorida por linha a tela virava confete e o que se via era a cor, não o
// artigo.
const STATUS_COLOR: Record<Article["status"], string> = {
  draft: "text-slate-500 dark:text-slate-400",
  scheduled: "text-nota-atencao",
  published: "text-nota-excelente",
};

export type Afetado = {
  artigo: Article;
  idiomaErrado: CodigoIdioma | null;
  trechos: string[];
};

export function ContentsBoard({
  blog,
  lista,
  afetados,
  visitasPorArtigo,
  veredito,
  fuso,
}: {
  blog: Blog;
  lista: Article[];
  afetados: Afetado[];
  /** Visitas dos últimos 28 dias, por id de artigo. */
  visitasPorArtigo: Map<string, number>;
  veredito: string;
  fuso: string;
}) {
  const errados = afetados.filter((x) => x.idiomaErrado);
  const idiomasErrados = new Set(errados.map((x) => x.idiomaErrado!));
  const idAfetado = new Set(errados.map((x) => x.artigo.id));

  return (
    <div className={pagina()}>
      <Lede
        acao={
          <Link
            href="/strategy"
            className={botao("primario")}
          >
            Escrever novo artigo
          </Link>
        }
      >
        {veredito}
      </Lede>

      {afetados.length > 0 && (
        <div className="mb-8 rounded-lg border border-slate-200 border-l-2 border-l-nota-atencao px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:border-l-nota-atencao dark:text-slate-300">
          {errados.length > 0 && (
            <p>
              {errados.length}{" "}
              {errados.length === 1 ? "artigo foi gerado" : "artigos foram gerados"}{" "}
              em{" "}
              {idiomasErrados.size === 1
                ? NOME_IDIOMA[[...idiomasErrados][0]]
                : "outro idioma"}{" "}
              antes da configuração atual. Revise ou reescreva cada um; nada
              foi alterado.
            </p>
          )}
          <ul className="mt-2 space-y-2">
            {afetados.map(({ artigo, idiomaErrado, trechos }) => (
              <li key={artigo.id}>
                <Link
                  href={`/contents/${artigo.id}`}
                  className="font-medium text-cobalto-700 hover:underline dark:text-cobalto-300"
                >
                  {artigo.title}
                </Link>{" "}
                <span className="text-slate-500 dark:text-slate-400">
                  · {STATUS_LABEL[artigo.status].toLowerCase()}
                  {idiomaErrado && <> · em {NOME_IDIOMA[idiomaErrado]}</>}
                </span>
                {trechos.length > 0 && (
                  <ul className="mt-1 space-y-1 border-l-2 border-slate-200 pl-3 dark:border-slate-700">
                    {trechos.map((t) => (
                      <li key={t} className="text-slate-600 dark:text-slate-400">
                        <span className="text-nota-atencao">fora do mercado:</span>{" "}
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lista, não grade de cards: a pergunta de quem abre esta tela é "o
          que falta revisar e o que já está rendendo", e isso se lê em linha -
          capa pequena à esquerda, estado e visitas à direita. A grade de
          capas mostrava seis retângulos iguais e nenhuma resposta.
          Rascunho vem primeiro: é o que espera decisão. */}
      {[
        { titulo: "Esperando revisão", itens: lista.filter((a) => a.status !== "published") },
        { titulo: "No ar", itens: lista.filter((a) => a.status === "published") },
      ]
        .filter((grupo) => grupo.itens.length > 0)
        .map((grupo) => (
          <section key={grupo.titulo}>
            <Secao>{grupo.titulo}</Secao>
            <ul className="mt-1">
              {grupo.itens.map((article) => {
                const visitas = visitasPorArtigo.get(article.id) ?? 0;
                return (
                  <Linha key={article.id}>
                    <Link
                      href={`/contents/${article.id}`}
                      className="group flex items-start gap-4"
                    >
                      {/* unoptimized: a capa já sai pronta da nossa rota
                          /api/og, e no Next 16 o otimizador recusa imagem
                          local com "?v=" na URL (a versão que fura o cache
                          quando a identidade muda). */}
                      <Image
                        unoptimized
                        src={
                          article.cover_image_url ||
                          `/api/og/${article.id}?v=${versaoDaIdentidade(blog)}`
                        }
                        alt=""
                        width={1200}
                        height={630}
                        className="hidden w-28 shrink-0 rounded-md border border-slate-200 sm:block dark:border-slate-800"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-slate-900 group-hover:text-cobalto-700 dark:text-slate-100 dark:group-hover:text-cobalto-300">
                          {article.title}
                        </span>
                        <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">
                          {idAfetado.has(article.id) && (
                            <span className="mr-2 text-nota-atencao">fora do idioma ·</span>
                          )}
                          <span className={STATUS_COLOR[article.status]}>
                            {STATUS_LABEL[article.status]}
                          </span>
                          {" · "}
                          {formatarData(
                            article.published_at ?? article.created_at,
                            fuso,
                            "longa",
                          )}
                        </span>
                      </span>
                      {article.status === "published" && (
                        <span className="shrink-0 text-right">
                          <span className="tabular font-display block text-lg text-slate-900 dark:text-slate-100">
                            {visitas}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {visitas === 1 ? "visita" : "visitas"} · 28 dias
                          </span>
                        </span>
                      )}
                    </Link>
                  </Linha>
                );
              })}
            </ul>
          </section>
        ))}

    </div>
  );
}
