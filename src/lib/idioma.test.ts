import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectarIdioma,
  dnaContradizIdioma,
  idiomaDoBlog,
  trechosForaDoMercado,
} from "./idioma.ts";

test("o domínio vence o idioma cadastrado: dataknow.es com 'pt' escreve em espanhol", () => {
  // O caso real que motivou tudo isto.
  const r = idiomaDoBlog({ custom_domain: "dataknow.es", language: "pt" });
  assert.equal(r.codigo, "es");
  assert.equal(r.instrucao, "Escreva em espanhol da Espanha");
  assert.equal(r.rotulo, "espanhol da Espanha");
});

test("sem domínio, vale o idioma cadastrado", () => {
  const pt = idiomaDoBlog({ custom_domain: null, language: "pt" });
  assert.equal(pt.codigo, "pt");
  assert.ok(pt.instrucao.includes("português do Brasil"));
  assert.ok(pt.instrucao.includes("nunca português de Portugal"));

  assert.equal(idiomaDoBlog({ custom_domain: null, language: "en" }).codigo, "en");
  assert.equal(idiomaDoBlog({ custom_domain: null, language: "es" }).codigo, "es");
});

test("domínio sem país conhecido (.com) não decide", () => {
  assert.equal(
    idiomaDoBlog({ custom_domain: "loja.com", language: "en" }).codigo,
    "en",
  );
});

test("variante vem do país: .pt é português de Portugal, .mx espanhol do México", () => {
  assert.equal(
    idiomaDoBlog({ custom_domain: "a.pt", language: "pt" }).rotulo,
    "português de Portugal",
  );
  assert.equal(
    idiomaDoBlog({ custom_domain: "a.mx", language: "es" }).rotulo,
    "espanhol do México",
  );
});

test("idioma desconhecido não quebra", () => {
  assert.equal(idiomaDoBlog({ custom_domain: null, language: "xx" }).codigo, "es");
});

test("detector de contradição no DNA", () => {
  assert.ok(dnaContradizIdioma("Escreva em português do Brasil", "es"));
  assert.ok(dnaContradizIdioma("Escribe en portugués", "es"));
  assert.ok(dnaContradizIdioma("Escreva em espanhol", "pt"));
  assert.ok(dnaContradizIdioma("Escribe en español", "pt"));
  assert.ok(!dnaContradizIdioma("Escreva em português do Brasil", "pt"));
  assert.ok(!dnaContradizIdioma("Frases curtas. Trate por você.", "es"));
  assert.ok(!dnaContradizIdioma("", "es"));
  assert.ok(!dnaContradizIdioma(null, "es"));
});

test("detectarIdioma: pautas antigas em português do acervo real", () => {
  assert.equal(detectarIdioma("Quanto Custa Anunciar no TikTok Ads no Brasil"), "pt");
  assert.equal(detectarIdioma("Quanto Investir em Google Ads por Mês"), "pt");
  assert.equal(detectarIdioma("Não deixe seu orçamento parado"), "pt");
});

test("detectarIdioma: as pautas em espanhol da Espanha", () => {
  assert.equal(
    detectarIdioma("Consent Mode v2 en 2026: cómo afecta a la medición de tus campañas"),
    "es",
  );
  assert.equal(
    detectarIdioma("ROAS de equilibrio: cómo calcular el mínimo rentable de tus campañas"),
    "es",
  );
  assert.equal(
    detectarIdioma("Estructura de cuenta de Google Ads para ecommerce: guía práctica 2026"),
    "es",
  );
});

test("detectarIdioma: inglês e incerteza", () => {
  assert.equal(detectarIdioma("How to calculate your break-even ROAS"), "en");
  // Sem marcador nenhum: diz que não sabe em vez de chutar.
  assert.equal(detectarIdioma("Google Ads 2026"), null);
  assert.equal(detectarIdioma(""), null);
  // Um marcador de cada lado: empate, não sabe.
  assert.equal(detectarIdioma("Google Ads con Brasil"), null);
});

test("detectarIdioma: artigo espanhol que cita o Brasil uma vez continua espanhol", () => {
  const corpo =
    "En España la inversión en Google Ads crece. Como en Brasil, las campañas de búsqueda son la base del plan y el presupuesto se reparte con cuidado.";
  assert.equal(detectarIdioma(corpo), "es");
});

test("trechosForaDoMercado: acha 'no Brasil' e R$ com contexto", () => {
  const texto =
    "Investir em Google Ads no Brasil exige planejamento. Um orçamento inicial de R$ 1.500 por mês costuma bastar.";
  const trechos = trechosForaDoMercado(texto);
  assert.equal(trechos.length, 2);
  assert.ok(trechos[0].includes("no Brasil"));
  assert.ok(trechos[1].includes("R$ 1.500"));
  assert.deepEqual(trechosForaDoMercado("Presupuesto de 1.500 € al mes."), []);
});
