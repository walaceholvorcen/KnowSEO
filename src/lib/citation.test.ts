import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { detectCitation, extractDomain, normalizeBrand } from "./citation.ts";

const brand = {
  brandNames: ["Clínica Dental Madrid"],
  brandDomains: ["clinicadentalmadrid.es"],
};

describe("extractDomain", () => {
  test("remove www e protocolo", () => {
    assert.equal(extractDomain("https://www.marca.es/a/b"), "marca.es");
    assert.equal(extractDomain("marca.es"), "marca.es");
  });

  test("devolve null em lixo", () => {
    assert.equal(extractDomain("não é url"), null);
  });
});

describe("normalizeBrand", () => {
  test("remove acentos, caixa e sufixo societário", () => {
    assert.equal(normalizeBrand("Clínica Dental Madrid S.L."), "clinica dental madrid");
    assert.equal(normalizeBrand("ACME LTDA"), "acme");
  });
});

describe("detectCitation - citação por domínio", () => {
  test("detecta e registra a posição", () => {
    const r = detectCitation({
      ...brand,
      answerText: "Hay varias opciones en Madrid.",
      citationUrls: [
        "https://otraclinica.es/precios",
        "https://www.clinicadentalmadrid.es/ortodoncia",
      ],
    });
    assert.equal(r.cited, true);
    assert.equal(r.matchType, "domain");
    assert.equal(r.position, 2);
  });

  test("subdomínio conta como a mesma marca", () => {
    const r = detectCitation({
      ...brand,
      answerText: "",
      citationUrls: ["https://blog.clinicadentalmadrid.es/post"],
    });
    assert.equal(r.cited, true);
    assert.equal(r.matchType, "domain");
  });

  test("lista concorrentes citados", () => {
    const r = detectCitation({
      ...brand,
      answerText: "",
      citationUrls: [
        "https://competidor-a.es/x",
        "https://competidor-b.com/y",
        "https://www.competidor-a.es/z",
      ],
    });
    assert.deepEqual(r.competitors, ["competidor-a.es", "competidor-b.com"]);
    assert.equal(r.cited, false);
  });
});

describe("detectCitation - menção por nome", () => {
  test("detecta menção sem link", () => {
    const r = detectCitation({
      ...brand,
      answerText: "Te recomiendo Clínica Dental Madrid por su experiencia.",
      citationUrls: ["https://otro.es"],
    });
    assert.equal(r.cited, true);
    assert.equal(r.matchType, "brand");
    assert.equal(r.position, null);
  });

  test("ignora acentos e caixa", () => {
    const r = detectCitation({
      ...brand,
      answerText: "clinica dental madrid es una opcion solida",
      citationUrls: [],
    });
    assert.equal(r.cited, true);
  });

  test("domínio tem prioridade sobre menção", () => {
    const r = detectCitation({
      ...brand,
      answerText: "Clínica Dental Madrid es buena.",
      citationUrls: ["https://clinicadentalmadrid.es/"],
    });
    assert.equal(r.matchType, "domain");
  });
});

describe("detectCitation - falsos positivos (o que mais importa)", () => {
  test("não casa marca dentro de palavra maior", () => {
    const r = detectCitation({
      brandNames: ["Sol"],
      brandDomains: ["sol.es"],
      answerText: "La solución ideal para tu problema es consultar un experto.",
      citationUrls: [],
    });
    assert.equal(r.cited, false);
  });

  test("concorrente de nome parecido não conta", () => {
    const r = detectCitation({
      ...brand,
      answerText: "Clínica Dental Madrileña ofrece buenos precios.",
      citationUrls: ["https://clinicadentalmadrilena.es"],
    });
    assert.equal(r.cited, false);
    assert.equal(r.matchType, "none");
  });

  test("domínio parecido não conta", () => {
    const r = detectCitation({
      ...brand,
      answerText: "",
      citationUrls: ["https://clinicadentalmadrid.com.mx/otra-empresa"],
    });
    assert.equal(r.cited, false);
  });

  test("marca curta demais é ignorada", () => {
    const r = detectCitation({
      brandNames: ["AB"],
      brandDomains: [],
      answerText: "AB testing es una practica comun",
      citationUrls: [],
    });
    assert.equal(r.cited, false);
  });

  test("resposta vazia não gera citação", () => {
    const r = detectCitation({
      ...brand,
      answerText: "",
      citationUrls: [],
    });
    assert.equal(r.cited, false);
    assert.deepEqual(r.competitors, []);
  });
});

