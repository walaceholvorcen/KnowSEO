import { redirect } from "next/navigation";
import { botao } from "@/components/ui";
import Link from "next/link";
import Image from "next/image";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { htmlParaTexto } from "@/lib/utils";
import { formatarData, lerFuso } from "@/lib/datas";
import {
  detectarIdioma,
  idiomaDoBlog,
  NOME_IDIOMA,
  trechosForaDoMercado,
} from "@/lib/idioma";
import { paisDoBlog } from "@/lib/keywords/metricas";
import { versaoDaIdentidade } from "@/lib/blog-endereco";
import { Lede } from "@/components/lede";
import type { Article } from "@/types";

const STATUS_LABEL: Record<Article["status"], string> = {
  draft: "Rascunho",
  scheduled: "Programado",
  published: "Publicado",
};

// O estado vira cor de texto, não pílula com fundo próprio: com uma pílula
// colorida por card a grade virava confete e o que se via era a cor, não o
// artigo.
const STATUS_COLOR: Record<Article["status"], string> = {
  draft: "text-slate-500 dark:text-slate-400",
  scheduled: "text-nota-atencao",
  published: "text-nota-excelente",
};

export default async function ContentsPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog) redirect("/onboarding");

  const { data: articles } = await supabase
    .from("articles")
    .select("*")
    .eq("blog_id", blog.id)
    .order("created_at", { ascending: false });

  const lista = (articles as Article[]) ?? [];
  const fuso = await lerFuso();
  const publicados = lista.filter((a) => a.status === "published").length;
  const rascunhos = lista.length - publicados;

  // Artigos do acervo gerados antes de o idioma vir do domínio. Detecta pelo
  // título e pelo corpo sem tags (título curto sozinho costuma dar "não sei").
  // Artigo não se descarta em massa: pode estar no ar com visita. A tela só
  // aponta, com o trecho, e quem decide é quem abre o artigo.
  const idioma = idiomaDoBlog(blog);
  const foraDoBrasil =
    paisDoBlog({ dominio: blog.custom_domain, idioma: blog.language }).chave !== "br";
  const afetados = lista
    .map((a) => {
      const texto = `${a.title}\n${htmlParaTexto(a.content_html ?? "")}`;
      const detectado = detectarIdioma(texto);
      return {
        artigo: a,
        idiomaErrado:
          detectado !== null && detectado !== idioma.codigo ? detectado : null,
        // "no Brasil", "R$ 1.500": num blog que vende fora do Brasil é
        // mercado errado, mesmo se o idioma estiver certo.
        trechos: foraDoBrasil ? trechosForaDoMercado(texto, 2) : [],
      };
    })
    .filter((x) => x.idiomaErrado || x.trechos.length > 0);
  const errados = afetados.filter((x) => x.idiomaErrado);
  const idiomasErrados = new Set(errados.map((x) => x.idiomaErrado!));
  const idAfetado = new Set(errados.map((x) => x.artigo.id));

  const veredito =
    lista.length === 0
      ? "Nenhum artigo ainda. Escolha uma pauta e a IA escreve o primeiro."
      : rascunhos === 0
        ? `${publicados} ${publicados === 1 ? "artigo publicado" : "artigos publicados"}.`
        : `${publicados} no ar, ${rascunhos} ${rascunhos === 1 ? "esperando revisão" : "esperando revisão"}.`;

  return (
    <div className="mx-auto max-w-5xl px-8 py-12">
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

      {lista.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((article) => (
            <Link
              key={article.id}
              href={`/contents/${article.id}`}
              className="group overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition hover:border-cobalto-400 dark:hover:border-cobalto-500"
            >
              {/* unoptimized: a capa já sai pronta da nossa rota /api/og, o
                    otimizador não tem o que ganhar - e no Next 16 ele recusa
                    imagem local com "?v=" na URL (a versão que fura o cache
                    quando a identidade muda), deixando o card sem imagem. */}
                <Image
                  unoptimized
                src={
                  article.cover_image_url ||
                  `/api/og/${article.id}?v=${versaoDaIdentidade(blog)}`
                }
                alt=""
                width={1200}
                height={630}
                className="w-full"
              />
              <div className="p-4">
                <h3 className="line-clamp-2 font-semibold text-slate-900 dark:text-slate-100 group-hover:text-cobalto-700 dark:group-hover:text-cobalto-300">
                  {article.title}
                </h3>
                <p className="mt-2 text-slate-500 dark:text-slate-400">
                  {idAfetado.has(article.id) && (
                    <span className="mr-2 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-nota-atencao dark:bg-slate-800">
                      fora do idioma
                    </span>
                  )}
                  <span className={STATUS_COLOR[article.status]}>
                    {STATUS_LABEL[article.status]}
                  </span>
                  {" · "}
                  {formatarData(article.published_at ?? article.created_at, fuso, "longa")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
