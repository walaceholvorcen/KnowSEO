import {
  safeFetch,
  fetchComStatus,
  normalizeSiteUrl,
  isPublicHttpUrl,
  discoverSitemaps,
  collectUrlsFromSitemaps,
} from "@/lib/crawler";
import { parsePage } from "./parse";
import { runRules, computeScores } from "./rules";
import type {
  Finding,
  PageSnapshot,
  SiteSignals,
  UrlComProblema,
} from "./types";

const MAX_PAGES = 25;
const CONCURRENCY = 6;

export interface AuditResult {
  origin: string;
  pagesAnalyzed: number;
  findings: Finding[];
  scores: { google: number; ai: number };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

type Leitura =
  | { tipo: "pagina"; snapshot: PageSnapshot; redirecionou: string | null }
  | { tipo: "quebrada"; problema: UrlComProblema }
  | { tipo: "ignorada" };

// Uma URL pode terminar de três formas, e as três importam: virou página
// legível, respondeu erro (ou não respondeu), ou não é HTML e sai da conta.
// Antes as três viravam `null` e só a primeira sobrevivia.
async function lerUrl(url: string, origin: string): Promise<Leitura> {
  const resposta = await fetchComStatus(url);

  if (!resposta) {
    return { tipo: "quebrada", problema: { url, status: null } };
  }

  if (!resposta.res.ok) {
    return {
      tipo: "quebrada",
      problema: { url, status: resposta.status },
    };
  }

  const contentType = resposta.res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return { tipo: "ignorada" };

  const html = (await resposta.res.text()).slice(0, 400_000);

  // Compara sem a barra final para não acusar redirecionamento onde só
  // houve normalização de caminho.
  const semBarra = (u: string) => u.replace(/\/$/, "");
  const redirecionou =
    semBarra(resposta.finalUrl) !== semBarra(url) ? resposta.finalUrl : null;

  return {
    tipo: "pagina",
    redirecionou,
    snapshot: parsePage({ url, statusCode: resposta.status, html, origin }),
  };
}

export async function auditSite(siteUrl: string): Promise<AuditResult | null> {
  const origin = normalizeSiteUrl(siteUrl);
  if (!origin || !isPublicHttpUrl(origin)) return null;

  // Sinais de site: robots, sitemap e llms.txt
  const robotsRes = await safeFetch(`${origin}/robots.txt`);
  const robotsBody = robotsRes ? await robotsRes.text() : null;

  const sitemapCandidates = await discoverSitemaps(origin);
  const sitemapUrls = await collectUrlsFromSitemaps(sitemapCandidates);

  const llmsRes = await safeFetch(`${origin}/llms.txt`);

  // Amostra de páginas: a home sempre entra; o resto vem do sitemap.
  const candidates = [origin, ...sitemapUrls.filter((u) => u !== origin)].slice(
    0,
    MAX_PAGES,
  );

  const leituras = await mapWithConcurrency(candidates, CONCURRENCY, (url) =>
    lerUrl(url, origin),
  );

  const snapshots: PageSnapshot[] = [];
  const urlsQuebradas: UrlComProblema[] = [];
  const urlsRedirecionadas: UrlComProblema[] = [];

  for (const leitura of leituras) {
    if (leitura.tipo === "quebrada") {
      urlsQuebradas.push(leitura.problema);
    } else if (leitura.tipo === "pagina") {
      snapshots.push(leitura.snapshot);
      if (leitura.redirecionou) {
        // Sem o código do redirect: seguimos a cadeia, então o status que
        // chega é o do destino. O que importa ao cliente é que a URL
        // anunciada não é a URL final.
        urlsRedirecionadas.push({
          url: leitura.snapshot.url,
          status: null,
          destino: leitura.redirecionou,
        });
      }
    }
  }

  // Site que não entregou uma página legível sequer: não há o que auditar,
  // e devolver zero achados seria pior que devolver erro.
  if (snapshots.length === 0) return null;

  const signals: SiteSignals = {
    origin,
    isHttps: origin.startsWith("https://"),
    robotsTxt: { found: Boolean(robotsRes), body: robotsBody },
    sitemapUrls,
    sitemapFound: sitemapUrls.length > 0,
    llmsTxtFound: Boolean(llmsRes),
    pages: snapshots,
    urlsQuebradas,
    urlsRedirecionadas,
  };

  const findings = runRules(signals);

  return {
    origin,
    pagesAnalyzed: snapshots.length,
    findings,
    scores: computeScores(findings, snapshots.length),
  };
}
