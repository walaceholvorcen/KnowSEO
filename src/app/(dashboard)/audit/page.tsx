import { redirect } from "next/navigation";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { compararAuditorias, type AchadoResumo } from "@/lib/audit/comparar";
import { AuditBoard } from "./audit-board";
import { lerJornada } from "./jornada-dados";

export interface AuditRow {
  id: string;
  site_url: string;
  status: string;
  pages_analyzed: number;
  score_google: number | null;
  score_ai: number | null;
  /** 'manual' ou 'agendada'. Nulo antes da migração 0011. */
  origem?: string | null;
  created_at: string;
}

export interface FindingRow {
  id: number;
  audit_id: string;
  code: string;
  severity: string;
  category: string;
  title: string;
  impact: string | null;
  evidence: string | null;
  fix: string | null;
  affected_urls: string[];
  affected_count: number;
}

export default async function AuditPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog) redirect("/onboarding");

  const { data: audits } = await supabase
    .from("site_audits")
    .select("*")
    .eq("blog_id", blog.id)
    .order("created_at", { ascending: false })
    // Mais que as 10 da lista: a jornada precisa da primeira auditoria
    // do site para datar o diagnóstico e desenhar a evolução inteira.
    .limit(30);

  const concluidas = ((audits as AuditRow[]) ?? []).filter(
    (a) => a.status === "done",
  );
  const latest = concluidas[0] ?? null;

  // A anterior é do MESMO site. Comparar dataknow.es com outro domínio
  // auditado no meio produziria "resolvidos" que nunca foram corrigidos.
  const anterior = latest
    ? (concluidas.find(
        (a) => a.id !== latest.id && a.site_url === latest.site_url,
      ) ?? null)
    : null;

  const [{ data: findings }, { data: antigos }] = await Promise.all([
    latest
      ? supabase.from("audit_findings").select("*").eq("audit_id", latest.id)
      : Promise.resolve({ data: [] }),
    anterior
      ? supabase
          .from("audit_findings")
          .select("code,title,severity,affected_count")
          .eq("audit_id", anterior.id)
      : Promise.resolve({ data: [] }),
  ]);

  const lista = (findings as FindingRow[]) ?? [];
  // Só promete reauditoria automática quando o agendamento consegue de
  // fato rodar: sem o segredo, a rota semanal recusa todo disparo.
  const acompanhamentoAtivo = Boolean(process.env.CRON_SECRET);
  const jornada = await lerJornada(supabase, {
    concluidas,
    latest,
    achados: lista,
    acompanhamentoAtivo,
  });

  return (
    <AuditBoard
      blogId={blog.id}
      audits={(audits as AuditRow[]) ?? []}
      latest={latest}
      findings={lista}
      anterior={anterior}
      comparacao={
        anterior
          ? compararAuditorias(lista, (antigos as AchadoResumo[]) ?? [])
          : null
      }
      acompanhamentoAtivo={acompanhamentoAtivo}
      jornada={jornada}
    />
  );
}
