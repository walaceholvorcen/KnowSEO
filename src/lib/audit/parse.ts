import type { PageSnapshot } from "./types";

// Extração de sinais de SEO do HTML. Função pura: recebe HTML, devolve
// dados. Sem rede aqui - assim as regras podem ser testadas com HTML fixo.

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return html
    .replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function cleanText(value: string): string {
  return decodeEntities(value).replace(/\s+/g, " ").trim();
}

function matchAllTags(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  return [...html.matchAll(re)].map((m) => cleanText(stripTags(m[1])));
}

/** Lê um atributo de uma tag, aceitando aspas simples, duplas ou nenhuma. */
function attr(tagHtml: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = tagHtml.match(re);
  if (!m) return null;
  return decodeEntities(m[2] ?? m[3] ?? m[4] ?? "").trim();
}

function findMeta(html: string, nameValue: string): string | null {
  const metas = html.match(/<meta[^>]*>/gi) ?? [];
  for (const meta of metas) {
    const name = attr(meta, "name") ?? attr(meta, "property");
    if (name && name.toLowerCase() === nameValue.toLowerCase()) {
      return attr(meta, "content");
    }
  }
  return null;
}

function findCanonical(html: string): string | null {
  const links = html.match(/<link[^>]*>/gi) ?? [];
  for (const link of links) {
    const rel = attr(link, "rel");
    if (rel && rel.toLowerCase().split(/\s+/).includes("canonical")) {
      return attr(link, "href");
    }
  }
  return null;
}

function extractJsonLdTypes(html: string): string[] {
  const types = new Set<string>();
  const blocks = [
    ...html.matchAll(
      /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];

  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1].trim());
      const collect = (node: unknown) => {
        if (Array.isArray(node)) return node.forEach(collect);
        if (node && typeof node === "object") {
          const t = (node as Record<string, unknown>)["@type"];
          if (typeof t === "string") types.add(t);
          if (Array.isArray(t))
            t.forEach((x) => typeof x === "string" && types.add(x));
          const graph = (node as Record<string, unknown>)["@graph"];
          if (graph) collect(graph);
        }
      };
      collect(parsed);
    } catch {
      // JSON-LD malformado: registra como presente porém inválido
      types.add("__invalid__");
    }
  }

  return [...types];
}

function countInternalLinks(html: string, origin: string): number {
  const anchors = html.match(/<a[^>]*>/gi) ?? [];
  let count = 0;
  for (const a of anchors) {
    const href = attr(a, "href");
    if (!href) continue;
    if (href.startsWith("#") || href.startsWith("mailto:")) continue;
    if (href.startsWith("/") || href.startsWith(origin)) count++;
  }
  return count;
}

function extractFirstParagraph(html: string): string | null {
  const paragraphs = matchAllTags(html, "p");
  return paragraphs.find((p) => p.length > 40) ?? null;
}

export function parsePage(params: {
  url: string;
  statusCode: number;
  html: string;
  origin: string;
}): PageSnapshot {
  const { url, statusCode, html, origin } = params;

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const images = html.match(/<img[^>]*>/gi) ?? [];
  const imagesWithoutAlt = images.filter((img) => {
    const alt = attr(img, "alt");
    return alt === null || alt.trim() === "";
  }).length;

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyText = cleanText(stripTags(bodyMatch ? bodyMatch[1] : html));

  return {
    url,
    statusCode,
    html,
    title: titleMatch ? cleanText(titleMatch[1]) || null : null,
    metaDescription: findMeta(html, "description"),
    canonical: findCanonical(html),
    robotsMeta: findMeta(html, "robots"),
    h1s: matchAllTags(html, "h1").filter(Boolean),
    h2s: matchAllTags(html, "h2").filter(Boolean),
    imagesTotal: images.length,
    imagesWithoutAlt,
    wordCount: bodyText ? bodyText.split(/\s+/).length : 0,
    internalLinks: countInternalLinks(html, origin),
    jsonLdTypes: extractJsonLdTypes(html),
    firstParagraph: extractFirstParagraph(html),
    hasJsScripts: /<script[^>]*src=/i.test(html),
  };
}
