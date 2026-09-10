import { NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";

// Progresso de uma rodada do Radar GEO. A tela consulta isto a cada poucos
// segundos enquanto a análise roda em segundo plano - é o que permite sair
// da página e voltar encontrando "12 de 30" em vez de um botão parado.
//
// Leitura pelo client do usuário: a RLS de ai_visibility_runs e de
// ai_visibility_checks já restringe aos blogs do workspace.
export async function GET(request: Request) {
  const { supabase } = await requireUserAndWorkspace();
  const runId = new URL(request.url).searchParams.get("runId");

  if (!runId) {
    return NextResponse.json({ error: "runId obrigatório" }, { status: 400 });
  }

  const { data: rodada } = await supabase
    .from("ai_visibility_runs")
    .select("id,status,total,falhas,error_message")
    .eq("id", runId)
    .maybeSingle();

  if (!rodada) {
    return NextResponse.json({ error: "rodada não encontrada" }, { status: 404 });
  }

  const { count } = await supabase
    .from("ai_visibility_checks")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId);

  const r = rodada as {
    id: string;
    status: string;
    total: number;
    falhas: number;
    error_message: string | null;
  };

  return NextResponse.json({
    ...r,
    // Falha também é consulta concluída: sem somá-la, uma rodada com erros
    // parece parada antes de chegar ao total.
    concluidas: (count ?? 0) + r.falhas,
  });
}
