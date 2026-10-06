import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avaliarArtigo } from "@/lib/artigo/qualidade";
import { venceu } from "@/lib/calendario";
import { abrirExecucao, fecharExecucao } from "../semanal/execucoes";
import type { Article } from "@/types";

// Publica o que o calendário marcou para hoje.
//
// Uma janela por dia, às 8h UTC, e é isso que a tela promete: o agendamento
// da Vercel dispara uma vez ao dia, então prometer hora marcada seria
// mentira. A data vale o dia inteiro.
//
// O que este robô NÃO faz: escrever. O texto foi gerado e revisado por uma
// pessoa antes de receber data - é a opção (A) que o dono escolheu. Gerar e
// publicar no mesmo disparo (piloto automático) estrearia no blog do cliente
// um texto que ninguém leu.
export const maxDuration = 60;

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const execucao = await abrirExecucao("/api/cron/diario");
  const admin = createAdminClient();
  const agora = new Date();

  // Rascunho com data marcada. O filtro de data também vai no banco, mas a
  // decisão final é da função pura - é ela que a tela usa para dizer
  // "atrasado", e duas regras diferentes para a mesma pergunta divergiriam.
  const { data: candidatos } = await admin
    .from("articles")
    .select("*")
    .neq("status", "published")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", agora.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(50);

  const fila = ((candidatos as Article[]) ?? []).filter((a) =>
    venceu(a.scheduled_at, agora),
  );

  const publicados: string[] = [];
  const reprovados: { artigo: string; motivo: string }[] = [];

  for (const artigo of fila) {
    // A trava de qualidade roda de novo, aqui. Ela já rodou na geração e na
    // revisão, mas é neste disparo que ninguém está olhando - e uma trava
    // que não vale no caminho automático é decoração.
    //
    // Sem `keyword` nem `linksConhecidos`: as duas exigiriam uma consulta por
    // artigo e as regras que dependem delas já foram conferidas quando uma
    // pessoa publicou... ou não publicou. O que importa aqui é o
    // indefensável: texto raso, sem H2, markdown vazado.
    const avaliacao = avaliarArtigo({
      titulo: artigo.title,
      seoTitle: artigo.seo_title,
      seoDescription: artigo.seo_description,
      html: artigo.content_html ?? "",
    });

    if (avaliacao.travas.length) {
      const motivo = avaliacao.travas.map((t) => t.titulo).join("; ");
      reprovados.push({ artigo: artigo.title, motivo });
      // A data fica como está: o artigo aparece como "atrasado" no
      // calendário, que é exatamente o que ele é. Limpar a data aqui
      // esconderia o problema.
      console.warn(`[cron diário] não publicou "${artigo.title}": ${motivo}`);
      continue;
    }

    const { error } = await admin
      .from("articles")
      .update({
        status: "published",
        // A hora real em que foi ao ar, não a data agendada: é ela que
        // ordena o blog e vai no sitemap.
        published_at: agora.toISOString(),
        updated_at: agora.toISOString(),
      })
      .eq("id", artigo.id)
      .neq("status", "published");

    if (error) {
      reprovados.push({ artigo: artigo.title, motivo: error.message });
      console.error(`[cron diário] falhou ao publicar "${artigo.title}"`, error.message);
      continue;
    }
    publicados.push(artigo.title);
  }

  await fecharExecucao(execucao, {
    tarefas: fila.length,
    falhas: reprovados.length,
    detalhe: { publicados, reprovados },
  });

  console.log(
    `[cron diário] ${publicados.length} publicados, ${reprovados.length} retidos`,
  );

  return NextResponse.json({
    publicados: publicados.length,
    retidos: reprovados.length,
  });
}
