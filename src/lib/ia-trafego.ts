// O que os assistentes de IA fazem no blog do cliente, medido por nós.
//
// Google e Bing têm painel próprio para o dono do site. Claude, ChatGPT e
// Perplexity não têm nenhum (conferido em 19/11/2026) - e são eles que o
// cliente quer acompanhar. Como o blog é servido por este app, dá para
// contar duas coisas sem depender de ninguém:
//
//  - o robô do assistente abrindo um artigo (quem bateu foi a máquina);
//  - a pessoa que clicou no link da resposta e chegou aqui (quem bateu foi
//    gente, e o navegador diz de onde veio).
//
// Função pura: quem grava e quem desenha leem a mesma tabela daqui.

export type Assistente = "claude" | "chatgpt" | "perplexity" | "google" | "copilot";

export const NOME_DO_ASSISTENTE: Record<Assistente, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  google: "Gemini",
  copilot: "Copilot",
};

/**
 * O que o robô veio fazer. A diferença é o que dá valor ao número:
 *
 * - `leitura`: alguém fez uma pergunta e o assistente abriu a página para
 *   responder. É o mais perto que existe de uma impressão.
 * - `indexacao`: o assistente está montando o índice de busca dele. Sem
 *   isto a página não é candidata a resposta.
 * - `treino`: coleta para treinar modelo. Não diz nada sobre ser citado.
 */
export type PapelDoRobo = "leitura" | "indexacao" | "treino";

export interface RoboDeIA {
  /** O nome que o robô declara, em minúsculas: "claude-user". */
  agente: string;
  assistente: Assistente;
  papel: PapelDoRobo;
}

// Ordem importa só entre nomes que se contêm - aqui nenhum contém o outro,
// mas o mais específico vem primeiro por garantia.
const ROBOS: RoboDeIA[] = [
  { agente: "claude-user", assistente: "claude", papel: "leitura" },
  { agente: "claude-searchbot", assistente: "claude", papel: "indexacao" },
  { agente: "claudebot", assistente: "claude", papel: "treino" },
  { agente: "chatgpt-user", assistente: "chatgpt", papel: "leitura" },
  { agente: "oai-searchbot", assistente: "chatgpt", papel: "indexacao" },
  { agente: "gptbot", assistente: "chatgpt", papel: "treino" },
  { agente: "perplexity-user", assistente: "perplexity", papel: "leitura" },
  { agente: "perplexitybot", assistente: "perplexity", papel: "indexacao" },
];

/**
 * Reconhece o robô de IA pelo nome que ele declara.
 *
 * ponytail: confia no cabeçalho, que qualquer um pode forjar. Serve para
 * tendência, não para auditoria. O degrau seguinte é conferir o IP contra
 * as faixas que cada empresa publica.
 */
export function roboDeIA(userAgent: string | null | undefined): RoboDeIA | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  return ROBOS.find((r) => ua.includes(r.agente)) ?? null;
}

export function roboPeloAgente(agente: string | null | undefined): RoboDeIA | null {
  return ROBOS.find((r) => r.agente === agente) ?? null;
}

const SITES: [string, Assistente][] = [
  ["claude.ai", "claude"],
  ["chatgpt.com", "chatgpt"],
  ["chat.openai.com", "chatgpt"],
  ["perplexity.ai", "perplexity"],
  ["gemini.google.com", "google"],
  ["copilot.microsoft.com", "copilot"],
];

/**
 * De qual assistente esta visita humana veio, se veio de algum.
 *
 * `origem` é o que o rastreio grava: o endereço da página anterior, ou
 * "utm:chatgpt.com" quando o assistente só marcou o link (o ChatGPT faz
 * isso, e parte dos aplicativos não manda endereço anterior nenhum).
 */
