import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { tituloDaPagina as ler, tituloDoCaminho, titulosSuspeitos } from "./titulo.ts";

const tituloDaPagina = (...a: Parameters<typeof ler>) => ler(...a).titulo;

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

describe("suspeita", () => {
  test("fallback pelo caminho marca suspeita; título próprio não", () => {
    assert.deepEqual(ler(spa(), "https://dataknow.es/metodologia", HOME), {
      titulo: "Metodologia",
      suspeita: true,
    });
    assert.equal(ler(spa(), "https://dataknow.es/", null).suspeita, false);
    const proprio = `<html><head><title>Contacto</title></head></html>`;
    assert.equal(ler(proprio, "https://dataknow.es/contacto", HOME).suspeita, false);
  });

  test("titulosSuspeitos: título repetido marca as internas, não a home", () => {
    const s = titulosSuspeitos([
      { id: "h", url: "https://dataknow.es/", title: HOME },
      { id: "a", url: "https://dataknow.es/metodologia", title: HOME },
      { id: "b", url: "https://dataknow.es/contacto", title: ` ${HOME.toUpperCase()}` },
      { id: "c", url: "https://dataknow.es/sobre", title: "Sobre nosotros" },
      { id: "d", url: "https://dataknow.es/x", title: null },
      { id: "e", url: "https://dataknow.es/y", title: null },
    ]);
    assert.deepEqual([...s].sort(), ["a", "b"]);
  });

  test("titulosSuspeitos: repetidas sem a home no mapa também contam", () => {
    const s = titulosSuspeitos([
      { id: "a", url: "https://x.es/a", title: "Igual" },
      { id: "b", url: "https://x.es/b", title: "Igual" },
    ]);
    assert.equal(s.size, 2);
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
