import { notFound } from "next/navigation";
import { requireUserAndWorkspace } from "@/lib/workspace";
import type { Article } from "@/types";
import { ArticleEditor } from "./article-editor";

export default async function ArticleEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUserAndWorkspace();

  const { data: article } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .single();

  if (!article) notFound();

  return <ArticleEditor article={article as Article} />;
}
