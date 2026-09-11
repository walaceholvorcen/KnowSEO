import { test } from "node:test";
import assert from "node:assert/strict";
import { montarJornada, dataCurta, type AuditoriaDoSite } from "./jornada.ts";

const aud = (
  created_at: string,
  score_google: number,
  comPrioridade: boolean,
  score_ai = 100,
): AuditoriaDoSite => ({
  id: created_at,
  created_at,
  score_google,
  score_ai,
  comPrioridade,
});

// O histórico real do dataknow.es: 55, 55, 55, 61, 90, 96.
const REAL = [
  aud("2026-09-04T17:36:00Z", 55, true, 88),
  aud("2026-09-09T17:59:00Z", 55, true, 88),
  aud("2026-09-09T20:46:00Z", 55, true, 88),
  aud("2026-09-09T21:35:00Z", 61, true),
  aud("2026-09-09T21:50:00Z", 90, false),
  aud("2026-09-10T13:51:00Z", 96, false),
];

const etapa = (j: ReturnType<typeof montarJornada>, chave: string) =>
  j!.etapas.find((e) => e.chave === chave)!;

test("histórico real: correção feita, efeito em andamento, confirmar em 7 dias", () => {
  const j = montarJornada({
    historico: REAL,
    abertosPrioridade: 0,
    agora: new Date("2026-09-11T12:00:00Z"),
    acompanhamentoAtivo: false,
  })!;
  assert.equal(etapa(j, "correcao").estado, "feita");
  assert.match(etapa(j, "correcao").detalhe, /09\/09/);
  assert.equal(j.atual, "efeito");
  // 09/09 + 14 dias = 23/09; + 56 dias = 04/11.
  assert.match(etapa(j, "efeito").detalhe, /23\/09 e 04\/11/);
  assert.equal(j.proxima.resumo, "Confirmar a correção");
  assert.equal(dataCurta(j.proxima.quando!), "17/09");
  assert.equal(j.ganhoGoogle, 41);
  assert.equal(j.evolucao.length, 6);
});

test("prioridade aberta: agir agora, efeito ainda não começa", () => {
  const j = montarJornada({
    historico: REAL.slice(0, 3),
    abertosPrioridade: 4,
    agora: new Date("2026-09-11T12:00:00Z"),
    acompanhamentoAtivo: true,
  })!;
  assert.equal(j.atual, "correcao");
  assert.match(etapa(j, "correcao").detalhe, /4 itens/);
  assert.equal(etapa(j, "efeito").estado, "futura");
  // Com item alto aberto, agendamento não substitui a ação.
  assert.equal(j.proxima.quando, null);
  assert.equal(j.proxima.automatica, false);
});

test("prioridade que reapareceu: a correção conta da recuperação", () => {
  const j = montarJornada({
    historico: [
      aud("2026-06-01T00:00:00Z", 90, false),
      aud("2026-07-01T00:00:00Z", 60, true),
      aud("2026-07-10T00:00:00Z", 92, false),
    ],
    abertosPrioridade: 0,
    agora: new Date("2026-07-11T00:00:00Z"),
    acompanhamentoAtivo: false,
  })!;
  assert.match(etapa(j, "correcao").detalhe, /10\/07/);
});

test("depois de 8 semanas vira manutenção; revisão mensal atrasada", () => {
  const j = montarJornada({
    historico: [aud("2026-06-01T00:00:00Z", 95, false)],
    abertosPrioridade: 0,
    agora: new Date("2026-09-11T00:00:00Z"),
    acompanhamentoAtivo: false,
  })!;
  assert.equal(etapa(j, "efeito").estado, "feita");
  assert.equal(j.atual, "manutencao");
  assert.equal(j.proxima.atrasada, true);
  assert.equal(j.proxima.resumo, "Atrasada");
  assert.match(j.proxima.motivo, /01\/06/);
  assert.equal(j.ganhoGoogle, null);
});

test("acompanhamento ativo agenda para a próxima segunda às 7h UTC", () => {
  // 11/09/2026 é sexta-feira.
  const j = montarJornada({
    historico: [aud("2026-06-01T00:00:00Z", 95, false)],
    abertosPrioridade: 0,
    agora: new Date("2026-09-11T12:00:00Z"),
    acompanhamentoAtivo: true,
  })!;
  assert.equal(j.proxima.quando, "2026-09-14T07:00:00.000Z");
  assert.equal(j.proxima.automatica, true);
  assert.equal(j.proxima.atrasada, false);
});

test("sem histórico não há jornada", () => {
  assert.equal(
    montarJornada({
      historico: [],
      abertosPrioridade: 0,
      agora: new Date(),
      acompanhamentoAtivo: false,
    }),
    null,
  );
});
