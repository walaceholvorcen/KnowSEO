import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CABECALHO_PASTA, codigoDoWorker, normalizarPasta, passosDaPasta } from "./pasta.ts";

describe("endereço da pasta", () => {
  test("completa o esquema e tira a barra final", () => {
    assert.deepEqual(normalizarPasta("dataknow.es/blog/"), {
      url: "https://dataknow.es/blog",
      host: "dataknow.es",
      caminho: "/blog",
    });
  });

  test("aceita www e pasta com mais de um nível", () => {
    assert.equal(
      (normalizarPasta("https://www.cliente.com.br/conteudo/blog") as { url: string }).url,
      "https://www.cliente.com.br/conteudo/blog",
    );
  });

  test("sem pasta é recusado - o blog ocuparia a página inicial", () => {
    for (const e of ["cliente.com", "https://cliente.com/", "https://cliente.com//"]) {
      const r = normalizarPasta(e);
      assert.ok("erro" in r, e);
      assert.match((r as { erro: string }).erro, /Falta a pasta/);
    }
  });

  test("recusa http, porta, consulta e âncora", () => {
    for (const e of [
      "http://cliente.com/blog",
      "https://cliente.com:8443/blog",
      "https://cliente.com/blog?x=1",
      "https://cliente.com/blog#topo",
      "https://user:senha@cliente.com/blog",
    ]) {
      assert.ok("erro" in normalizarPasta(e), e);
    }
  });

  test("recusa o próprio app, vercel.app, IP e host que não é domínio", () => {
    for (const e of [
      "https://know-seo.vercel.app/blog",
      "https://outro.vercel.app/blog",
      "https://10.0.0.1/blog",
      "https://localhost/blog",
      "https://com/blog",
    ]) {
      assert.ok("erro" in normalizarPasta(e, "know-seo.vercel.app"), e);
    }
    assert.ok("erro" in normalizarPasta("https://app.meusite.com/blog", "app.meusite.com"));
  });

  test("pasta só com minúscula, número e hífen", () => {
    assert.ok("erro" in normalizarPasta("https://cliente.com/Blog"));
    assert.ok("erro" in normalizarPasta("https://cliente.com/blog_novo"));
    assert.ok("erro" in normalizarPasta("https://cliente.com/a/b/c/d"));
    assert.ok(!("erro" in normalizarPasta("https://cliente.com/blog-2026")));
  });
});

// O código que o cliente cola no Cloudflare roda aqui do jeito que é: um
// módulo com `export default { fetch }`, com o fetch global trocado por um
// que só anota o que recebeu. Testar uma cópia do código não provaria nada.
async function carregarWorker(pastaUrl: string) {
  const codigo = codigoDoWorker(pastaUrl, "https://know-seo.vercel.app");
  const modulo = await import(`data:text/javascript,${encodeURIComponent(codigo)}`);
  return modulo.default as { fetch: (r: Request) => Promise<Response> };
}

type Chamada = { url: string; headers: Headers; redirect?: string; original: boolean };

function simularFetch(resposta: () => Response) {
  const chamadas: Chamada[] = [];
  const antigo = globalThis.fetch;
  globalThis.fetch = (async (entrada: Request | string, init?: RequestInit) => {
    if (entrada instanceof Request) {
      chamadas.push({ url: entrada.url, headers: entrada.headers, original: true });
    } else {
      chamadas.push({
        url: String(entrada),
        headers: new Headers(init?.headers),
        redirect: init?.redirect,
        original: false,
      });
    }
    return resposta();
  }) as typeof fetch;
  return { chamadas, restaurar: () => (globalThis.fetch = antigo) };
}

describe("código do Worker", () => {
  test("fora da pasta, o pedido segue intocado para o site do cliente", async () => {
    const worker = await carregarWorker("https://dataknow.es/blog");
    const f = simularFetch(() => new Response("site do cliente"));
    try {
      for (const caminho of ["/", "/contato", "/blogger", "/blog-antigo", "/outra/blog"]) {
        const pedido = new Request(`https://dataknow.es${caminho}`);
        await worker.fetch(pedido);
      }
      assert.equal(f.chamadas.length, 5);
      assert.ok(f.chamadas.every((c) => c.original), "todos os pedidos seguiram intocados");
      assert.ok(f.chamadas.every((c) => c.url.startsWith("https://dataknow.es/")));
    } finally {
      f.restaurar();
    }
  });

  test("dentro da pasta, vai ao app com o endereço da pasta e sem cookie", async () => {
    const worker = await carregarWorker("https://dataknow.es/blog");
    const f = simularFetch(() => new Response("blog"));
    try {
      await worker.fetch(
        new Request("https://www.dataknow.es/blog/meu-artigo?utm=x", {
          headers: { cookie: "sessao=segredo", accept: "text/html" },
        }),
      );
      await worker.fetch(new Request("https://dataknow.es/blog"));
      const [artigo, inicio] = f.chamadas;
      assert.equal(artigo.url, "https://know-seo.vercel.app/pasta/meu-artigo?utm=x");
      // O endereço cadastrado, não o host do pedido: com www na frente, os
      // links do blog continuam no endereço oficial.
      assert.equal(artigo.headers.get(CABECALHO_PASTA), "https://dataknow.es/blog");
      assert.equal(artigo.headers.get("cookie"), null);
      assert.equal(artigo.headers.get("accept"), "text/html");
      assert.equal(artigo.redirect, "manual");
      assert.equal(inicio.url, "https://know-seo.vercel.app/pasta");
    } finally {
      f.restaurar();
    }
  });

  test("a resposta volta sem HSTS e sem Set-Cookie", async () => {
    const worker = await carregarWorker("https://dataknow.es/blog");
    const f = simularFetch(
      () =>
        new Response("<html>blog</html>", {
          headers: {
            "content-type": "text/html",
            "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
            "set-cookie": "x=1",
            "x-frame-options": "SAMEORIGIN",
          },
        }),
    );
    try {
      const r = await worker.fetch(new Request("https://dataknow.es/blog"));
      assert.equal(r.headers.get("strict-transport-security"), null);
      assert.equal(r.headers.get("set-cookie"), null);
      assert.equal(r.headers.get("x-frame-options"), "SAMEORIGIN");
      assert.equal(await r.text(), "<html>blog</html>");
    } finally {
      f.restaurar();
    }
  });

  test("redirecionamento do app volta para a pasta", async () => {
    const worker = await carregarWorker("https://dataknow.es/blog");
    for (const [location, esperado] of [
      ["https://know-seo.vercel.app/pasta/novo", "https://dataknow.es/blog/novo"],
      ["/pasta", "https://dataknow.es/blog"],
      ["https://outro-site.com/x", "https://outro-site.com/x"],
    ]) {
      const f = simularFetch(() => new Response(null, { status: 308, headers: { location } }));
      try {
        const r = await worker.fetch(new Request("https://dataknow.es/blog/x/"));
        assert.equal(r.status, 308);
        assert.equal(r.headers.get("location"), esperado, location);
      } finally {
        f.restaurar();
      }
    }
  });
});

test("passo a passo usa a zona e a rota certas", () => {
  const passos = passosDaPasta("https://www.cliente.com.br/blog").join("\n");
  assert.match(passos, /domínio cliente\.com\.br/);
  assert.match(passos, /Route escreva www\.cliente\.com\.br\/blog\*/);
  assert.match(passos, /https:\/\/www\.cliente\.com\.br\/blog\/sitemap\.xml/);
});
