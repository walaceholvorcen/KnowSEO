import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ehDominioRaiz } from "./dominio.ts";

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
