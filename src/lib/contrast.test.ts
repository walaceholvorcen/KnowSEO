import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  contrastRatio,
  parseHex,
  serveComoTexto,
  destacaDoFundo,
  textoSobre,
} from "./contrast.ts";

const PAPEL = "#f3f4f1";
const TINTA = "#15191c";

describe("leitura de hex", () => {
  test("aceita forma curta e longa, com e sem #", () => {
    assert.deepEqual(parseHex("#fff"), [255, 255, 255]);
    assert.deepEqual(parseHex("000000"), [0, 0, 0]);
    assert.deepEqual(parseHex("#1B3FCB"), [27, 63, 203]);
  });

  test("recusa lixo em vez de fingir que entendeu", () => {
    assert.equal(parseHex(""), null);
    assert.equal(parseHex("azul"), null);
    assert.equal(parseHex("#12345"), null);
    assert.equal(parseHex("#gggggg"), null);
  });
});

describe("razão de contraste", () => {
  test("preto contra branco é o máximo (21:1)", () => {
    assert.ok(Math.abs(contrastRatio("#000000", "#ffffff") - 21) < 0.01);
  });

  test("cor contra ela mesma é 1", () => {
    assert.ok(Math.abs(contrastRatio("#1b3fcb", "#1b3fcb") - 1) < 0.001);
  });

  test("ordem dos argumentos não muda o resultado", () => {
    assert.equal(
      contrastRatio("#1b3fcb", PAPEL).toFixed(4),
      contrastRatio(PAPEL, "#1b3fcb").toFixed(4),
    );
  });
});

describe("texto sobre a cor da marca", () => {
  // O caso que motivou tudo: amarelo com texto branco era ilegível e
  // ninguém no código percebia.
  test("cor clara recebe texto escuro", () => {
    assert.equal(textoSobre("#ffe600"), TINTA);
    assert.equal(textoSobre("#a3e635"), TINTA);
    assert.equal(textoSobre("#ffffff"), TINTA);
  });

  test("cor escura recebe texto claro", () => {
    assert.equal(textoSobre("#1b3fcb"), PAPEL);
    assert.equal(textoSobre("#15191c"), PAPEL);
    assert.equal(textoSobre("#7c3aed"), PAPEL);
  });

  test("hex inválido cai no lado legível, não some", () => {
    assert.equal(textoSobre("nao-e-cor"), TINTA);
  });

  test("a escolha sempre passa do mínimo de texto grande", () => {
    for (const cor of ["#ffe600", "#1b3fcb", "#808080", "#a3e635", "#15191c"]) {
      assert.ok(
        contrastRatio(cor, textoSobre(cor)) >= 3,
        `${cor} ficou abaixo do mínimo`,
      );
    }
  });
});

describe("cor usada como texto sobre papel", () => {
  test("cobalto serve, amarelo não", () => {
    assert.equal(serveComoTexto("#1b3fcb"), true);
    assert.equal(serveComoTexto("#ffe600"), false);
  });
});

describe("aviso no seletor de cor", () => {
  test("cor clara demais some no fundo do blog", () => {
    assert.equal(destacaDoFundo("#ffe600"), false);
    assert.equal(destacaDoFundo("#ffffff"), false);
  });

  test("cores que funcionam como bloco passam", () => {
    assert.equal(destacaDoFundo("#1b3fcb"), true);
    assert.equal(destacaDoFundo("#15191c"), true);
    assert.equal(destacaDoFundo("#8a8f8a"), true);
  });
});
