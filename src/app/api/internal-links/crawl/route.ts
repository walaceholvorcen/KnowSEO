import { NextResponse } from "next/server";
import {
  requireUserAndWorkspace,
  completeOnboardingStep,
} from "@/lib/workspace";
import { crawlSite, normalizeSiteUrl, isPublicHttpUrl } from "@/lib/crawler";

// Crawl pode levar dezenas de segundos em sites grandes.
export const maxDuration = 60;

export async function POST(request: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const { blogId, siteUrl } = await request.json();

  if (!blogId || !siteUrl) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  // Confirma que o blog pertence ao workspace de quem chamou.
  const { data: blog } = await supabase
    .from("blogs")
    .select("id")
    .eq("id", blogId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!blog) {
    return NextResponse.json({ error: "blog not found" }, { status: 404 });
  }

  const origin = normalizeSiteUrl(siteUrl);
  if (!origin || !isPublicHttpUrl(origin)) {
    return NextResponse.json(
      { error: "URL inválida o no permitida" },
      { status: 400 },
    );
  }

  const pages = await crawlSite(origin);

  if (!pages.length) {
    return NextResponse.json(
      {
        error:
          "No encontramos un sitemap en ese dominio. Puedes añadir las páginas manualmente.",
      },
      { status: 422 },
    );
  }

  // upsert para poder recrawlear sem duplicar (unique em blog_id + url).
  const { data: inserted, error } = await supabase
    .from("internal_links")
    .upsert(
      pages.map((p) => ({
        blog_id: blogId,
        url: p.url,
        title: p.title,
        description: p.description,
      })),
      { onConflict: "blog_id,url" },
    )
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await completeOnboardingStep(supabase, workspace, "site_analyzed");

  return NextResponse.json({ links: inserted, count: inserted?.length ?? 0 });
}
