// Import relativo com extensão, como o resto do lib: o atalho "@/" não é
// resolvido pelo node que roda os testes, e este módulo passou a ter uma
// função pura para testar (conexaoGoogleMorreu).
import { createAdminClient } from "../supabase/admin.ts";

// Conexão única por workspace com Search Console + GA4, autorizada pela
// conta Google da agência - não uma por cliente. Ver a migration
// 0007_google_integration.sql para o porquê.
//
// Escopos de leitura só: este produto nunca precisa escrever no Search
// Console ou no GA4 do cliente, e pedir escopo de escrita sem uso real é
// o tipo de coisa que atrasa (ou reprova) revisão de app.
const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
  // Sem isto, buscarEmailDaConta() não tinha permissão para chamar o
  // userinfo e a tela ficava presa em "Conectado como (desconhecido)" -
  // achado testando a conexão real pela primeira vez.
  "https://www.googleapis.com/auth/userinfo.email",
  // Planejador de Palavras-chave: volume de busca real na Estratégia. Entra
  // na MESMA conexão de propósito - uma tela de login para as três coisas,
  // em vez de pedir ao cliente que autorize o Google três vezes.
  "https://www.googleapis.com/auth/adwords",
].join(" ");

export function isGoogleIntegrationConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
}

export const GOOGLE_INTEGRATION_NOT_CONFIGURED_MESSAGE =
  "Integração com o Google desativada: falta configurar as credenciais OAuth no ambiente.";

function redirectUri(): string {
  const domain = process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost:3000";
  const protocolo = domain.includes("localhost") ? "http" : "https";
  return `${protocolo}://${domain}/api/integrations/google/callback`;
}

// URL para onde mandamos o usuário logar e autorizar.
//
// access_type=offline + prompt=consent: sem os dois, o Google às vezes não
// devolve refresh_token numa segunda autorização da mesma conta - e sem
// refresh_token a conexão morre assim que o token de acesso expira em 1h.
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
}

// Troca o código de autorização (URL de callback) pelo primeiro par de
// tokens. Só acontece uma vez, no momento em que o usuário autoriza.
export async function trocarCodigoPorTokens(
  code: string,
): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google recusou o código: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// E-mail da conta que autorizou, só para mostrar na tela ("conectado como
// fulano@agencia.com") - sem isso ninguém sabe qual conta está ligada.
export async function buscarEmailDaConta(accessToken: string): Promise<string> {
  const res = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return "(desconhecido)";
  const data = (await res.json()) as { email?: string };
  return data.email ?? "(desconhecido)";
}

export const CONEXAO_GOOGLE_MORREU =
  "A conexão com o Google expirou. Reconecte a conta em Configurações > Integrações.";

/**
 * O Google recusou o refresh_token em definitivo?
 *
 * `invalid_grant` é a única resposta que significa "este acesso não vale
 * mais": app em modo de teste no Google Cloud (ali o Google derruba a
 * conexão a cada 7 dias), acesso revogado em
 * myaccount.google.com/permissions, senha da conta trocada.
 *
 * Qualquer outro erro - 500, 503, rede - é soluço do lado deles. Marcar a
 * conexão como morta nesse caso mandaria a agência reconectar sem precisar,
 * e ensinaria a ignorar o aviso.
 */
export function conexaoGoogleMorreu(status: number, corpo: string): boolean {
  return status === 400 && corpo.includes("invalid_grant");
}

// Token de acesso de curta duração (1h), a partir do refresh_token salvo.
// Chamado antes de toda leitura no Search Console/GA4 - nunca guardamos
// access_token, ele expira rápido demais para valer a pena persistir.
//
// É também o único lugar por onde toda leitura do Google passa, então é aqui
// que a morte da conexão é percebida e anotada - sem nenhuma chamada nova
// em nenhum outro lugar.
export async function obterAccessToken(workspaceId: string): Promise<string> {
  const admin = createAdminClient();
  // select("*") e não o nome das colunas: `quebrada_em` só existe depois da
  // migração 0020, e pedi-la pelo nome derrubaria a consulta inteira num
  // deploy que chegasse antes dela.
  const { data } = await admin
    .from("google_integration")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!data) {
    throw new Error("Nenhuma conta Google conectada neste workspace.");
  }

  // Anotar o estado nunca pode derrubar a leitura: antes da migração a
  // coluna não existe, e perder o Search Console por causa do aviso seria
  // pior que ficar sem o aviso.
  const anotar = async (quebrada_em: string | null) => {
    try {
      await admin
        .from("google_integration")
        .update({ quebrada_em })
        .eq("workspace_id", workspaceId);
    } catch {
      /* coluna ainda não existe neste banco */
    }
  };

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      refresh_token: data.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const corpo = await res.text();
    if (conexaoGoogleMorreu(res.status, corpo)) {
      // Guarda a data da PRIMEIRA falha: o que a tela precisa dizer é há
      // quanto tempo o dado do Google parou de chegar, não quando foi a
      // última tentativa.
      if (!data.quebrada_em) await anotar(new Date().toISOString());
      throw new Error(CONEXAO_GOOGLE_MORREU);
    }
    throw new Error(
      `Não foi possível renovar o acesso ao Google: ${res.status}`,
    );
  }
  // Voltou a responder: ou alguém reconectou, ou a falha anterior era
  // soluço do lado deles. O aviso sai da tela sozinho.
  if (data.quebrada_em) await anotar(null);
  const tokens = (await res.json()) as TokenResponse;
  return tokens.access_token;
}

export async function salvarConexao(params: {
  workspaceId: string;
  email: string;
  refreshToken: string;
}) {
  const admin = createAdminClient();
  // upsert: reconectar a mesma conta atualiza em vez de duplicar.
  await admin.from("google_integration").upsert({
    workspace_id: params.workspaceId,
    connected_email: params.email,
    refresh_token: params.refreshToken,
    connected_at: new Date().toISOString(),
  });

  // Reconectar é o conserto, então a marca de quebrada sai junto - mas numa
  // escrita separada e tolerante: com o deploy antes da migração 0020, a
  // coluna não existe, e juntar os dois campos faria a reconexão falhar
  // justamente para quem está tentando consertar a conexão.
  try {
    await admin
      .from("google_integration")
      .update({ quebrada_em: null })
      .eq("workspace_id", params.workspaceId);
  } catch {
    /* coluna ainda não existe neste banco */
  }
}

export async function buscarConexao(workspaceId: string): Promise<{
  email: string;
  conectadoEm: string;
  /** Desde quando o Google parou de aceitar o acesso. Null = viva. */
  quebradaEm: string | null;
} | null> {
  const admin = createAdminClient();
  // select("*") pelo mesmo motivo de obterAccessToken: a coluna é nova.
  const { data } = await admin
    .from("google_integration")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return data
    ? {
        email: data.connected_email,
        conectadoEm: data.connected_at,
        quebradaEm: data.quebrada_em ?? null,
      }
    : null;
}
