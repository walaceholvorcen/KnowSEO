import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { lerPeriodo, montarDesempenho, porcento, umaCasa } from "./desempenho.ts";

const dia = (chave: string, cliques: number, impressoes: number, posicao: number) => ({
  chave,
  cliques,
  impressoes,
  ctr: impressoes ? cliques / impressoes : 0,
  posicao,
});

describe("desempenho no Google", () => {
  test("dia que o Google omite no meio do período é zero de verdade", () => {
    const d = montarDesempenho(
      [dia("2026-11-10", 2, 100, 8), dia("2026-11-12", 1, 50, 12)],
      "2026-11-10",
    );
    assert.deepEqual(d.dias, ["2026-11-10", "2026-11-11", "2026-11-12"]);
    assert.deepEqual(d.cliques, [2, 0, 1]);
    assert.deepEqual(d.impressoes, [100, 0, 50]);
  });

  test("o eixo termina no último dia fechado, sem inventar queda no fim", () => {
    // Pedido até o dia 19, mas o Google só fechou até o 16.
    const d = montarDesempenho([dia("2026-11-16", 1, 10, 5)], "2026-11-14");
    assert.equal(d.ate, "2026-11-16");
    assert.equal(d.dias.at(-1), "2026-11-16");
    assert.equal(d.dias.length, 3);
  });

  test("dia sem impressão não tem posição", () => {
    const d = montarDesempenho(
      [dia("2026-11-10", 0, 20, 9), dia("2026-11-12", 0, 5, 30)],
      "2026-11-10",
    );
    assert.deepEqual(d.posicao, [9, null, 30]);
  });

  test("posição média pesa pela impressão; CTR é do total, não média de dias", () => {
    const d = montarDesempenho(
      [dia("2026-11-10", 5, 500, 6), dia("2026-11-11", 0, 1, 80)],
      "2026-11-10",
    );
    // (6×500 + 80×1) / 501
    assert.equal(umaCasa(d.total.posicao!), "6,1");
    // 5 / 501
    assert.equal(porcento(d.total.ctr), "1,0%");
  });

  test("período sem dado nenhum não quebra", () => {
    const d = montarDesempenho([], "2026-11-10");
    assert.deepEqual(d.dias, []);
    assert.equal(d.ate, null);
    assert.deepEqual(d.total, { cliques: 0, impressoes: 0, ctr: 0, posicao: null });
  });

  test("período fora da lista vira 28 dias", () => {
    assert.equal(lerPeriodo("7"), 7);
    assert.equal(lerPeriodo("90"), 90);
    for (const v of [undefined, "", "30", "abc", "-1"]) assert.equal(lerPeriodo(v), 28);
  });
});
