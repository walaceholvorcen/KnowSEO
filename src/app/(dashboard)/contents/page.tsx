import { redirect } from "next/navigation";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { htmlParaTexto } from "@/lib/utils";
import { lerFuso } from "@/lib/datas";
import { detectarIdioma, idiomaDoBlog, trechosForaDoMercado } from "@/lib/idioma";
import { paisDoBlog } from "@/lib/keywords/metricas";
import type { Article } from "@/types";
import { ContentsBoard } from "./contents-board";

/** Começo da janela de 28 dias. Fora do componente: o lint recusa relógio
 *  dentro do corpo de quem renderiza, e com razão - o valor mudaria a cada
 *  reexecução. */
function inicioDaJanela() {
  return new Date(Date.now() - 28 * 86_400_000).toISOString();
}

export default async function ContentsPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog) redirect("/onboarding");

  const { data: articles } = await supabase
    .from("articles")
    .select("*")
    .eq("blog_id", blog.id)
    .order("created_at", { ascending: false });

  const lista = (articles as Article[]) ?? [];

  // Visitas dos últimos 28 dias por artigo. Sem isto a tela responde "o que
  // existe" e nunca "o que funcionou" - e o dado já estava no banco, a uma
  // consulta de distância, desde o primeiro dia.
  const desde = inicioDaJanela();
  const { data: eventos } = await supabase
    .from("analytics_events")
    .select("article_id")
    .eq("blog_id", blog.id)
    .eq("event_type", "pageview")
    .gte("created_at", desde);
  const visitasPorArtigo = new Map<string, number>();
  for (const e of (eventos as { article_id: string | null }[]) ?? []) {
    if (e.article_id) {
      visitasPorArtigo.set(e.article_id, (visitasPorArtigo.get(e.article_id) ?? 0) + 1);
    }
  }

  const fuso = await lerFuso();
  const publicados = lista.filter((a) => a.status === "published").length;
  const rascunhos = lista.length - publicados;

  // Artigos do acervo gerados antes de o idioma vir do domínio. Detecta pelo
  // título e pelo corpo sem tags (título curto sozinho costuma dar "não sei").
  // Artigo não se descarta em massa: pode estar no ar com visita. A tela só
  // aponta, com o trecho, e quem decide é quem abre o artigo.
  const idioma = idiomaDoBlog(blog);
  const foraDoBrasil =
    paisDoBlog({ dominio: blog.custom_domain, idioma: blog.language }).chave !== "br";
  const afetados = lista
    .map((a) => {
      const texto = `${a.title}\n${htmlParaTexto(a.content_html ?? "")}`;
      const detectado = detectarIdioma(texto);
      return {
        artigo: a,
        idiomaErrado:
          detectado !== null && detectado !== idioma.codigo ? detectado : null,
        // "no Brasil", "R$ 1.500": num blog que vende fora do Brasil é
        // mercado errado, mesmo se o idioma estiver certo.
        trechos: foraDoBrasil ? trechosForaDoMercado(texto, 2) : [],
      };
    })
    .filter((x) => x.idiomaErrado || x.trechos.length > 0);
  const veredito =
    lista.length === 0
      ? "Nenhum artigo ainda. Escolha uma pauta e a IA escreve o primeiro."
      : rascunhos === 0
        ? `${publicados} ${publicados === 1 ? "artigo publicado" : "artigos publicados"}.`
        : `${publicados} no ar, ${rascunhos} ${rascunhos === 1 ? "esperando revisão" : "esperando revisão"}.`;

  return (
    <ContentsBoard
      blog={blog}
      lista={lista}
      afetados={afetados}
      visitasPorArtigo={visitasPorArtigo}
      veredito={veredito}
      fuso={fuso}
    />
  );
}
