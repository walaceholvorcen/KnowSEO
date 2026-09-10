import { test } from "node:test";
import assert from "node:assert/strict";
import { compararAuditorias, resumirComparacao } from "./comparar.ts";

const achado = (code: string, affected_count = 1, severity = "medium") => ({
  code,
  title: code,
  severity,
  affected_count,
});

test("achado que sumiu vira resolvido", () => {
  const c = compararAuditorias([], [achado("TITLE_DUPLICATE")]);
  assert.deepEqual(c.resolvidos.map((f) => f.code), ["TITLE_DUPLICATE"]);
  assert.equal(c.novos.length, 0);
});

test("achado que apareceu vira novo", () => {
  const c = compararAuditorias([achado("URLS_QUEBRADAS")], []);
  assert.deepEqual(c.novos.map((f) => f.code), ["URLS_QUEBRADAS"]);
});

test("mesmo código nas duas é persistente, casado pelo código e não pelo título", () => {
  const atual = { ...achado("TITLE_TOO_LONG", 2), title: "2 títulos longos" };
  const anterior = { ...achado("TITLE_TOO_LONG", 3), title: "3 títulos longos" };
  const c = compararAuditorias([atual], [anterior]);
  assert.equal(c.persistem.length, 1);
  assert.equal(c.novos.length, 0);
  assert.equal(c.resolvidos.length, 0);
});

test("persistente atingindo menos páginas está melhorando", () => {
  const c = compararAuditorias(
    [achado("IMAGES_NO_ALT", 3)],
    [achado("IMAGES_NO_ALT", 9)],
  );
  assert.equal(c.persistem[0].melhorou, true);
  assert.equal(c.persistem[0].piorou, false);
});

test("persistente atingindo mais páginas está piorando", () => {
  const c = compararAuditorias(
    [achado("THIN_CONTENT", 8)],
    [achado("THIN_CONTENT", 2)],
  );
  assert.equal(c.persistem[0].piorou, true);
});

test("novos saem do mais grave para o mais leve", () => {
  const c = compararAuditorias(
    [achado("A", 1, "quick_win"), achado("B", 1, "critical"), achado("C", 1, "high")],
    [],
  );
  assert.deepEqual(c.novos.map((f) => f.code), ["B", "C", "A"]);
});

test("resumo fala só do que mudou", () => {
  const c = compararAuditorias(
    [achado("NOVO")],
    [achado("VELHO_1"), achado("VELHO_2")],
  );
  assert.equal(
    resumirComparacao(c),
    "Desde a auditoria anterior: 2 problemas resolvidos, 1 novo.",
  );
});

test("resumo diz quando nada mudou - também é informação", () => {
  const c = compararAuditorias([achado("X", 2)], [achado("X", 2)]);
  assert.equal(resumirComparacao(c), "Nada mudou desde a auditoria anterior.");
});

test("resumo conta o que está diminuindo", () => {
  const c = compararAuditorias([achado("X", 1)], [achado("X", 5)]);
  assert.match(resumirComparacao(c), /1 atingindo menos páginas/);
});
