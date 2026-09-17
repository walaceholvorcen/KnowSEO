import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ehDominioRaiz, isSafeCustomDomain } from "./dominio.ts";

describe("domínio raiz", () => {
  test("endereço principal do site é raiz", () => {
    assert.equal(ehDominioRaiz("dataknow.es"), true);
    assert.equal(ehDominioRaiz("cliente.com.br"), true);
    assert.equal(ehDominioRaiz("cliente.co.uk"), true);
  });

  test("subdomínio não é raiz", () => {
    assert.equal(ehDominioRaiz("blog.dataknow.es"), false);
    assert.equal(ehDominioRaiz("blog.cliente.com.br"), false);
  });
});

describe("domínio próprio seguro", () => {
  test("rejeita apex, www, .vercel.app, IP e host sem ponto", () => {
    for (const d of [
      "dataknow.es", "www.dataknow.es", "x.knowseo.vercel.app", "know-seo.vercel.app",
      "cliente.com.br", "www.blog.cliente.com", "192.168.0.1", "localhost", "", "https://blog.x.com",
    ]) {
      assert.equal(isSafeCustomDomain(d), false, d);
    }
  });

  test("aceita subdomínio de 3º nível ou mais", () => {
    for (const d of ["blog.dataknow.es", "blog.cliente.com.br", "Blog.Dataknow.es."]) {
      assert.equal(isSafeCustomDomain(d), true, d);
    }
  });
});
