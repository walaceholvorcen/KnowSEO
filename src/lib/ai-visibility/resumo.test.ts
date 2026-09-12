import { test } from "node:test";
import assert from "node:assert/strict";
import {
  perguntasComCitacao,
  perguntasDaRodada,
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
