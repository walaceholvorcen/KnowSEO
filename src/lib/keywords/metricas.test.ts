import { test } from "node:test";
import assert from "node:assert/strict";
import {
  enriquecer,
  idiomaDoBlog,
  indexarMetricas,
  numeroOuNulo,
  paisDoBlog,
} from "./metricas.ts";

test("o domínio manda no país, não o idioma", () => {
  // Caso real do produto: blog marcado como "pt" servindo uma agência
  // espanhola. Deduzir pelo idioma traria volume do Brasil.
  const pais = paisDoBlog({ dominio: "dataknow.es", idioma: "pt" });
  assert.equal(pais.chave, "es");
  assert.equal(pais.rotulo, "Espanha");
});

test("domínio composto usa o último pedaço", () => {
  assert.equal(paisDoBlog({ dominio: "blog.loja.com.br", idioma: "es" }).chave, "br");
});

test("TLD sem país conhecido cai no idioma", () => {
  assert.equal(paisDoBlog({ dominio: "empresa.com", idioma: "pt" }).chave, "br");
  assert.equal(paisDoBlog({ dominio: "empresa.com", idioma: "es" }).chave, "es");
});

test("sem domínio nenhum ainda decide pelo idioma", () => {
  assert.equal(paisDoBlog({ dominio: null, idioma: "pt" }).chave, "br");
});

test("todo país deduzido tem rótulo e preposição para a frase da tela", () => {
  for (const dominio of ["a.es", "a.br", "a.mx", "a.co", "a.ar", "a.cl", "a.pt", "a.com"]) {
    const pais = paisDoBlog({ dominio, idioma: "es" });
    assert.ok(pais.rotulo.length > 0, `sem rótulo para ${dominio}`);
    assert.ok(
      ["na", "no", "em"].includes(pais.preposicao),
      `preposição inválida para ${dominio}`,
    );
  }
});

test("a preposição concorda com o país", () => {
  assert.equal(paisDoBlog({ dominio: "a.es", idioma: "es" }).preposicao, "na");
  assert.equal(paisDoBlog({ dominio: "a.br", idioma: "pt" }).preposicao, "no");
  assert.equal(paisDoBlog({ dominio: "a.pt", idioma: "pt" }).preposicao, "em");
});

test("idioma desconhecido não quebra: cai no espanhol", () => {
  assert.equal(idiomaDoBlog("xx"), idiomaDoBlog("es"));
});

test("numeroOuNulo aceita string da API REST e preserva zero", () => {
  assert.equal(numeroOuNulo("1900"), 1900);
  assert.equal(numeroOuNulo(0), 0);
  assert.equal(numeroOuNulo("0"), 0);
  assert.equal(numeroOuNulo(null), null);
  assert.equal(numeroOuNulo(undefined), null);
  assert.equal(numeroOuNulo(""), null);
  assert.equal(numeroOuNulo("abc"), null);
});

test("indexarMetricas normaliza a caixa do termo", () => {
  const mapa = indexarMetricas([
    {
      text: "Google Ads",
      keywordIdeaMetrics: { avgMonthlySearches: "8100", competitionIndex: "72" },
    },
  ]);
  assert.equal(mapa.get("google ads")?.volumeMensal, 8100);
  assert.equal(mapa.get("google ads")?.indiceDeConcorrencia, 72);
});

test("resultado sem métrica entra com volume nulo", () => {
  const mapa = indexarMetricas([{ text: "termo novo", keywordIdeaMetrics: null }]);
  assert.equal(mapa.get("termo novo")?.volumeMensal, null);
});

test("resultado sem texto é ignorado", () => {
  assert.equal(indexarMetricas([{ keywordIdeaMetrics: {} }]).size, 0);
});

test("termo repetido não sobrescreve o primeiro", () => {
  const mapa = indexarMetricas([
    { text: "seo", keywordIdeaMetrics: { avgMonthlySearches: "100" } },
    { text: "SEO", keywordIdeaMetrics: { avgMonthlySearches: "999" } },
  ]);
  assert.equal(mapa.get("seo")?.volumeMensal, 100);
});

test("keyword medida vira origem google_ads", () => {
  const mapa = indexarMetricas([
    {
      text: "agencia seo madrid",
      keywordIdeaMetrics: { avgMonthlySearches: "480", competitionIndex: "64" },
    },
  ]);
  const r = enriquecer("Agencia SEO Madrid", mapa);
  assert.equal(r.search_volume, 480);
  assert.equal(r.competition_index, 64);
  assert.equal(r.source, "google_ads");
});

test("keyword sem medição continua marcada como opinião do modelo", () => {
  const r = enriquecer("termo que o google não conhece", new Map());
  assert.equal(r.search_volume, null);
  assert.equal(r.source, "ai");
});

test("volume ausente não vira google_ads: origem tem que dizer a verdade", () => {
  const mapa = indexarMetricas([
    { text: "termo raro", keywordIdeaMetrics: { competitionIndex: "10" } },
  ]);
  const r = enriquecer("termo raro", mapa);
  assert.equal(r.source, "ai");
  assert.equal(r.competition_index, null);
});

test("volume zero é medição válida, não ausência", () => {
  const mapa = indexarMetricas([
    { text: "termo sem busca", keywordIdeaMetrics: { avgMonthlySearches: "0" } },
  ]);
  const r = enriquecer("termo sem busca", mapa);
  assert.equal(r.search_volume, 0);
  assert.equal(r.source, "google_ads");
});
