import { NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";
import { generateKeywordIdeas } from "@/lib/anthropic";
import {
  fetchRealKeywordMetrics,
  isDataForSeoConfigured,
} from "@/lib/dataforseo";
import type { Blog, BrandDna, Keyword } from "@/types";

export async function POST(request: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const { blogId } = await request.json();

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

  const ideas = await generateKeywordIdeas({
    blog: blog as Blog,
    dna: dna as BrandDna | null,
    existingKeywords,
  });

  // Enriquece com dados reais da DataForSEO quando configurado - senão
  // fica só com a estimativa qualitativa de dificultad que la IA ya dio.
  const realMetrics = isDataForSeoConfigured()
    ? await fetchRealKeywordMetrics(
        ideas.map((i) => i.keyword),
        (blog as Blog).language === "pt" ? "co" : "es",
      )
    : new Map();

  const rows = ideas.map((idea) => {
    const real = realMetrics.get(idea.keyword.toLowerCase());
    return {
      blog_id: blogId,
      keyword: idea.keyword,
      suggested_title: idea.suggested_title,
      funnel_stage: idea.funnel_stage,
      difficulty: idea.difficulty,
      opportunity_score: idea.opportunity_score,
      search_volume: real?.search_volume ?? null,
      source: real ? "dataforseo" : "ai",
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

  return NextResponse.json({ keywords: inserted as Keyword[] });
}
