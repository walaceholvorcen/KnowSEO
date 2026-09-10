import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analisarMercado,
  acharChances,
  bigramas,
  normalizar,
  removerBoilerplate,
} from "./temas.ts";

test("normalizar remove acento, caixa e pontuação", () => {
  assert.equal(normalizar("Orçamento: Guia Prático!"), "orcamento guia pratico");
  assert.equal(normalizar("  Múltiplos   espaços  "), "multiplos espacos");
});

test("bigramas descartam palavras vazias e números soltos", () => {
  assert.deepEqual(bigramas("Quanto investir em Google Ads por mês"), [
    "investir google",
    "google ads",
    "ads mes",
  ]);
});

test("bigramas não repetem o mesmo par duas vezes", () => {
  const pares = bigramas("Google Ads e Google Ads");
  assert.deepEqual(
    pares.filter((p) => p === "google ads").length,
    1,
  );
});

test("removerBoilerplate corta a assinatura repetida do site", () => {
  const limpos = removerBoilerplate([
    "Quanto investir em Google Ads | DataKnow",
    "Como medir ROAS | DataKnow",
    "Estratégia de mídia paga | DataKnow",
  ]);
  assert.deepEqual(limpos, [
    "Quanto investir em Google Ads",
    "Como medir ROAS",
    "Estratégia de mídia paga",
  ]);
});

test("removerBoilerplate preserva o que não é repetido", () => {
  // A cauda "guia definitivo" aparece uma vez só: é conteúdo, não assinatura.
  const limpos = removerBoilerplate([
    "Google Ads - guia definitivo",
    "Como medir ROAS",
    "Mídia paga na prática",
  ]);
  assert.equal(limpos[0], "Google Ads - guia definitivo");
});

test("tema coberto pelos concorrentes e ausente no cliente vira lacuna", () => {
  const temas = analisarMercado({
    cliente: [{ dominio: "cliente.com", titulo: "Sobre nós" }],
    concorrentes: [
      { dominio: "a.com", titulo: "Quanto custa Google Ads" },
      { dominio: "b.com", titulo: "Google Ads para iniciantes" },
    ],
  });

  const tema = temas.find((t) => t.termo === "google ads");
  assert.ok(tema, "esperava o tema google ads");
  assert.equal(tema.situacao, "lacuna");
  assert.equal(tema.paginasCliente, 0);
  assert.equal(tema.paginasConcorrentes, 2);
  assert.equal(tema.concorrentesQueCobrem, 2);
  assert.equal(tema.lacuna, 2);
});

test("tema em que o cliente escreve menos que o mercado fica disputado", () => {
  const temas = analisarMercado({
    cliente: [{ dominio: "cliente.com", titulo: "Google Ads na prática" }],
    concorrentes: [
      { dominio: "a.com", titulo: "Quanto custa Google Ads" },
      { dominio: "b.com", titulo: "Google Ads para iniciantes" },
      { dominio: "b.com", titulo: "Erros em Google Ads" },
    ],
  });

  const tema = temas.find((t) => t.termo === "google ads");
  assert.equal(tema?.situacao, "disputado");
  assert.equal(tema?.lacuna, 2);
});

test("tema em que o cliente escreve mais que o mercado é terreno dele", () => {
  const temas = analisarMercado({
    cliente: [
      { dominio: "cliente.com", titulo: "Marketing jurídico para escritórios" },
      { dominio: "cliente.com", titulo: "Marketing jurídico na prática" },
      { dominio: "cliente.com", titulo: "Erros de marketing jurídico" },
    ],
    concorrentes: [
      { dominio: "a.com", titulo: "Marketing jurídico básico" },
    ],
  });

  const tema = temas.find((t) => t.termo === "marketing juridico");
  assert.equal(tema?.situacao, "seu_terreno");
});

test("tema que só o cliente cobre não entra: crawl não prova demanda", () => {
  const temas = analisarMercado({
    cliente: [
      { dominio: "cliente.com", titulo: "Nosso método exclusivo" },
      { dominio: "cliente.com", titulo: "Método exclusivo em detalhe" },
    ],
    concorrentes: [{ dominio: "a.com", titulo: "Google Ads para iniciantes" }],
  });

  assert.equal(
    temas.some((t) => t.termo === "metodo exclusivo"),
    false,
  );
});

test("a marca repetida no título não vira o tema mais forte", () => {
  const titulos = [
    "Google Ads para clínicas | Agência Alfa",
    "Quanto custa Google Ads | Agência Alfa",
    "Como escolher palavras | Agência Alfa",
  ];
  const temas = analisarMercado({
    cliente: [],
    concorrentes: titulos.map((titulo) => ({ dominio: "alfa.com", titulo })),
  });

  assert.equal(
    temas.some((t) => t.termo.includes("agencia alfa")),
    false,
  );
});

