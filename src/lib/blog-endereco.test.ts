import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  erroNoSlug,
  slugDoNome,
  slugsAposRenomear,
  urlDoArtigo,
  urlPublicaDoBlog,
  versaoDaIdentidade,
} from "./blog-endereco.ts";

describe("URL pública do blog", () => {
  const app = "know-seo.vercel.app";
  const cliente = { subdomain: "testando", custom_domain: "blog.dataknow.es" };

  test("domínio próprio só quando seguro e verificado", () => {
    assert.deepEqual(
      urlPublicaDoBlog({ ...cliente, domain_status: "active" }, app),
      { url: "https://blog.dataknow.es", kind: "custom", verified: true },
    );
  });

  test("pendente ou com erro cai no caminho da plataforma", () => {
    for (const domain_status of ["pending", "error"] as const) {
      assert.deepEqual(urlPublicaDoBlog({ ...cliente, domain_status }, app), {
        url: "https://know-seo.vercel.app/b/testando",
        kind: "path",
        verified: false,
      });
    }
  });

  test("domínio raiz ou .vercel.app nunca é servido, nem marcado ativo", () => {
    for (const custom_domain of ["dataknow.es", "www.dataknow.es", "testando.knowseo.vercel.app"]) {
      const r = urlPublicaDoBlog({ subdomain: "testando", custom_domain, domain_status: "active" }, app);
      assert.equal(r.kind, "path", custom_domain);
    }
  });

  test("sem domínio próprio usa o caminho; localhost em http", () => {
    assert.equal(
      urlPublicaDoBlog({ subdomain: "x", custom_domain: null, domain_status: "active" }, "localhost:3000").url,
      "http://localhost:3000/b/x",
    );
  });

  test("artigo pendura o slug na mesma base", () => {
    assert.equal(
      urlDoArtigo({ ...cliente, domain_status: "pending" }, "meu-artigo", app),
      "https://know-seo.vercel.app/b/testando/meu-artigo",
    );
  });
});

describe("slug do blog", () => {
  test("aceita minúsculas, números e hífen de 3 a 40", () => {
    for (const s of ["dataknow", "clinica-sorriso-2", "abc"]) assert.equal(erroNoSlug(s), null, s);
  });

  test("rejeita curto, longo, acento, maiúscula, hífen na ponta e reservado", () => {
    for (const s of ["ab", "a".repeat(41), "clínica", "Data", "-x-y", "xy-", "com espaço", "b", "admin", "blog", "dashboard"]) {
      assert.notEqual(erroNoSlug(s), null, s);
    }
  });

  test("nome do cliente vira slug sem acento", () => {
    assert.equal(slugDoNome("Clínica São João"), "clinica-sao-joao");
    assert.equal(erroNoSlug(slugDoNome("x".repeat(60))), null);
  });

  test("renomear guarda o antigo e tira o novo (sem laço de 301)", () => {
    assert.deepEqual(slugsAposRenomear([], "testando", "dataknow"), ["testando"]);
    assert.deepEqual(slugsAposRenomear(["dataknow", "testando"], "outro", "dataknow"), ["testando", "outro"]);
    assert.deepEqual(slugsAposRenomear(["a1b"], "a1b", "novo"), ["a1b"]);
  });
});

describe("versão da identidade para a URL da capa", () => {
  const base = { name: "Clínica", theme: { primary_color: "#1b3fcb", logo_url: null } };

  test("estável para a mesma identidade", () => {
    assert.equal(versaoDaIdentidade(base), versaoDaIdentidade({ ...base }));
    assert.match(versaoDaIdentidade(base), /^[a-z0-9]{1,7}$/);
  });

  test("muda quando qualquer peça desenhada na capa muda", () => {
    const v = versaoDaIdentidade(base);
    assert.notEqual(v, versaoDaIdentidade({ ...base, name: "Outra" }));
    assert.notEqual(v, versaoDaIdentidade({ ...base, theme: { ...base.theme, primary_color: "#000000" } }));
    assert.notEqual(v, versaoDaIdentidade({ ...base, theme: { ...base.theme, logo_url: "https://x/logo.png" } }));
    // Secundária e proporção entram no carrossel e na capa como as outras.
    assert.notEqual(v, versaoDaIdentidade({ ...base, theme: { ...base.theme, secondary_color: "#f0b429" } }));
    assert.notEqual(v, versaoDaIdentidade({ ...base, theme: { ...base.theme, logo_ratio: 2.5 } }));
  });
});
