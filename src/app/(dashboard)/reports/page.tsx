import { redirect } from "next/navigation";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { assinarRelatorio, lerPeriodo } from "@/lib/relatorio";
import { carregarRelatorio } from "./dados";
import { Relatorio } from "./relatorio";
import { lerFuso } from "@/lib/datas";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; de?: string; ate?: string }>;
}) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog) redirect("/onboarding");

  // Período na URL, não em estado: "?dias=90" colado no chat abre o mesmo
  // recorte. Padrão de 28 dias, a mesma janela do Início.
  const periodo = lerPeriodo(await searchParams);
  const { eventos, artigos } = await carregarRelatorio(supabase, blog.id, periodo);

  // Sem segredo não há link: um token assinado com string vazia seria
  // forjável por qualquer um.
  const segredo = process.env.RELATORIO_SECRET;
  const token = segredo
    ? assinarRelatorio({ blogId: blog.id, de: periodo.de, ate: periodo.ate }, segredo)
    : null;

  return (
    <Relatorio blog={blog} periodo={periodo} eventos={eventos} artigos={artigos} token={token} fuso={await lerFuso()} />
  );
}
