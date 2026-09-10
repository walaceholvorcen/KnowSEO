import { after, NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";
import {
  executarRodada,
  getProviders,
  iniciarRodada,
  rodadaEmAndamento,
  MAX_PERGUNTAS,
} from "@/lib/ai-visibility/runner";
import type { AiQuery, Blog } from "@/types";

// O trabalho roda dentro de `after()`, que mantém a função viva até este
// limite depois de a resposta já ter voltado ao navegador. Dez perguntas em
// três motores, seis por vez, cabem com folga em cinco minutos.
export const maxDuration = 300;

// Dispara a rodada e responde NA HORA com o identificador dela.
//
// Antes esta rota só respondia quando a última pergunta terminava. O
// navegador ficava minutos esperando; sair da tela cancelava a espera, e ao
// voltar não havia registro de que algo estava rodando - o cliente clicava
// de novo e recomeçava do zero. Agora a análise independe da tela aberta.
export async function POST(request: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const { blogId } = (await request.json()) as { blogId: string };

  const providers = getProviders();
  if (!providers.length) {
    return NextResponse.json(
      {
        error:
          "Nenhum assistente de IA configurado: falta a chave de API no ambiente.",
      },
      { status: 503 },
    );
  }

  const { data: blog } = await supabase
    .from("blogs")
    .select("*")
    .eq("id", blogId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!blog) {
    return NextResponse.json({ error: "blog not found" }, { status: 404 });
  }

  // Clique duplo, ou volta à tela no meio da análise: devolve a rodada que
  // já está em curso em vez de abrir outra.
  const emCurso = await rodadaEmAndamento(blogId);
  if (emCurso) {
    return NextResponse.json({
      runId: emCurso.id,
      total: emCurso.total,
      jaEmAndamento: true,
    });
  }

  const { data: queries } = await supabase
    .from("ai_queries")
    .select("*")
    .eq("blog_id", blogId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(MAX_PERGUNTAS);

  if (!queries?.length) {
    return NextResponse.json(
      { error: "Gere primeiro o conjunto de perguntas." },
      { status: 422 },
    );
  }

  let runId: string;
  try {
    runId = await iniciarRodada({
      blogId,
      providers,
      perguntas: queries.length,
      origem: "manual",
    });
  } catch (err) {
    console.error("[ai-visibility/run] rodada não abriu", err);
    return NextResponse.json(
      {
        error:
          "Não foi possível iniciar a análise. Se acabou de atualizar o sistema, confira se a migração 0011 foi aplicada no banco.",
      },
      { status: 503 },
    );
  }

  after(async () => {
    try {
      await executarRodada({
        runId,
        blog: blog as Blog,
        queries: queries as AiQuery[],
        providers,
      });
    } catch (err) {
      console.error("[ai-visibility/run] rodada falhou", runId, err);
    }
  });

  return NextResponse.json({
    runId,
    total: queries.length * providers.length,
  });
}
