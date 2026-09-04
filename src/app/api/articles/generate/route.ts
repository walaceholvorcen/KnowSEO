import { NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";
import { generateArticle } from "@/lib/anthropic";
import { slugify } from "@/lib/utils";
import type { Blog, BrandDna, InternalLink, Keyword } from "@/types";

export async function POST(request: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const { keywordId } = await request.json();

  const { data: keyword } = await supabase
    .from("keywords")
    .select("*, blogs!inner(*)")
    .eq("id", keywordId)
    .single();

  if (!keyword) {
    return NextResponse.json({ error: "keyword not found" }, { status: 404 });
  }

  const blog = keyword.blogs as Blog;

  if (blog.workspace_id !== workspace.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (workspace.credits <= 0) {
    return NextResponse.json(
      { error: "no credits available" },
      { status: 402 },
    );
  }

  const { data: dna } = await supabase
    .from("brand_dna")
    .select("*")
    .eq("blog_id", blog.id)
    .maybeSingle();

  const { data: internalLinks } = await supabase
    .from("internal_links")
    .select("*")
    .eq("blog_id", blog.id);

  // Cria o artigo em estado "generating" já para o usuário poder navegar
  // até ele e ver o spinner, em vez de esperar a resposta da IA na tela
  // de listagem.
  const { data: draft, error: draftError } = await supabase
    .from("articles")
    .insert({
      blog_id: blog.id,
      keyword_id: keyword.id,
      title: (keyword as Keyword).suggested_title ?? keyword.keyword,
      slug: slugify(
        (keyword as Keyword).suggested_title ?? keyword.keyword,
      ),
      generation_status: "generating",
    })
    .select()
    .single();

  if (draftError || !draft) {
    return NextResponse.json(
      { error: draftError?.message ?? "could not create draft" },
      { status: 500 },
    );
  }

  await supabase
    .from("keywords")
    .update({ status: "written" })
    .eq("id", keyword.id);

  try {
    const generated = await generateArticle({
      blog,
      dna: dna as BrandDna | null,
      keyword: keyword.keyword,
      suggestedTitle: (keyword as Keyword).suggested_title,
      internalLinks: (internalLinks as InternalLink[]) ?? [],
    });

    if (!generated) {
      throw new Error("empty response from model");
    }

    const { data: finalArticle } = await supabase
      .from("articles")
      .update({
        title: generated.title,
        slug: slugify(generated.slug || generated.title),
        seo_title: generated.seo_title,
        seo_description: generated.seo_description,
        excerpt: generated.excerpt,
        content_html: generated.content_html,
        generation_status: "done",
        updated_at: new Date().toISOString(),
      })
      .eq("id", draft.id)
      .select()
      .single();

    // Debita 1 crédito pelo artigo gerado.
    await supabase
      .from("workspaces")
      .update({ credits: Math.max(0, workspace.credits - 1) })
      .eq("id", workspace.id);

    return NextResponse.json({ article: finalArticle });
  } catch (err) {
    await supabase
      .from("articles")
      .update({ generation_status: "error" })
      .eq("id", draft.id);

    console.error("[articles/generate] failed", err);
    return NextResponse.json(
      { error: "generation failed", articleId: draft.id },
      { status: 500 },
    );
  }
}
