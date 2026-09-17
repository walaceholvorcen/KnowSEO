import { test } from "node:test";
import assert from "node:assert/strict";
import { formatarData, fusoDoPais } from "./datas.ts";

test("00:35 UTC de 17/09 ainda é 16/09 em São Paulo", () => {
  assert.equal(formatarData("2026-09-17T00:35:00Z", "America/Sao_Paulo", "curta"), "16/09");
  assert.equal(formatarData("2026-09-17T00:35:00Z", "UTC", "curta"), "17/09");
});

test("estilo longo igual ao formatDate antigo", () => {
  assert.match(
    formatarData(new Date("2026-09-17T00:35:00Z"), "America/Sao_Paulo", "longa"),
    /^16 de set\.? de 2026$/,
  );
});

test("fuso inválido cai em UTC em vez de quebrar", () => {
  assert.equal(formatarData("2026-09-17T00:35:00Z", "Lua/Base", "curta"), "17/09");
});

test("blog: fuso só pelo domínio de país", () => {
  assert.equal(fusoDoPais({ chave: "es", origem: "dominio" }), "Europe/Madrid");
  assert.equal(fusoDoPais({ chave: "es", origem: "idioma" }), "UTC");
});
