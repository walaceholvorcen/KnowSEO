import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resumirSubcontas, vereditoDaAgencia } from "./agencia.ts";

const AGORA = new Date("2026-11-17T12:00:00.000Z");
const conta = (id: string, name: string) => ({
  id,
  name,
  plan: "pro",
  artigos_por_mes: 90,
  created_at: "2026-09-01T00:00:00.000Z",
});
const blog = (id: string, workspace_id: string) => ({
  id,
  workspace_id,
  name: `Blog ${id}`,
  endereco: `https://blog.${id}.es`,
});
const artigo = (
  blog_id: string,
  status: string,
  extra: Partial<{ scheduled_at: string; published_at: string; created_at: string }> = {},
) => ({
  blog_id,
  status,
  scheduled_at: null,
  published_at: null,
  created_at: "2026-10-05T00:00:00.000Z",
  ...extra,
});

describe("painel da agência", () => {
  test("cada artigo cai na subconta do blog dele, nunca na do vizinho", () => {
    const [alfa, beta] = resumirSubcontas(
      [conta("a", "Alfa"), conta("b", "Beta")],
      [blog("ba", "a"), blog("bb", "b")],
      [
        artigo("ba", "published", { published_at: "2026-10-30T08:54:00.000Z" }),
        artigo("ba", "draft", { scheduled_at: "2026-11-20T00:00:00.000Z" }),
        artigo("bb", "published", { published_at: "2026-10-12T08:54:00.000Z" }),
      ],
      AGORA,
    );
    assert.equal(alfa.publicados, 1);
    assert.equal(alfa.agendados, 1);
    assert.equal(alfa.estado, "em-dia");
    assert.equal(beta.publicados, 1);
    assert.equal(beta.agendados, 0);
    assert.equal(beta.estado, "fila-vazia");
  });

  test("rascunho sem data não conta como fila: ele não vai ao ar sozinho", () => {
    // O caso real de outubro: cinco rascunhos prontos e o cliente achando
    // que tinha publicado.
    const [s] = resumirSubcontas(
      [conta("a", "Alfa")],
      [blog("ba", "a")],
      [artigo("ba", "draft"), artigo("ba", "draft")],
      AGORA,
    );
    assert.equal(s.estado, "fila-vazia");
    assert.equal(s.semData, 2);
    assert.equal(s.agendados, 0);
  });

  test("subconta recém-criada, sem blog, aparece e diz o que falta", () => {
    const [s] = resumirSubcontas([conta("a", "Alfa")], [], [], AGORA);
    assert.equal(s.estado, "sem-blog");
    assert.equal(s.blog, null);
  });

  test("próximo é o agendamento mais cedo, último é a publicação mais tarde", () => {
    const [s] = resumirSubcontas(
      [conta("a", "Alfa")],
      [blog("ba", "a")],
      [
        artigo("ba", "draft", { scheduled_at: "2026-11-27T00:00:00.000Z" }),
        artigo("ba", "draft", { scheduled_at: "2026-11-20T00:00:00.000Z" }),
        artigo("ba", "published", { published_at: "2026-10-12T08:54:00.000Z" }),
        artigo("ba", "published", { published_at: "2026-10-30T08:54:00.000Z" }),
      ],
      AGORA,
    );
    assert.equal(s.proximo, "2026-11-20T00:00:00.000Z");
    assert.equal(s.ultimoPublicado, "2026-10-30T08:54:00.000Z");
  });

  test("a cota conta o mês corrente, igual ao contador da barra lateral", () => {
    const [s] = resumirSubcontas(
      [conta("a", "Alfa")],
      [blog("ba", "a")],
      [
        artigo("ba", "published", { created_at: "2026-10-19T00:00:00.000Z" }),
        artigo("ba", "draft", { created_at: "2026-11-03T00:00:00.000Z" }),
      ],
      AGORA,
    );
    assert.equal(s.usados, 1);
    assert.equal(s.limite, 90);
  });

  test("a frase de abertura conta quem está parado", () => {
    const r = resumirSubcontas(
      [conta("a", "Alfa"), conta("b", "Beta"), conta("c", "Gama")],
      [blog("ba", "a"), blog("bb", "b")],
      [artigo("ba", "draft", { scheduled_at: "2026-11-20T00:00:00.000Z" })],
      AGORA,
    );
    assert.equal(
      vereditoDaAgencia(r),
      "3 subcontas: 1 sem nada agendado e 1 sem blog montado.",
    );
    assert.equal(
      vereditoDaAgencia([]),
      "Nenhuma subconta ainda. Crie a primeira abaixo.",
    );
    assert.equal(
      vereditoDaAgencia(r.filter((s) => s.estado === "em-dia")),
      "1 subconta, com publicação agendada.",
    );
  });
});
