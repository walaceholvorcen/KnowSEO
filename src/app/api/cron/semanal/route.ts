import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarAuditoria } from "@/lib/audit/salvar";
import {
  executarRodada,
  getProviders,
  iniciarRodada,
  rodadaEmAndamento,
  MAX_PERGUNTAS,
} from "@/lib/ai-visibility/runner";
import type { AiQuery, Blog } from "@/types";
import { resultadoDaTarefa } from "@/lib/cron/resultado";
import { abrirExecucao, fecharExecucao } from "./execucoes";

// O acompanhamento semanal: reaudita o site e refaz o Raio X - GEO de cada
// blog, sem ninguém clicar.
//
// É isto que dá sentido às duas telas. SEO não muda na hora - o efeito de uma
// correção aparece em semanas -, e o cliente não volta para rodar a mesma
// análise toda segunda-feira. O produto roda por ele, e a tela abre dizendo
// o que mudou. A tese do produto ("um número que muda todo mês justifica a
// renovação") não se sustentava enquanto nada fazia o número mudar.
//
// Disparado pelo agendamento da Vercel (vercel.json). A Vercel manda
// `Authorization: Bearer <CRON_SECRET>` quando a variável existe; sem ela a
// rota recusa tudo, para que ninguém de fora dispare auditoria em massa.
//
// Disparo manual verificável: `GET /api/cron/semanal?forcar=1` com o mesmo
// `Authorization: Bearer <CRON_SECRET>` ignora o critério dos seis dias e
// reaudita/refaz o Raio X na hora. Existe porque, sem ele, conferir se o
// acompanhamento funciona exigia esperar a segunda-feira seguinte - e foi
// assim que ele passou semanas quebrado sem ninguém ver. Atenção: forçar
// também refaz o Raio X - GEO de cada blog com perguntas (custo de API).
// Cada disparo fica em `cron_execucoes` (ver ./execucoes.ts).
export const maxDuration = 300;

const INTERVALO_MS = 6 * 24 * 60 * 60 * 1000; // "já rodou esta semana"

// Blogs por disparo. Cada um pode levar até dois minutos; o que não couber
// hoje entra no disparo seguinte, porque o critério é "rodou há mais de seis
// dias", não "é segunda-feira".
const MAX_BLOGS = 5;

function venceu(quando: string | null | undefined, forcar = false): boolean {
  return forcar || !quando || Date.now() - new Date(quando).getTime() > INTERVALO_MS;
}

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const forcar = new URL(request.url).searchParams.get("forcar") === "1";
  const execucao = await abrirExecucao("/api/cron/semanal");

  const admin = createAdminClient();
  // Ordem fixa: sem ela o Postgres devolve em qualquer ordem e o mesmo blog
  // pode cair sempre fora dos MAX_BLOGS - nunca é reauditado.
  const { data: blogs } = await admin
    .from("blogs")
    .select("*")
    .order("created_at", { ascending: true });
  const providers = getProviders();

  // Cada tarefa leva um rótulo: é o que permite dizer no log QUAL blog e
  // QUAL etapa falhou, em vez de só contar falhas.
  const tarefas: { rotulo: string; promessa: Promise<unknown> }[] = [];
  const feito: { blog: string; auditoria?: string; radar?: string }[] = [];

  const lote = ((blogs as Blog[]) ?? []).slice(0, MAX_BLOGS);
  console.log(`[cron semanal] início, ${lote.length} blogs${forcar ? " (forçado)" : ""}`);

  for (const bruto of lote) {
    const blog = bruto;
    const registro: (typeof feito)[number] = { blog: blog.name };

    // Auditoria: reaudita o último site que o cliente escolheu auditar. Sem
    // auditoria manual anterior não há o que acompanhar.
    const { data: ultima } = await admin
      .from("site_audits")
      .select("site_url,created_at")
      .eq("blog_id", blog.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const auditoria = ultima as { site_url: string; created_at: string } | null;
    if (auditoria && venceu(auditoria.created_at, forcar)) {
      registro.auditoria = auditoria.site_url;
      tarefas.push({
        rotulo: `auditoria ${blog.name} (${auditoria.site_url})`,
        promessa: registrarAuditoria({
          blogId: blog.id,
          siteUrl: auditoria.site_url,
          tipo: "agendada",
        }),
      });
    }

    // Raio X - GEO: mesma lógica - só onde já existe conjunto de perguntas.
    if (providers.length) {
      const [{ data: queries }, { data: ultimaRodada }] = await Promise.all([
        admin
          .from("ai_queries")
          .select("*")
          .eq("blog_id", blog.id)
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(MAX_PERGUNTAS),
        admin
          .from("ai_visibility_runs")
          .select("started_at")
          .eq("blog_id", blog.id)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const perguntas = (queries as AiQuery[]) ?? [];
      const inicio = (ultimaRodada as { started_at: string } | null)?.started_at;

      if (perguntas.length && venceu(inicio, forcar) && !(await rodadaEmAndamento(blog.id))) {
        registro.radar = `${perguntas.length} perguntas`;
        tarefas.push({
          rotulo: `Raio X ${blog.name}`,
          promessa: iniciarRodada({
            blogId: blog.id,
            providers,
            perguntas: perguntas.length,
            origem: "agendada",
          }).then((runId) =>
            executarRodada({ runId, blog, queries: perguntas, providers }),
          ),
        });
      }
    }

    feito.push(registro);
  }

  // Tudo em paralelo: cada blog é independente, e em sequência cinco blogs
  // estourariam o limite de cinco minutos da função.
  const resultados = await Promise.allSettled(tarefas.map((t) => t.promessa));

  // As duas etapas resolvem mesmo quando falham (ver resultadoDaTarefa):
  // contar só os rejeitados respondia "falhas: 0" com tudo quebrado.
  let falhas = 0;
  const erros: { tarefa: string; erro: string }[] = [];
  resultados.forEach((r, i) => {
    const erro = resultadoDaTarefa(tarefas[i].rotulo, r);
    if (erro === null) return;
    falhas++;
    erros.push({ tarefa: tarefas[i].rotulo, erro });
    console.error(`[cron semanal] falhou: ${tarefas[i].rotulo}`, erro);
  });

  await fecharExecucao(execucao, {
    tarefas: tarefas.length,
    falhas,
    detalhe: { forcar, blogs: feito, erros },
  });

  console.log(
    `[cron semanal] fim: ${feito.length} blogs, ${tarefas.length} tarefas, ${falhas} falhas`,
  );

  return NextResponse.json({ blogs: feito, tarefas: tarefas.length, falhas });
}
