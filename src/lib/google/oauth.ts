import { createAdminClient } from "@/lib/supabase/admin";

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

// Token de acesso de curta duração (1h), a partir do refresh_token salvo.
// Chamado antes de toda leitura no Search Console/GA4 - nunca guardamos
// access_token, ele expira rápido demais para valer a pena persistir.
export async function obterAccessToken(workspaceId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("google_integration")
    .select("refresh_token")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!data) {
    throw new Error("Nenhuma conta Google conectada neste workspace.");
  }

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
    throw new Error(
      `Não foi possível renovar o acesso ao Google: ${res.status}`,
    );
  }
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
}

export async function buscarConexao(
  workspaceId: string,
): Promise<{ email: string; conectadoEm: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("google_integration")
    .select("connected_email, connected_at")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return data
    ? { email: data.connected_email, conectadoEm: data.connected_at }
    : null;
}
