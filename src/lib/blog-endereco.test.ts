import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { enderecoDoBlog } from "./blog-endereco.ts";

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
