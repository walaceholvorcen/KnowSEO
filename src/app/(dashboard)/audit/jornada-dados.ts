import type { SupabaseClient } from "@supabase/supabase-js";
import { montarJornada, type Jornada } from "@/lib/audit/jornada";
import type { AuditRow, FindingRow } from "./page";

const PRIORIDADE = ["critical", "high"];

// Leitura de banco da jornada, num lugar só: a página logada e a vitrine
// local de design chamam a mesma função, então o que uma mostra a outra
// também mostra.
export async function lerJornada(
  supabase: SupabaseClient,
  {
    concluidas,
    latest,
    achados,
    acompanhamentoAtivo,
  }: {
    concluidas: AuditRow[];
    latest: AuditRow | null;
    achados: FindingRow[];
    acompanhamentoAtivo: boolean;
  },
): Promise<Jornada | null> {
  if (!latest) return null;

  // Só o mesmo site: a jornada de dataknow.es não pode herdar a data de
  // diagnóstico de outro domínio auditado no meio.
  const doSite = concluidas.filter((a) => a.site_url === latest.site_url);

  // Uma consulta para saber quais auditorias do histórico tinham item
  // crítico ou alto - é o que data o fim da etapa de correção.
  const { data } = await supabase
    .from("audit_findings")
    .select("audit_id")
    .in(
      "audit_id",
      doSite.map((a) => a.id),
    )
    .in("severity", PRIORIDADE);
  const comPrioridade = new Set(
    ((data as { audit_id: string }[]) ?? []).map((r) => r.audit_id),
  );

  return montarJornada({
    historico: doSite.map((a) => ({
      id: a.id,
      created_at: a.created_at,
      score_google: a.score_google,
      score_ai: a.score_ai,
      comPrioridade: comPrioridade.has(a.id),
    })),
    abertosPrioridade: achados.filter((f) => PRIORIDADE.includes(f.severity))
      .length,
    agora: new Date(),
    acompanhamentoAtivo,
  });
}
