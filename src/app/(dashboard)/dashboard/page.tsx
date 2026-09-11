import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import { encontrarGargalo } from "@/lib/gargalo";
import { carregarInicio } from "./dados";
import { InicioBoard } from "./inicio-board";

export default async function DashboardHomePage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  const blog = blogs[0];

  const dados = await carregarInicio(supabase, blog.id);

  const gargalo = encontrarGargalo({
    notaGoogle: dados.notaGoogle,
    pautasAbertas: dados.pautas,
    artigosPublicados: dados.publicados,
    visitas: dados.visitas,
    conversas: dados.conversas,
    perguntasIa: dados.perguntas,
    citacoesIa: dados.citacoes,
    rivalCitado: dados.rivalCitado,
  });

  return (
    <InicioBoard
      blogNome={blog?.name ?? ""}
      feitos={workspace.onboarding_steps}
      gargalo={gargalo}
      dados={dados}
    />
  );
}
