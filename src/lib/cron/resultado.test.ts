import { test } from "node:test";
import assert from "node:assert/strict";
import { resultadoDaTarefa } from "./resultado.ts";

const ok = (value: unknown) => ({ status: "fulfilled", value }) as const;

test("auditoria ok não é falha", () => {
  assert.equal(resultadoDaTarefa("auditoria x", ok({ ok: true })), null);
});

test("auditoria {ok:false} é falha com o erro", () => {
  assert.equal(resultadoDaTarefa("auditoria x", ok({ ok: false, erro: "timeout" })), "timeout");
  assert.equal(resultadoDaTarefa("auditoria x", ok({ ok: false })), "sem detalhe");
});

test("Raio X sem falhas não é falha", () => {
  assert.equal(resultadoDaTarefa("Raio X blog", ok({ total: 10, cited: 2, failed: 0, runId: "r" })), null);
});

test("Raio X com todas as perguntas falhando é falha, sem vazar chave", () => {
  const erro = resultadoDaTarefa(
    "Raio X blog",
    ok({ total: 10, cited: 0, failed: 10, runId: "r", // Chave falsa montada por concatenação: escrita inteira, o hook de
    // pre-commit a trataria como segredo de verdade e bloquearia o commit.
    primeiroErro: "401 invalid x-api-key " + ["sk", "ant", "api03", "abcdefghijkl"].join("-") }),
  );
  assert.equal(erro, "Raio X blog: 10 de 10 perguntas falharam (401 invalid x-api-key [chave omitida])");
});

test("rejeição é falha com a mensagem", () => {
  assert.equal(resultadoDaTarefa("x", { status: "rejected", reason: new Error("boom") }), "boom");
});
