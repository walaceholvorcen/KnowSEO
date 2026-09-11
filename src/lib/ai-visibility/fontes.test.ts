import { test } from "node:test";
import assert from "node:assert/strict";
import { lerFontes, type CheckFonte } from "./fontes.ts";

const check = (
  query_id: string,
  provider: string,
  competitors: string[] = [],
  directories: string[] = [],
  cited = false,
): CheckFonte => ({ query_id, provider, cited, competitors, directories });

test("conta perguntas distintas, não checagens", () => {
  const { fontes } = lerFontes([
    check("q1", "chatgpt", ["rival.es"]),
    check("q1", "claude", ["rival.es"]),
    check("q2", "chatgpt", ["rival.es"]),
  ]);
  assert.equal(fontes[0].dominio, "rival.es");
  assert.equal(fontes[0].perguntas, 2);
  assert.deepEqual(fontes[0].motores, ["chatgpt", "claude"]);
});

test("diretório vira plataforma, inclusive o misturado em competitors", () => {
  const { fontes } = lerFontes([
    check("q1", "chatgpt", ["https://www.sortlist.com/x", "rival.es"], ["clutch.co"]),
  ]);
  const tipo = Object.fromEntries(fontes.map((f) => [f.dominio, f.tipo]));
  assert.equal(tipo["rival.es"], "empresa");
  assert.equal(tipo["sortlist.com"], "plataforma");
  assert.equal(tipo["clutch.co"], "plataforma");
});

test("posição da marca entre as fontes", () => {
  const leitura = lerFontes([
    check("q1", "chatgpt", ["a.es"], [], true),
    check("q2", "chatgpt", ["a.es", "b.es"]),
    check("q3", "chatgpt", ["a.es"]),
  ]);
  assert.equal(leitura.perguntasDaMarca, 1);
  // a.es em 3 perguntas está à frente; b.es empata com a marca e não conta.
  assert.equal(leitura.fontesAFrente, 1);
  assert.equal(leitura.totalPerguntas, 3);
});

test("concentração só aparece com dado suficiente", () => {
  assert.equal(lerFontes([check("q1", "chatgpt", ["a.es"])]).concentracao, null);

  const muitos = Array.from({ length: 12 }, (_, i) =>
    check(`q${i}`, "chatgpt", i < 9 ? ["a.es"] : [`outro${i}.es`]),
  );
  // 12 citações: a.es leva 9, e as 5 maiores fontes levam 9+1+1+1 = 12.
  assert.deepEqual(lerFontes(muitos).concentracao, { fontes: 4, pct: 100 });
});
