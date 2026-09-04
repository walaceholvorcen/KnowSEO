import {
  safeFetch,
  normalizeSiteUrl,
  isPublicHttpUrl,
  discoverSitemaps,
  collectUrlsFromSitemaps,
} from "@/lib/crawler";
import { parsePage } from "./parse";
import { runRules, computeScores } from "./rules";
import type { Finding, PageSnapshot, SiteSignals } from "./types";

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

async function fetchSnapshot(
  url: string,
  origin: string,
): Promise<PageSnapshot | null> {
  const res = await safeFetch(url);
  if (!res) return null;

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return null;

  const html = (await res.text()).slice(0, 400_000);
  return parsePage({ url, statusCode: res.status, html, origin });
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

  const snapshots = (
    await mapWithConcurrency(candidates, CONCURRENCY, (url) =>
      fetchSnapshot(url, origin),
    )
  ).filter((p): p is PageSnapshot => p !== null);

  if (snapshots.length === 0) return null;

  const signals: SiteSignals = {
    origin,
    isHttps: origin.startsWith("https://"),
    robotsTxt: { found: Boolean(robotsRes), body: robotsBody },
    sitemapUrls,
    sitemapFound: sitemapUrls.length > 0,
    llmsTxtFound: Boolean(llmsRes),
    pages: snapshots,
  };

  const findings = runRules(signals);

  return {
    origin,
    pagesAnalyzed: snapshots.length,
    findings,
    scores: computeScores(findings, snapshots.length),
  };
}