export function assistenteDaVisita(origem: string | null | undefined): Assistente | null {
  if (!origem) return null;

  let host = "";
  if (origem.startsWith("utm:")) {
    host = origem.slice(4).toLowerCase();
  } else {
    try {
      host = new URL(origem).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
  // Domínio exato ou subdomínio dele - "notclaude.ai" não é o Claude.
  const achado = SITES.find(([site]) => host === site || host.endsWith(`.${site}`));
  return achado ? achado[1] : null;
}

/**
 * O que o rastreio grava como origem de uma visita.
 *
 * Vem do navegador de um desconhecido, então é cortado e conferido aqui:
 * só endereço http(s) de OUTRO site entra (navegar dentro do próprio blog
 * não é origem de nada), e a marcação do link só com caracteres de domínio.
 */
export function origemDaVisita(
  paginaAnterior: unknown,
  marcacao: unknown,
  hostDoBlog: string | null,
): string | null {
  if (typeof paginaAnterior === "string" && paginaAnterior.length <= 500) {
    try {
      const u = new URL(paginaAnterior);
      const externo = !hostDoBlog || u.hostname !== hostDoBlog;
      if ((u.protocol === "https:" || u.protocol === "http:") && externo) {
        // Sem caminho nem parâmetros: o que interessa é de qual site veio, e
        // o resto pode carregar dado de quem navegava.
        return u.origin;
      }
    } catch {
      // segue para a marcação
    }
  }
  if (typeof marcacao === "string" && /^[a-z0-9.-]{2,60}$/i.test(marcacao)) {
    return `utm:${marcacao.toLowerCase()}`;
  }
  return null;
}

/**
 * O dia em que a contagem foi ligada. Antes dele o blog não anotava robô
 * nem origem de visita, e a tela precisa dizer isso: "0 leituras em 28
 * dias" seria mentira num período em que ninguém estava contando.
 *
 * Meio-dia UTC, e não meia-noite: a tela mostra esta data no fuso de quem
 * opera, e meia-noite UTC aparecia como "18/11" para quem está no Brasil.
 */
export const CONTAGEM_DESDE = "2026-11-19T12:00:00.000Z";

/** Começo do período mostrado: 28 dias atrás, nunca antes de a contagem existir. */
export function inicioDoPeriodo(agora: Date): Date {
  const janela = new Date(agora.getTime() - 28 * 86_400_000);
  const ligada = new Date(CONTAGEM_DESDE);
  return janela > ligada ? janela : ligada;
}

export interface EventoDeIA {
  event_type: string;
  agente?: string | null;
  referrer?: string | null;
  article_id: string | null;
  created_at: string;
}

export interface LinhaDoAssistente {
  assistente: Assistente;
  nome: string;
  /** Vezes em que o assistente abriu uma página para responder alguém. */
  leituras: number;
  indexacoes: number;
  treinos: number;
  /** Pessoas que chegaram clicando num link da resposta. */
  cliques: number;
}

export interface TrafegoDeIA {
  assistentes: LinhaDoAssistente[];
  /** Artigos mais abertos por IA para responder, com os cliques recebidos. */
  artigos: { articleId: string; leituras: number; cliques: number }[];
  total: { leituras: number; cliques: number };
}

/**
 * Soma o período por assistente e por artigo.
 *
 * Os três que o produto promete acompanhar aparecem sempre, mesmo zerados:
 * "Claude: 0 leituras" é informação; a linha sumir parece defeito.
 */
export function resumirTrafegoDeIA(eventos: EventoDeIA[]): TrafegoDeIA {
  const fixos: Assistente[] = ["claude", "chatgpt", "perplexity"];
  const linhas = new Map<Assistente, LinhaDoAssistente>();
  const linha = (a: Assistente) => {
    let l = linhas.get(a);
    if (!l) {
      l = { assistente: a, nome: NOME_DO_ASSISTENTE[a], leituras: 0, indexacoes: 0, treinos: 0, cliques: 0 };
      linhas.set(a, l);
    }
    return l;
  };
  fixos.forEach(linha);

  const porArtigo = new Map<string, { leituras: number; cliques: number }>();
  const artigo = (id: string) => {
    let a = porArtigo.get(id);
    if (!a) {
      a = { leituras: 0, cliques: 0 };
      porArtigo.set(id, a);
    }
    return a;
  };

  for (const e of eventos) {
    if (e.event_type === "ai_bot") {
      const robo = roboPeloAgente(e.agente);
      if (!robo) continue;
      const l = linha(robo.assistente);
      if (robo.papel === "leitura") {
        l.leituras++;
        if (e.article_id) artigo(e.article_id).leituras++;
      } else if (robo.papel === "indexacao") l.indexacoes++;
      else l.treinos++;
    } else if (e.event_type === "pageview") {
      const de = assistenteDaVisita(e.referrer);
      if (!de) continue;
      linha(de).cliques++;
      if (e.article_id) artigo(e.article_id).cliques++;
    }
  }

  const assistentes = [...linhas.values()].sort(
    (a, b) => fixos.indexOf(a.assistente) - fixos.indexOf(b.assistente),
  );
  // Os fixos na ordem prometida; os demais (Gemini, Copilot) depois, só
  // quando tiveram algum movimento.
  const ordenados = [
    ...assistentes.filter((l) => fixos.includes(l.assistente)),
    ...assistentes.filter((l) => !fixos.includes(l.assistente)),
  ];

  return {
    assistentes: ordenados,
    artigos: [...porArtigo.entries()]
      .map(([articleId, v]) => ({ articleId, ...v }))
      .sort((a, b) => b.leituras + b.cliques - (a.leituras + a.cliques))
      .slice(0, 5),
    total: {
      leituras: ordenados.reduce((s, l) => s + l.leituras, 0),
      cliques: ordenados.reduce((s, l) => s + l.cliques, 0),
    },
  };
}
