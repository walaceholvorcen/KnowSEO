export type Severity = "critical" | "high" | "medium" | "quick_win" | "info";
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
}

export interface SiteSignals {
  origin: string;
  isHttps: boolean;
  robotsTxt: { found: boolean; body: string | null };
  sitemapUrls: string[];
  sitemapFound: boolean;
  llmsTxtFound: boolean;
  pages: PageSnapshot[];
}
