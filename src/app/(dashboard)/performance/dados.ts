import { unstable_cache } from "next/cache";
import {
  consultarDesempenho,
  inspecionarUrl,
  listarSitemaps,
} from "@/lib/google/search-console";
import { resumirIndexacao, type Indexacao } from "@/lib/google/indexacao";
import {
  montarDesempenho,
  type Desempenho,
  type LinhaDoGoogle,
  type Periodo,
} from "@/lib/google/desempenho";
import { semEsquema, urlPublicaDoBlog } from "@/lib/blog-endereco";
import { diasAntes } from "@/lib/grafico";
import type { Blog } from "@/types";

export type Escopo = "site" | "blog";

export interface TelaDeDesempenho {
  desempenho: Desempenho;
  consultas: LinhaDoGoogle[];
  paginas: LinhaDoGoogle[];
}

// Três leituras do Search Console por tela: o período dia a dia, as
// consultas e as páginas. Guardadas por meia hora - o Google atualiza esse
// dado uma vez por dia, e sem o cache cada troca de aba eram três chamadas
// e mais de um segundo de espera.
//
// `hoje` entra na chave para a virada do dia renovar sozinha. Falha lança
// (ver consultarDesempenho) e exceção não é guardada.
const lerDoGoogle = unstable_cache(
  async (
    workspaceId: string,
    siteUrl: string,
    periodo: Periodo,
    paginaContem: string | null,
    hoje: string,
  ): Promise<TelaDeDesempenho> => {
    const desde = diasAntes(hoje, periodo - 1);
    const base = { workspaceId, siteUrl, desde, ate: hoje, paginaContem };
    const [porDia, consultas, paginas] = await Promise.all([
      consultarDesempenho({ ...base, dimensao: "date" }),
      consultarDesempenho({ ...base, dimensao: "query", limite: 10 }),
      consultarDesempenho({ ...base, dimensao: "page", limite: 10 }),
    ]);
    return { desempenho: montarDesempenho(porDia, desde), consultas, paginas };
  },
  ["desempenho-google"],
  { revalidate: 1800 },
);

/** O trecho de endereço que separa o blog do resto do site, se houver um. */
export function enderecoDoBlog(blog: Blog): string | null {
  const publica = urlPublicaDoBlog(blog);
  // No endereço da plataforma (/b/...) o blog não mora no site do cliente:
  // não há o que filtrar na propriedade dele.
  return publica.kind === "path" ? null : semEsquema(publica.url);
}

export async function carregarDesempenho(params: {
  workspaceId: string;
  blog: Blog;
  periodo: Periodo;
  escopo: Escopo;
  hoje: string;
}): Promise<TelaDeDesempenho> {
  const { workspaceId, blog, periodo, escopo, hoje } = params;
  const filtro = escopo === "blog" ? enderecoDoBlog(blog) : null;
  return lerDoGoogle(workspaceId, blog.gsc_property!, periodo, filtro, hoje);
}

// Quantos artigos conferir por vez. A inspeção é uma chamada por endereço
// (cerca de um segundo cada, cota de 2.000 por dia por propriedade): os
// doze mais recentes respondem "o Google conhece o blog?" sem pesar a tela.
const ARTIGOS_CONFERIDOS = 12;

// Guardado por uma hora: indexação muda em dias, não em minutos.
const lerIndexacao = unstable_cache(
  async (
    workspaceId: string,
    siteUrl: string,
    sitemapDoBlog: string,
    enderecos: string[],
  ): Promise<Indexacao> => {
    const [sitemaps, estados] = await Promise.all([
      listarSitemaps(workspaceId, siteUrl),
      Promise.all(
        enderecos.map((paginaUrl) => inspecionarUrl({ workspaceId, siteUrl, paginaUrl })),
      ),
    ]);
    return resumirIndexacao({ sitemapDoBlog, sitemaps, estados });
  },
  ["indexacao-google"],
  { revalidate: 3600 },
);

/**
 * O Google conhece os artigos deste blog? Null quando não há o que
 * conferir: blog sem endereço no site do cliente, ou sem artigo no ar.
 */
export async function carregarIndexacao(params: {
  workspaceId: string;
  blog: Blog;
  /** Slugs dos artigos publicados, do mais recente para o mais antigo. */
  slugs: string[];
}): Promise<Indexacao | null> {
  const { workspaceId, blog, slugs } = params;
  const publica = urlPublicaDoBlog(blog);
  if (publica.kind === "path" || !slugs.length || !blog.gsc_property) return null;
  return lerIndexacao(
    workspaceId,
    blog.gsc_property,
    `${publica.url}/sitemap.xml`,
    slugs.slice(0, ARTIGOS_CONFERIDOS).map((slug) => `${publica.url}/${slug}`),
  ).catch((err) => {
    console.error("[indexação] conferência com o Google falhou", err);
    return null;
  });
}
