import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { autorGravado, datasDoArtigo, normalizarAutor } from "./autor.ts";

describe("quem assina os artigos", () => {
  test("completa o perfil sem esquema e limpa espaços", () => {
    assert.deepEqual(
      normalizarAutor({
        nome: "  Renan   Souza ",
        cargo: "Fundador",
        bio: "",
        perfil: "www.linkedin.com/in/renan",
      }),
      {
        autor: {
          nome: "Renan Souza",
          cargo: "Fundador",
          bio: null,
          perfil: "https://www.linkedin.com/in/renan",
        },
      },
    );
  });

  test("tudo vazio remove o autor", () => {
    assert.deepEqual(normalizarAutor({ nome: " ", cargo: "", bio: "", perfil: "" }), { autor: null });
  });

  test("bio sem nome é recusada", () => {
    assert.ok("erro" in normalizarAutor({ bio: "Especialista em Google Ads" }));
  });

  test("perfil só com https - vira link público no blog", () => {
    assert.ok("erro" in normalizarAutor({ nome: "Ana", perfil: "http://linkedin.com/in/ana" }));
    assert.ok("erro" in normalizarAutor({ nome: "Ana", perfil: "javascript:alert(1)" }));
  });

  test("valor gravado fora do formato vale como sem autor", () => {
    assert.equal(autorGravado(null), null);
    assert.equal(autorGravado("texto"), null);
    assert.equal(autorGravado({ bio: "sem nome" }), null);
    assert.equal(autorGravado({ nome: "Ana" })?.nome, "Ana");
  });
});

describe("datas do artigo", () => {
  test("atualizado só aparece depois de um dia", () => {
    const pub = "2026-09-10T10:00:00Z";
    assert.equal(datasDoArtigo(pub, "2026-09-10T18:00:00Z").atualizado, null);
    assert.equal(datasDoArtigo(pub, "2026-09-12T09:00:00Z").atualizado, "2026-09-12T09:00:00Z");
  });

  test("sem publicação, sem data", () => {
    assert.deepEqual(datasDoArtigo(null, "2026-09-12T09:00:00Z"), { publicado: null, atualizado: null });
  });
});
