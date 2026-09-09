// Fases esperadas de um blog novo, contadas a partir da primeira publicação.
//
// Por que isto existe: nos primeiros meses quase todo número do produto é
// zero, e zero sem contexto parece produto quebrado. SEO e GEO não são
// interruptor - a página precisa ser descoberta, indexada, testada em
// várias posições e só então passa a trazer clique.
//
// IMPORTANTE, e a tela precisa dizer isso: nenhuma destas fases é medida.
// Não lemos Search Console nem posição real - é prazo típico contado por
// tempo decorrido. Chamar isso de medição seria inventar dado.

export interface Fase {
  chave: string;
  nome: string;
  /** Mês em que a fase costuma começar, a partir da 1ª publicação. */
  mes: number;
  descricao: string;
}

export const FASES: Fase[] = [
  {
    chave: "no_ar",
    nome: "No ar",
    mes: 0,
    descricao:
      "Os artigos estão publicados. O Google e as IAs ainda estão descobrindo o site, então é esperado que o resto fique zerado neste começo.",
  },
  {
    chave: "indexado",
    nome: "Indexado",
    mes: 1,
    descricao:
      "As páginas entram no índice do Google e passam a poder ser citadas pelas IAs. As primeiras impressões começam a aparecer.",
  },
  {
    chave: "ranqueando",
    nome: "Ranqueando",
    mes: 2,
    descricao:
      "Os artigos começam a disputar posição. O ranking oscila bastante aqui, enquanto o Google testa o conteúdo em posições diferentes. Oscilar é parte do processo.",
  },
  {
    chave: "cliques",
    nome: "Gerando cliques",
    mes: 4,
    descricao:
      "As posições estabilizam e os cliques começam a vir. É nesta fase que publicar com constância dá o retorno mais visível.",
  },
  {
    chave: "primeira_pagina",
    nome: "Primeira página",
    mes: 6,
    descricao:
      "O tráfego passa a compor sozinho: cada artigo novo soma autoridade ao domínio e ajuda a puxar os antigos junto.",
  },
];

// Meses completos entre a primeira publicação e agora. Conta por data de
// calendário, não por blocos de 30 dias: "mês 1" para quem publicou em 3 de
// janeiro começa em 3 de fevereiro, que é como a pessoa conta.
export function mesesDesde(inicioIso: string, agora: Date = new Date()): number {
  const inicio = new Date(inicioIso);
  if (Number.isNaN(inicio.getTime())) return 0;

  let meses =
    (agora.getFullYear() - inicio.getFullYear()) * 12 +
    (agora.getMonth() - inicio.getMonth());

  // Ainda não chegou no mesmo dia do mês: o mês não fechou.
  if (agora.getDate() < inicio.getDate()) meses--;

  return Math.max(0, meses);
}

// Índice da fase esperada hoje. -1 quando ainda não há nada publicado -
// aí não existe contagem para começar.
export function faseAtual(
  primeiraPublicacao: string | null,
  agora: Date = new Date(),
): number {
  if (!primeiraPublicacao) return -1;

  const meses = mesesDesde(primeiraPublicacao, agora);

  let indice = 0;
  for (let i = 0; i < FASES.length; i++) {
    if (meses >= FASES[i].mes) indice = i;
  }
  return indice;
}
