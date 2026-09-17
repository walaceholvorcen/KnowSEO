import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparEmPlanos } from "./cluster.ts";
import type { Keyword } from "../../types/index.ts";

function pauta(p: Partial<Keyword>): Keyword {
  return {
    id: Math.random().toString(36).slice(2),
    blog_id: "b",
    keyword: "k",
    suggested_title: null,
    funnel_stage: null,
    search_volume: null,
    competition_index: null,
    difficulty: null,
    opportunity_score: null,
    status: "suggested",
    source: "ai",
    cluster_id: null,
    cluster_tema: null,
    cluster_papel: null,
    created_at: "2026-09-17",
    ...p,
  } as Keyword;
}

test("pauta sem cluster continua solta", () => {
  const { planos, soltas } = agruparEmPlanos([pauta({ keyword: "a" })]);
  assert.equal(planos.length, 0);
  assert.equal(soltas.length, 1);
});

test("o pilar vem antes dos apoios, na ordem de exibição", () => {
  const { planos } = agruparEmPlanos([
    pauta({ keyword: "apoio 1", cluster_id: "c1", cluster_papel: "apoio", cluster_tema: "tráfego pago" }),
    pauta({ keyword: "pilar", cluster_id: "c1", cluster_papel: "pilar", cluster_tema: "tráfego pago" }),
  ]);
  assert.equal(planos.length, 1);
  assert.equal(planos[0].tema, "tráfego pago");
  assert.equal(planos[0].abertas[0].keyword, "pilar");
  assert.equal(planos[0].apoios.length, 1);
});

test("descartada sai do plano e do total - senão o plano nunca fecha", () => {
  const { planos } = agruparEmPlanos([
    pauta({ cluster_id: "c1", cluster_papel: "pilar", status: "written" }),
    pauta({ cluster_id: "c1", cluster_papel: "apoio", status: "written" }),
    pauta({ cluster_id: "c1", cluster_papel: "apoio", status: "rejected" }),
  ]);
  assert.equal(planos[0].total, 2);
  assert.equal(planos[0].escritos, 2);
  assert.equal(planos[0].abertas.length, 0);
});

test("plano sem pilar continua sendo plano", () => {
  const { planos } = agruparEmPlanos([
    pauta({ cluster_id: "c1", cluster_papel: "pilar", status: "rejected" }),
    pauta({ keyword: "apoio", cluster_id: "c1", cluster_papel: "apoio" }),
  ]);
  assert.equal(planos.length, 1);
  assert.equal(planos[0].pilar, null);
  assert.equal(planos[0].abertas.length, 1);
});

test("plano com pauta aberta aparece antes do plano concluído", () => {
  const { planos } = agruparEmPlanos([
    pauta({ cluster_id: "pronto", cluster_tema: "a pronto", cluster_papel: "pilar", status: "written" }),
    pauta({ cluster_id: "aberto", cluster_tema: "z aberto", cluster_papel: "pilar" }),
  ]);
  assert.equal(planos[0].tema, "z aberto");
});
