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
// Medido em setembro/2026 batendo na API: v19, v20 e v21 já devolvem 404
// (versão aposentada); v22 a v26 respondem. O padrão fica na mais nova.
const VERSAO = process.env.GOOGLE_ADS_API_VERSION || "v26";

// keywordSeed aceita no máximo 20 termos por chamada.
const MAX_SEMENTES = 20;

function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}


function cabecalhos(token: string): Record<string, string> {
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

  return headers;
}

/** Contas de anúncios que a conta Google conectada enxerga. */
export async function contasAcessiveis(workspaceId: string): Promise<string[]> {
  const token = await obterAccessToken(workspaceId);
  const res = await fetch(
    `https://googleads.googleapis.com/${VERSAO}/customers:listAccessibleCustomers`,
    { headers: cabecalhos(token) },
  );
  if (!res.ok) {
    console.error(
      "[google-ads] listAccessibleCustomers",
      res.status,
      (await res.text()).slice(0, 400),
    );
    return [];
  }
  const data = (await res.json()) as { resourceNames?: string[] };
  return (data.resourceNames ?? []).map((r) => somenteDigitos(r));
}

// A conta usada na consulta. A variável de ambiente manda; sem ela, a
// primeira conta que a conexão enxerga serve - ideia de palavra-chave não
// muda de conta para conta, e exigir que o dono descubra e cole o número
// era mais um passo para travar a ativação.
async function resolverCustomerId(workspaceId: string): Promise<string | null> {
  const doAmbiente = somenteDigitos(process.env.GOOGLE_ADS_CUSTOMER_ID ?? "");
  if (doAmbiente) return doAmbiente;
  const contas = await contasAcessiveis(workspaceId);
  return contas[0] ?? null;
}

export type EstadoGoogleAds =
  | "sem_conexao"
  | "sem_escopo"
  | "sem_conta"
  | "sem_acesso_ao_planejador"
  | "pronto";

export interface DiagnosticoGoogleAds {
  estado: EstadoGoogleAds;
  detalhe: string;
  customerId?: string;
}

// Diagnóstico real, não adivinhação por variável de ambiente: pergunta ao
// Google o que esta conexão consegue fazer. Mesmo princípio do resto do
// produto - medir em vez de supor -, e aqui evita a tela dizer "ligado"
// enquanto a API recusa toda chamada.
export async function diagnosticarGoogleAds(
  workspaceId: string,
): Promise<DiagnosticoGoogleAds> {
  let token: string;
  try {
    token = await obterAccessToken(workspaceId);
  } catch {
    return { estado: "sem_conexao", detalhe: "Nenhuma conta Google conectada." };
  }

  const lista = await fetch(
    `https://googleads.googleapis.com/${VERSAO}/customers:listAccessibleCustomers`,
    { headers: cabecalhos(token) },
  );

  if (lista.status === 403) {
    const corpo = (await lista.text()).slice(0, 400);
    return corpo.includes("insufficient authentication scopes")
      ? {
          estado: "sem_escopo",
          detalhe:
            "A autorização atual do Google não inclui o Google Ads. Revogue o acesso em myaccount.google.com/permissions e conecte de novo.",
        }
      : {
          estado: "sem_acesso_ao_planejador",
          detalhe:
            "O Google recusou a chamada. Confira se o projeto do Google Cloud que gera este login tem acesso Básico à API do Google Ads.",
        };
  }

  const customerId = await resolverCustomerId(workspaceId);
  if (!customerId) {
    return {
      estado: "sem_conta",
      detalhe:
        "A conta Google conectada não enxerga nenhuma conta do Google Ads. Crie uma em ads.google.com - não precisa anunciar - com o mesmo e-mail.",
    };
  }

  // A prova final: só uma chamada de planejamento revela se o projeto tem
  // acesso Básico. O nível Explorer, concedido por padrão, responde bem em
  // tudo menos nos serviços de planejamento - e é exatamente o que usamos.
  const prova = await fetch(
    `https://googleads.googleapis.com/${VERSAO}/customers/${customerId}:generateKeywordIdeas`,
    {
      method: "POST",
      headers: cabecalhos(token),
      body: JSON.stringify({
        language: idiomaDoBlog("pt"),
        geoTargetConstants: [
          paisDoBlog({ dominio: null, idioma: "pt" }).constante,
        ],
        keywordPlanNetwork: "GOOGLE_SEARCH",
        keywordSeed: { keywords: ["marketing digital"] },
      }),
    },
  );

  if (prova.ok) {
    return {
      estado: "pronto",
      detalhe: `Consultando pela conta ${customerId}.`,
      customerId,
    };
  }

  console.error(
    "[google-ads] prova do planejador",
    prova.status,
    (await prova.text()).slice(0, 600),
  );
  return {
    estado: "sem_acesso_ao_planejador",
    detalhe:
      "A conexão funciona, mas o Google recusou o Planejador de Palavras-chave. Falta acesso Básico à API do Google Ads no projeto do Google Cloud que gera este login.",
    customerId,
  };
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

  if (keywords.length === 0) return vazio;

  let customerId: string | null;
  let token: string;
  try {
    customerId = await resolverCustomerId(workspaceId);
    if (!customerId) return vazio;
    token = await obterAccessToken(workspaceId);
  } catch {
    // Sem conexão com o Google o volume não vem. Isto é enriquecimento:
    // nunca pode derrubar a geração de pauta.
    return vazio;
  }

  const headers = cabecalhos(token);

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
