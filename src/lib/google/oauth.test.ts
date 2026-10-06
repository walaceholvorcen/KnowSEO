import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { conexaoGoogleMorreu } from "./oauth.ts";

// O corpo real que o Google devolve quando o refresh_token não vale mais.
const INVALID_GRANT =
  '{"error": "invalid_grant", "error_description": "Token has been expired or revoked."}';

describe("conexão com o Google morreu", () => {
  test("invalid_grant é a única resposta que mata a conexão", () => {
    assert.equal(conexaoGoogleMorreu(400, INVALID_GRANT), true);
  });

  test("soluço do servidor do Google não manda ninguém reconectar", () => {
    // Marcar como morta aqui faria a tela pedir reconexão por uma falha de
    // segundos - e ensinaria a agência a ignorar o aviso.
    for (const status of [500, 502, 503, 504]) {
      assert.equal(conexaoGoogleMorreu(status, "internal error"), false);
    }
  });

  test("outro erro 400 não é conexão morta", () => {
    // invalid_client é credencial do app errada: reconectar não resolve.
    assert.equal(
      conexaoGoogleMorreu(400, '{"error": "invalid_client"}'),
      false,
    );
  });

  test("corpo vazio não vira diagnóstico", () => {
    assert.equal(conexaoGoogleMorreu(400, ""), false);
  });
});
