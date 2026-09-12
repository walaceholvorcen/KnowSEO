import { obterAccessToken } from "./oauth";
import {
  idiomaDoBlog,
  indexarMetricas,
  paisDoBlog,
  type MetricaReal,
  type ResultadoDaApi,
} from "@/lib/keywords/metricas";

// Planejador de Palavras-chave do Google Ads: volume de busca REAL, de
// graça, direto da fonte que o mercado usa como referência.
//
// Usa a mesma conta Google já conectada para Search Console e GA4 (escopo
// `adwords` somado em oauth.ts), então não existe segunda tela de login.
// A credencial exclusiva daqui é uma só:
//
//   GOOGLE_ADS_CUSTOMER_ID - a conta de anúncios contra a qual a consulta é
//     feita. Só dígitos, sem hífen.
//
// GOOGLE_ADS_DEVELOPER_TOKEN virou OPCIONAL em setembro/2026: o Google
// aposentou o token ("this is optional and ignored by the API servers") e
// passou o nível de acesso para o PROJETO do Google Cloud que gerou as
// credenciais OAuth. O Planejador de Palavras-chave (KeywordPlanIdeaService)
// exige nível Básico nesse projeto - o nível Explorer, que vem por padrão,
// bloqueia justamente os serviços de planejamento. Exigir o token aqui
// travava quem cria a conta hoje e nunca vai receber um.
//
// AVISO que precisa chegar ao cliente, não ficar só aqui: sem campanha
// ativa gastando, o Google devolve o volume em FAIXAS (ex.: 1.000 no lugar
// de "entre 1.000 e 10.000"). Continua sendo medição do Google e não
// palpite, mas não é o número exato que uma conta com investimento vê.

// A API do Google Ads sobe de versão a cada poucos meses e derruba as
// antigas. Fica em variável de ambiente para que uma virada de versão seja
// troca de configuração, não espera por deploy.
const VERSAO = process.env.GOOGLE_ADS_API_VERSION || "v21";

// keywordSeed aceita no máximo 20 termos por chamada.
const MAX_SEMENTES = 20;

export function isGoogleAdsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_ADS_CUSTOMER_ID);
}

function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export async function buscarVolumeDeBusca(params: {
  workspaceId: string;
  keywords: string[];
  dominio: string | null;
  idioma: string;
}): Promise<{ metricas: Map<string, MetricaReal>; pais: string }> {
  const { workspaceId, keywords, dominio, idioma } = params;

  const pais = paisDoBlog({ dominio, idioma });
  const vazio = { metricas: new Map<string, MetricaReal>(), pais: pais.rotulo };

  if (!isGoogleAdsConfigured() || keywords.length === 0) return vazio;

  const customerId = somenteDigitos(process.env.GOOGLE_ADS_CUSTOMER_ID ?? "");
  if (!customerId) return vazio;

  const token = await obterAccessToken(workspaceId);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Só vai quando existe: o cabeçalho é ignorado hoje e será recusado numa
  // versão futura da API. Mandar vazio é convite a erro de credencial.
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (devToken) headers["developer-token"] = devToken;

  // Quando a conta consultada está sob uma conta de administrador, o Google
  // exige saber por qual MCC estamos entrando. Se não for informado, assume
  // que a própria conta faz o login.
  const mcc = somenteDigitos(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "");
  if (mcc) headers["login-customer-id"] = mcc;

  const res = await fetch(
    `https://googleads.googleapis.com/${VERSAO}/customers/${customerId}:generateKeywordIdeas`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        language: idiomaDoBlog(idioma),
        geoTargetConstants: [pais.constante],
        keywordPlanNetwork: "GOOGLE_SEARCH",
        keywordSeed: { keywords: keywords.slice(0, MAX_SEMENTES) },
      }),
    },
  );

  if (!res.ok) {
    // O corpo do erro do Google Ads é onde mora a causa de verdade (token
    // sem acesso básico, conta errada, versão morta). Sem registrar isto, a
    // falha vira "não veio volume" e ninguém descobre por quê.
    console.error(
      "[google-ads] falha ao consultar volume",
      res.status,
      (await res.text()).slice(0, 800),
    );
    return vazio;
  }

  const data = (await res.json()) as { results?: ResultadoDaApi[] };

  return {
    metricas: indexarMetricas(data.results ?? []),
    pais: pais.rotulo,
  };
}
