import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parsePage } from "./parse.ts";
import { runRules, computeScores, robotsBloqueiaTudo } from "./rules.ts";
import type { PageSnapshot, SiteSignals } from "./types.ts";

const ORIGIN = "https://cliente.es";

function page(html: string, url = `${ORIGIN}/`): PageSnapshot {
  return parsePage({ url, statusCode: 200, html, origin: ORIGIN });
}

function signals(over: Partial<SiteSignals> = {}): SiteSignals {
  return {
    origin: ORIGIN,
    isHttps: true,
    robotsTxt: { found: true, body: "User-agent: *\nAllow: /\nSitemap: x" },
    sitemapUrls: [`${ORIGIN}/sitemap.xml`],
    sitemapFound: true,
    llmsTxtFound: true,
    pages: [],
    ...over,
  };
}

const codes = (s: SiteSignals) => runRules(s).map((f) => f.code);

// Página "boa" para servir de base: sem nenhum achado esperado.
const GOOD_HTML = `<!doctype html><html><head>
<title>Clínica dental en Madrid especializada en ortodoncia</title>
<meta name="description" content="Somos una clínica dental en Madrid con más de 20 años tratando ortodoncia invisible e implantes. Primera consulta sin coste y financiación a medida.">
<link rel="canonical" href="${ORIGIN}/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Clinica"}</script>
</head><body>
<h1>Ortodoncia invisible en Madrid</h1>
<h2>Cómo funciona</h2><h2>Cuánto cuesta</h2>
<p>${"palabra ".repeat(400)}</p>
<img src="a.jpg" alt="Antes y después">
<a href="/servicios">Servicios</a><a href="/precios">Precios</a><a href="/contacto">Contacto</a>
</body></html>`;

describe("parsePage", () => {
  test("extrai os sinais principais", () => {
    const p = page(GOOD_HTML);
    assert.equal(p.title, "Clínica dental en Madrid especializada en ortodoncia");
    assert.match(p.metaDescription!, /^Somos una clínica dental/);
    assert.equal(p.canonical, `${ORIGIN}/`);
    assert.equal(p.h1s.length, 1);
    assert.equal(p.h2s.length, 2);
    assert.equal(p.imagesTotal, 1);
    assert.equal(p.imagesWithoutAlt, 0);
    assert.equal(p.internalLinks, 3);
    assert.deepEqual(p.jsonLdTypes, ["LocalBusiness"]);
    assert.ok(p.wordCount > 300);
  });

  test("aceita atributos com aspas simples e sem aspas", () => {
    const p = page(
      `<html><head><link rel='canonical' href=${ORIGIN}/x><meta name='description' content='Olá'></head><body></body></html>`,
    );
    assert.equal(p.canonical, `${ORIGIN}/x`);
    assert.equal(p.metaDescription, "Olá");
  });

  test("alt vazio é imagem decorativa, não falta de alt", () => {
    // `alt=""` é a marcação correta em WCAG para imagem que não carrega
    // informação. Contá-la como falta acusava justamente quem fez certo.
    const p = page(`<html><body><img src="a.jpg" alt=""><img src="b.jpg"></body></html>`);
    assert.equal(p.imagesWithoutAlt, 1);
  });

  test("não conta link externo nem âncora como link interno", () => {
    const p = page(
      `<html><body><a href="https://outro.com/x">e</a><a href="#topo">a</a><a href="/i">i</a></body></html>`,
    );
    assert.equal(p.internalLinks, 1);
  });

  test("ignora texto de script e style na contagem de palavras", () => {
    const p = page(
      `<html><body><script>${"var x=1; ".repeat(200)}</script><p>uma duas tres</p></body></html>`,
    );
    assert.ok(p.wordCount < 20, `esperava poucas palavras, veio ${p.wordCount}`);
  });

  test("lê @type dentro de @graph e de array", () => {
    const p = page(
      `<html><head><script type="application/ld+json">{"@graph":[{"@type":"Organization"},{"@type":["Article","BlogPosting"]}]}</script></head><body></body></html>`,
    );
    assert.deepEqual(p.jsonLdTypes.sort(), ["Article", "BlogPosting", "Organization"]);
  });

  test("marca JSON-LD malformado", () => {
    const p = page(
      `<html><head><script type="application/ld+json">{quebrado}</script></head><body></body></html>`,
    );
    assert.deepEqual(p.jsonLdTypes, ["__invalid__"]);
  });

  test("decodifica entidades no título", () => {
    const p = page(`<html><head><title>Casa &amp; Jardim</title></head><body></body></html>`);
    assert.equal(p.title, "Casa & Jardim");
  });
});

