import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { avaliarArtigo, type ArtigoParaAvaliar } from "./qualidade.ts";

const paragrafo = (n: number) =>
  `<p>${"palavra ".repeat(n).trim()}</p>`;

// Artigo que passa em tudo: serve de base para os testes mudarem um ponto
// de cada vez e provarem que a regra testada é a que disparou.
const BOM: ArtigoParaAvaliar = {
  titulo: "Quanto custa uma agência de tráfego pago em 2026",
  seoTitle: "Quanto custa uma agência de tráfego pago em 2026",
  seoDescription:
    "Veja faixas de preço praticadas por agências de tráfego pago no Brasil em 2026, o que entra em cada plano e como comparar propostas sem se perder.",
  keyword: "quanto custa agência de tráfego pago",
  html: `<p>Quanto custa uma agência de tráfego pago? Em 2026 as propostas ficam entre 2.500 e 8.000 reais por mês, e a diferença raramente está no volume de anúncios.</p>
    <h2>O que entra no preço</h2>
    ${paragrafo(140)}
    <ul><li>Gestão de campanhas</li><li>Criação de anúncios</li></ul>
    <p>Veja também a nossa <a href="/servicos">página de serviços</a>.</p>
    ${paragrafo(140)}`,
  linksConhecidos: ["https://cliente.com/servicos"],
};

const codigos = (a: ArtigoParaAvaliar) => {
  const r = avaliarArtigo(a);
  return [...r.travas, ...r.avisos].map((x) => x.codigo);
};

describe("trava de qualidade", () => {
  test("artigo completo pode publicar, sem trava nem aviso", () => {
    const r = avaliarArtigo(BOM);
    assert.deepEqual(r.travas, []);
    assert.deepEqual(r.avisos, []);
    assert.equal(r.podePublicar, true);
    assert.ok(r.palavras > 300);
  });

  test("texto raso trava e o número de palavras aparece no achado", () => {
    const r = avaliarArtigo({ ...BOM, html: `<h2>Oi</h2>${paragrafo(50)}<a href="/x">x</a>` });
    const raso = r.travas.find((t) => t.codigo === "RASO");
    assert.ok(raso);
    assert.match(raso.titulo, /5[0-9] palavras/);
    assert.equal(r.podePublicar, false);
  });

  test("sem H2 e sem link interno travam", () => {
    const c = codigos({ ...BOM, html: BOM.html.replace(/<h2>.*?<\/h2>/, "").replace(/<a[^>]*>.*?<\/a>/, "") });
    assert.ok(c.includes("SEM_H2"));
    assert.ok(c.includes("SEM_LINK_INTERNO"));
  });

  test("link para página conhecida do cliente conta como interno", () => {
    const c = codigos({
      ...BOM,
      html: BOM.html.replace(
        '<a href="/servicos">página de serviços</a>',
        '<a href="https://cliente.com/servicos">página de serviços</a>',
      ),
    });
    assert.ok(!c.includes("SEM_LINK_INTERNO"));
  });

  test("artigo que não responde à pauta trava", () => {
    const r = avaliarArtigo({
      ...BOM,
      titulo: "Dicas de marketing para 2026",
      html: `<h2>Dicas</h2>${paragrafo(200)}<p><a href="/x">link</a></p>${paragrafo(150)}`,
    });
    assert.ok(r.travas.some((t) => t.codigo === "FORA_DA_PAUTA"));
  });

  test("markdown vazado no HTML trava", () => {
    assert.ok(codigos({ ...BOM, html: "```html" + BOM.html }).includes("HTML_SUJO"));
  });

  test("meta fora do tamanho é aviso, não trava", () => {
    const r = avaliarArtigo({ ...BOM, seoDescription: "Curta demais." });
    assert.equal(r.podePublicar, true);
    assert.ok(r.avisos.some((a) => a.codigo === "META_SEO"));
  });

  test("duas frases de folheto viram aviso", () => {
    const c = codigos({
      ...BOM,
      html:
        BOM.html +
        "<p>Somos líder de mercado com soluções inovadoras para o seu negócio.</p>",
    });
    assert.ok(c.includes("FOLHETO"));
  });

  test("texto sem número nenhum avisa; parágrafo gigante também", () => {
    const c = codigos({
      ...BOM,
      seoDescription: BOM.seoDescription,
      html: `<h2>Título</h2><p><a href="/x">link</a></p><ul><li>um</li></ul>${paragrafo(400)}`,
    });
    assert.ok(c.includes("SEM_DADO"));
    assert.ok(c.includes("PARAGRAFO_LONGO"));
  });

  test("mesma pauta já publicada vira aviso de canibalização", () => {
    const c = codigos({
      ...BOM,
      keywordsPublicadas: ["Quanto custa agência de tráfego pago"],
    });
    assert.ok(c.includes("CANIBALIZACAO"));
  });
});
