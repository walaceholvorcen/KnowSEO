import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { perguntasFrequentes } from "./faq.ts";

const ARTIGO = `<p>Intro</p>
<h2>¿Cuánto cuesta?</h2><p>Depende.</p>
<h2>Preguntas frecuentes</h2>
<h3>¿Sirve para pymes?</h3><p>Sí, con <strong>presupuesto</strong> &amp; foco.</p>
<h3>¿Cuánto tarda?</h3><p>Tres meses.</p><p>A veces más.</p>
<h2>Conclusión</h2><p>Fin.</p>`;

describe("perguntas frequentes do artigo", () => {
  test("lê os pares da seção e para no próximo H2", () => {
    assert.deepEqual(perguntasFrequentes(ARTIGO), [
      { pergunta: "¿Sirve para pymes?", resposta: "Sí, con presupuesto & foco." },
      { pergunta: "¿Cuánto tarda?", resposta: "Tres meses. A veces más." },
    ]);
  });

  test("H2 em pergunta fora da seção não vira FAQ", () => {
    assert.deepEqual(perguntasFrequentes(`<h2>¿Cuánto cuesta?</h2><h3>¿A?</h3><p>a</p><h3>¿B?</h3><p>b</p>`), []);
  });

  test("português, inglês e seção no fim do texto", () => {
    const pt = `<h2>Perguntas frequentes</h2><h3>A?</h3><p>a</p><h3>B?</h3><p>b</p>`;
    assert.equal(perguntasFrequentes(pt).length, 2);
    assert.equal(perguntasFrequentes(pt.replace("Perguntas frequentes", "Frequently asked questions")).length, 2);
  });

  test("uma pergunta só não basta para o schema", () => {
    assert.deepEqual(perguntasFrequentes(`<h2>Preguntas frecuentes</h2><h3>A?</h3><p>a</p>`), []);
    assert.deepEqual(perguntasFrequentes(null), []);
  });
});