describe("runRules - página saudável não gera ruído", () => {
  test("nenhum achado numa página bem feita", () => {
    const found = codes(signals({ pages: [page(GOOD_HTML)] }));
    assert.deepEqual(found, [], `achados inesperados: ${found.join(", ")}`);
  });

  test("nota alta nos dois placares", () => {
    const scores = computeScores(runRules(signals({ pages: [page(GOOD_HTML)] })));
    assert.equal(scores.google, 100);
    assert.equal(scores.ai, 100);
  });
});

describe("runRules - rastreamento e indexação", () => {
  test("detecta site sem HTTPS", () => {
    assert.ok(codes(signals({ isHttps: false })).includes("NO_HTTPS"));
  });

  test("detecta robots bloqueando tudo", () => {
    const c = codes(
      signals({ robotsTxt: { found: true, body: "User-agent: *\nDisallow: /" } }),
    );
    assert.ok(c.includes("ROBOTS_BLOCKS_ALL"));
  });

  test("'Disallow: /admin' não é confundido com bloqueio total", () => {
    const c = codes(
      signals({
        robotsTxt: { found: true, body: "User-agent: *\nDisallow: /admin\nSitemap: x" },
      }),
    );
    assert.ok(!c.includes("ROBOTS_BLOCKS_ALL"));
  });

  test("detecta ausência de sitemap e de robots", () => {
    const c = codes(
      signals({ robotsTxt: { found: false, body: null }, sitemapFound: false }),
    );
    assert.ok(c.includes("ROBOTS_MISSING"));
    assert.ok(c.includes("SITEMAP_MISSING"));
  });

  test("detecta noindex", () => {
    const p = page(
      `<html><head><meta name="robots" content="noindex, follow"></head><body></body></html>`,
    );
    assert.ok(codes(signals({ pages: [p] })).includes("NOINDEX_ON_PAGES"));
  });

  test("'index, follow' não vira achado de noindex", () => {
    const p = page(
      `<html><head><meta name="robots" content="index, follow"></head><body></body></html>`,
    );
    assert.ok(!codes(signals({ pages: [p] })).includes("NOINDEX_ON_PAGES"));
  });
});

describe("runRules - on-page", () => {
  test("detecta título duplicado entre páginas", () => {
    const html = () =>
      `<html><head><title>Mesmo título repetido em duas páginas aqui</title></head><body></body></html>`;
    const c = codes(
      signals({
        pages: [page(html(), `${ORIGIN}/a`), page(html(), `${ORIGIN}/b`)],
      }),
    );
    assert.ok(c.includes("TITLE_DUPLICATE"));
  });

  test("títulos diferentes não geram duplicidade", () => {
    const c = codes(
      signals({
        pages: [
          page(`<html><head><title>Ortodoncia invisible en Madrid centro</title></head><body></body></html>`),
          page(`<html><head><title>Implantes dentales en Madrid con garantia</title></head><body></body></html>`),
        ],
      }),
    );
    assert.ok(!c.includes("TITLE_DUPLICATE"));
  });

  test("detecta título curto e longo", () => {
    const short = page(`<html><head><title>Inicio</title></head><body></body></html>`);
    const long = page(
      `<html><head><title>${"a".repeat(90)}</title></head><body></body></html>`,
    );
    const c = codes(signals({ pages: [short, long] }));
    assert.ok(c.includes("TITLE_TOO_SHORT"));
    assert.ok(c.includes("TITLE_TOO_LONG"));
  });

  test("detecta H1 ausente e múltiplo", () => {
    const none = page(`<html><body><p>x</p></body></html>`);
    const many = page(`<html><body><h1>A</h1><h1>B</h1></body></html>`);
    const c = codes(signals({ pages: [none, many] }));
    assert.ok(c.includes("H1_MISSING"));
    assert.ok(c.includes("H1_MULTIPLE"));
  });

  test("detecta imagens sem alt", () => {
    const p = page(`<html><body><img src="a.jpg"></body></html>`);
    assert.ok(codes(signals({ pages: [p] })).includes("IMAGES_NO_ALT"));
  });
});

