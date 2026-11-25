// Leitura do site pelos assistentes de IA. Funções puras, sem rede.
import { normalizeText } from "../citation.ts";

// Os robôs de IA em três papéis, e só um deles decide se o site pode ser
// citado. Misturar os três era o erro comum (inclusive em ferramentas
// abertas de GEO): bloquear GPTBot é uma escolha legítima sobre TREINO e não
// tira ninguém do ChatGPT; bloquear OAI-SearchBot tira.
//
//   busca  - monta o índice que o assistente consulta ao responder
//   leitura - abre a página na hora, quando alguém pede no chat
//   treino - coleta para treinar o próximo modelo (fora da conta aqui)
//
// Conferido na documentação de cada empresa em nov/2026.
export const ROBOS_DE_BUSCA_IA: { agente: string; assistente: string; papel: "busca" | "leitura" }[] = [
  { agente: "OAI-SearchBot", assistente: "ChatGPT", papel: "busca" },
  { agente: "ChatGPT-User", assistente: "ChatGPT", papel: "leitura" },
  { agente: "Claude-SearchBot", assistente: "Claude", papel: "busca" },
  { agente: "Claude-User", assistente: "Claude", papel: "leitura" },
  { agente: "PerplexityBot", assistente: "Perplexity", papel: "busca" },
  { agente: "Perplexity-User", assistente: "Perplexity", papel: "leitura" },
];

// Como o robots.txt trata um agente: o grupo com o nome dele manda; sem
// grupo próprio, vale o curinga. Grupos de outros agentes não dizem nada -
// ignorar isso era o falso positivo de "Disallow: /" no grupo do GPTBot
// acusado como site inteiro bloqueado (PROCESSO 21).
export function robotsBloqueiaAgente(body: string, agente: string): boolean {
  const grupos: { agentes: string[]; bloqueia: boolean }[] = [];
  let atual: { agentes: string[]; bloqueia: boolean } | null = null;
  let ultimaFoiAgente = false;

  for (const bruta of body.split(/\r?\n/)) {
    const linha = bruta.replace(/#.*/, "").trim();
    if (!linha) continue;
    const separador = linha.indexOf(":");
    if (separador === -1) continue;
    const campo = linha.slice(0, separador).trim().toLowerCase();
    const valor = linha.slice(separador + 1).trim();

    if (campo === "user-agent") {
      // User-agents seguidos compartilham o mesmo bloco de regras.
      if (!ultimaFoiAgente) {
        atual = { agentes: [], bloqueia: false };
        grupos.push(atual);
      }
      atual?.agentes.push(valor.toLowerCase());
      ultimaFoiAgente = true;
      continue;
    }
    ultimaFoiAgente = false;
    if (campo === "disallow" && valor === "/" && atual) atual.bloqueia = true;
  }

  const alvo = agente.toLowerCase();
  const proprios = grupos.filter((g) => g.agentes.includes(alvo));
  if (proprios.length) return proprios.some((g) => g.bloqueia);
  return grupos.filter((g) => g.agentes.includes("*")).some((g) => g.bloqueia);
}

/** Respostas que significam "recusado", não "fora do ar". */
export const STATUS_DE_BLOQUEIO = new Set([401, 403, 406, 429, 451, 503]);

// O dado estruturado diz o que a página não mostra?
//
// Pergunta de FAQ e título de artigo no JSON-LD que não aparecem no texto
// visível são o caso que o Google trata como marcação enganosa (pode perder
// o resultado rico), e a IA, que lê os dois, encontra duas versões da mesma
// página. Acontece quando o texto é editado e o schema fica para trás.
export function schemaForaDoTexto(html: string): string[] {
  const blocos = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  if (!blocos.length) return [];

  const declarado: string[] = [];
  const visitar = (no: unknown): void => {
    if (Array.isArray(no)) return no.forEach(visitar);
    if (!no || typeof no !== "object") return;
    const obj = no as Record<string, unknown>;
    const tipos = ([] as unknown[]).concat(obj["@type"] ?? []).map(String);
    if (tipos.includes("Question") && typeof obj.name === "string") declarado.push(obj.name);
    if (tipos.some((t) => /Article|BlogPosting/.test(t)) && typeof obj.headline === "string") {
      declarado.push(obj.headline);
    }
    Object.values(obj).forEach(visitar);
  };
  for (const b of blocos) {
    try {
      visitar(JSON.parse(b[1]));
    } catch {
      // JSON inválido já é outro achado (SCHEMA_INVALID).
    }
  }
  if (!declarado.length) return [];

  const visivel = comparavel(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;|&#34;/g, '"')
      .replace(/&#39;|&apos;/g, "'"),
  );
  return declarado.filter((d) => {
    const alvo = comparavel(d);
    return alvo.length > 0 && !visivel.includes(alvo);
  });
}

// Acento, caixa, pontuação e espaço não contam: o que se compara é o texto.
const comparavel = (s: string) =>
  normalizeText(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
