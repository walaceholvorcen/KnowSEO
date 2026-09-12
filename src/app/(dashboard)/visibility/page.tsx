import { redirect } from "next/navigation";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { getProviders, MAX_PERGUNTAS } from "@/lib/ai-visibility/runner";
import type { AiQuery, AiVisibilityCheck } from "@/types";
import { VisibilityBoard, type RodadaResumo } from "./visibility-board";

export default async function VisibilityPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog) redirect("/onboarding");

  const [{ data: queries }, { data: checks }, { data: rodada }] =
    await Promise.all([
      // As mesmas dez que a rodada usa: a tela não pode listar perguntas que
      // a análise não vai consultar.
      supabase
        .from("ai_queries")
        .select("*")
        .eq("blog_id", blog.id)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(MAX_PERGUNTAS),
      supabase
        .from("ai_visibility_checks")
        .select("*")
        .eq("blog_id", blog.id)
        .order("checked_at", { ascending: false })
        .limit(500),
      supabase
        .from("ai_visibility_runs")
        .select("id,status,total,falhas,error_message")
        .eq("blog_id", blog.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  // Rodada em curso: conta o que já chegou, para a tela abrir mostrando o
  // progresso real quando o cliente volta no meio da análise.
  let resumo: RodadaResumo | null = null;
  if (rodada) {
    const r = rodada as {
      id: string;
      status: RodadaResumo["status"];
      total: number;
      falhas: number;
      error_message: string | null;
    };
    const { count } =
      r.status === "running"
        ? await supabase
            .from("ai_visibility_checks")
            .select("id", { count: "exact", head: true })
            .eq("run_id", r.id)
        : { count: r.total };
    resumo = {
      id: r.id,
      status: r.status,
      total: r.total,
      concluidas: (count ?? 0) + (r.status === "running" ? r.falhas : 0),
      error_message: r.error_message,
    };
  }

  return (
    <VisibilityBoard
      blogId={blog.id}
      queries={((queries as AiQuery[]) ?? []).reverse()}
      checks={(checks as AiVisibilityCheck[]) ?? []}
      rodada={resumo}
      motores={getProviders().map((p) => p.name)}
    />
  );
}
