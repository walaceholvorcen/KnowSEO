import type { SupabaseClient } from "@supabase/supabase-js";
import { extractDomain, isDirectory } from "@/lib/citation";
import {
  perguntasComCitacao,
  perguntasDaRodada,
  type CheckMin,
} from "@/lib/ai-visibility/resumo";
import type { AnalyticsEvent } from "@/types";

// Quantos dias de operação o Início enxerga. O mesmo número vale para o
// total de visitas, para as barras por dia e para o texto das linhas -
// mudou aqui, mudou em todo lugar.
export const DIAS_JANELA = 28;

export interface ArtigoResumo {
  id: string;
  titulo: string;
  publicadoEm: string | null;
  visitas: number;
}

export interface PautaResumo {
  id: string;
  termo: string;
  volume: number | null;
}

export interface TemaResumo {
  termo: string;
  paginasCliente: number;
  paginasConcorrentes: number;
  situacao: string;
}

export interface DadosInicio {
  notaGoogle: number | null;
  pautas: number;
  publicados: number;
  visitas: number;
  conversas: number;
  /** Uma posição por dia, da mais antiga (índice 0) à de hoje. */
  visitasPorDia: number[];
  perguntas: number;
  /** Perguntas cobertas pela rodada mais recente do Radar. */
  perguntasRodada: number;
  /** Perguntas citadas em ao menos um assistente; null se nunca rodou. */
  citacoes: number | null;
  rivalCitado: string | null;
  primeiraPublicacao: string | null;
  /** Nota de prontidão para IA da última auditoria. */
  notaIa: number | null;
  auditoriaEm: string | null;
  /** Nota do Google na auditoria anterior do mesmo site, para o "desde". */
  notaGoogleAnterior: number | null;
  /** Achados da última auditoria, separados pelo que exige ação agora. */
  achadosGraves: number;
  achadosTotal: number;
  geoEm: string | null;
  motoresMedidos: string[];
  /** Domínios diferentes que a IA citou na última rodada. */
  fontes: number;
  rascunhos: number;
  ultimosArtigos: ArtigoResumo[];
  proximasPautas: PautaResumo[];
  mercadoEm: string | null;
  temas: TemaResumo[];
  chances: number;
}

