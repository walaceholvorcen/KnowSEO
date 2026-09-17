import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  assinarRelatorio,
  comparar,
  fraseVariacao,
  lerPeriodo,
  lerRelatorio,
  manchete,
  resumoDoPeriodo,
  type Evento,
} from "./relatorio.ts";

const ev = (event_type: Evento["event_type"], created_at: string, article_id: string | null = "a1"): Evento => ({
  event_type,
  created_at,
  article_id,
});

describe("lerPeriodo", () => {
  const hoje = new Date("2026-09-16T15:00:00Z");

  test("padrão é 28 dias terminando hoje, anterior do mesmo tamanho", () => {
    const p = lerPeriodo({}, hoje);
    assert.equal(p.de, "2026-08-20");
    assert.equal(p.ate, "2026-09-16");
    assert.equal(p.dias, 28);
    assert.equal(p.anteriorInicio.toISOString(), "2026-07-23T00:00:00.000Z");
    assert.equal(p.texto, "nos últimos 28 dias");
  });

  test("dias fora dos atalhos cai no padrão", () => {
    assert.equal(lerPeriodo({ dias: "7" }, hoje).dias, 7);
    assert.equal(lerPeriodo({ dias: "13" }, hoje).dias, 28);
  });

  test("personalizado inclui o último dia; inválido cai no padrão", () => {
    const p = lerPeriodo({ de: "2026-09-01", ate: "2026-09-16" }, hoje);
    assert.equal(p.dias, 16);
    assert.equal(p.fim.toISOString(), "2026-09-17T00:00:00.000Z");
    assert.equal(p.preset, null);
    assert.equal(lerPeriodo({ de: "2026-09-16", ate: "2026-09-01" }, hoje).dias, 28);
    assert.equal(lerPeriodo({ de: "2026-02-31", ate: "2026-03-02" }, hoje).dias, 28);
  });
});

describe("resumoDoPeriodo e comparar", () => {
  const inicio = new Date("2026-09-10T00:00:00Z");
  const fim = new Date("2026-09-17T00:00:00Z");
  const eventos = [
    ev("pageview", "2026-09-09T23:59:59Z"), // fora: anterior
    ev("pageview", "2026-09-10T00:00:00Z"),
    ev("pageview", "2026-09-16T23:00:00Z", null),
    ev("whatsapp_click", "2026-09-12T10:00:00Z"),
    ev("pageview", "2026-09-17T00:00:00Z"), // fora: fim é exclusivo
  ];

  test("conta só dentro de [inicio, fim) e separa por artigo", () => {
    const r = resumoDoPeriodo(eventos, inicio, fim);
    assert.equal(r.visitas, 2);
    assert.equal(r.conversas, 1);
    assert.equal(r.cliquesZap, 1);
    assert.equal(r.taxa, 50);
    assert.deepEqual(r.porArtigo, { a1: { visitas: 1, conversas: 1 } });
  });

  test("variação absoluta e percentual; sem base não inventa %", () => {
    const atual = resumoDoPeriodo(eventos, inicio, fim);
    const anterior = resumoDoPeriodo(eventos, new Date("2026-09-03T00:00:00Z"), inicio);
    const c = comparar(atual, anterior);
    assert.equal(c.semBase, false);
    assert.deepEqual(c.visitas, { atual: 2, delta: 1, pct: 100 });
    assert.equal(c.conversas.pct, null);
    assert.equal(fraseVariacao(c.visitas, ["visita", "visitas"], 7, false), "+1 visita (+100%) em relação aos 7 dias anteriores");
    const vazio = resumoDoPeriodo([], inicio, fim);
    assert.equal(comparar(atual, vazio).semBase, true);
    assert.equal(fraseVariacao(c.visitas, ["visita", "visitas"], 7, true), "sem período anterior para comparar");
  });

  test("manchete diz o resultado real", () => {
    const tres = resumoDoPeriodo([ev("pageview", "2026-09-11T00:00:00Z"), ev("pageview", "2026-09-11T00:00:00Z"), ev("pageview", "2026-09-11T00:00:00Z")], inicio, fim);
    assert.equal(manchete(tres, [], "nos últimos 28 dias"), "Nenhuma conversa nos últimos 28 dias: 3 visitas chegaram e ninguém chamou.");
    const r = resumoDoPeriodo(eventos, inicio, fim);
    assert.match(manchete(r, [{ titulo: "Modelo 130", conversas: 1 }], "nos últimos 7 dias"), /“Modelo 130”: 1 de 1 conversa/);
  });
});

describe("token do link público", () => {
  const segredo = "s3gredo";
  const agora = Date.parse("2026-09-16T12:00:00Z");
  const dados = { blogId: "b1", de: "2026-09-01", ate: "2026-09-16" };

  test("assinatura válida devolve o payload", () => {
    const t = assinarRelatorio(dados, segredo, agora);
    assert.deepEqual({ ...lerRelatorio(t, segredo, agora) }, { ...dados, exp: agora / 1000 + 30 * 86_400 });
  });

  test("expira em 30 dias", () => {
    const t = assinarRelatorio(dados, segredo, agora);
    assert.ok(lerRelatorio(t, segredo, agora + 29 * 86_400_000));
    assert.equal(lerRelatorio(t, segredo, agora + 30 * 86_400_000), null);
  });

  test("payload adulterado, segredo errado ou lixo são recusados", () => {
    const t = assinarRelatorio(dados, segredo, agora);
    const [, assinatura] = t.split(".");
    const outroBlog = Buffer.from(JSON.stringify({ ...dados, blogId: "b2", exp: 9e9 })).toString("base64url");
    assert.equal(lerRelatorio(`${outroBlog}.${assinatura}`, segredo, agora), null);
    assert.equal(lerRelatorio(t, "outro", agora), null);
    assert.equal(lerRelatorio(t, "", agora), null);
    assert.equal(lerRelatorio("abc", segredo, agora), null);
    assert.equal(lerRelatorio(`${t}x`, segredo, agora), null);
  });
});
