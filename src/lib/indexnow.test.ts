import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chaveIndexNow, pedidoIndexNow } from "./indexnow.ts";

const base = {
  id: "3ee6ce8e-1ac4-4f8e-81cf-ce122ae889da",
  subdomain: "cliente",
  custom_domain: "blog.cliente.com",
  domain_status: "active",
  pasta_url: null,
  pasta_status: null,
};

describe("aviso ao Bing (IndexNow)", () => {
  test("chave estável, 32 caracteres hexadecimais, uma por blog", () => {
    assert.match(chaveIndexNow(base.id), /^[0-9a-f]{32}$/);
    assert.equal(chaveIndexNow(base.id), chaveIndexNow(base.id));
    assert.notEqual(chaveIndexNow(base.id), chaveIndexNow("outro"));
  });

  test("domínio do cliente: avisa a home e os artigos, com a chave no próprio blog", () => {
    const p = pedidoIndexNow(base as never, ["um-artigo"])!;
    assert.equal(p.host, "blog.cliente.com");
    assert.equal(p.keyLocation, "https://blog.cliente.com/indexnow.txt");
    assert.deepEqual(p.urlList, ["https://blog.cliente.com", "https://blog.cliente.com/um-artigo"]);
  });

  test("blog na pasta: a chave mora dentro da pasta", () => {
    const p = pedidoIndexNow(
      { ...base, pasta_url: "https://cliente.com/blog", pasta_status: "active" } as never,
      ["x"],
    )!;
    assert.equal(p.host, "cliente.com");
    assert.equal(p.keyLocation, "https://cliente.com/blog/indexnow.txt");
  });

  test("blog ainda no endereço da plataforma não é avisado", () => {
    assert.equal(pedidoIndexNow({ ...base, domain_status: "pending" } as never, ["x"]), null);
  });
});
