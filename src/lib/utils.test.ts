import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { htmlParaTexto } from "./utils.ts";

describe("HTML vira texto corrido", () => {
  test("tags de bloco viram quebra de linha, não somem coladas", () => {
    assert.equal(
      htmlParaTexto("<p>Primeiro.</p><p>Segundo.</p>"),
      "Primeiro.\nSegundo.",
    );
  });

  test("tags inline somem sem deixar as palavras coladas", () => {
    // Sem espaço no lugar da tag, "forte texto" viraria "fortetexto".
    assert.equal(
      htmlParaTexto("<p>Isto é <strong>forte</strong> texto.</p>"),
      "Isto é forte texto.",
    );
  });

  test("entidades HTML comuns são decodificadas", () => {
    assert.equal(
      htmlParaTexto("<p>Curso &amp; Consultoria &quot;Pro&quot;</p>"),
      'Curso & Consultoria "Pro"',
    );
  });

  test("script e style são descartados, não viram texto", () => {
    const html = "<style>.x{color:red}</style><p>Conteúdo real.</p>";
    assert.equal(htmlParaTexto(html), "Conteúdo real.");
  });

  test("lista vira uma linha por item", () => {
    assert.equal(
      htmlParaTexto("<ul><li>Um</li><li>Dois</li></ul>"),
      "Um\nDois",
    );
  });

  test("linhas em branco em excesso colapsam", () => {
    assert.equal(
      htmlParaTexto("<p>A</p>\n\n\n\n<p>B</p>"),
      "A\nB",
    );
  });

  test("string vazia não quebra", () => {
    assert.equal(htmlParaTexto(""), "");
  });
});
