import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import { SettingsNav } from "../settings-nav";
import { Lede } from "@/components/lede";
import { buscarConexao, isGoogleIntegrationConfigured } from "@/lib/google/oauth";
import { IntegrationsForm } from "./integrations-form";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ conectado?: string; erro?: string }>;
}) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  const blog = blogs[0];
  const { conectado, erro } = await searchParams;

  const conexao = isGoogleIntegrationConfigured()
    ? await buscarConexao(workspace.id)
    : null;

  const veredito = !isGoogleIntegrationConfigured()
    ? "Integração com o Google ainda não está configurada no ambiente."
    : conexao
      ? `Conectado como ${conexao.email}.`
      : "Nenhuma conta Google conectada ainda.";

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <SettingsNav />
      <Lede apoio="Uma conta só, da agência. Cada cliente adiciona esse e-mail como usuário no Search Console e no GA4 dele - sem senha compartilhada, sem login por cliente.">
        {veredito}
      </Lede>

      {erro && (
        <p className="mb-6 text-nota-critico">
          {erro === "cancelado"
            ? "Autorização cancelada."
            : erro === "sem_refresh_token"
              ? "O Google não devolveu acesso permanente. Revogue o acesso em myaccount.google.com/permissions e tente de novo."
              : "Não foi possível conectar. Tente de novo."}
        </p>
      )}
      {conectado && (
        <p className="mb-6 text-nota-excelente">Conta conectada.</p>
      )}

      {isGoogleIntegrationConfigured() && (
        <IntegrationsForm
          conectado={Boolean(conexao)}
          blogId={blog.id}
          gscPropertyAtual={blog.gsc_property}
          ga4PropertyAtual={blog.ga4_property_id}
        />
      )}
    </div>
  );
}
