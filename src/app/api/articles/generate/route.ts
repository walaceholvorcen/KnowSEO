import { NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { generateArticle } from "@/lib/anthropic";
import { slugify } from "@/lib/utils";
import { isAiConfigured, AI_NOT_CONFIGURED_MESSAGE } from "@/lib/ai-config";
import { avaliarArtigo } from "@/lib/artigo/qualidade";
import type { Blog, BrandDna, InternalLink, Keyword } from "@/types";

export async function POST(request: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const { keywordId } = await request.json();

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: AI_NOT_CONFIGURED_MESSAGE },
      { status: 503 },
    );
  }

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
  const draftTitle =
    (keyword as Keyword).suggested_title ?? keyword.keyword;

  const { data: draft, error: draftError } = await supabase
    .from("articles")
    .insert({
      blog_id: blog.id,
      keyword_id: keyword.id,
      title: draftTitle,
      slug: await uniqueSlug(supabase, blog.id, slugify(draftTitle)),
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
    const pedido = {
      blog,
      dna: dna as BrandDna | null,
      keyword: keyword.keyword,
      suggestedTitle: (keyword as Keyword).suggested_title,
      internalLinks: (internalLinks as InternalLink[]) ?? [],
    };
    const paginas = ((internalLinks as InternalLink[]) ?? []).map((l) => l.url);

    const conferir = (a: NonNullable<Awaited<ReturnType<typeof generateArticle>>>) =>
      avaliarArtigo({
        titulo: a.title,
        seoTitle: a.seo_title,
        seoDescription: a.seo_description,
        html: a.content_html,
        keyword: keyword.keyword,
        linksConhecidos: paginas,
      });

    let generated = await generateArticle(pedido);
    if (!generated) {
      throw new Error("empty response from model");
    }

    // Segunda tentativa pelo mesmo crédito quando a trava de qualidade
    // reprova: a falha foi da geração, não de quem pediu. Fica no melhor
    // resultado dos dois - insistir mais que isso é queimar tempo e token
    // num prompt que claramente não está resolvendo.
    let avaliacao = conferir(generated);
    if (avaliacao.travas.length > 0) {
      console.warn(
        "[articles/generate] reprovado na trava, tentando de novo",
        avaliacao.travas.map((t) => t.codigo),
      );
      const segunda = await generateArticle(pedido);
      if (segunda) {
        const avaliacaoDaSegunda = conferir(segunda);
        if (avaliacaoDaSegunda.travas.length < avaliacao.travas.length) {
          generated = segunda;
          avaliacao = avaliacaoDaSegunda;
        }
      }
    }

    const { data: finalArticle } = await supabase
      .from("articles")
      .update({
        title: generated.title,
        slug: await uniqueSlug(
          supabase,
          blog.id,
          slugify(generated.slug || generated.title),
          draft.id,
        ),
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

    // A avaliação vai junto para a tela poder abrir já dizendo o que ficou
    // pendente, em vez de o cliente descobrir só ao clicar em Publicar.
    return NextResponse.json({ article: finalArticle, avaliacao });
  } catch (err) {
    await supabase
      .from("articles")
      .update({ generation_status: "error" })
      .eq("id", draft.id);

    console.error("[articles/generate] failed", err);
    return NextResponse.json(
      {
        error:
          "A geração falhou. O rascunho foi salvo - tente gerar de novo.",
        articleId: draft.id,
      },
      { status: 500 },
    );
  }
}

// O slug é único por blog. Sem isto, uma geração que falhou deixa o
// rascunho gravado e a mesma keyword nunca mais pode ser gerada - o
// insert seguinte colide e o usuário fica travado sem entender por quê.
async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  blogId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = base || "artigo";

  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;

    let query = supabase
      .from("articles")
      .select("id")
      .eq("blog_id", blogId)
      .eq("slug", candidate);

    if (excludeId) query = query.neq("id", excludeId);

    const { data } = await query.maybeSingle();
    if (!data) return candidate;
  }

  // Fallback improvável: sufixo aleatório para nunca travar o usuário.
  return `${root}-${Math.random().toString(36).slice(2, 7)}`;
}