describe("detectCitation - variações de nome", () => {
  test("nome com sufixo societário na resposta ainda casa", () => {
    const r = detectCitation({
      brandNames: ["Clínica Dental Madrid S.L."],
      brandDomains: [],
      answerText: "Clínica Dental Madrid tiene buenas reseñas.",
      citationUrls: [],
    });
    assert.equal(r.cited, true);
  });

  test("marca entre pontuação casa", () => {
    const r = detectCitation({
      ...brand,
      answerText: "Opciones: Clínica Dental Madrid, Dentix y otras.",
      citationUrls: [],
    });
    assert.equal(r.cited, true);
  });

  test("aceita múltiplos nomes da marca", () => {
    const r = detectCitation({
      brandNames: ["Clínica Dental Madrid", "CDM Dental"],
      brandDomains: [],
      answerText: "En CDM Dental hacen ortodoncia invisible.",
      citationUrls: [],
    });
    assert.equal(r.cited, true);
  });
});

// ---------------------------------------------------------------------------
// Separação entre citação e resultado de busca.
//
// Este bloco existe por causa de um defeito real: o provedor jogava as duas
// coisas no mesmo array, e bastava o site do cliente aparecer no resultado de
// uma busca para o produto declarar "citado, posição 1". Num produto que
// vende prova de citação, era o pior defeito possível.
// ---------------------------------------------------------------------------
describe("resultado de busca não é citação", () => {
  test("aparecer só na busca NÃO conta como citado", () => {
    const r = detectCitation({
      answerText: "Recomendo a Clínica Sorriso e a Odonto Norte.",
      citationUrls: ["https://sorriso.es", "https://odontonorte.es"],
      searchResultUrls: ["https://clinicadentalmadrid.es/precos"],
      ...brand,
    });

    assert.equal(r.cited, false);
    assert.equal(r.matchType, "none");
    assert.equal(r.position, null);
  });

  test("mas o produto registra que a IA te encontrou e escolheu outro", () => {
    const r = detectCitation({
      answerText: "Recomendo a Clínica Sorriso.",
      citationUrls: ["https://sorriso.es"],
      searchResultUrls: ["https://clinicadentalmadrid.es/precos"],
      ...brand,
    });

    assert.equal(r.foundInSearch, true);
  });

  test("não aparecer nem na busca deixa foundInSearch falso", () => {
    const r = detectCitation({
      answerText: "Recomendo a Clínica Sorriso.",
      citationUrls: ["https://sorriso.es"],
      searchResultUrls: ["https://outra.es"],
      ...brand,
    });

    assert.equal(r.foundInSearch, false);
  });

  test("citação de verdade continua contando", () => {
    const r = detectCitation({
      answerText: "A Clínica Dental Madrid é uma boa opção.",
      citationUrls: ["https://sorriso.es", "https://clinicadentalmadrid.es"],
      searchResultUrls: ["https://qualquer.es"],
      ...brand,
    });

    assert.equal(r.cited, true);
    assert.equal(r.matchType, "domain");
    assert.equal(r.position, 2);
  });

  test("concorrente não sai do resultado bruto de busca", () => {
    const r = detectCitation({
      answerText: "A Clínica Sorriso é a melhor.",
      citationUrls: ["https://sorriso.es"],
      searchResultUrls: [
        "https://rival-que-nao-foi-citado.es",
        "https://outro-nao-citado.es",
      ],
      ...brand,
    });

    assert.deepEqual(r.competitors, ["sorriso.es"]);
  });

  test("sem searchResultUrls o detector continua funcionando", () => {
    const r = detectCitation({
      answerText: "A Clínica Sorriso é a melhor.",
      citationUrls: ["https://sorriso.es"],
      ...brand,
    });
    assert.equal(r.foundInSearch, false);
    assert.deepEqual(r.competitors, ["sorriso.es"]);
  });
});

describe("diretório não é concorrente", () => {
  test("agregador sai da lista de concorrentes", () => {
    const r = detectCitation({
      answerText: "Veja opções.",
      citationUrls: [
        "https://sortlist.com/es/agencias",
        "https://sorriso.es",
        "https://es.wikipedia.org/wiki/Odontologia",
      ],
      ...brand,
    });

    assert.deepEqual(r.competitors, ["sorriso.es"]);
    assert.deepEqual(r.directories, ["sortlist.com", "es.wikipedia.org"]);
  });

  test("subdomínio de agregador também é agregador", () => {
    const r = detectCitation({
      answerText: "Veja.",
      citationUrls: ["https://agencies.semrush.com/lista"],
      ...brand,
    });

    assert.deepEqual(r.competitors, []);
    assert.deepEqual(r.directories, ["agencies.semrush.com"]);
  });

  test("domínio comum não é confundido com agregador", () => {
    const r = detectCitation({
      answerText: "Veja.",
      citationUrls: ["https://minhaagencia.com", "https://naogoogle.com"],
      ...brand,
    });

    assert.deepEqual(r.directories, []);
    assert.equal(r.competitors.length, 2);
  });
});

describe("menção pelo endereço escrito no texto", () => {
  test("domínio citado por extenso, sem link, conta como menção", () => {
    const r = detectCitation({
      answerText: "Você pode ver os preços em clinicadentalmadrid.es.",
      citationUrls: ["https://sorriso.es"],
      ...brand,
    });

    assert.equal(r.cited, true);
    assert.equal(r.matchType, "brand");
  });
});
