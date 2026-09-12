import { pagina } from "@/components/ui";
import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import { SettingsNav } from "../settings-nav";
import { Lede, Secao } from "@/components/lede";
import { buscarConexao, isGoogleIntegrationConfigured } from "@/lib/google/oauth";
import { diagnosticarGoogleAds } from "@/lib/google/ads";
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

  // Estado medido, não deduzido de variável de ambiente: a conexão pode
  // existir e mesmo assim o Planejador recusar (escopo antigo, projeto sem
  // acesso Básico, conta de anúncios inexistente). Cada caso tem uma saída
  // diferente, e a tela precisa dizer qual é.
  const ads = conexao ? await diagnosticarGoogleAds(workspace.id) : null;

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
        {ads?.estado === "pronto"
          ? "O Planejador de Palavras-chave do Google Ads está ligado. As pautas da Estratégia saem com volume de busca medido pelo Google, e não com estimativa do modelo."
          : (ads?.detalhe ??
            "Conecte uma conta Google acima para a Estratégia usar volume de busca medido, em vez da leitura qualitativa do modelo.")}
      </p>
      {ads?.estado === "sem_acesso_ao_planejador" && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
          <li>
            Abra o projeto do Google Cloud que gera este login e ative a
            Google Ads API na Biblioteca de APIs.
          </li>
          <li>
            Na página de visão geral da Google Ads API do projeto, peça o
            nível Básico. O nível Explorer, concedido por padrão, bloqueia
            justamente os serviços de planejamento.
          </li>
          <li>Volte aqui: esta tela consulta o Google a cada visita.</li>
        </ol>
      )}
      {ads?.estado === "pronto" && (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {ads.detalhe} Sem campanha ativa na conta, o Google devolve o volume
          em faixas aproximadas em vez do número exato. Continua sendo medição
          do Google, não palpite.
        </p>
      )}
    </div>
  );
}
