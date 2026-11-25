import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { avaliarArtigo, type ArtigoParaAvaliar } from "./qualidade.ts";

// Enchimento com nome próprio no meio: só "palavra" repetida é, com razão,
// texto genérico para a regra de densidade.
const ENCHIMENTO = ["palavra", "Madrid", "custa", "em", "média"];
const paragrafo = (n: number) =>
  `<p>${Array.from({ length: n }, (_, i) => ENCHIMENTO[i % ENCHIMENTO.length]).join(" ")}</p>`;

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

import { dadosSemFonte, densidade, variacaoDasFrases } from "./qualidade.ts";

describe("dado sem fonte", () => {
  test("estatística de população sem dono é acusada", () => {
    assert.equal(dadosSemFonte("<p>O 73% das empresas perde clientes por isso.</p>").length, 1);
    assert.equal(dadosSemFonte("<p>Estudos mostram que o e-mail converte mais.</p>").length, 1);
  });

  test("com link, atribuição ou citação entre parênteses passa", () => {
    assert.equal(dadosSemFonte('<p>O 73% das empresas, <a href="https://ine.es">segundo dados</a>.</p>').length, 0);
    assert.equal(dadosSemFonte("<p>Segundo o INE, 73% das empresas são pequenas.</p>").length, 0);
    assert.equal(dadosSemFonte("<p>El 99,8% de las compañías son pymes (INE, DIRCE 2025).</p>").length, 0);
  });

  test("porcentagem de regra ou exemplo de conta não é pesquisa", () => {
    assert.equal(dadosSemFonte("<p>Separe 50% para necessidades e 30% para desejos.</p>").length, 0);
    assert.equal(dadosSemFonte("<p>Um fee que reduz o CPA em 30% se paga.</p>").length, 0);
  });
});

describe("texto genérico e ritmo", () => {
  test("texto que nomeia coisas tem densidade; o vazio não", () => {
    assert.ok(densidade("Em Madrid a Hacienda cobra 21% de IVA desde 2012 no Modelo 303.") > 2);
    assert.equal(densidade("a empresa oferece soluções completas para o seu negócio crescer sempre"), 0);
  });

  test("frases do mesmo tamanho têm desvio baixo", () => {
    const igual = Array(20).fill("Esta frase tem sempre seis palavras.").join(" ");
    assert.ok(variacaoDasFrases(igual).desvio < 1);
    const variado = "Curta. " + "Esta outra frase é bem mais longa e carrega bem mais coisa dentro dela. ".repeat(2) + "Média aqui de novo.";
    assert.ok(variacaoDasFrases(variado).desvio > 3);
  });
});
