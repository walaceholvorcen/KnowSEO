import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mensagemDeFalhaDaIA } from "./ai-config.ts";

const GENERICA = "Tente de novo em instantes.";

// O corpo real que a Anthropic devolveu em 07/10, quando o saldo acabou.
const SEM_SALDO = new Error(
  '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}',
);

describe("mensagem de falha da IA", () => {
  test("conta sem saldo diz isso, e não manda tentar de novo", () => {
    const m = mensagemDeFalhaDaIA(SEM_SALDO, GENERICA);
    assert.match(m, /sem saldo/);
    assert.match(m, /console\.anthropic\.com/);
    assert.ok(!m.includes(GENERICA));
  });

  test("chave recusada aponta para a chave, não para o saldo", () => {
    const m = mensagemDeFalhaDaIA(new Error("401 authentication_error"), GENERICA);
    assert.match(m, /chave/);
  });

  test("excesso de pedidos no minuto manda esperar", () => {
    assert.match(
      mensagemDeFalhaDaIA(new Error("429 rate limit exceeded"), GENERICA),
      /Espere/,
    );
  });

  test("falha desconhecida fica com a frase genérica", () => {
    // Para falha passageira, "tente de novo" é a orientação certa.
    assert.equal(mensagemDeFalhaDaIA(new Error("socket hang up"), GENERICA), GENERICA);
    assert.equal(mensagemDeFalhaDaIA(null, GENERICA), GENERICA);
    assert.equal(mensagemDeFalhaDaIA("", GENERICA), GENERICA);
  });
});
