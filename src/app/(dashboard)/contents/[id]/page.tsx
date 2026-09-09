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

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
  const host = blog.custom_domain || `${blog.subdomain}.${rootDomain}`;
  const protocolo = host.includes("localhost") ? "http" : "https";

  return (
    <ArticleEditor
      article={article as Article}
      enderecoPublico={`${protocolo}://${host}/${article.slug}`}
    />
  );
}
