import type { EntidadeSchema } from "./entidade.ts";

export type Severity ="critical" | "high" | "medium" | "quick_win" | "info";
export type Category =
  | "crawlability"
  | "indexation"
  | "onpage"
  | "content"
  | "geo"
  | "technical";

export interface Finding {
  code: string;
  severity: Severity;
  category: Category;
  title: string;
  impact: string;
  evidence: string;
  fix: string;
  /** Amostra de URLs para exibição (limitada). */
  affectedUrls: string[];
  /** Quantidade real de páginas afetadas - base do cálculo da nota. */
  affectedCount: number;
}

// Sinais extraídos de uma página. Tudo que as regras precisam para decidir,
// sem tocar em rede - é isso que torna as regras testáveis.
export interface PageSnapshot {
  url: string;
  statusCode: number;
  html: string;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  h1s: string[];
  h2s: string[];
  imagesTotal: number;
  imagesWithoutAlt: number;
  wordCount: number;
  internalLinks: number;
  jsonLdTypes: string[];
  /** Primeiro parágrafo de texto com conteúdo real (usado no check de GEO). */
  firstParagraph: string | null;
  hasJsScripts: boolean;
  /** Organizações descritas no JSON-LD da página (SEO de entidade). */
  entidades: EntidadeSchema[];
  /** Frases de folheto encontradas no texto ("líder de mercado"...). */
  frasesVazias: string[];
}

/** URL que o site anuncia (no sitemap ou como home) e não entrega. */
export interface UrlComProblema {
  url: string;
  /** Status HTTP devolvido, ou null quando nem houve resposta (timeout,
   *  DNS, TLS). São problemas diferentes e o achado precisa separá-los. */
  status: number | null;
  /** Destino final, quando a URL redirecionou. */
  destino?: string;
}

export interface SiteSignals {
  origin: string;
  isHttps: boolean;
  robotsTxt: { found: boolean; body: string | null };
  sitemapUrls: string[];
  sitemapFound: boolean;
  llmsTxtFound: boolean;
  pages: PageSnapshot[];
  /** URLs que responderam 4xx/5xx ou não responderam. Opcional para não
   *  quebrar chamadas antigas de teste. */
  urlsQuebradas?: UrlComProblema[];
  /** URLs anunciadas que redirecionam para outro endereço. */
  urlsRedirecionadas?: UrlComProblema[];
}