// Toda a leitura de banco do Início, num lugar só - a página logada e a
// vitrine local de design chamam a mesma função, então o que uma mostra a
// outra também mostra.
export async function carregarInicio(
  supabase: SupabaseClient,
  blogId: string,
): Promise<DadosInicio> {
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);
  desde.setDate(desde.getDate() - (DIAS_JANELA - 1));

  const [
    { data: audits },
    { count: pautas },
    { count: publicados },
    { data: eventos },
    { count: perguntas },
    { data: checks },
    { data: primeiroArtigo },
    { count: rascunhos },
    { data: publicadosRecentes },
    { data: pautasTopo },
    { data: analises },
  ] = await Promise.all([
    supabase
      .from("site_audits")
      .select("id,site_url,score_google,score_ai,status,created_at")
      .eq("blog_id", blogId)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("keywords")
      .select("id", { count: "exact", head: true })
      .eq("blog_id", blogId)
      .eq("status", "suggested"),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("blog_id", blogId)
      .eq("status", "published"),
    supabase
      .from("analytics_events")
      .select("event_type,created_at,article_id")
      .eq("blog_id", blogId)
      .gte("created_at", desde.toISOString()),
    supabase
      .from("ai_queries")
      .select("id", { count: "exact", head: true })
      .eq("blog_id", blogId)
      .eq("active", true),
    supabase
      .from("ai_visibility_checks")
      .select("cited,competitors,checked_at,run_id,query_id,provider")
      .eq("blog_id", blogId)
      .order("checked_at", { ascending: false })
      .limit(200),
    supabase
      .from("articles")
      .select("published_at")
      .eq("blog_id", blogId)
      .eq("status", "published")
      .not("published_at", "is", null)
      .order("published_at", { ascending: true })
      .limit(1),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("blog_id", blogId)
      .eq("status", "draft"),
    supabase
      .from("articles")
      .select("id,title,published_at")
      .eq("blog_id", blogId)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(3),
    supabase
      .from("keywords")
      .select("id,keyword,search_volume")
      .eq("blog_id", blogId)
      .eq("status", "suggested")
      .order("search_volume", { ascending: false, nullsFirst: false })
      .limit(3),
    supabase
      .from("market_analyses")
      .select("id,created_at")
      .eq("blog_id", blogId)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const eventosLista =
    (eventos as Pick<
      AnalyticsEvent,
      "event_type" | "created_at" | "article_id"
    >[]) ?? [];
  const visitasPorArtigo = new Map<string, number>();
  const visitasPorDia = Array.from({ length: DIAS_JANELA }, () => 0);
  let visitas = 0;
  let conversas = 0;
  for (const e of eventosLista) {
    if (e.event_type === "pageview") {
      visitas++;
      if (e.article_id) {
        visitasPorArtigo.set(
          e.article_id,
          (visitasPorArtigo.get(e.article_id) ?? 0) + 1,
        );
      }
      const dia = Math.floor(
        (new Date(e.created_at).getTime() - desde.getTime()) / 86_400_000,
      );
      if (dia >= 0 && dia < DIAS_JANELA) visitasPorDia[dia]++;
    } else if (
      e.event_type === "cta_click" ||
      e.event_type === "whatsapp_click"
    ) {
      conversas++;
    }
  }

  // Só a rodada mais recente conta: misturar rodadas antigas faria a taxa
  // de citação parecer melhor (ou pior) do que a situação de hoje.
  const rodadas =
    (checks as
      | (CheckMin & {
          competitors: string[] | null;
          checked_at: string;
          run_id: string | null;
        })[]
      | null) ?? [];
  // Identidade da rodada quando existe; data só para o que foi gravado antes
  // do run_id existir. Agrupar por dia fundia duas análises do mesmo dia.
  const chave = (c: (typeof rodadas)[number]) =>
    c.run_id ?? c.checked_at.slice(0, 10);
  const ultimaRodada = rodadas[0] ? chave(rodadas[0]) : null;
  const daRodada = rodadas.filter((c) => chave(c) === ultimaRodada);

  // Contado em perguntas, não em checagens: com três motores na rodada,
  // "12 citações de 10 perguntas" seria a conta errada na tela.
  const citacoes = daRodada.length
    ? perguntasComCitacao(daRodada).size
    : null;
  const perguntasRodada = perguntasDaRodada(daRodada).size;

  // Diretório não é rival: sem este filtro o painel chegava a anunciar "a IA
  // cita semrush.com no seu lugar", que é uma frase sem sentido para o
  // cliente. Filtrado na leitura porque as checagens antigas continuam sujas.
  const porRival = new Map<string, number>();
  for (const c of daRodada) {
    for (const bruto of c.competitors ?? []) {
      const d = extractDomain(bruto);
      if (!d || isDirectory(d)) continue;
      porRival.set(d, (porRival.get(d) ?? 0) + 1);
    }
  }
  const rivalCitado =
    [...porRival.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const auditorias =
    (audits as {
      id: string;
      site_url: string;
      score_google: number | null;
      score_ai: number | null;
      created_at: string;
    }[]) ?? [];
  const auditoria = auditorias[0];
  // A comparação é sempre do mesmo site: auditar dois domínios no mesmo blog
  // e comparar as notas inventaria uma evolução que não houve.
  const auditoriaAnterior = auditoria
    ? auditorias.find(
        (a) => a.id !== auditoria.id && a.site_url === auditoria.site_url,
      )
    : undefined;

  // Segunda leva: depende de um id que só existe depois da primeira.
  const analise = (analises as { id: string; created_at: string }[] | null)?.[0];
  const [{ data: achados }, { data: temas }, { count: chances }] =
    await Promise.all([
      auditoria
        ? supabase
            .from("audit_findings")
            .select("severity")
            .eq("audit_id", auditoria.id)
        : Promise.resolve({ data: [] }),
      analise
        ? supabase
            .from("market_themes")
            .select("termo,paginas_cliente,paginas_concorrentes,situacao")
            .eq("analysis_id", analise.id)
            .order("posicao", { ascending: true })
            .limit(4)
        : Promise.resolve({ data: [] }),
      analise
        ? supabase
            .from("market_chances")
            .select("id", { count: "exact", head: true })
            .eq("analysis_id", analise.id)
        : Promise.resolve({ count: 0 }),
    ]);

  const listaAchados = (achados as { severity: string }[] | null) ?? [];

  // Domínios diferentes em que a IA se apoiou: é o tamanho do mercado de
  // fontes que o cliente disputa, e sai das citações já gravadas.
  const dominiosCitados = new Set<string>();
  for (const c of daRodada) {
    for (const bruto of c.competitors ?? []) {
      const d = extractDomain(bruto);
      if (d) dominiosCitados.add(d);
    }
  }

  return {
    notaGoogle: auditoria?.score_google ?? null,
    pautas: pautas ?? 0,
    publicados: publicados ?? 0,
    visitas,
    conversas,
    visitasPorDia,
    perguntas: perguntas ?? 0,
    perguntasRodada,
    citacoes,
    rivalCitado,
    primeiraPublicacao:
      (primeiroArtigo as { published_at: string }[] | null)?.[0]
        ?.published_at ?? null,
    notaIa: auditoria?.score_ai ?? null,
    auditoriaEm: auditoria?.created_at ?? null,
    notaGoogleAnterior: auditoriaAnterior?.score_google ?? null,
    achadosGraves: listaAchados.filter(
      (a) => a.severity === "critical" || a.severity === "high",
    ).length,
    achadosTotal: listaAchados.length,
    geoEm: daRodada[0]?.checked_at ?? null,
    motoresMedidos: [...new Set(daRodada.map((c) => c.provider))],
    fontes: dominiosCitados.size,
    rascunhos: rascunhos ?? 0,
    ultimosArtigos: (
      (publicadosRecentes as
        | { id: string; title: string; published_at: string | null }[]
        | null) ?? []
    ).map((a) => ({
      id: a.id,
      titulo: a.title,
      publicadoEm: a.published_at,
      visitas: visitasPorArtigo.get(a.id) ?? 0,
    })),
    proximasPautas: (
      (pautasTopo as
        | { id: string; keyword: string; search_volume: number | null }[]
        | null) ?? []
    ).map((k) => ({ id: k.id, termo: k.keyword, volume: k.search_volume })),
    mercadoEm: analise?.created_at ?? null,
    temas: (
      (temas as
        | {
            termo: string;
            paginas_cliente: number;
            paginas_concorrentes: number;
            situacao: string;
          }[]
        | null) ?? []
    ).map((t) => ({
      termo: t.termo,
      paginasCliente: t.paginas_cliente,
      paginasConcorrentes: t.paginas_concorrentes,
      situacao: t.situacao,
    })),
    chances: chances ?? 0,
  };
}
