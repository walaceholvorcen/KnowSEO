import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { enderecoDoBlog, versaoDaIdentidade } from "./blog-endereco.ts";

describe("endereço servido do blog", () => {
  test("domínio próprio só quando o DNS foi confirmado", () => {
    assert.equal(
      enderecoDoBlog(
        { subdomain: "cliente", custom_domain: "blog.cliente.com", domain_status: "active" },
        "knowseo.app",
      ),
      "blog.cliente.com",
    );
  });

  test("pendente ou com erro cai no subdomínio", () => {
    for (const domain_status of ["pending", "error"] as const) {
      assert.equal(
        enderecoDoBlog(
          { subdomain: "cliente", custom_domain: "blog.cliente.com", domain_status },
          "knowseo.app",
        ),
        "cliente.knowseo.app",
      );
    }
  });

  test("sem domínio próprio usa o subdomínio mesmo com status ativo", () => {
    assert.equal(
      enderecoDoBlog(
        { subdomain: "cliente", custom_domain: null, domain_status: "active" },
        "knowseo.app",
      ),
      "cliente.knowseo.app",
    );
  });
});

describe("versão da identidade para a URL da capa", () => {
  const base = { name: "Clínica", theme: { primary_color: "#1b3fcb", logo_url: null } };

  test("estável para a mesma identidade", () => {
    assert.equal(versaoDaIdentidade(base), versaoDaIdentidade({ ...base }));
    assert.match(versaoDaIdentidade(base), /^[a-z0-9]{1,7}$/);
  });

  test("muda quando nome, cor ou logo mudam", () => {
    const v = versaoDaIdentidade(base);
    assert.notEqual(v, versaoDaIdentidade({ ...base, name: "Outra" }));
    assert.notEqual(v, versaoDaIdentidade({ ...base, theme: { ...base.theme, primary_color: "#000000" } }));
    assert.notEqual(v, versaoDaIdentidade({ ...base, theme: { ...base.theme, logo_url: "https://x/logo.png" } }));
  });
});
