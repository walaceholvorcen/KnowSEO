import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  perguntasComCitacao,
  perguntasDaRodada,
  pareceCortada,
  placarPorMotor,
} from "./resumo.ts";

const c = (query_id: string, provider: string, cited: boolean) => ({
  query_id,
  provider,
  cited,
});

test("placar separa cada motor", () => {
  const p = placarPorMotor([
    c("q1", "chatgpt", true),
    c("q2", "chatgpt", false),
    c("q1", "claude", false),
    c("q2", "claude", false),
  ]);
  assert.deepEqual(p, [
    { provider: "chatgpt", citadas: 1, total: 2 },
    { provider: "claude", citadas: 0, total: 2 },
  ]);
});

test("placar sai na ordem de uso: ChatGPT, Gemini, Perplexity, Claude", () => {
  const p = placarPorMotor([
    c("q1", "claude", false),
    c("q1", "perplexity", false),
    c("q1", "chatgpt", false),
  ]);
  assert.deepEqual(p.map((x) => x.provider), ["chatgpt", "perplexity", "claude"]);
});

test("motor desconhecido vai para o fim sem quebrar", () => {
  const p = placarPorMotor([c("q1", "copilot", true), c("q1", "claude", false)]);
  assert.deepEqual(p.map((x) => x.provider), ["claude", "copilot"]);
});

test("pergunta conta como citada se UM motor citou", () => {
  const citadas = perguntasComCitacao([
    c("q1", "chatgpt", false),
    c("q1", "perplexity", true),
    c("q2", "chatgpt", false),
  ]);
  assert.deepEqual([...citadas], ["q1"]);
});

test("perguntas da rodada não duplicam por motor", () => {
  const todas = perguntasDaRodada([
    c("q1", "chatgpt", false),
    c("q1", "claude", false),
    c("q2", "claude", false),
  ]);
  assert.equal(todas.size, 2);
});

test("pareceCortada: termina em palavra sem pontuação", () => {
  assert.equal(pareceCortada("A melhor agência é a Clínica Madr"), true);
  assert.equal(pareceCortada("Custa cerca de 300"), true);
  assert.equal(pareceCortada("Frase completa.\n"), false);
  assert.equal(pareceCortada("Quer saber mais?"), false);
  assert.equal(pareceCortada("Veja (fonte)"), false);
  assert.equal(pareceCortada("Termina em **negrito.**"), false);
  assert.equal(pareceCortada("Diz «assim»"), false);
  assert.equal(pareceCortada(""), false);
  assert.equal(pareceCortada(null), false);
});

import { visibilidade, dentroDaMargem, paresParaDesempate } from "./resumo.ts";

describe("visibilidade com margem de erro", () => {
  test("20% em 10 respostas cobre de 6% a 51%", () => {
    assert.deepEqual(visibilidade(2, 10), { pct: 20, de: 6, ate: 51, n: 10 });
  });

  test("zero citações não dá margem negativa", () => {
    const v = visibilidade(0, 20)!;
    assert.equal(v.de, 0);
    assert.equal(v.pct, 0);
    assert.ok(v.ate > 0 && v.ate < 20);
  });

  test("sem amostra não há número", () => {
    assert.equal(visibilidade(0, 0), null);
  });

  test("de 20% para 30% com 20 respostas cada é acaso possível", () => {
    assert.ok(dentroDaMargem(visibilidade(4, 20)!, visibilidade(6, 20)!));
  });

  test("de 0% para 70% com 20 respostas é mudança de verdade", () => {
    assert.ok(!dentroDaMargem(visibilidade(0, 20)!, visibilidade(14, 20)!));
  });
});

describe("terceira resposta só onde as duas discordam", () => {
  test("desempata só o par que divergiu", () => {
    const pares = paresParaDesempate([
      { query_id: "a", provider: "claude", cited: true },
      { query_id: "a", provider: "claude", cited: false },
      { query_id: "b", provider: "claude", cited: false },
      { query_id: "b", provider: "claude", cited: false },
      { query_id: "c", provider: "claude", cited: true },
      { query_id: "c", provider: "claude", cited: true },
    ]);
    assert.deepEqual(pares, [{ query_id: "a", provider: "claude" }]);
  });
});
