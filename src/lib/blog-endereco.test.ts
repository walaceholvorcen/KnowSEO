import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  enderecoNovoDoBlog,
  erroNoSlug,
  origemDoApp,
  siteDoCliente,
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

describe("blog numa pasta do site do cliente", () => {
  const app = "know-seo.vercel.app";
  const base = {
    subdomain: "dataknow",
    custom_domain: "blog.dataknow.es",
    domain_status: "active" as const,
  };

  test("pasta confirmada vence o subdomínio: é a que mais soma ao SEO", () => {
    assert.deepEqual(
      urlPublicaDoBlog({ ...base, pasta_url: "https://dataknow.es/blog", pasta_status: "active" }, app),
      { url: "https://dataknow.es/blog", kind: "pasta", verified: true },
    );
  });

  test("pasta ainda não confirmada não muda o endereço", () => {
    assert.equal(
      urlPublicaDoBlog({ ...base, pasta_url: "https://dataknow.es/blog", pasta_status: "pending" }, app).kind,
      "custom",
    );
  });

  test("pasta gravada fora do formato é ignorada, nunca vira a raiz do site", () => {
    assert.equal(
      urlPublicaDoBlog({ ...base, pasta_url: "https://dataknow.es/", pasta_status: "active" }, app).kind,
      "custom",
    );
  });

  test("artigo na pasta", () => {
    assert.equal(
      urlDoArtigo({ ...base, pasta_url: "https://dataknow.es/blog", pasta_status: "active" }, "meu-artigo", app),
      "https://dataknow.es/blog/meu-artigo",
    );
  });
});

describe("origem do app e site do cliente", () => {
  test("origem com esquema, http só em localhost", () => {
    assert.equal(origemDoApp("know-seo.vercel.app"), "https://know-seo.vercel.app");
    assert.equal(origemDoApp("localhost:3000"), "http://localhost:3000");
  });

  test("site vem da pasta, depois do subdomínio, depois da marca", () => {
    assert.equal(
      siteDoCliente({ pasta_url: "https://www.dataknow.es/blog", custom_domain: "blog.outro.com", brand_domains: [] }),
      "https://www.dataknow.es",
    );
    assert.equal(
      siteDoCliente({ custom_domain: "blog.cliente.com.br", brand_domains: ["x.com"] }),
      "https://cliente.com.br",
    );
    assert.equal(
      siteDoCliente({ custom_domain: null, brand_domains: ["", "https://www.dataknow.es/"] }),
      "https://www.dataknow.es",
    );
  });

  test("sem nada cadastrado, sem link", () => {
    assert.equal(siteDoCliente({ custom_domain: null, brand_domains: [] }), null);
    assert.equal(siteDoCliente({ custom_domain: null, brand_domains: ["não é domínio"] }), null);
  });
});

describe("endereço novo depois da migração", () => {
  const app = "know-seo.vercel.app";
  const base = {
    subdomain: "dataknow",
    custom_domain: "blog.dataknow.es",
    domain_status: "active" as const,
  };

  test("pasta no ar: o subdomínio antigo manda para ela", () => {
    const blog = { ...base, pasta_url: "https://dataknow.es/blog", pasta_status: "active" as const };
    assert.equal(
      enderecoNovoDoBlog(blog, "https://blog.dataknow.es", app),
      "https://dataknow.es/blog",
    );
  });

  test("barra no fim do endereço servido não engana a comparação", () => {
    const blog = { ...base, pasta_url: "https://dataknow.es/blog", pasta_status: "active" as const };
    assert.equal(
      enderecoNovoDoBlog(blog, "https://blog.dataknow.es/", app),
      "https://dataknow.es/blog",
    );
  });

  test("servido no próprio endereço público não redireciona", () => {
    assert.equal(enderecoNovoDoBlog(base, "https://blog.dataknow.es", app), null);
  });

  test("a prévia da agência nunca redireciona", () => {
    const blog = { ...base, pasta_url: "https://dataknow.es/blog", pasta_status: "active" as const };
    assert.equal(
      enderecoNovoDoBlog(blog, `https://${app}/b/dataknow`, app),
      null,
    );
  });

  test("domínio que deixou de ser verificado não manda a visita para o nosso endereço", () => {
    // Sem pasta e com o domínio fora do ar, o endereço público volta a ser
    // o caminho da plataforma - e mandar o visitante do domínio do cliente
    // para cá é justamente o que não pode acontecer (PROCESSO 63).
    const blog = { ...base, domain_status: "pending" as const };
    assert.equal(enderecoNovoDoBlog(blog, "https://blog.dataknow.es", app), null);
  });

  test("sem domínio próprio não há endereço antigo", () => {
    assert.equal(
      enderecoNovoDoBlog({ ...base, custom_domain: null }, "https://blog.dataknow.es", app),
      null,
    );
  });
});