describe("runRules - conteúdo", () => {
  test("detecta conteúdo raso", () => {
    const p = page(`<html><body><p>${"palavra ".repeat(50)}</p></body></html>`);
    assert.ok(codes(signals({ pages: [p] })).includes("THIN_CONTENT"));
  });

  test("página longa não é marcada como rasa", () => {
    assert.ok(!codes(signals({ pages: [page(GOOD_HTML)] })).includes("THIN_CONTENT"));
  });

  test("detecta pouca linkagem interna", () => {
    const p = page(`<html><body><a href="/a">a</a></body></html>`);
    assert.ok(codes(signals({ pages: [p] })).includes("LOW_INTERNAL_LINKS"));
  });
});

describe("runRules - GEO", () => {
  test("detecta ausência de llms.txt", () => {
    assert.ok(codes(signals({ llmsTxtFound: false })).includes("NO_LLMS_TXT"));
  });

  test("detecta ausência de schema", () => {
    const p = page(`<html><head><title>t</title></head><body><p>x</p></body></html>`);
    assert.ok(codes(signals({ pages: [p] })).includes("NO_SCHEMA"));
  });

  test("site com JS ganha aviso de possível injeção, com severidade menor", () => {
    const p = page(
      `<html><head><script src="/app.js"></script></head><body><p>x</p></body></html>`,
    );
    const finding = runRules(signals({ pages: [p] })).find(
      (f) => f.code === "NO_SCHEMA",
    )!;
    assert.equal(finding.severity, "medium");
    assert.match(finding.evidence, /JavaScript/);
  });

  test("sem JS na página, ausência de schema é tratada como certeza", () => {
    const p = page(`<html><head><title>t</title></head><body><p>x</p></body></html>`);
    const finding = runRules(signals({ pages: [p] })).find(
      (f) => f.code === "NO_SCHEMA",
    )!;
    assert.equal(finding.severity, "high");
  });

  test("detecta schema inválido", () => {
    const p = page(
      `<html><head><script type="application/ld+json">{quebrado}</script></head><body></body></html>`,
    );
    assert.ok(codes(signals({ pages: [p] })).includes("SCHEMA_INVALID"));
  });

  test("página longa sem H2 é sinalizada para GEO", () => {
    const p = page(`<html><body><h1>T</h1><p>${"palavra ".repeat(400)}</p></body></html>`);
    assert.ok(codes(signals({ pages: [p] })).includes("NO_HEADING_STRUCTURE"));
  });
});

describe("computeScores", () => {
  test("problema crítico derruba a nota do Google", () => {
    const scores = computeScores(runRules(signals({ isHttps: false })));
    assert.ok(scores.google <= 75);
  });

  test("achado de GEO não contamina a nota do Google", () => {
    const scores = computeScores(runRules(signals({ llmsTxtFound: false })));
    assert.equal(scores.google, 100);
    assert.ok(scores.ai < 100);
  });

  test("nota nunca fica negativa", () => {
    const broken = page(`<html><body><img src="a.jpg"></body></html>`);
    const scores = computeScores(
      runRules(
        signals({
          isHttps: false,
          robotsTxt: { found: true, body: "Disallow: /" },
          sitemapFound: false,
          llmsTxtFound: false,
          pages: [broken, broken, broken],
        }),
      ),
    );
    assert.ok(scores.google >= 0);
    assert.ok(scores.ai >= 0);
  });
});

