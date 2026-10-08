import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  BLOGS_POR_CONTA,
  cotaDeArtigos,
  MENSAGEM_LIMITE_DE_BLOGS,
  mensagemDeCotaCheia,
  podeAdicionarBlog,
  textoDaCota,
} from "./plano.ts";

const AGORA = new Date("2026-10-07T21:00:00.000Z");

describe("cota de artigos do plano", () => {
  test("plano pago conta do dia 1 do mês", () => {
    const c = cotaDeArtigos({ plan: "pro", artigos_por_mes: 30 }, AGORA);
    assert.equal(c.limite, 30);
    assert.equal(c.janela, "mes");
    assert.equal(c.desde?.toISOString(), "2026-10-01T00:00:00.000Z");
  });

  test("prova grátis são 5 artigos no total, sem janela", () => {
    const c = cotaDeArtigos({ plan: "free", artigos_por_mes: null }, AGORA);
    assert.equal(c.limite, 5);
    assert.equal(c.janela, "prova");
    assert.equal(c.desde, null);
  });

  test("coluna ainda não criada não barra ninguém", () => {
    // Entre o deploy e o SQL rodar, `artigos_por_mes` nem chega no objeto.
    // Tratar isso como prova de 5 tiraria o botão de escrever de quem já
    // tem 17 artigos no banco.
    const c = cotaDeArtigos({ plan: "free" });
    assert.equal(c.indefinida, true);
    assert.equal(c.limite, Infinity);
  });

  test("na dúvida, cai na prova - nunca em ilimitado", () => {
    // Deploy antes da migração, valor inesperado na coluna, plano pago sem
    // degrau contratado: todos recebem o limite menor. Errar para o lado de
    // cobrar a menos custa dinheiro; errar para o outro entrega de graça.
    for (const w of [
      { artigos_por_mes: null },
      { plan: null, artigos_por_mes: null },
      { plan: "pro", artigos_por_mes: null },
      { plan: "pro", artigos_por_mes: 0 },
      { plan: "pro", artigos_por_mes: -3 },
      { plan: "enterprise", artigos_por_mes: 500 },
    ]) {
      assert.equal(cotaDeArtigos(w, AGORA).limite, 5, JSON.stringify(w));
    }
  });

  test("a virada de ano não quebra o começo do mês", () => {
    const c = cotaDeArtigos(
      { plan: "pro", artigos_por_mes: 12 },
      new Date("2027-01-03T10:00:00.000Z"),
    );
    assert.equal(c.desde?.toISOString(), "2027-01-01T00:00:00.000Z");
  });

  test("o contador fala a língua da janela", () => {
    assert.equal(
      textoDaCota(8, cotaDeArtigos({ plan: "pro", artigos_por_mes: 30 }, AGORA)),
      "8 de 30 artigos este mês",
    );
    assert.equal(
      textoDaCota(3, cotaDeArtigos({ plan: "free", artigos_por_mes: null }, AGORA)),
      "3 de 5 artigos da prova",
    );
  });

  test("cota cheia tem saída diferente em cada caso", () => {
    const mes = mensagemDeCotaCheia(cotaDeArtigos({ plan: "pro", artigos_por_mes: 4 }, AGORA));
    assert.match(mes, /volta no dia 1/);
    const prova = mensagemDeCotaCheia(cotaDeArtigos({ plan: "free", artigos_por_mes: null }, AGORA));
    assert.match(prova, /prova grátis/);
    assert.match(prova, /ranknow\.es\/planes/);
  });
});

describe("limite de blogs do plano", () => {
  test("conta vazia pode criar o primeiro", () => {
    assert.equal(podeAdicionarBlog(0), true);
  });

  test("com o limite atingido, não cria mais", () => {
    assert.equal(podeAdicionarBlog(BLOGS_POR_CONTA), false);
  });

  test("conta que já passou do limite também não cria", () => {
    // Acontece com quem criou antes da trava existir: o que já está no ar
    // continua, mas não nasce mais nenhum.
    assert.equal(podeAdicionarBlog(BLOGS_POR_CONTA + 3), false);
  });

  test("a mensagem manda para onde resolve", () => {
    assert.match(MENSAGEM_LIMITE_DE_BLOGS, /ranknow\.es\/contacto/);
  });
});
