import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { extrairEntidades, frasesVazias } from "./entidade.ts";
import { parsePage } from "./parse.ts";
import { runRules, computeScores } from "./rules.ts";
import type { SiteSignals } from "./types.ts";

const ORIGIN = "https://cliente.es";

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

function site(...htmls: string[]): SiteSignals {
  return {
    origin: ORIGIN,
    isHttps: true,
    robotsTxt: { found: true, body: "User-agent: *\nAllow: /" },
    sitemapUrls: [],
    sitemapFound: true,
    llmsTxtFound: true,
    pages: htmls.map((html, i) =>
      parsePage({
        url: `${ORIGIN}/${i ? `p${i}` : ""}`,
        statusCode: 200,
        html: `<html><head>${html}</head><body><p>texto</p></body></html>`,
        origin: ORIGIN,
      }),
    ),
  };
}

const codes = (s: SiteSignals) => runRules(s).map((f) => f.code);

const COMPLETA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Dataknow",
  url: "https://cliente.es/",
  logo: "https://cliente.es/logo.png",
  description: "Agência de SEO",
  sameAs: ["https://www.instagram.com/dataknow"],
};

describe("extrairEntidades", () => {
  test("acha a organização aninhada em @graph e como publisher", () => {
    const html =
      ld({ "@graph": [{ "@type": "WebSite" }, { "@type": "Organization", name: "A" }] }) +
      ld({ "@type": "Article", publisher: { "@type": "Organization", name: "B" } });
    assert.deepEqual(
      extrairEntidades(html).map((e) => e.nome),
      ["A", "B"],
    );
  });

  test("subtipo de LocalBusiness conta, Service puro não", () => {
    const html =
      ld({ "@type": "Dentist", name: "Clínica" }) +
      ld({ "@type": "Service", name: "Ortodontia" });
    const achadas = extrairEntidades(html);
    assert.equal(achadas.length, 1);
    assert.equal(achadas[0].tipo, "Dentist");
    assert.equal(achadas[0].local, true);
  });

  test("com vários tipos, vale o mais específico", () => {
    const [e] = extrairEntidades(
      ld({ "@type": ["Organization", "ProfessionalService"], name: "A" }),
    );
    assert.equal(e.tipo, "ProfessionalService");
    assert.equal(e.local, true);
  });

  test("sameAs aceita string única e ignora o que não é URL", () => {
    const [e] = extrairEntidades(
      ld({ "@type": "Organization", sameAs: "https://x.com/a" }) +
        ld({ "@type": "Organization", sameAs: ["@perfil", "https://y.com"] }),
    );
    assert.deepEqual(e.sameAs, ["https://x.com/a"]);
  });
});

describe("frasesVazias", () => {
  test("acha frase de folheto com acento e maiúscula", () => {
    assert.deepEqual(
      frasesVazias("Somos LÍDER DE MERCADO com soluções inovadoras."),
      ["lider de mercado", "solucoes inovadoras"],
    );
  });

  test("texto com fato não dispara", () => {
    assert.deepEqual(
      frasesVazias("Atendemos 140 clínicas em Madri desde 2012."),
      [],
    );
  });
});

describe("regras de entidade", () => {
  test("ficha completa não gera achado de entidade", () => {
    const c = codes(site(ld(COMPLETA)));
    assert.ok(!c.some((x) => x.startsWith("ENTIDADE") || x === "SEM_ENTIDADE"));
  });

  test("schema sem organização dispara SEM_ENTIDADE alto", () => {
    const achado = runRules(site(ld({ "@type": "WebSite", name: "x" }))).find(
      (f) => f.code === "SEM_ENTIDADE",
    );
    assert.equal(achado?.severity, "high");
    assert.match(achado!.evidence, /WebSite/);
  });

  test("sem schema nenhum, SEM_ENTIDADE cai para médio (NO_SCHEMA já cobra)", () => {
    const achado = runRules(site("")).find((f) => f.code === "SEM_ENTIDADE");
    assert.equal(achado?.severity, "medium");
  });

  test("organização sem sameAs", () => {
    const semPerfis = { ...COMPLETA, sameAs: undefined };
    assert.ok(codes(site(ld(semPerfis))).includes("ENTIDADE_SEM_SAMEAS"));
  });

  test("negócio local sem endereço é incompleto em nível médio", () => {
    const achado = runRules(
      site(ld({ ...COMPLETA, "@type": "LocalBusiness", telephone: "+34 1" })),
    ).find((f) => f.code === "ENTIDADE_INCOMPLETA");
    assert.equal(achado?.severity, "medium");
    assert.match(achado!.evidence, /address/);
  });

  test("uma página com a ficha completa basta", () => {
    const c = codes(site(ld({ "@type": "Organization", name: "Dataknow" }), ld(COMPLETA)));
    assert.ok(!c.includes("ENTIDADE_INCOMPLETA"));
  });

  test("nome diferente entre páginas; grafia igual não conta", () => {
    assert.ok(
      codes(site(ld(COMPLETA), ld({ ...COMPLETA, name: "Data Know SL" }))).includes(
        "ENTIDADE_NOME_INCONSISTENTE",
      ),
    );
    assert.ok(
      !codes(site(ld(COMPLETA), ld({ ...COMPLETA, name: "DATAKNOW" }))).includes(
        "ENTIDADE_NOME_INCONSISTENTE",
      ),
    );
  });

  test("duas frases de folheto disparam TEXTO_GENERICO; uma não", () => {
    const pagina = (texto: string): SiteSignals => ({
      ...site(ld(COMPLETA)),
      pages: [
        parsePage({
          url: `${ORIGIN}/`,
          statusCode: 200,
          html: `<html><head>${ld(COMPLETA)}</head><body><p>${texto}</p></body></html>`,
          origin: ORIGIN,
        }),
      ],
    });
    assert.ok(
      codes(pagina("Líderes en el sector con soluciones innovadoras.")).includes(
        "TEXTO_GENERICO",
      ),
    );
    assert.ok(!codes(pagina("Somos líderes en el sector desde 2009.")).includes("TEXTO_GENERICO"));
  });

  test("achado de entidade pesa na nota IA, não na do Google", () => {
    const antes = computeScores(runRules(site(ld(COMPLETA))), 1);
    const depois = computeScores(runRules(site(ld({ "@type": "WebSite" }))), 1);
    assert.equal(antes.google, depois.google);
    assert.ok(depois.ai < antes.ai);
  });
});
