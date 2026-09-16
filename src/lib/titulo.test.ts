import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { tituloDaPagina, tituloDoCaminho } from "./titulo.ts";

const HOME = "DataKnow | Agencia de Performance Digital";
const spa = (extra = "") =>
  `<html><head><title>${HOME}</title>${extra}</head><body></body></html>`;

describe("tituloDaPagina", () => {
  test("página com título próprio usa o <title>", () => {
    const html = `<html><head><title> Metodología T.I.A. &amp; datos | DataKnow </title></head></html>`;
    assert.equal(
      tituloDaPagina(html, "https://dataknow.es/metodologia", HOME),
      "Metodología T.I.A. & datos | DataKnow",
    );
  });

  test("home devolve o próprio título mesmo sem referência", () => {
    assert.equal(tituloDaPagina(spa(), "https://dataknow.es/", null), HOME);
  });

  test("SPA: título igual ao da home cai para og:title", () => {
    const html = spa(`<meta property="og:title" content="Contacto | DataKnow">`);
    assert.equal(tituloDaPagina(html, "https://dataknow.es/contacto", HOME), "Contacto | DataKnow");
  });

  test("SPA: sem og:title próprio, usa o h1", () => {
    const html = `<html><head><title>${HOME}</title></head><body><h1>Sobre <em>nosotros</em></h1></body></html>`;
    assert.equal(tituloDaPagina(html, "https://dataknow.es/sobre-nosotros", HOME), "Sobre nosotros");
  });

  test("SPA: tudo igual à home, deriva do caminho em vez de repetir", () => {
    const html = spa(`<meta property="og:title" content="${HOME}">`) ;
    assert.equal(tituloDaPagina(html, "https://dataknow.es/metodologia", HOME), "Metodologia");
    assert.equal(
      tituloDaPagina(html, "https://dataknow.es/gestion-de-performance/", HOME),
      "Gestion de performance",
    );
  });

  test("comparação com a home ignora caixa", () => {
    const html = `<html><head><title>${HOME.toUpperCase()}</title></head></html>`;
    assert.equal(tituloDaPagina(html, "https://dataknow.es/contacto", HOME), "Contacto");
  });

  test("home sem <title> nenhum devolve null", () => {
    assert.equal(tituloDaPagina("<html></html>", "https://dataknow.es/", null), null);
  });
});

describe("tituloDoCaminho", () => {
  test("raiz não tem título derivável", () => {
    assert.equal(tituloDoCaminho("https://dataknow.es/"), null);
  });
  test("tira extensão e decodifica", () => {
    assert.equal(tituloDoCaminho("https://x.es/blog/qu%C3%A9-es-seo.html"), "Qué es seo");
  });
});
