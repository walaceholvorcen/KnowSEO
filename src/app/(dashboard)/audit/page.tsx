import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import { compararAuditorias, type AchadoResumo } from "@/lib/audit/comparar";
import { AuditBoard } from "./audit-board";

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
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  const blog = blogs[0];

  const { data: audits } = await supabase
    .from("site_audits")
    .select("*")
    .eq("blog_id", blog.id)
    .order("created_at", { ascending: false })
    .limit(10);

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

  const { data: findings } = latest
    ? await supabase
        .from("audit_findings")
        .select("*")
        .eq("audit_id", latest.id)
    : { data: [] };

  const { data: antigos } = anterior
    ? await supabase
        .from("audit_findings")
        .select("code,title,severity,affected_count")
        .eq("audit_id", anterior.id)
    : { data: [] };

  const lista = (findings as FindingRow[]) ?? [];

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
      // Só promete reauditoria automática quando o agendamento consegue de
      // fato rodar: sem o segredo, a rota semanal recusa todo disparo.
      acompanhamentoAtivo={Boolean(process.env.CRON_SECRET)}
    />
  );
}
