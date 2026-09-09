import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireUserAndWorkspace } from "@/lib/workspace";
import { ArticleView } from "@/components/article-view";
import { LiveBridge } from "./live-bridge";
import type { Article, Blog } from "@/types";

// Prévia do artigo, servida dentro do iframe do editor.
//
// Fora do grupo (dashboard) de propósito: aqui não entra barra lateral
// nenhuma - o que aparece é a página do blog, e só ela.
export default async function ArticlePreviewPage({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId } = await params;
  const { supabase, workspace } = await requireUserAndWorkspace();

  // Rascunho é conteúdo privado: só quem é do workspace dono do blog vê.
  const { data: article } = await supabase
    .from("articles")
    .select("*, blogs!inner(*)")
    .eq("id", articleId)
    .single();

  if (!article) notFound();

  const blog = article.blogs as Blog;
  if (blog.workspace_id !== workspace.id) notFound();

  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  const host = (await headers()).get("host") ?? "";

  return (
    <>
      <LiveBridge origin={`${proto}://${host}`} />
      <ArticleView blog={blog} article={article as Article} preview />
    </>
  );
}