// ---------------------------------------------------------------------------
// Agrupamento por User-agent no robots.txt.
//
// A regra antiga procurava "Disallow: /" em qualquer lugar do arquivo, sem
// olhar a quem a diretiva se aplicava. Um site que bloqueia rastreador de IA
// - hoje comum - era acusado de bloquear o site inteiro e perdia 30 pontos.
// ---------------------------------------------------------------------------
describe("robotsBloqueiaTudo", () => {
  test("bloqueio do curinga é bloqueio de verdade", () => {
    assert.equal(robotsBloqueiaTudo("User-agent: *\nDisallow: /"), true);
  });

  test("bloquear só o GPTBot não é bloquear o site", () => {
    const robots = [
      "User-agent: *",
      "Allow: /",
      "",
      "User-agent: GPTBot",
      "Disallow: /",
    ].join("\n");
    assert.equal(robotsBloqueiaTudo(robots), false);
  });

  test("grupo do Googlebot tem precedência sobre o curinga", () => {
    const bloqueado = [
      "User-agent: *",
      "Allow: /",
      "",
      "User-agent: Googlebot",
      "Disallow: /",
    ].join("\n");
    assert.equal(robotsBloqueiaTudo(bloqueado), true);

    const liberado = [
      "User-agent: *",
      "Disallow: /",
      "",
      "User-agent: Googlebot",
      "Allow: /",
    ].join("\n");
    assert.equal(robotsBloqueiaTudo(liberado), false);
  });

  test("user-agents seguidos compartilham o mesmo bloco", () => {
    const robots = [
      "User-agent: GPTBot",
      "User-agent: CCBot",
      "Disallow: /",
    ].join("\n");
    assert.equal(robotsBloqueiaTudo(robots), false);
  });

  test("bloquear um caminho não é bloquear tudo", () => {
    assert.equal(
      robotsBloqueiaTudo("User-agent: *\nDisallow: /admin/\nDisallow: /tmp"),
      false,
    );
  });

  test("comentário e caixa alta não confundem", () => {
    assert.equal(
      robotsBloqueiaTudo("# bloqueio geral\nUSER-AGENT: *\nDISALLOW: /"),
      true,
    );
  });

  test("robots vazio não acusa nada", () => {
    assert.equal(robotsBloqueiaTudo(""), false);
  });

  test("disallow sem grupo declarado não derruba a análise", () => {
    assert.equal(robotsBloqueiaTudo("Disallow: /"), false);
  });
});

// ---------------------------------------------------------------------------
// URLs que o site anuncia e não entrega.
//
// Categoria que não existia: o crawler descartava tudo que não fosse 2xx, e
// as páginas quebradas sumiam da amostra - a nota MELHORAVA conforme o site
// piorava.
// ---------------------------------------------------------------------------
describe("runRules - URLs quebradas e redirecionadas", () => {
  test("404 no sitemap vira achado com o status na evidência", () => {
    const achados = runRules(
      signals({
        pages: [page(GOOD_HTML)],
        urlsQuebradas: [{ url: `${ORIGIN}/antiga`, status: 404 }],
      }),
    );
    const f = achados.find((a) => a.code === "URLS_QUEBRADAS");
    assert.ok(f, "esperava o achado de URL quebrada");
    assert.equal(f.severity, "high");
    assert.match(f.evidence!, /404/);
    assert.match(f.evidence!, /\/antiga/);
  });

  test("erro de servidor é mais grave que 404", () => {
    const achados = runRules(
      signals({
        pages: [page(GOOD_HTML)],
        urlsQuebradas: [{ url: `${ORIGIN}/x`, status: 503 }],
      }),
    );
    assert.equal(
      achados.find((a) => a.code === "URLS_QUEBRADAS")?.severity,
      "critical",
    );
  });

  test("URL que não respondeu é descrita como tal, não como 404", () => {
    const achados = runRules(
      signals({
        pages: [page(GOOD_HTML)],
        urlsQuebradas: [{ url: `${ORIGIN}/lenta`, status: null }],
      }),
    );
    assert.match(
      achados.find((a) => a.code === "URLS_QUEBRADAS")!.evidence!,
      /não respondeu/,
    );
  });

  test("redirecionamento aparece com origem e destino", () => {
    const achados = runRules(
      signals({
        pages: [page(GOOD_HTML)],
        urlsRedirecionadas: [
          { url: `${ORIGIN}/velha`, status: null, destino: `${ORIGIN}/nova` },
        ],
      }),
    );
    const f = achados.find((a) => a.code === "URLS_REDIRECIONADAS");
    assert.ok(f);
    assert.match(f.evidence!, /\/velha → .*\/nova/);
  });

  test("site sem URL quebrada não ganha achado nenhum", () => {
    const c = codes(signals({ pages: [page(GOOD_HTML)] }));
    assert.ok(!c.includes("URLS_QUEBRADAS"));
    assert.ok(!c.includes("URLS_REDIRECIONADAS"));
  });

  test("URL quebrada derruba a nota em vez de sumir da amostra", () => {
    const limpo = computeScores(
      runRules(signals({ pages: [page(GOOD_HTML)] })),
      1,
    );
    const comErro = computeScores(
      runRules(
        signals({
          pages: [page(GOOD_HTML)],
          urlsQuebradas: [{ url: `${ORIGIN}/a`, status: 404 }],
        }),
      ),
      1,
    );
    assert.equal(limpo.google, 100);
    assert.ok(
      comErro.google < limpo.google,
      `esperava nota menor com URL quebrada, veio ${comErro.google}`,
    );
  });
});
