import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { registrosPendentes } from "./vercel.ts";

describe("o que falta no DNS do cliente", () => {
  test("desafio de posse vem antes do apontamento", () => {
    const r = registrosPendentes(
      "blog.cliente.com",
      { verification: [{ type: "TXT", domain: "_vercel.cliente.com", value: "vc-domain-verify=abc" }] },
      { misconfigured: true },
    );
    assert.deepEqual(r, [
      { tipo: "TXT", nome: "_vercel.cliente.com", valor: "vc-domain-verify=abc" },
    ]);
  });

  test("usa o destino que a Vercel recomenda para aquele domínio", () => {
    // Formato real da API: lista ordenada por rank, com ponto no fim.
    const config = {
      recommendedCNAME: [
        { rank: 1, value: "d433667938f5b093.vercel-dns-017.com." },
        { rank: 2, value: "cname.vercel-dns.com." },
      ],
    };
    assert.deepEqual(registrosPendentes("blog.cliente.com", {}, config), [
      { tipo: "CNAME", nome: "blog", valor: "d433667938f5b093.vercel-dns-017.com" },
    ]);
  });

  test("sem recomendação, o destino de sempre", () => {
    assert.deepEqual(registrosPendentes("blog.cliente.com", {}, {}), [
      { tipo: "CNAME", nome: "blog", valor: "cname.vercel-dns.com" },
    ]);
  });
});
