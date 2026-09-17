import { createHmac, timingSafeEqual } from "node:crypto";
import type { AnalyticsEvent } from "@/types";
import { formatDate } from "./utils.ts";

// Lógica do relatório de Relatórios e do link público (/r/<token>): período,
// comparação com o período anterior, manchete e assinatura do link. Tudo
// puro para ser testado sem banco - o número que vai para o cliente final
// não pode depender de conferência visual.

const DIA = 86_400_000;
export const PRESETS = [7, 28, 90] as const;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export type Periodo = {
  de: string;
  ate: string;
  dias: number;
  /** 7, 28 ou 90 quando veio de atalho; null para datas escolhidas. */
  preset: number | null;
  inicio: Date;
  /** Exclusivo: meia-noite UTC do dia seguinte a `ate`. */
  fim: Date;
  /** Início do período anterior de mesmo tamanho (que termina em `inicio`). */
  anteriorInicio: Date;
  /** "nos últimos 28 dias" ou "entre 01 de set. de 2026 e 16 de set. de 2026". */
  texto: string;
};

function dataValida(s: string | undefined): s is string {
  // O regex sozinho aceitaria 2026-02-31; a volta pelo Date recusa.
  return !!s && DATA.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
}

// Dias em UTC, o mesmo fuso de formatDate: se o corte do dia e a data
// escrita usassem fusos diferentes, o evento das 23h de 16/09 cairia num
// período e seria contado no rótulo de outro.
export function periodoEntre(de: string, ate: string, preset: number | null = null): Periodo | null {
  if (!dataValida(de) || !dataValida(ate) || de > ate) return null;
  const inicio = new Date(`${de}T00:00:00Z`);
  const fim = new Date(Date.parse(`${ate}T00:00:00Z`) + DIA);
  const dias = Math.round((fim.getTime() - inicio.getTime()) / DIA);
  // Um ano no máximo: período maior pede o dobro de eventos (atual + anterior)
  // numa tela que não foi pensada para isso.
  if (dias > 366) return null;
  return {
    de,
    ate,
    dias,
    preset,
    inicio,
    fim,
    anteriorInicio: new Date(inicio.getTime() - dias * DIA),
    texto: preset
      ? `nos últimos ${dias} dias`
      : // fuso: trocar por formatarData quando src/lib/datas.ts existir
        `entre ${formatDate(de)} e ${formatDate(ate)}`,
  };
}

type Param = string | string[] | undefined;
const um = (v: Param) => (Array.isArray(v) ? v[0] : v);

/** `?dias=7` ou `?de=2026-09-01&ate=2026-09-16`; qualquer outra coisa vira 28 dias. */
export function lerPeriodo(
  sp: { dias?: Param; de?: Param; ate?: Param },
  hoje = new Date(),
): Periodo {
  const personalizado = periodoEntre(um(sp.de) ?? "", um(sp.ate) ?? "");
  if (personalizado) return personalizado;
  const pedido = Number(um(sp.dias));
  const dias = (PRESETS as readonly number[]).includes(pedido) ? pedido : 28;
  const ate = hoje.toISOString().slice(0, 10);
  const de = new Date(Date.parse(`${ate}T00:00:00Z`) - (dias - 1) * DIA)
    .toISOString()
    .slice(0, 10);
  return periodoEntre(de, ate, dias)!;
}

export type Evento = Pick<AnalyticsEvent, "event_type" | "article_id" | "created_at">;

export type Resumo = {
  visitas: number;
  conversas: number;
  cliquesCta: number;
  cliquesZap: number;
  /** Conversas por 100 visitas; 0 sem visita. */
  taxa: number;
  porArtigo: Record<string, { visitas: number; conversas: number }>;
};

export function resumoDoPeriodo(eventos: Evento[], inicio: Date, fim: Date): Resumo {
  const r: Resumo = { visitas: 0, conversas: 0, cliquesCta: 0, cliquesZap: 0, taxa: 0, porArtigo: {} };
  const a = inicio.getTime();
  const b = fim.getTime();
  for (const e of eventos) {
    const t = Date.parse(e.created_at);
    if (t < a || t >= b) continue;
    const visita = e.event_type === "pageview";
    if (visita) r.visitas++;
    else if (e.event_type === "cta_click") r.cliquesCta++;
    else if (e.event_type === "whatsapp_click") r.cliquesZap++;
    else continue;
    if (!visita) r.conversas++;
    // Evento sem article_id (artigo apagado depois de medido) conta no total
    // mas não inventa linha de artigo: não temos como provar a origem.
    if (!e.article_id) continue;
    const linha = (r.porArtigo[e.article_id] ??= { visitas: 0, conversas: 0 });
    if (visita) linha.visitas++;
    else linha.conversas++;
  }
  r.taxa = r.visitas ? (r.conversas / r.visitas) * 100 : 0;
  return r;
}

