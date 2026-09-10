import { NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";
import { generateKeywordIdeas } from "@/lib/anthropic";
import {
  fetchRealKeywordMetrics,
  isDataForSeoConfigured,
} from "@/lib/dataforseo";
import { buscarVolumeDeBusca, isGoogleAdsConfigured } from "@/lib/google/ads";
import { buscarConexao } from "@/lib/google/oauth";
import { enriquecer, type MetricaReal } from "@/lib/keywords/metricas";
import { isAiConfigured, AI_NOT_CONFIGURED_MESSAGE } from "@/lib/ai-config";
import type { Blog, BrandDna, Keyword } from "@/types";

export async function POST(request: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const { blogId, temaId, pergunta } = (await request.json()) as {
    blogId: string;
    temaId?: number;
    pergunta?: string;
  };

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: AI_NOT_CONFIGURED_MESSAGE },
      { status: 503 },
    );
  }

  const { data: blog } = await supabase
    .from("blogs")
    .select("*")
    .eq("id", blogId)
    .eq("workspace_id", workspace.id)
    .single();

  if (!blog) {
    return NextResponse.json({ error: "blog not found" }, { status: 404 });
  }

  const { data: dna } = await supabase
    .from("brand_dna")
    .select("*")
    .eq("blog_id", blogId)
    .maybeSingle();

  const { data: existing } = await supabase
    .from("keywords")
    .select("keyword")
    .eq("blog_id", blogId);

  const existingKeywords = (existing as { keyword: string }[])?.map(
    (k) => k.keyword,
  ) ?? [];

  // Pauta pedida a partir de um tema da Análise de Mercado. A RLS de
  // market_themes já limita a leitura aos blogs do workspace, então um id de
  // outra conta simplesmente não devolve linha.
  let tema: { termo: string; exemplos: string[] } | null = null;
  if (temaId) {
    const { data } = await supabase
      .from("market_themes")
      .select("termo,exemplos")
      .eq("id", temaId)
      .maybeSingle();
    tema = (data as { termo: string; exemplos: string[] } | null) ?? null;
  }

  // Pauta pedida a partir de uma pergunta que a marca perdeu no Radar GEO.
  // É o laço que o produto não fechava: o módulo media a derrota e parava
  // ali, com o gerador de artigo na tela ao lado.
  const perguntaPerdida = pergunta?.trim() || null;

  let ideas;
  try {
    ideas = await generateKeywordIdeas({
      blog: blog as Blog,
      dna: dna as BrandDna | null,
      existingKeywords,
      tema,
      perguntaPerdida,
    });
  } catch (err) {
    console.error("[keywords/suggest] falha na IA", err);
    return NextResponse.json(
      { error: "Não foi possível gerar sugestões agora. Tente de novo em instantes." },
      { status: 502 },
    );
  }

  if (!ideas.length) {
    return NextResponse.json(
      { error: "A IA não devolveu sugestões. Tente de novo." },
      { status: 502 },
    );
  }

  // Troca a opinião do modelo por medição do Google onde der. A ordem é
  // deliberada: o Planejador de Palavras-chave é a fonte que o mercado usa
  // como referência e sai de graça; a DataForSEO fica como caminho pago
  // alternativo para quem já paga por ela.
  const termos = ideas.map((i) => i.keyword);
  const dominioDoBlog = (blog as Blog).custom_domain;
  const idiomaDoTexto = (blog as Blog).language;

  let metricas = new Map<string, MetricaReal>();
  let paisMedido: string | null = null;

  if (isGoogleAdsConfigured()) {
    const conexao = await buscarConexao(workspace.id).catch(() => null);
    if (conexao) {
      try {
        const resposta = await buscarVolumeDeBusca({
          workspaceId: workspace.id,
          keywords: termos,
          dominio: dominioDoBlog,
          idioma: idiomaDoTexto,
        });
        metricas = resposta.metricas;
        paisMedido = resposta.pais;
      } catch (err) {
        // Volume é enriquecimento, não requisito: uma falha aqui não pode
        // derrubar a geração de pauta inteira.
        console.error("[keywords/suggest] Google Ads indisponível", err);
      }
    }
  }

  const usouGoogleAds = metricas.size > 0;

  const legado =
    !usouGoogleAds && isDataForSeoConfigured()
      ? await fetchRealKeywordMetrics(
          termos,
          idiomaDoTexto === "pt" ? "co" : "es",
        )
      : new Map();

  const rows = ideas.map((idea) => {
    const medido = usouGoogleAds
      ? enriquecer(idea.keyword, metricas)
      : null;
    const antigo = legado.get(idea.keyword.toLowerCase());

    return {
      blog_id: blogId,
      keyword: idea.keyword,
      suggested_title: idea.suggested_title,
      funnel_stage: idea.funnel_stage,
      // Continua sendo leitura do modelo de propósito: o que o Google Ads
      // mede é concorrência de anunciantes, que é outra coisa.
      difficulty: idea.difficulty,
      opportunity_score: idea.opportunity_score,
      search_volume: medido?.search_volume ?? antigo?.search_volume ?? null,
      competition_index:
        medido?.competition_index ?? antigo?.competition_index ?? null,
      source: medido?.source ?? (antigo ? "dataforseo" : "ai"),
      status: "suggested" as const,
    };
  });

  const { data: inserted, error } = await supabase
    .from("keywords")
    .insert(rows)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    keywords: inserted as Keyword[],
    // A tela mostra o país junto do volume: dedução errada precisa aparecer
    // na hora, não virar decisão de pauta com número do país errado.
    pais: paisMedido,
  });
}
