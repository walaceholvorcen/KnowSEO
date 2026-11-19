import type { SupabaseClient } from "@supabase/supabase-js";
import {
  inicioDoPeriodo,
  resumirTrafegoDeIA,
  type EventoDeIA,
  type TrafegoDeIA,
} from "@/lib/ia-trafego";

export interface TrafegoDaTela {
  resumo: TrafegoDeIA;
  /** Título de cada artigo da lista, pelo id. */
  titulos: Record<string, string>;
  /** Começo do período somado (ISO). */
  desde: string;
}

// O que os assistentes fizeram no blog no período: passagens de robô e
// visitas de gente que chegou por link de assistente.
//
// `select("*")` e não o nome das colunas: `agente` só existe depois da
// migração 0025, e pedi-la pelo nome derrubaria a tela num deploy que
// chegasse antes do SQL. Falha de leitura vira bloco zerado, nunca erro.
//
// ponytail: até 1.000 linhas por consulta (teto do PostgREST). Um blog com
// mais de mil passagens de robô em 28 dias precisa de soma no banco.
export async function carregarTrafegoDeIA(
  supabase: SupabaseClient,
  blogId: string,
): Promise<TrafegoDaTela> {
  const desde = inicioDoPeriodo(new Date()).toISOString();

  const [{ data: robos }, { data: visitas }] = await Promise.all([
    supabase
      .from("analytics_events")
      .select("*")
      .eq("blog_id", blogId)
      .eq("event_type", "ai_bot")
      .gte("created_at", desde),
    supabase
      .from("analytics_events")
      .select("*")
      .eq("blog_id", blogId)
      .eq("event_type", "pageview")
      .not("referrer", "is", null)
      .gte("created_at", desde),
  ]);

  const resumo = resumirTrafegoDeIA([
    ...((robos as EventoDeIA[]) ?? []),
    ...((visitas as EventoDeIA[]) ?? []),
  ]);

  const titulos: Record<string, string> = {};
  if (resumo.artigos.length) {
    const { data } = await supabase
      .from("articles")
      .select("id,title")
      .in("id", resumo.artigos.map((a) => a.articleId));
    for (const a of (data as { id: string; title: string }[]) ?? []) {
      titulos[a.id] = a.title;
    }
  }

  return { resumo, titulos, desde };
}