export type Variacao = { atual: number; delta: number; pct: number | null };

export function variacao(atual: number, anterior: number): Variacao {
  const delta = Math.round((atual - anterior) * 10) / 10;
  // Sem base não existe percentual: "+3 visitas (+∞%)" não diz nada.
  return { atual, delta, pct: anterior > 0 ? Math.round(((atual - anterior) / anterior) * 100) : null };
}

export function comparar(atual: Resumo, anterior: Resumo) {
  return {
    semBase: anterior.visitas === 0 && anterior.conversas === 0,
    visitas: variacao(atual.visitas, anterior.visitas),
    conversas: variacao(atual.conversas, anterior.conversas),
    // Delta da taxa em pontos percentuais; o % é relativo à taxa anterior.
    taxa: variacao(atual.taxa, anterior.taxa),
  };
}

const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const sinal = (n: number) => (n > 0 ? "+" : "−");

/** "+12 visitas (+40%) em relação aos 28 dias anteriores". */
export function fraseVariacao(
  v: Variacao,
  unidade: [singular: string, plural: string],
  dias: number,
  semBase: boolean,
): string {
  if (semBase) return "sem período anterior para comparar";
  const anteriores = `em relação aos ${dias} dias anteriores`;
  if (v.delta === 0) return `igual aos ${dias} dias anteriores`;
  const abs = Math.abs(v.delta);
  const u = abs === 1 ? unidade[0] : unidade[1];
  const pct = v.pct === null ? "" : ` (${sinal(v.pct)}${Math.abs(v.pct)}%)`;
  return `${sinal(v.delta)}${num(abs)} ${u}${pct} ${anteriores}`;
}

export const visitasTxt = (n: number) => `${n} ${n === 1 ? "visita" : "visitas"}`;
export const conversasTxt = (n: number) => `${n} ${n === 1 ? "conversa" : "conversas"}`;

/** A manchete é o diagnóstico: a pergunta é "qual pauta valeu a pena", não "quantos cliques". */
export function manchete(
  r: Resumo,
  artigos: { titulo: string; conversas: number }[],
  texto: string,
): string {
  if (r.visitas === 0 && r.conversas === 0) {
    return `Nenhuma visita ${texto}. O rastreio já está ligado — falta divulgar o link.`;
  }
  if (r.conversas === 0) {
    return `Nenhuma conversa ${texto}: ${visitasTxt(r.visitas)} ${r.visitas === 1 ? "chegou" : "chegaram"} e ninguém chamou.`;
  }
  const melhor = [...artigos].sort((a, b) => b.conversas - a.conversas)[0];
  if (melhor && melhor.conversas > 0) {
    return `A pauta que valeu a pena ${texto} foi “${melhor.titulo}”: ${melhor.conversas} de ${conversasTxt(r.conversas)}.`;
  }
  return `${visitasTxt(r.visitas)} ${texto}, ${r.conversas} ${r.conversas === 1 ? "virou conversa" : "viraram conversa"}.`;
}

// ---------------------------------------------------------------------------
// Link somente leitura: token assinado, sem tabela nova. O token carrega o
// blog e o período; quem tem o link vê aquele relatório e nada mais. Não dá
// para revogar um link antes de vencer - trocar RELATORIO_SECRET invalida
// todos de uma vez.

export type TokenRelatorio = { blogId: string; de: string; ate: string; exp: number };
export const VALIDADE_DIAS = 30;

const hmac = (corpo: string, segredo: string) =>
  createHmac("sha256", segredo).update(corpo).digest("base64url");

export function assinarRelatorio(
  dados: { blogId: string; de: string; ate: string },
  segredo: string,
  agora = Date.now(),
): string {
  const payload: TokenRelatorio = { ...dados, exp: Math.floor(agora / 1000) + VALIDADE_DIAS * 86_400 };
  const corpo = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${corpo}.${hmac(corpo, segredo)}`;
}

/** Payload se a assinatura confere e o link não venceu; senão null. */
export function lerRelatorio(token: string, segredo: string, agora = Date.now()): TokenRelatorio | null {
  if (!segredo) return null;
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [corpo, assinatura] = partes;
  const esperada = Buffer.from(hmac(corpo, segredo));
  const recebida = Buffer.from(assinatura);
  // Tempo constante: comparar com === vaza, pelo tempo de resposta, quantos
  // caracteres iniciais da assinatura já estão certos.
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;
  try {
    const p = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8"));
    if (
      typeof p?.blogId !== "string" ||
      !dataValida(p.de) ||
      !dataValida(p.ate) ||
      typeof p.exp !== "number" ||
      p.exp * 1000 <= agora
    ) {
      return null;
    }
    return { blogId: p.blogId, de: p.de, ate: p.ate, exp: p.exp };
  } catch {
    return null;
  }
}
