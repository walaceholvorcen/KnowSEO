import type { SupabaseClient } from "@supabase/supabase-js";
import type { Evento, Periodo } from "@/lib/relatorio";

// Mesma carga para o painel (client com RLS) e para o link público (client
// admin, filtrado pelo blog do token): as duas telas não podem divergir.

export type ArtigoDoRelatorio = {
  id: string;
  title: string;
  slug: string;
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

export async function carregarRelatorio(supabase: SupabaseClient, blogId: string, periodo: Periodo) {
  const [eventos, { data: artigos }] = await Promise.all([
    eventosDoPeriodo(supabase, blogId, periodo),
    supabase
      .from("articles")
      .select("id, title, slug, keywords(keyword)")
      .eq("blog_id", blogId)
      .eq("status", "published"),
  ]);
  return { eventos, artigos: (artigos as unknown as ArtigoDoRelatorio[]) ?? [] };
}
