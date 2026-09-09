import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { FASES, faseAtual, mesesDesde } from "./fases.ts";

const em = (iso: string) => new Date(iso);

describe("meses completos desde a primeira publicação", () => {
  test("mesmo dia é mês zero", () => {
    assert.equal(mesesDesde("2026-01-10T12:00:00Z", em("2026-01-10T23:00:00Z")), 0);
  });

  test("o mês só fecha na data equivalente, não aos 30 dias", () => {
    // Publicou em 10 de janeiro: em 9 de fevereiro ainda é mês 0.
    assert.equal(mesesDesde("2026-01-10T12:00:00Z", em("2026-02-09T12:00:00Z")), 0);
    assert.equal(mesesDesde("2026-01-10T12:00:00Z", em("2026-02-10T12:00:00Z")), 1);
  });

  test("atravessa a virada do ano", () => {
    assert.equal(mesesDesde("2025-11-05T00:00:00Z", em("2026-02-05T00:00:00Z")), 3);
  });

  test("data futura ou inválida não devolve número negativo", () => {
    assert.equal(mesesDesde("2027-01-01T00:00:00Z", em("2026-01-01T00:00:00Z")), 0);
    assert.equal(mesesDesde("nao e data", em("2026-01-01T00:00:00Z")), 0);
  });
});

describe("fase esperada hoje", () => {
  test("sem nada publicado não existe fase", () => {
    // Não é "fase zero": é ausência de contagem. Mostrar a régua aqui
    // sugeriria progresso que não começou.
    assert.equal(faseAtual(null), -1);
  });

  test("recém-publicado fica na primeira fase", () => {
    assert.equal(faseAtual("2026-01-10T00:00:00Z", em("2026-01-15T00:00:00Z")), 0);
  });

  test("cada marco move a fase", () => {
    const inicio = "2026-01-10T00:00:00Z";
    assert.equal(faseAtual(inicio, em("2026-02-10T00:00:00Z")), 1);
    assert.equal(faseAtual(inicio, em("2026-03-10T00:00:00Z")), 2);
    // Mês 3 não tem marco próprio: continua na fase do mês 2.
    assert.equal(faseAtual(inicio, em("2026-04-10T00:00:00Z")), 2);
    assert.equal(faseAtual(inicio, em("2026-05-10T00:00:00Z")), 3);
    assert.equal(faseAtual(inicio, em("2026-07-10T00:00:00Z")), 4);
  });

  test("blog antigo trava na última fase, não estoura o índice", () => {
    assert.equal(
      faseAtual("2020-01-10T00:00:00Z", em("2026-01-10T00:00:00Z")),
      FASES.length - 1,
    );
  });
});

describe("conteúdo das fases", () => {
  test("os marcos estão em ordem crescente", () => {
    for (let i = 1; i < FASES.length; i++) {
      assert.ok(
        FASES[i].mes > FASES[i - 1].mes,
        `fase ${FASES[i].chave} não vem depois da anterior`,
      );
    }
  });

  test("toda fase explica o que acontece nela", () => {
    for (const fase of FASES) {
      assert.ok(fase.nome.length > 2);
      assert.ok(
        fase.descricao.length > 40,
        `fase ${fase.chave} sem explicação de verdade`,
      );
    }
  });
});
