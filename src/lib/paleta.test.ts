import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { paletaDoLogo } from "./paleta.ts";

/** Monta pixels RGBA repetindo cada cor a quantidade pedida. */
function pixels(...partes: [[number, number, number, number], number][]) {
  const saida: number[] = [];
  for (const [cor, vezes] of partes) {
    for (let i = 0; i < vezes; i++) saida.push(...cor);
  }
  return saida;
}

describe("paleta do logo", () => {
  test("fundo branco e transparente não viram cor da marca", () => {
    const p = paletaDoLogo(
      pixels(
        [[255, 255, 255, 255], 800],
        [[0, 0, 0, 0], 800],
        [[27, 63, 203, 255], 200],
      ),
      1,
    );
    assert.equal(p?.principal, "#1b3fcb");
  });

  test("a cor com saturação vence o preto do texto", () => {
    const p = paletaDoLogo(
      pixels([[20, 20, 20, 255], 700], [[214, 40, 40, 255], 300]),
      1,
    );
    assert.equal(p?.principal, "#d62828");
  });

  test("tom colorido raro demais não rouba o lugar do dominante", () => {
    const p = paletaDoLogo(
      pixels([[20, 20, 20, 255], 990], [[214, 40, 40, 255], 10]),
      1,
    );
    assert.equal(p?.principal, "#141414");
  });

  test("logo de uma cor só ganha secundária escurecida, não igual", () => {
    const p = paletaDoLogo(pixels([[27, 63, 203, 255], 500]), 1);
    assert.equal(p?.principal, "#1b3fcb");
    assert.notEqual(p?.secundaria, p?.principal);
    assert.equal(p?.secundaria, "#0f2370");
  });

  test("duas cores distintas viram principal e secundária", () => {
    const p = paletaDoLogo(
      pixels([[27, 63, 203, 255], 600], [[240, 180, 20, 255], 400]),
      1,
    );
    assert.equal(p?.principal, "#1b3fcb");
    assert.equal(p?.secundaria, "#f0b414");
  });

  test("imagem sem pixel aproveitável devolve nada", () => {
    assert.equal(paletaDoLogo(pixels([[255, 255, 255, 255], 50]), 1), null);
  });
});
