import { NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";
import { generateCarouselSlides } from "@/lib/anthropic";
import { htmlParaTexto } from "@/lib/utils";
import { isAiConfigured, AI_NOT_CONFIGURED_MESSAGE } from "@/lib/ai-config";
import type { Blog, BrandDna } from "@/types";

export async function POST(request: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const { articleId } = await request.json();

  if (!articleId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: AI_NOT_CONFIGURED_MESSAGE },
      { status: 503 },
    );
  }

  const { data: article } = await supabase
    .from("articles")
    .select("*, blogs!inner(*)")
    .eq("id", articleId)
    .single();

  if (!article) {
    return NextResponse.json({ error: "article not found" }, { status: 404 });
  }

  const blog = article.blogs as Blog;
  if (blog.workspace_id !== workspace.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const bodyText = htmlParaTexto(article.content_html ?? "");
  if (!bodyText) {
    return NextResponse.json(
      { error: "O artigo ainda não tem conteúdo para virar carrossel." },
      { status: 422 },
    );
  }

  const { data: dna } = await supabase
    .from("brand_dna")
    .select("*")
    .eq("blog_id", blog.id)
    .maybeSingle();

  let slides;
  try {
    slides = await generateCarouselSlides({
      blog,
      dna: dna as BrandDna | null,
      title: article.title,
      bodyText,
      ctaText: blog.cta_config?.button_text,
    });
  } catch (err) {
    console.error("[carousel/generate] falha na IA", err);
    return NextResponse.json(
      { error: "Não foi possível gerar o carrossel agora. Tente de novo." },
      { status: 502 },
    );
  }

  if (!slides.length) {
    return NextResponse.json(
      { error: "A IA não devolveu slides. Tente de novo." },
      { status: 502 },
    );
  }

  const { error: saveError } = await supabase
    .from("articles")
    .update({ carousel_slides: slides })
    .eq("id", articleId);

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({ slides });
}
