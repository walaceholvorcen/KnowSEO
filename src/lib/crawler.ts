// Descoberta e leitura do sitemap do site do cliente, para alimentar a
// linkagem interna dos artigos gerados.
//
// Este módulo busca URLs fornecidas pelo usuário a partir do servidor, o
// que é um vetor clássico de SSRF - por isso todo host passa por
// isPublicHttpUrl() antes de qualquer fetch.

const MAX_URLS = 200;
const MAX_TITLE_FETCHES = 60;
const FETCH_TIMEOUT_MS = 8000;
const CONCURRENCY = 8;

export interface CrawledPage {
  url: string;
  title: string | null;
  description: string | null;
}

// ---------------------------------------------------------------------------
// Proteção contra SSRF: só http/https em hosts públicos.
// ---------------------------------------------------------------------------
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

export function isPublicHttpUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return false;
  if (host.endsWith(".localhost") || host.endsWith(".internal")) return false;

  // Faixas privadas / link-local por IPv4 literal.
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 192 && b === 168) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 169 && b === 254) return false;
  }

  // IPv6 privado/loopback em forma literal.
  if (host.startsWith("[") || host.includes(":")) {
    if (/^\[?(::1|fc|fd|fe80)/i.test(host)) return false;
  }

  return true;
}

async function safeFetch(url: string): Promise<Response | null> {
  if (!isPublicHttpUrl(url)) return null;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "KnowSEO-Crawler/1.0 (+internal-linking)" },
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Descoberta do sitemap
// ---------------------------------------------------------------------------
export function normalizeSiteUrl(input: string): string | null {
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  try {
    const url = new URL(withProtocol);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

async function sitemapsFromRobots(origin: string): Promise<string[]> {
  const res = await safeFetch(`${origin}/robots.txt`);
  if (!res) return [];
  const text = await res.text();
  return [...text.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
}

export async function discoverSitemaps(origin: string): Promise<string[]> {
  const fromRobots = await sitemapsFromRobots(origin);
  if (fromRobots.length) return fromRobots;

  // Caminhos convencionais quando o robots.txt não declara nada.
  return [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
  ];
}

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) =>
    m[1].replace(/&amp;/g, "&"),
  );
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex/i.test(xml);
}

// Lê os sitemaps, seguindo um nível de sitemap index.
export async function collectUrlsFromSitemaps(
  candidates: string[],
): Promise<string[]> {
  const found = new Set<string>();

  for (const candidate of candidates) {
    if (found.size >= MAX_URLS) break;

    const res = await safeFetch(candidate);
    if (!res) continue;

    const xml = await res.text();

    if (isSitemapIndex(xml)) {
      const children = extractLocs(xml).slice(0, 10);
      for (const child of children) {
        if (found.size >= MAX_URLS) break;
        const childRes = await safeFetch(child);
        if (!childRes) continue;
        for (const loc of extractLocs(await childRes.text())) {
          if (found.size >= MAX_URLS) break;
          found.add(loc);
        }
      }
    } else {
      for (const loc of extractLocs(xml)) {
        if (found.size >= MAX_URLS) break;
        found.add(loc);
      }
    }

    if (found.size > 0) break; // primeiro sitemap válido basta
  }

  return [...found];
}

// ---------------------------------------------------------------------------
// Títulos das páginas (dão à IA uma âncora de link decente)
// ---------------------------------------------------------------------------
function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

async function fetchPageMeta(url: string): Promise<CrawledPage> {
  const res = await safeFetch(url);
  if (!res) return { url, title: null, description: null };

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return { url, title: null, description: null };
  }

  const html = (await res.text()).slice(0, 200_000);

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
  );

  return {
    url,
    title: titleMatch ? decodeEntities(titleMatch[1]).slice(0, 200) : null,
    description: descMatch ? decodeEntities(descMatch[1]).slice(0, 300) : null,
  };
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

export async function crawlSite(siteUrl: string): Promise<CrawledPage[]> {
  const origin = normalizeSiteUrl(siteUrl);
  if (!origin || !isPublicHttpUrl(origin)) return [];

  const candidates = await discoverSitemaps(origin);
  const urls = await collectUrlsFromSitemaps(candidates);
  if (!urls.length) return [];

  // Busca título só das primeiras N; o resto entra apenas com a URL, para
  // não transformar um site grande numa espera de minutos.
  const withMeta = urls.slice(0, MAX_TITLE_FETCHES);
  const withoutMeta = urls.slice(MAX_TITLE_FETCHES);

  const crawled = await mapWithConcurrency(
    withMeta,
    CONCURRENCY,
    fetchPageMeta,
  );

  return [
    ...crawled,
    ...withoutMeta.map((url) => ({ url, title: null, description: null })),
  ];
}
