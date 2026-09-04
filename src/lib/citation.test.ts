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
