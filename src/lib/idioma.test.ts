import { test } from "node:test";
import assert from "node:assert/strict";
import { dnaContradizIdioma, idiomaDoBlog } from "./idioma.ts";

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
