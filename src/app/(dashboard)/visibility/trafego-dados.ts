import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONTAGEM_DESDE,
  inicioDoPeriodo,
  resumirTrafegoDeIA,
  seriesDiariasDeIA,
  type EventoDeIA,
  type SerieDeIA,
  type TrafegoDeIA,
} from "@/lib/ia-trafego";
import { diaNoFuso, diasAntes, diasEntre } from "@/lib/grafico";

export interface TrafegoDaTela {
  resumo: TrafegoDeIA;
  /** Título de cada artigo da lista, pelo id. */
  titulos: Record<string, string>;
  /** Os 28 dias do gráfico ("AAAA-MM-DD"), no fuso de quem opera. */
  dias: string[];
  series: SerieDeIA[];
  /** Dia em que a contagem começou, no mesmo fuso. */
  ligadaEm: string;
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
  fuso: string,
): Promise<TrafegoDaTela> {
  const agora = new Date();
  const desde = inicioDoPeriodo(agora).toISOString();

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

  const eventos = [
    ...((robos as EventoDeIA[]) ?? []),
    ...((visitas as EventoDeIA[]) ?? []),
  ];
  const resumo = resumirTrafegoDeIA(eventos);

  // O eixo tem sempre 28 dias, mesmo na primeira semana: os dias anteriores
  // à contagem aparecem vazios, e o gráfico não muda de largura conforme o
  // histórico cresce.
  const hoje = diaNoFuso(agora, fuso);
  const dias = diasEntre(diasAntes(hoje, 27), hoje);

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

  return {
    resumo,
    titulos,
    dias,
    series: seriesDiariasDeIA(eventos, dias, fuso),
    ligadaEm: diaNoFuso(CONTAGEM_DESDE, fuso),
  };
}
