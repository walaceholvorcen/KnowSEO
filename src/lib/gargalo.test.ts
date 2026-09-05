import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { encontrarGargalo, type Sinais } from "./gargalo.ts";

// Operação saudável. Cada teste muda um sinal só, para provar que é aquele
// sinal que move o diagnóstico.
const SAUDAVEL: Sinais = {
  notaGoogle: 88,
  pautasAbertas: 5,
  artigosPublicados: 4,
  visitas: 120,
  conversas: 6,
  perguntasIa: 15,
  citacoesIa: 4,
  rivalCitado: "concorrente.com",
};

const com = (mudanca: Partial<Sinais>) =>
  encontrarGargalo({ ...SAUDAVEL, ...mudanca });

describe("o elo mais fraco da corrente", () => {
  test("sem auditoria, o gargalo é descobrir o estado do site", () => {
    assert.equal(com({ notaGoogle: null }).etapa, "site");
  });

  test("site crítico vem antes de tudo, mesmo com pauta e artigo prontos", () => {
    // A razão de existir desta ordem: publicar em site que o Google não
    // rastreia gasta crédito sem chance de retorno.
    const g = com({ notaGoogle: 31, artigosPublicados: 0, pautasAbertas: 9 });
    assert.equal(g.etapa, "site");
    assert.ok(g.frase.includes("31"));
  });

  test("sem artigo e sem pauta, o gargalo é escolher a pauta", () => {
    assert.equal(
      com({ artigosPublicados: 0, pautasAbertas: 0 }).etapa,
      "pauta",
    );
  });

  test("com pauta e sem artigo, o gargalo é escrever", () => {
    const g = com({ artigosPublicados: 0, pautasAbertas: 6 });
    assert.equal(g.etapa, "conteudo");
    assert.ok(g.frase.includes("6"));
  });

  test("artigo no ar sem visita: o gargalo é alcance", () => {
    assert.equal(com({ visitas: 0, conversas: 0 }).etapa, "alcance");
  });

  test("visita que não vira conversa é o desperdício mais caro", () => {
    assert.equal(com({ conversas: 0 }).etapa, "conversao");
  });

  test("com tráfego e conversa, sobra a citação em IA", () => {
    const g = com({ citacoesIa: 0 });
    assert.equal(g.etapa, "ia");
    assert.ok(g.frase.includes("concorrente.com"));
  });

  test("sem rival conhecido a frase não inventa um", () => {
    const g = com({ citacoesIa: 0, rivalCitado: null });
    assert.equal(g.etapa, "ia");
    assert.ok(!g.frase.includes("Cita "));
  });

  test("visibilidade nunca rodada não vira gargalo", () => {
    // citacoesIa null significa "ninguém consultou ainda", não "zero
    // citações" - acusar gargalo aqui seria inventar um problema.
    assert.equal(com({ citacoesIa: null }).etapa, "nenhum");
    assert.equal(com({ perguntasIa: 0, citacoesIa: 0 }).etapa, "nenhum");
  });

  test("site apenas mediano só aparece depois que o resto anda", () => {
    assert.equal(com({ notaGoogle: 64 }).etapa, "site");
    // ...mas perde a vez para um problema mais grave na corrente.
    assert.equal(com({ notaGoogle: 64, visitas: 0, conversas: 0 }).etapa, "alcance");
  });

  test("operação saudável não inventa gargalo e propõe o próximo passo", () => {
    const g = encontrarGargalo(SAUDAVEL);
    assert.equal(g.etapa, "nenhum");
    assert.equal(g.acaoHref, "/strategy");
  });

  test("toda saída traz ação com destino utilizável", () => {
    const casos: Partial<Sinais>[] = [
      { notaGoogle: null },
      { notaGoogle: 20 },
      { artigosPublicados: 0, pautasAbertas: 0 },
      { artigosPublicados: 0 },
      { visitas: 0, conversas: 0 },
      { conversas: 0 },
      { citacoesIa: 0 },
      { notaGoogle: 64 },
      {},
    ];
    for (const caso of casos) {
      const g = com(caso);
      assert.ok(g.frase.length > 20, `frase curta demais: ${g.frase}`);
      assert.ok(g.acaoHref.startsWith("/"), `destino inválido: ${g.acaoHref}`);
      assert.ok(g.acaoTexto.length > 3);
    }
  });
});
