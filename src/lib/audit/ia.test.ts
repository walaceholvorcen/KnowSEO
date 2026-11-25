import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parsePage } from "./parse.ts";
import { runRules } from "./rules.ts";
import { robotsBloqueiaAgente, schemaForaDoTexto } from "./ia.ts";
import type { SiteSignals } from "./types.ts";

const ORIGIN = "https://cliente.es";
const HOME = parsePage({
  url: `${ORIGIN}/`,
  statusCode: 200,
  html: "<html><head><title>Clínica dental en Madrid</title></head><body><h1>Ortodoncia</h1></body></html>",
  origin: ORIGIN,
});

function signals(over: Partial<SiteSignals> = {}): SiteSignals {
  return {
    origin: ORIGIN,
    isHttps: true,
    robotsTxt: { found: true, body: "User-agent: *\nAllow: /\nSitemap: x" },
    sitemapUrls: [],
    sitemapFound: true,
    llmsTxtFound: true,
    pages: [HOME],
    ...over,
  };
}
const codes = (s: SiteSignals) => runRules(s).map((f) => f.code);

describe("robots.txt e os robôs de IA", () => {
  test("grupo próprio manda; sem grupo, vale o curinga", () => {
    const body = "User-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: *\nAllow: /";
    assert.equal(robotsBloqueiaAgente(body, "OAI-SearchBot"), true);
    assert.equal(robotsBloqueiaAgente(body, "PerplexityBot"), false);
    assert.equal(robotsBloqueiaAgente("User-agent: *\nDisallow: /", "Claude-SearchBot"), true);
  });

  test("bloquear só o treino (GPTBot, ClaudeBot) não é achado", () => {
    const body = "User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /";
    assert.ok(!codes(signals({ robotsTxt: { found: true, body } })).includes("IA_BLOQUEADA_NO_ROBOTS"));
  });

  test("bloquear o robô de busca do ChatGPT é achado e nomeia o assistente", () => {
    const body = "User-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: *\nAllow: /";
    const f = runRules(signals({ robotsTxt: { found: true, body } })).find((x) => x.code === "IA_BLOQUEADA_NO_ROBOTS");
    assert.ok(f);
    assert.match(f.title, /ChatGPT/);
  });
});

describe("firewall barrando robô de IA", () => {
  test("403 para o robô com a home no ar é achado", () => {
    const s = signals({ acessoDeIA: [{ agente: "OAI-SearchBot", status: 403 }, { agente: "PerplexityBot", status: 200 }] });
    const f = runRules(s).find((x) => x.code === "IA_BLOQUEADA_NO_SERVIDOR");
    assert.ok(f);
    assert.match(f.evidence, /OAI-SearchBot: respondeu 403/);
  });

  test("todos atendidos, ou redirecionamento, não é achado", () => {
    const s = signals({ acessoDeIA: [{ agente: "OAI-SearchBot", status: 200 }, { agente: "PerplexityBot", status: 301 }] });
    assert.ok(!codes(s).includes("IA_BLOQUEADA_NO_SERVIDOR"));
  });
});

describe("dado estruturado igual ao texto", () => {
  const ld = (obj: unknown) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
  const faq = (q: string) => ({
    "@type": "FAQPage",
    mainEntity: [{ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: "x" } }],
  });

  test("pergunta do FAQ que está no texto passa, mesmo com acento e pontuação diferentes", () => {
    const html = `<html><body><h3>¿Cuánto cuesta la ortodoncia?</h3>${ld(faq("Cuanto cuesta la ortodoncia"))}</body></html>`;
    assert.deepEqual(schemaForaDoTexto(html), []);
  });

  test("pergunta que o texto não mostra é acusada", () => {
    const html = `<html><body><h3>Outra pergunta</h3>${ld(faq("¿Duele el tratamiento?"))}</body></html>`;
    assert.deepEqual(schemaForaDoTexto(html), ["¿Duele el tratamiento?"]);
  });

  test("título do artigo no JSON-LD precisa estar na página", () => {
    const html = `<html><body><h1>Título novo</h1>${ld({ "@type": "BlogPosting", headline: "Título antigo" })}</body></html>`;
    assert.deepEqual(schemaForaDoTexto(html), ["Título antigo"]);
  });
});
