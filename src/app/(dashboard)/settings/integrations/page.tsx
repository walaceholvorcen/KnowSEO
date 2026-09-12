import { pagina } from "@/components/ui";
import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import { SettingsNav } from "../settings-nav";
import { Lede, Secao } from "@/components/lede";
import { buscarConexao, isGoogleIntegrationConfigured } from "@/lib/google/oauth";
import { isGoogleAdsConfigured } from "@/lib/google/ads";
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
    <div className={pagina("estreita")}>
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

      <Secao>Volume de busca</Secao>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {isGoogleAdsConfigured()
          ? "O Planejador de Palavras-chave do Google Ads está ligado. As pautas da Estratégia saem com volume de busca medido pelo Google, e não com estimativa do modelo."
          : "Sem o Planejador de Palavras-chave, a Estratégia sugere pauta com leitura qualitativa do modelo — sem volume de busca. Para ligar: o projeto do Google Cloud que gera o login do Google precisa de acesso Básico à API do Google Ads (o nível Explorer, padrão, bloqueia o Planejador), e falta a variável GOOGLE_ADS_CUSTOMER_ID com o número da conta de anúncios."}
      </p>
      {isGoogleAdsConfigured() && (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Sem campanha ativa na conta, o Google devolve o volume em faixas
          aproximadas em vez do número exato. Continua sendo medição do
          Google, não palpite.
        </p>
      )}
    </div>
  );
}
