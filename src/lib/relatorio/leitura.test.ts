import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { leituraDoPeriodo, type Contexto } from "./leitura.ts";

const BASE: Contexto = {
  dias: 28,
  texto: "nos últimos 28 dias",
  visitas: 6,
  conversas: 0,
  taxa: 0,
  semBase: true,
  visitasAntes: 0,
  conversasAntes: 0,
  publicados: 0,
  noAr: 2,
  melhor: null,
  auditoria: null,
  geo: null,
};

describe("leitura do período", () => {
  test("pouco volume sem conversa não culpa o botão", () => {
    const l = leituraDoPeriodo(BASE);
    assert.match(l.paragrafos.join(" "), /ainda não dá para culpar o botão/);
    assert.equal(l.proximoPasso.href, "/strategy");
  });

  test("volume suficiente sem conversa culpa a oferta, e é esse o próximo passo", () => {
    const l = leituraDoPeriodo({ ...BASE, visitas: 120, semBase: false, visitasAntes: 100 });
    assert.match(l.paragrafos.join(" "), /não é audiência, é a oferta/);
    assert.equal(l.proximoPasso.href, "/settings/blog");
  });

  test("site com nota baixa vem antes de qualquer outra recomendação", () => {
    const l = leituraDoPeriodo({
      ...BASE,
      visitas: 200,
      auditoria: { google: 55, ia: 88, googleAntes: 40 },
    });
    assert.equal(l.proximoPasso.href, "/audit");
    assert.match(l.paragrafos.join(" "), /55 de 100 no Google \(\+15 desde a auditoria anterior\)/);
  });

  test("sem artigo no ar, o passo é publicar o primeiro", () => {
    const l = leituraDoPeriodo({ ...BASE, visitas: 0, noAr: 0 });
    assert.equal(l.proximoPasso.href, "/strategy");
    assert.match(l.paragrafos.join(" "), /Nenhum artigo publicado até agora/);
  });

  test("IA sem citar a marca vira o próximo passo quando o resto está de pé", () => {
    const l = leituraDoPeriodo({
      ...BASE,
      visitas: 20,
      conversas: 2,
      taxa: 10,
      auditoria: { google: 92, ia: 88, googleAntes: 92 },
      geo: { citadas: 0, perguntas: 10, rival: "concorrente.es" },
    });
    assert.equal(l.proximoPasso.href, "/visibility");
    assert.match(l.paragrafos.join(" "), /no lugar dela a IA cita concorrente\.es/);
  });

  test("queda é dita com o número dos dois períodos", () => {
    const l = leituraDoPeriodo({ ...BASE, visitas: 40, semBase: false, visitasAntes: 100 });
    assert.match(l.paragrafos[0], /caíram de 100 para 40 \(−60%\)/);
  });

  test("artigo publicado no período aparece na explicação", () => {
    const l = leituraDoPeriodo({ ...BASE, publicados: 3, noAr: 5 });
    assert.match(l.paragrafos[1], /3 artigos foram ao ar/);
  });
});