test("lacuna maior aparece primeiro", () => {
  const temas = analisarMercado({
    cliente: [],
    concorrentes: [
      { dominio: "a.com", titulo: "Google Ads para clínicas" },
      { dominio: "b.com", titulo: "Google Ads para dentistas" },
      { dominio: "c.com", titulo: "Google Ads para advogados" },
      { dominio: "a.com", titulo: "Email marketing na prática" },
      { dominio: "b.com", titulo: "Email marketing para lojas" },
    ],
  });

  assert.equal(temas[0].termo, "google ads");
});

test("tema que três concorrentes cobrem vence tema que um só repete", () => {
  // Caso medido em site real: um concorrente com dezenas de páginas de
  // serviço sobre o mesmo termo abafava o que o mercado inteiro discute.
  const muitasDoMesmo = Array.from({ length: 20 }, (_, i) => ({
    dominio: "a.com",
    titulo: `Agências SEO em cidade ${i}`,
  }));

  const temas = analisarMercado({
    cliente: [],
    concorrentes: [
      ...muitasDoMesmo,
      { dominio: "a.com", titulo: "Email marketing na prática" },
      { dominio: "b.com", titulo: "Email marketing para lojas" },
      { dominio: "c.com", titulo: "Email marketing para clínicas" },
    ],
  });

  assert.equal(temas[0].termo, "email marketing");
  assert.equal(temas[0].concorrentesQueCobrem, 3);
});

test("assinatura que varia no fim do título não vira tema", () => {
  // "| Ranking comparado", "| Ranking actualizado", "| Ranking 2026": caudas
  // diferentes, mesma assinatura. A palavra repetida cai, o resto fica.
  const temas = analisarMercado({
    cliente: [],
    concorrentes: [
      { dominio: "a.com", titulo: "Melhores agências SEO | Ranking comparado" },
      { dominio: "a.com", titulo: "Melhores agências de mídia | Ranking actualizado" },
      { dominio: "a.com", titulo: "Melhores consultorias | Ranking 2026" },
      { dominio: "b.com", titulo: "Melhores agências SEO do país" },
    ],
  });

  assert.equal(
    temas.some((t) => t.termo.includes("ranking")),
    false,
  );
});

test("páginas sem título não derrubam a análise", () => {
  const temas = analisarMercado({
    cliente: [{ dominio: "cliente.com", titulo: null }],
    concorrentes: [
      { dominio: "a.com", titulo: null },
      { dominio: "a.com", titulo: "Google Ads para clínicas" },
      { dominio: "b.com", titulo: "Google Ads para dentistas" },
    ],
  });

  assert.equal(temas[0].termo, "google ads");
});

test("sem concorrente nenhum a análise devolve lista vazia", () => {
  const temas = analisarMercado({
    cliente: [{ dominio: "cliente.com", titulo: "Google Ads na prática" }],
    concorrentes: [],
  });
  assert.deepEqual(temas, []);
});

// --- camada do Search Console -----------------------------------------------

test("posição de página 2 com impressão vira chance", () => {
  const chances = acharChances([
    { query: "agencia google ads madrid", clicks: 0, impressions: 140, position: 13.4 },
  ]);
  assert.equal(chances.length, 1);
  assert.equal(chances[0].tipo, "pagina_dois");
});

test("primeira página sem clique vira chance de título", () => {
  const chances = acharChances([
    { query: "consultoria seo", clicks: 0, impressions: 200, position: 6.1 },
  ]);
  assert.equal(chances[0].tipo, "sem_clique");
});

test("primeira página com clique saudável não é chance", () => {
  const chances = acharChances([
    { query: "dataknow", clicks: 90, impressions: 200, position: 1.2 },
  ]);
  assert.deepEqual(chances, []);
});

test("posição além da página 2 não entra: subir dali não é empurrão", () => {
  const chances = acharChances([
    { query: "marketing digital", clicks: 0, impressions: 500, position: 48 },
  ]);
  assert.deepEqual(chances, []);
});

test("impressão baixa demais não vira chance", () => {
  const chances = acharChances([
    { query: "termo raríssimo", clicks: 0, impressions: 3, position: 12 },
  ]);
  assert.deepEqual(chances, []);
});

test("chances saem ordenadas pela impressão", () => {
  const chances = acharChances([
    { query: "menor", clicks: 0, impressions: 40, position: 12 },
    { query: "maior", clicks: 0, impressions: 900, position: 15 },
  ]);
  assert.deepEqual(
    chances.map((c) => c.query),
    ["maior", "menor"],
  );
});
