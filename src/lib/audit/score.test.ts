import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parsePage } from "./parse.ts";
import { runRules, computeScores, scoreBand } from "./rules.ts";
import type { PageSnapshot, SiteSignals } from "./types.ts";

const ORIGIN = "https://cliente.es";

function page(html: string, url: string): PageSnapshot {
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

const BROKEN = `<html><head><title>x</title></head><body><p>curto</p></body></html>`;

const HEALTHY = `<!doctype html><html><head>
<title>Clínica dental en Madrid especializada en ortodoncia</title>
<meta name="description" content="Somos una clínica dental en Madrid con más de 20 años tratando ortodoncia invisible e implantes. Primera consulta sin coste y financiación a medida.">
<link rel="canonical" href="${ORIGIN}/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"C","url":"https://cliente.es/","logo":"https://cliente.es/logo.png","description":"Clinica dental en Madrid","address":"Calle Mayor 1, Madrid","telephone":"+34 910 000 000","sameAs":["https://www.instagram.com/clinica"]}</script>
</head><body>
<h1>Ortodoncia invisible en Madrid</h1><h2>Como funciona</h2><h2>Precio</h2>
<p>${"palabra ".repeat(400)}</p>
<img src="a.jpg" alt="Antes y despues">
<a href="/a">a</a><a href="/b">b</a><a href="/c">c</a>
</body></html>`;

function siteWith(brokenCount: number, total: number) {
  const pages = [
    ...Array.from({ length: brokenCount }, (_, i) =>
      page(BROKEN, `${ORIGIN}/ruim-${i}`),
    ),
    ...Array.from({ length: total - brokenCount }, (_, i) =>
      page(HEALTHY, `${ORIGIN}/bom-${i}`),
    ),
  ];
  return computeScores(runRules(signals({ pages })), total);
}

describe("nota proporcional ao alcance", () => {
  test("problema pontual pesa muito menos que problema sistêmico", () => {
    const pontual = siteWith(1, 20).google;
    const sistemico = siteWith(20, 20).google;
    assert.ok(
      pontual > sistemico + 20,
      `pontual ${pontual} deveria ser bem melhor que sistêmico ${sistemico}`,
    );
  });

  test("site com falhas em minoria das páginas fica em faixa boa", () => {
    const s = siteWith(2, 25).google;
    assert.ok(s >= 70, `esperava nota boa, veio ${s}`);
    assert.ok(["bom", "excelente"].includes(scoreBand(s)));
  });

  test("site inteiro quebrado cai para faixa crítica", () => {
    const scores = computeScores(
      runRules(
        signals({
          isHttps: false,
          robotsTxt: { found: true, body: "Disallow: /" },
          sitemapFound: false,
          pages: Array.from({ length: 10 }, (_, i) =>
            page(BROKEN, `${ORIGIN}/p${i}`),
          ),
        }),
      ),
      10,
    );
    assert.equal(scoreBand(scores.google), "critico");
  });

  test("problema de site inteiro não é diluído pelo número de páginas", () => {
    // Cada página precisa ser única: páginas idênticas disparariam
    // título/descrição duplicados e contaminariam a comparação.
    const unique = (i: number) =>
      HEALTHY.replace(
        "Clínica dental en Madrid especializada en ortodoncia",
        `Clínica dental en Madrid especializada en ortodoncia ${i}`,
      ).replace("Somos una clínica", `Somos la clínica número ${i}`);

    const poucas = computeScores(
      runRules(signals({ isHttps: false, pages: [page(unique(0), `${ORIGIN}/`)] })),
      1,
    );
    const muitas = computeScores(
      runRules(
        signals({
          isHttps: false,
          pages: Array.from({ length: 50 }, (_, i) =>
            page(unique(i), `${ORIGIN}/p${i}`),
          ),
        }),
      ),
      50,
    );
    assert.equal(poucas.google, muitas.google);
  });

  test("nota nunca sai da faixa 0-100", () => {
    const scores = siteWith(30, 30);
    assert.ok(scores.google >= 0 && scores.google <= 100);
    assert.ok(scores.ai >= 0 && scores.ai <= 100);
  });
});

describe("faixas nomeadas", () => {
  test("mapeia o número para uma faixa compreensível", () => {
    assert.equal(scoreBand(95), "excelente");
    assert.equal(scoreBand(75), "bom");
    assert.equal(scoreBand(55), "atencao");
    assert.equal(scoreBand(20), "critico");
  });
});
