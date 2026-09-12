import { notFound } from "next/navigation";
import { requireUserAndWorkspace } from "@/lib/workspace";
import type { Article, Blog } from "@/types";
import { ArticleEditor } from "./article-editor";

export default async function ArticleEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, workspace } = await requireUserAndWorkspace();

  const { data: article } = await supabase
    .from("articles")
    .select("*, blogs!inner(*)")
    .eq("id", id)
    .single();

  if (!article) notFound();

  const blog = article.blogs as Blog;
  if (blog.workspace_id !== workspace.id) notFound();

  // Contexto que a trava de qualidade precisa para julgar o artigo: a pauta
  // que o originou, as páginas do site (para reconhecer link interno de
  // verdade) e as pautas já publicadas (para acusar canibalização).
  const [{ data: pauta }, { data: paginas }, { data: publicados }] =
    await Promise.all([
      article.keyword_id
        ? supabase
            .from("keywords")
            .select("keyword")
            .eq("id", article.keyword_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("internal_links").select("url").eq("blog_id", blog.id),
      supabase
        .from("articles")
        .select("keywords(keyword)")
        .eq("blog_id", blog.id)
        .eq("status", "published")
        .neq("id", article.id),
    ]);

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
  const host = blog.custom_domain || `${blog.subdomain}.${rootDomain}`;
  const protocolo = host.includes("localhost") ? "http" : "https";

  return (
    <ArticleEditor
      article={article as Article}
      enderecoPublico={`${protocolo}://${host}/${article.slug}`}
      pauta={(pauta as { keyword: string } | null)?.keyword ?? null}
      linksConhecidos={
        ((paginas as { url: string }[]) ?? []).map((l) => l.url)
      }
      keywordsPublicadas={
        // O Supabase devolve a relação como lista, mesmo sendo 1 para 1.
        ((publicados as { keywords: { keyword: string }[] | null }[]) ?? [])
          .flatMap((a) => a.keywords ?? [])
          .map((k) => k.keyword)
          .filter(Boolean)
      }
    />
  );
}
