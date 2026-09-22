import type { SupabaseClient } from "@supabase/supabase-js";
import type { Evento, Periodo } from "@/lib/relatorio";

// Mesma carga para o painel (client com RLS) e para o link público (client
// admin, filtrado pelo blog do token): as duas telas não podem divergir.

export type ArtigoDoRelatorio = {
  id: string;
  title: string;
  slug: string;
  published_at: string | null;
  // PostgREST devolve objeto único (keyword_id -> keywords.id é muitos-para-um).
  keywords: { keyword: string } | null;
};

// O PostgREST do Supabase corta em 1000 linhas por resposta, calado. Um
// relatório de 90 dias (180 com o anterior) passa disso fácil e mostraria
// menos visitas do que houve - por isso a leitura vai em lotes.
const LOTE = 1000;

async function eventosDoPeriodo(supabase: SupabaseClient, blogId: string, periodo: Periodo) {
  const eventos: Evento[] = [];
  for (let de = 0; ; de += LOTE) {
    // Período atual e anterior numa consulta só: a comparação é feita em
    // memória por resumoDoPeriodo.
    const { data, error } = await supabase
      .from("analytics_events")
      .select("event_type, article_id, created_at")
      .eq("blog_id", blogId)
      .gte("created_at", periodo.anteriorInicio.toISOString())
      .lt("created_at", periodo.fim.toISOString())
      .order("id")
      .range(de, de + LOTE - 1);
    // Erro vira erro de tela, não relatório zerado: número errado entregue
    // ao cliente é pior que página que não abriu.
    if (error) throw new Error(`analytics_events: ${error.message}`);
    eventos.push(...(data as Evento[]));
    if (data.length < LOTE) return eventos;
  }
}

/** Nota do site e citações em IA: o relatório mostra a corrente inteira,
 *  não só a visita. As duas leituras são as mais recentes, não do período -
 *  auditoria e Raio X são fotos do estado de hoje. */
export type Contexto = {
  auditoria: { google: number; ia: number; googleAntes: number | null } | null;
  geo: { citadas: number; perguntas: number; rival: string | null } | null;
};

async function contextoDoBlog(supabase: SupabaseClient, blogId: string): Promise<Contexto> {
  const [{ data: auditorias }, { data: checks }] = await Promise.all([
    supabase
      .from("site_audits")
      .select("score_google,score_ai,created_at")
      .eq("blog_id", blogId)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(2),
    // Só a rodada mais recente: o campo run_id agrupa, e a lista já vem em
    // ordem, então o primeiro run_id é o da última rodada.
    supabase
      .from("ai_visibility_checks")
      .select("cited,competitors,run_id,query_id,checked_at")
      .eq("blog_id", blogId)
      .order("checked_at", { ascending: false })
      .limit(200),
  ]);

  const a = (auditorias ?? []) as { score_google: number | null; score_ai: number | null }[];
  const auditoria =
    a[0]?.score_google != null && a[0]?.score_ai != null
      ? { google: a[0].score_google, ia: a[0].score_ai, googleAntes: a[1]?.score_google ?? null }
      : null;

  const linhas = (checks ?? []) as {
    cited: boolean;
    competitors: string[] | null;
    run_id: string | null;
    query_id: string;
  }[];
  const ultima = linhas[0]?.run_id ?? null;
  const daRodada = ultima ? linhas.filter((c) => c.run_id === ultima) : [];
  // Por pergunta, não por consulta: com dois assistentes, "citado em 3 de 20"
  // não é o número que o cliente pensa - ele pensa em perguntas.
  const perguntas = new Set(daRodada.map((c) => c.query_id));
  const citadas = new Set(daRodada.filter((c) => c.cited).map((c) => c.query_id));
  const rival = daRodada.flatMap((c) => c.competitors ?? [])[0] ?? null;

  return {
    auditoria,
    geo: perguntas.size ? { citadas: citadas.size, perguntas: perguntas.size, rival } : null,
  };
}

export async function carregarRelatorio(supabase: SupabaseClient, blogId: string, periodo: Periodo) {
  const [eventos, { data: artigos }, contexto] = await Promise.all([
    eventosDoPeriodo(supabase, blogId, periodo),
    supabase
      .from("articles")
      .select("id, title, slug, published_at, keywords(keyword)")
      .eq("blog_id", blogId)
      .eq("status", "published"),
    contextoDoBlog(supabase, blogId),
  ]);
  return { eventos, artigos: (artigos as unknown as ArtigoDoRelatorio[]) ?? [], contexto };
}
