import { redirect } from "next/navigation";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { paisDoBlog } from "@/lib/keywords/metricas";
import type { Keyword } from "@/types";
import { StrategyBoard } from "./strategy-board";

export default async function StrategyPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog) redirect("/onboarding");

  const { data: keywords } = await supabase
    .from("keywords")
    .select("*")
    .eq("blog_id", blog.id)
    .order("created_at", { ascending: false });

  // O país é deduzido do mesmo jeito na tela e na consulta ao Google, para
  // que o rótulo mostrado seja de fato o país em que o volume foi medido.
  const pais = paisDoBlog({
    dominio: blog.custom_domain,
    idioma: blog.language,
  });

  return (
    <StrategyBoard
      blogId={blog.id}
      initialKeywords={(keywords as Keyword[]) ?? []}
      credits={workspace.credits}
      pais={`${pais.preposicao} ${pais.rotulo}`}
    />
  );
}
