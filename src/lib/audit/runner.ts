import {
  safeFetch,
  fetchComStatus,
  normalizeSiteUrl,
  isPublicHttpUrl,
  discoverSitemaps,
  collectUrlsFromSitemaps,
} from "@/lib/crawler";
import { parsePage } from "./parse";
import { runRules, computeScores, pareceHome } from "./rules";
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
// Exportada para a conferência pontual da home (/api/audit/conferir), que lê
// uma página só sem rodar a auditoria inteira.
export async function lerUrl(url: string, origin: string): Promise<Leitura> {
  // Uma tentativa a mais antes de acusar "não respondeu": com seis leituras
  // em paralelo, um tempo esgotado isolado virava achado de gravidade alta em
  // página que responde em 1s (isocialweb.agency/ecommerce, set/2026).
  const resposta = (await fetchComStatus(url)) ?? (await fetchComStatus(url));

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

  // Tira CSS e JS embutidos ANTES de cortar: páginas com CSS-in-JS passam de
  // 1 MB e o corte cego em 400 KB deixava o H1 e os links de fora - achado
  // falso de "sem H1" em site que tem (backlinko.com, set/2026). O JSON-LD e
  // a tag de script externo ficam: as regras de schema e de JS dependem deles.
  const html = (await resposta.res.text())
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script(?![^>]*ld\+json)([^>]*)>[\s\S]*?<\/script>/gi, "<script$1></script>")
    .slice(0, 400_000);

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

  // Mesma página por dois endereços (https://site.com e https://site.com/, ou
  // o endereço e o destino do redirect) virava "título duplicado" de
  // gravidade alta que não existe. Conta a página final uma vez só.
  const vistas = new Set<string>();

  for (const leitura of leituras) {
    if (leitura.tipo === "pagina") {
      const final = (leitura.redirecionou ?? leitura.snapshot.url)
        .toLowerCase()
        .replace(/\/$/, "");
      if (vistas.has(final)) continue;
      vistas.add(final);
    }
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

  // Soft 404: caminho que não existe tem que responder 404. SPA hospedada
  // com fallback para index.html responde 200 com a home (dataknow.es,
  // set/2026) e a auditoria dava nota 100 para um site que indexa lixo.
  const fantasma = await lerUrl(
    `${origin}/knowseo-404-${Math.random().toString(36).slice(2, 8)}`,
    origin,
  );
  const home = snapshots.find((s) => s.url === origin);
  const soft404 =
    fantasma.tipo === "pagina"
      ? {
          url: fantasma.snapshot.url,
          status: fantasma.snapshot.statusCode,
          igualHome: home ? pareceHome(fantasma.snapshot, home) : false,
        }
      : fantasma.tipo === "quebrada"
        ? { url: fantasma.problema.url, status: fantasma.problema.status, igualHome: false }
        : undefined;

  const signals: SiteSignals = {
    soft404,
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
