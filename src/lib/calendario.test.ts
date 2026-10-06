import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  diasUteis,
  distribuirDatas,
  limitesDoMes,
  mesVizinho,
  paraInput,
  doInput,
  semanasDoMes,
  venceu,
} from "./calendario.ts";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("calendário de publicação", () => {
  test("outubro de 2026 tem 31 dias e 22 dias úteis", () => {
    const { inicio, fim } = limitesDoMes("2026-10");
    assert.equal(paraInput(inicio), "2026-10-01");
    assert.equal(paraInput(fim), "2026-10-31");
    assert.equal(diasUteis(inicio, fim).length, 22);
  });

  test("fim de semana fica fora da distribuição", () => {
    // 10 e 11/10/2026 são sábado e domingo.
    const datas = distribuirDatas(22, d("2026-10-01"), d("2026-10-31"));
    assert.equal(datas.length, 22);
    assert.ok(!datas.some((x) => [0, 6].includes(x.getUTCDay())));
  });

  test("seis artigos saem espaçados de ponta a ponta, não todos na primeira semana", () => {
    const datas = distribuirDatas(6, d("2026-10-01"), d("2026-10-31")).map(paraInput);
    assert.deepEqual(datas, [
      "2026-10-01",
      "2026-10-07",
      "2026-10-13",
      "2026-10-20",
      "2026-10-26",
      "2026-10-30",
    ]);
  });

  test("um artigo só vai no primeiro dia útil, não no meio do mês", () => {
    assert.deepEqual(
      distribuirDatas(1, d("2026-10-03"), d("2026-10-31")).map(paraInput),
      ["2026-10-05"], // 3 e 4/10 são sábado e domingo
    );
  });

  test("mais artigos que dias úteis: um por dia, e o resto fica sem data", () => {
    // Publicar dois no mesmo dia desperdiça a cadência que se está montando.
    const datas = distribuirDatas(40, d("2026-10-01"), d("2026-10-31"));
    assert.equal(datas.length, 22);
    assert.equal(new Set(datas.map(paraInput)).size, 22);
  });

  test("intervalo sem dia útil não devolve data nenhuma", () => {
    assert.deepEqual(distribuirDatas(3, d("2026-10-10"), d("2026-10-11")), []);
  });

  test("a semana começa na segunda", () => {
    const semanas = semanasDoMes("2026-10", d("2026-10-06"));
    assert.equal(semanas[0][0].dia.getUTCDay(), 1);
    assert.equal(semanas[0].every((x) => x.dia instanceof Date), true);
    // 1/10/2026 é quinta: a primeira semana começa em 28/09, do mês vizinho.
    assert.equal(paraInput(semanas[0][0].dia), "2026-09-28");
    assert.equal(semanas[0][0].doMes, false);
    assert.equal(semanas[0][3].doMes, true);
  });

  test("toda semana tem sete dias e o mês cabe inteiro", () => {
    for (const mes of ["2026-02", "2026-10", "2027-01"]) {
      const semanas = semanasDoMes(mes, d("2026-10-06"));
      assert.ok(semanas.every((s) => s.length === 7));
      const dias = semanas.flat().filter((x) => x.doMes).length;
      assert.equal(dias, limitesDoMes(mes).fim.getUTCDate());
    }
  });

  test("hoje é marcado uma vez só", () => {
    const semanas = semanasDoMes("2026-10", d("2026-10-06"));
    assert.equal(semanas.flat().filter((x) => x.hoje).length, 1);
  });

  test("o robô publica o que venceu, e só isso", () => {
    const agora = new Date("2026-10-06T08:00:00.000Z");
    assert.equal(venceu("2026-10-06T00:00:00.000Z", agora), true);
    assert.equal(venceu("2026-10-05T00:00:00.000Z", agora), true);
    assert.equal(venceu("2026-10-07T00:00:00.000Z", agora), false);
    assert.equal(venceu(null, agora), false);
    assert.equal(venceu("data inventada", agora), false);
  });

  test("navegação de mês atravessa o ano", () => {
    assert.equal(mesVizinho("2026-12", 1), "2027-01");
    assert.equal(mesVizinho("2026-01", -1), "2025-12");
  });

  test("o que o campo de data devolve vira instante gravável", () => {
    assert.equal(doInput("2026-10-14"), "2026-10-14T00:00:00.000Z");
    assert.equal(doInput("14/10/2026"), null);
    assert.equal(doInput(""), null);
  });
});
