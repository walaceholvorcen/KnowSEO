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
      "O artigo existe e já pode ser lido, mas ninguém sabe que ele existe. Aqui no painel, visitas e citações ficam em zero - e zero neste começo é o esperado, não defeito.",
  },
  {
    chave: "indexado",
    nome: "Indexado",
    mes: 1,
    descricao:
      "O Google leu a página e a guardou no índice; a partir daí as IAs também podem citá-la. É quando o Raio X pode devolver a primeira citação, quase sempre numa pergunta bem específica.",
  },
  {
    chave: "ranqueando",
    nome: "Ranqueando",
    mes: 2,
    descricao:
      "A página entra na disputa e muda de posição de um dia para o outro, porque o Google está testando onde ela rende mais. Subir e cair nesta fase não significa nada ainda.",
  },
  {
    chave: "cliques",
    nome: "Gerando cliques",
    mes: 4,
    descricao:
      "A posição para de balançar e as primeiras visitas de busca chegam. É aqui que publicar com constância começa a aparecer no gráfico de visitas do relatório.",
  },
  {
    chave: "primeira_pagina",
    nome: "Primeira página",
    mes: 6,
    descricao:
      "O domínio já tem autoridade suficiente para um artigo novo nascer mais alto e puxar os antigos junto. O trabalho passa a render sobre o que já foi feito.",
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
