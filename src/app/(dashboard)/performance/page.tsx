import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { Lede } from "@/components/lede";
import { botao, pagina } from "@/components/ui";
import { lerFuso } from "@/lib/datas";
import { diaNoFuso } from "@/lib/grafico";
import { lerPeriodo } from "@/lib/google/desempenho";
import { carregarDesempenho, carregarIndexacao, enderecoDoBlog, type Escopo } from "./dados";
import { DesempenhoBoard } from "./desempenho-board";

export default async function DesempenhoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; escopo?: string }>;
}) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog) redirect("/onboarding");

  const conectar = (
    <Link href="/settings/integrations" className={botao("primario")}>
      Abrir Integrações
    </Link>
  );

  // Sem propriedade escolhida não há o que perguntar ao Google.
  if (!blog.gsc_property) {
    return (
      <div className={pagina()}>
        <Lede
          acao={conectar}
          apoio="Conecte a conta Google e escolha a propriedade do Search Console deste cliente. Depois disso, cliques, impressões e posição aparecem aqui, sem abrir outra aba."
        >
          O Search Console ainda não está ligado a este blog.
        </Lede>
      </div>
    );
  }

  const params = await searchParams;
  const periodo = lerPeriodo(params.periodo);
  const filtro = enderecoDoBlog(blog);
  const escopo: Escopo = params.escopo === "blog" && filtro ? "blog" : "site";

  const { data: publicados } = await supabase
    .from("articles")
    .select("slug")
    .eq("blog_id", blog.id)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  const slugs = ((publicados as { slug: string }[]) ?? []).map((a) => a.slug);

  // Falha do Google vira `null` aqui e a tela de erro é montada depois, fora
  // de qualquer try: é uma recusa esperada (conexão vencida), não um defeito.
  const [tela, indexacao] = await Promise.all([
    carregarDesempenho({
    workspaceId: workspace.id,
    blog,
    periodo,
    escopo,
    hoje: diaNoFuso(new Date(), await lerFuso()),
  }).catch((err) => {
    console.error("[desempenho] leitura do Search Console falhou", err);
    return null;
  }),
    carregarIndexacao({ workspaceId: workspace.id, blog, slugs }),
  ]);

  if (!tela) {
    return (
      <div className={pagina()}>
        <Lede
          acao={conectar}
          apoio="A conexão pode ter expirado ou a conta conectada pode ter perdido o acesso a esta propriedade. Reconectar em Integrações costuma resolver."
        >
          O Google não deixou ler o desempenho agora.
        </Lede>
      </div>
    );
  }

  return (
    <DesempenhoBoard
      tela={tela}
      periodo={periodo}
      escopo={escopo}
      propriedade={blog.gsc_property}
      enderecoDoBlog={filtro}
      indexacao={indexacao}
    />
  );
}
