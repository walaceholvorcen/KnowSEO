import { redirect } from "next/navigation";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { paisDoBlog } from "@/lib/keywords/metricas";
import { detectarIdioma, idiomaDoBlog, NOME_IDIOMA } from "@/lib/idioma";
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

  // Acervo gerado antes de o idioma vir do domínio: marca na leitura, sem
  // migração, para a promessa do topo ("saem em espanhol") não conviver
  // calada com pautas em português logo abaixo.
  const idioma = idiomaDoBlog(blog);
  const lista = (keywords as Keyword[]) ?? [];
  const fora = lista
    .filter((k) => k.status === "suggested")
    .map((k) => ({
      id: k.id,
      detectado: detectarIdioma(`${k.suggested_title ?? ""} ${k.keyword}`),
    }))
    .filter((k) => k.detectado !== null && k.detectado !== idioma.codigo);
  const idiomasFora = new Set(fora.map((k) => k.detectado!));

  return (
    <StrategyBoard
      blogId={blog.id}
      initialKeywords={lista}
      pais={`${pais.preposicao} ${pais.rotulo}`}
      idioma={idioma.rotulo}
      foraDoIdioma={fora.map((k) => k.id)}
      nomeIdiomaFora={
        idiomasFora.size === 1
          ? NOME_IDIOMA[[...idiomasFora][0]]
          : "outro idioma"
      }
    />
  );
}
