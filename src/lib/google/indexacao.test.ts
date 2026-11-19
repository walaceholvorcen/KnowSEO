import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resumirIndexacao, type EstadoDaUrl } from "./indexacao.ts";

const SM = "https://blog.cliente.com/sitemap.xml";
const n = (estado: EstadoDaUrl, vezes: number) => Array<EstadoDaUrl>(vezes).fill(estado);

describe("o Google conhece o blog?", () => {
  test("o caso real: no ar há semanas, sem sitemap, nada indexado", () => {
    const r = resumirIndexacao({ sitemapDoBlog: SM, sitemaps: [], estados: n("nao_indexado", 6) });
    assert.equal(r.sitemap, "nao-enviado");
    assert.match(r.veredito, /não conhece nenhum dos 6/);
    assert.equal(r.passos.length, 2);
    assert.match(r.passos[0], /blog\.cliente\.com\/sitemap\.xml/);
  });

  test("sitemap do site principal não vale pelo do blog", () => {
    const r = resumirIndexacao({
      sitemapDoBlog: SM,
      sitemaps: [{ path: "https://cliente.com/sitemap.xml", pendente: false, erros: 0, ultimaLeitura: "2026-11-11" }],
      estados: n("nao_indexado", 2),
    });
    assert.equal(r.sitemap, "nao-enviado");
  });

  test("enviado e ainda não lido é espera, não erro", () => {
    const r = resumirIndexacao({
      sitemapDoBlog: SM,
      sitemaps: [{ path: SM, pendente: true, erros: 0, ultimaLeitura: null }],
      estados: n("nao_indexado", 3),
    });
    assert.equal(r.sitemap, "aguardando");
    assert.match(r.veredito, /ainda não o leu/);
    // Não manda enviar de novo o que já foi enviado.
    assert.ok(!r.passos.some((p) => p.includes("envie")));
  });

  test("tudo indexado não pede nada", () => {
    const r = resumirIndexacao({
      sitemapDoBlog: SM,
      sitemaps: [{ path: SM + "/", pendente: false, erros: 0, ultimaLeitura: "2026-11-20" }],
      estados: n("indexado", 4),
    });
    assert.equal(r.sitemap, "enviado");
    assert.deepEqual(r.passos, []);
    assert.match(r.veredito, /4 artigos conferidos estão indexados/);
  });

  test("parte indexada diz quantos de quantos", () => {
    const r = resumirIndexacao({
      sitemapDoBlog: SM,
      sitemaps: [{ path: SM, pendente: false, erros: 0, ultimaLeitura: "2026-11-20" }],
      estados: [...n("indexado", 3), ...n("nao_indexado", 3)],
    });
    assert.match(r.veredito, /3 de 6/);
  });

  test("falha de conferência não vira 'não indexado'", () => {
    const r = resumirIndexacao({ sitemapDoBlog: SM, sitemaps: [], estados: n("desconhecido", 5) });
    assert.equal(r.conferidos, 0);
    assert.equal(r.semResposta, 5);
    assert.match(r.veredito, /não deu para conferir/);
  });

  test("erro no sitemap manda olhar o erro", () => {
    const r = resumirIndexacao({
      sitemapDoBlog: SM,
      sitemaps: [{ path: SM, pendente: false, erros: 2, ultimaLeitura: "2026-11-20" }],
      estados: [],
    });
    assert.equal(r.sitemap, "com-erro");
    assert.match(r.passos[0], /erro/);
  });
});
