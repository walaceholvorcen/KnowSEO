import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { traduzErroAuth } from "./traduz-erro.ts";

describe("erro de login em português", () => {
  test("servidor fora do ar não vira '<none>' na tela", () => {
    // O que a biblioteca do Supabase devolveu num 522 real.
    assert.equal(
      traduzErroAuth("<none>"),
      "O servidor de contas não respondeu. Tente de novo em alguns segundos.",
    );
  });

  test("senha errada continua dizendo senha errada", () => {
    assert.equal(traduzErroAuth("Invalid login credentials"), "Email ou senha incorretos.");
  });

  test("mensagem desconhecida passa direto", () => {
    assert.equal(traduzErroAuth("algo novo do servidor"), "algo novo do servidor");
  });
});
