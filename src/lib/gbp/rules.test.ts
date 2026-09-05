import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runRules, computeScore } from "./rules.ts";
import type { PlaceProfile } from "./types.ts";

// Perfil sem nenhum problema: base para cada teste desligar UM sinal por
// vez e provar que é aquele sinal - e só ele - que gera o achado.
const PERFIL_SAUDAVEL: PlaceProfile = {
  placeId: "abc123",
  name: "Clínica Dental Madrid",
  address: "Calle Falsa 123, Madrid",
  mapsUri: "https://maps.google.com/?cid=1",
  businessStatus: "OPERATIONAL",
  phone: "+34 600 000 000",
  website: "https://clinicadentalmadrid.es",
  hasOpeningHours: true,
  rating: 4.6,
  reviewCount: 87,
  photoCount: 12,
  primaryType: "dentist",
};

const com = (mudanca: Partial<PlaceProfile>): PlaceProfile => ({
  ...PERFIL_SAUDAVEL,
  ...mudanca,
});

describe("perfil saudável", () => {
  test("não gera nenhum achado", () => {
    assert.deepEqual(runRules(PERFIL_SAUDAVEL), []);
  });

  test("nota cheia", () => {
    assert.equal(computeScore(runRules(PERFIL_SAUDAVEL)), 100);
  });
});

describe("status do negócio", () => {
  test("fechado permanentemente é crítico", () => {
    const achados = runRules(com({ businessStatus: "CLOSED_PERMANENTLY" }));
    assert.equal(achados.length, 1);
    assert.equal(achados[0].code, "gbp_fechado");
    assert.equal(achados[0].severity, "critical");
  });

  test("fechado temporariamente também é crítico", () => {
    const achados = runRules(com({ businessStatus: "CLOSED_TEMPORARILY" }));
    assert.equal(achados[0].severity, "critical");
  });

  test("status nulo não é tratado como fechado", () => {
    // A API às vezes não devolve o campo - ausência não é a mesma coisa
    // que "fechado", e acusar isso seria um falso positivo caro.
    assert.deepEqual(runRules(com({ businessStatus: null })), []);
  });
});

describe("contato", () => {
  test("sem telefone", () => {
    const achados = runRules(com({ phone: null }));
    assert.equal(achados[0].code, "gbp_sem_telefone");
    assert.equal(achados[0].severity, "high");
  });

  test("sem site", () => {
    const achados = runRules(com({ website: null }));
    assert.equal(achados[0].code, "gbp_sem_site");
    assert.equal(achados[0].severity, "high");
  });
});

describe("completude do perfil", () => {
  test("sem horário configurado", () => {
    const achados = runRules(com({ hasOpeningHours: false }));
    assert.equal(achados[0].code, "gbp_sem_horario");
    assert.equal(achados[0].severity, "medium");
  });

  test("poucas fotos entra no limite, não sai", () => {
    assert.deepEqual(runRules(com({ photoCount: 3 })), []);
    assert.equal(runRules(com({ photoCount: 2 }))[0].code, "gbp_poucas_fotos");
  });

  test("achado de fotos cita o número real, não um texto genérico", () => {
    const achados = runRules(com({ photoCount: 1 }));
    assert.ok(achados[0].title.includes("1"));
  });
});

describe("reputação", () => {
  test("poucas avaliações no limite não gera achado", () => {
    assert.deepEqual(runRules(com({ reviewCount: 10 })), []);
    assert.equal(
      runRules(com({ reviewCount: 9 }))[0].code,
      "gbp_poucas_avaliacoes",
    );
  });

  test("nota abaixo de 4.0 é achado informativo, não corrigível de fato", () => {
    const achados = runRules(com({ rating: 3.2 }));
    const achado = achados.find((a) => a.code === "gbp_nota_baixa");
    assert.ok(achado);
    assert.equal(achado!.severity, "info");
  });

  test("nota exatamente no piso não gera achado", () => {
    assert.deepEqual(
      runRules(com({ rating: 4.0 })).filter((a) => a.code === "gbp_nota_baixa"),
      [],
    );
  });

  test("sem nenhuma avaliação ainda, nota nula não quebra a regra", () => {
    assert.doesNotThrow(() =>
      runRules(com({ rating: null, reviewCount: 0 })),
    );
  });
});

describe("nota final", () => {
  test("crítico pesa mais que quick_win", () => {
    const notaCritica = computeScore(
      runRules(com({ businessStatus: "CLOSED_PERMANENTLY" })),
    );
    const notaLeve = computeScore(runRules(com({ photoCount: 1 })));
    assert.ok(notaCritica < notaLeve);
  });

  test("nunca fica negativa mesmo com vários achados graves", () => {
    const pior = com({
      businessStatus: "CLOSED_PERMANENTLY",
      phone: null,
      website: null,
      hasOpeningHours: false,
      photoCount: 0,
      reviewCount: 0,
      rating: 2.1,
    });
    assert.equal(computeScore(runRules(pior)), 0);
  });
});
