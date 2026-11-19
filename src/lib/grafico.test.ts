import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  diaCurto,
  diaNoFuso,
  diasAntes,
  diasEntre,
  marcasDoEixo,
  trechos,
} from "./grafico.ts";

describe("dias do gráfico", () => {
  test("o dia é o de quem opera, não o de Londres", () => {
    // 01h UTC do dia 20 ainda é dia 19 em São Paulo.
    assert.equal(diaNoFuso("2026-11-20T01:00:00.000Z", "America/Sao_Paulo"), "2026-11-19");
    assert.equal(diaNoFuso("2026-11-20T01:00:00.000Z", "Europe/Madrid"), "2026-11-20");
  });

  test("fuso inválido cai em UTC em vez de quebrar", () => {
    assert.equal(diaNoFuso("2026-11-20T01:00:00.000Z", "Lua/Cratera"), "2026-11-20");
  });

  test("o intervalo inclui as duas pontas e atravessa o mês", () => {
    assert.deepEqual(diasEntre("2026-10-30", "2026-11-02"), [
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    assert.deepEqual(diasEntre("2026-11-02", "2026-10-30"), []);
  });

  test("dias atrás e rótulo curto", () => {
    assert.equal(diasAntes("2026-11-19", 27), "2026-10-23");
    assert.equal(diaCurto("2026-11-09"), "09/11");
  });
});

describe("eixo vertical", () => {
  test("passo redondo que cobre o maior valor", () => {
    assert.deepEqual(marcasDoEixo(11), [0, 5, 10, 15]);
    assert.deepEqual(marcasDoEixo(102), [0, 50, 100, 150]);
    assert.deepEqual(marcasDoEixo(3), [0, 1, 2, 3]);
    assert.deepEqual(marcasDoEixo(8461), [0, 5000, 10000]);
  });

  test("série toda em zero ainda tem eixo, e em número inteiro", () => {
    assert.deepEqual(marcasDoEixo(0), [0, 1, 2, 3, 4]);
  });

  test("contagem nunca ganha marca quebrada; taxa pode", () => {
    assert.ok(marcasDoEixo(1.4).every(Number.isInteger));
    assert.deepEqual(marcasDoEixo(0.9, 0.1), [0, 0.5, 1]);
  });
});

describe("buracos na série", () => {
  test("null parte a linha; zero não", () => {
    const t = trechos([null, null, 0, 2, null, 5]);
    assert.deepEqual(
      t.map((p) => p.map((x) => x.i)),
      [[2, 3], [5]],
    );
  });

  test("série sem dado nenhum não tem trecho", () => {
    assert.deepEqual(trechos([null, null]), []);
  });
});
