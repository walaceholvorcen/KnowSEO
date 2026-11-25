// O que mudou no Google entre dois períodos iguais - a resposta para "o
// trabalho está andando?" antes de as visitas chegarem.
//
// Os limites vêm de ferramentas abertas de SEO (seomachine, open-seo-mcp) e
// são deliberadamente conservadores: duas posições é o menor movimento que
// não é ruído do próprio Google; abaixo de 10 impressões a posição média de
// uma consulta pula sozinha de um dia para o outro.
//
// Função pura: recebe o que o Search Console devolveu e decide o que a tela
// mostra.
import type { LinhaDoGoogle } from "./desempenho.ts";

export interface Mudanca {
  chave: string;
  antes: number;
  agora: number;
  impressoes: number;
}

export interface Disputa {
  /** A consulta de mais impressão entre as que o par disputa. */
  consulta: string;
  paginas: string[];
  impressoes: number;
  /** Quantas consultas as mesmas páginas disputam. */
  consultas: number;
}

export interface Movimento {
  /** Consultas que ganharam 2+ posições. */
  subiram: Mudanca[];
  /** Consultas que perderam 2+ posições. */
  cairam: Mudanca[];
  /** Posição 8 a 20 com impressão: a primeira página está perto. */
  quaseLa: LinhaDoGoogle[];
  /** Páginas que perderam 30% ou mais dos cliques. `antes`/`agora` em cliques. */
  decaindo: Mudanca[];
  /** Consultas em que duas páginas do mesmo site disputam o lugar. */
  disputas: Disputa[];
}

const MIN_IMPRESSOES = 10;
const MIN_POSICOES = 2;
const MIN_CLIQUES_ANTES = 5;
const QUEDA = 0.3;
const POR_LISTA = 5;

export function compararPeriodos(params: {
  consultasAgora: LinhaDoGoogle[];
  consultasAntes: LinhaDoGoogle[];
  paginasAgora: LinhaDoGoogle[];
  paginasAntes: LinhaDoGoogle[];
  /** Consulta × página do período atual (`chave` = consulta, `pagina` = endereço). */
  consultaPagina: (LinhaDoGoogle & { pagina?: string })[];
}): Movimento {
  const antes = new Map(params.consultasAntes.map((l) => [l.chave, l]));
  const mudancas: Mudanca[] = [];
  for (const agora of params.consultasAgora) {
    const velho = antes.get(agora.chave);
    // Os dois lados precisam ter amostra: posição média de 3 impressões é sorte.
    if (!velho || agora.impressoes < MIN_IMPRESSOES || velho.impressoes < MIN_IMPRESSOES) continue;
    mudancas.push({ chave: agora.chave, antes: velho.posicao, agora: agora.posicao, impressoes: agora.impressoes });
  }
  const porImpressao = (a: Mudanca, b: Mudanca) => b.impressoes - a.impressoes;
  const subiram = mudancas.filter((m) => m.antes - m.agora >= MIN_POSICOES).sort(porImpressao).slice(0, POR_LISTA);
  const cairam = mudancas.filter((m) => m.agora - m.antes >= MIN_POSICOES).sort(porImpressao).slice(0, POR_LISTA);

  const quaseLa = params.consultasAgora
    .filter((l) => l.posicao >= 8 && l.posicao <= 20 && l.impressoes >= MIN_IMPRESSOES)
    .sort((a, b) => b.impressoes - a.impressoes)
    .slice(0, POR_LISTA);

  const paginasAgora = new Map(params.paginasAgora.map((l) => [l.chave, l]));
  const decaindo = params.paginasAntes
    .filter((velha) => velha.cliques >= MIN_CLIQUES_ANTES)
    .map((velha) => ({
      chave: velha.chave,
      antes: velha.cliques,
      // Página que sumiu do relatório perdeu tudo, não "não tem dado".
      agora: paginasAgora.get(velha.chave)?.cliques ?? 0,
      impressoes: paginasAgora.get(velha.chave)?.impressoes ?? 0,
    }))
    .filter((m) => m.agora <= m.antes * (1 - QUEDA))
    .sort((a, b) => b.antes - b.agora - (a.antes - a.agora))
    .slice(0, POR_LISTA);

  const porConsulta = new Map<string, { paginas: string[]; impressoes: number }>();
  for (const l of params.consultaPagina) {
    // Página com impressão insignificante não está disputando nada. A home
    // aparecer junto de outra página é o normal em busca pela marca, não
    // disputa - contada, ela enchia a lista com "dataknow" e "sobre nós".
    if (!l.pagina || l.impressoes < 5 || /^https?:\/\/[^/]+\/?$/.test(l.pagina)) continue;
    const atual = porConsulta.get(l.chave) ?? { paginas: [], impressoes: 0 };
    atual.paginas.push(l.pagina);
    atual.impressoes += l.impressoes;
    porConsulta.set(l.chave, atual);
  }
  // Um problema por par de páginas, não por consulta: "agencia performance"
  // e "agencia de performance" com as mesmas duas páginas são a mesma
  // disputa, e listá-las separadas enchia a lista com uma coisa só.
  const porPar = new Map<string, Disputa>();
  for (const [consulta, v] of porConsulta) {
    if (v.paginas.length < 2) continue;
    const paginas = [...v.paginas].sort();
    const chave = paginas.join("\u0000");
    const atual = porPar.get(chave);
    if (!atual) porPar.set(chave, { consulta, paginas, impressoes: v.impressoes, consultas: 1 });
    else {
      atual.consultas++;
      if (v.impressoes > atual.impressoes) atual.consulta = consulta;
      atual.impressoes = Math.max(atual.impressoes, v.impressoes);
    }
  }
  const disputas = [...porPar.values()].sort((a, b) => b.impressoes - a.impressoes).slice(0, POR_LISTA);

  return { subiram, cairam, quaseLa, decaindo, disputas };
}

export function semMovimento(m: Movimento): boolean {
  return !m.subiram.length && !m.cairam.length && !m.quaseLa.length && !m.decaindo.length && !m.disputas.length;
}
