import { createAdminClient } from "@/lib/supabase/admin";
import { auditSite, type AuditResult } from "./runner";

export type ResultadoRegistro =
  | { ok: true; auditId: string; result: AuditResult }
  | {
      ok: false;
      auditId: string | null;
      status: 422 | 500;
      mensagem: string;
    };

// Uma auditoria do começo ao fim: abre o registro, roda, grava os achados e
// fecha com a nota.
//
// Mora aqui, fora da rota, porque agora são dois caminhos que auditam - o
// botão do cliente e o acompanhamento semanal - e duas cópias deste fluxo
// divergiriam na primeira correção.
//
// Tudo pelo client admin: quem chama já validou que o blog pertence a quem
// pediu (a rota) ou não tem usuário nenhum (o agendamento).
export async function registrarAuditoria(params: {
  blogId: string;
  /** Origem já normalizada e validada contra SSRF por quem chama. */
  siteUrl: string;
  tipo: "manual" | "agendada";
}): Promise<ResultadoRegistro> {
  const { blogId, siteUrl, tipo } = params;
  const admin = createAdminClient();

  const { data: audit, error: createError } = await admin
    .from("site_audits")
    .insert({
      blog_id: blogId,
      site_url: siteUrl,
      status: "running",
      // Só a agendada escreve a coluna: a manual segue funcionando mesmo
      // antes de a migração 0011 ser aplicada, porque o padrão já é 'manual'.
      ...(tipo === "agendada" ? { origem: "agendada" } : {}),
    })
    .select("id")
    .single();

  if (createError || !audit) {
    return {
      ok: false,
      auditId: null,
      status: 500,
      mensagem: createError?.message ?? "Não foi possível abrir a auditoria.",
    };
  }

  const auditId = (audit as { id: string }).id;
  const fechar = (campos: Record<string, unknown>) =>
    admin
      .from("site_audits")
      .update({ ...campos, finished_at: new Date().toISOString() })
      .eq("id", auditId);

  try {
    const result = await auditSite(siteUrl);

    if (!result) {
      await fechar({
        status: "error",
        error_message: "Não foi possível ler o site",
      });
      return {
        ok: false,
        auditId,
        status: 422,
        mensagem:
          "Não conseguimos ler esse site. Confira o endereço ou se o servidor bloqueia rastreadores.",
      };
    }

    if (result.findings.length) {
      const { error: findingsError } = await admin
        .from("audit_findings")
        .insert(
          result.findings.map((f) => ({
            audit_id: auditId,
            code: f.code,
            severity: f.severity,
            category: f.category,
            title: f.title,
            impact: f.impact,
            evidence: f.evidence,
            fix: f.fix,
            affected_urls: f.affectedUrls,
            affected_count: f.affectedCount,
          })),
        );

      // Sem este check o insert falharia em silêncio e a auditoria
      // apareceria "concluída" sem nenhum achado.
      if (findingsError) {
        throw new Error(`falha ao gravar achados: ${findingsError.message}`);
      }
    }

    await fechar({
      status: "done",
      pages_analyzed: result.pagesAnalyzed,
      score_google: result.scores.google,
      score_ai: result.scores.ai,
    });

    return { ok: true, auditId, result };
  } catch (err) {
    await fechar({
      status: "error",
      error_message: String(err).slice(0, 300),
    });
    console.error("[audit] falha", err);
    return {
      ok: false,
      auditId,
      status: 500,
      mensagem: "A auditoria falhou. Tente de novo.",
    };
  }
}
