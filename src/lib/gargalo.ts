// Onde a operação está travada.
//
// Reunir auditoria, estratégia, visibilidade e relatório numa tela só é
// fácil: quatro cards lado a lado. O problema é que quatro números soltos
// não dizem o que fazer na segunda-feira de manhã - e o cliente volta a
// abrir quatro telas para descobrir.
//
// Estes módulos formam uma corrente: site saudável -> pauta escolhida ->
// artigo no ar -> gente chegou -> virou conversa. Uma corrente vale o
// que vale o elo mais fraco, então o painel aponta o elo.
//
// A ordem abaixo é opinião de produto, não gosto:
//   1. site quebrado vem antes de tudo - artigo publicado em site que o
//      Google não rastreia é crédito jogado fora;
//   2. sem artigo não há o que medir;
//   3. tráfego dá retorno mais rápido que citação em IA, que é jogo longo;
//   4. visita que não vira conversa é o desperdício mais caro, porque o
//      trabalho todo já foi feito.

export interface Sinais {
  notaGoogle: number | null;
  pautasAbertas: number;
  artigosPublicados: number;
  visitas: number;
  conversas: number;
  perguntasIa: number;
  citacoesIa: number | null;
  rivalCitado: string | null;
}

export type Etapa =
  | "site"
  | "pauta"
  | "conteudo"
  | "alcance"
  | "conversao"
  | "ia"
  | "nenhum";

export interface Gargalo {
  etapa: Etapa;
  frase: string;
  acaoTexto: string;
  acaoHref: string;
}

export function encontrarGargalo(s: Sinais): Gargalo {
  if (s.notaGoogle === null) {
    return {
      etapa: "site",
      frase:
        "Você ainda não sabe como o Google e a IA enxergam o site. É a primeira coisa a descobrir.",
      acaoTexto: "Auditar o site",
      acaoHref: "/audit",
    };
  }

  if (s.notaGoogle < 50) {
    return {
      etapa: "site",
      frase: `O site tira ${s.notaGoogle} de 100 no Google. Publicar artigo antes de corrigir isso é jogar crédito fora.`,
      acaoTexto: "Ver o que corrigir",
      acaoHref: "/audit",
    };
  }

  if (s.artigosPublicados === 0) {
    return s.pautasAbertas === 0
      ? {
          etapa: "pauta",
          frase:
            "Nenhuma pauta escolhida ainda. A IA sugere as palavras que o seu cliente digita no Google.",
          acaoTexto: "Buscar pautas",
          acaoHref: "/strategy",
        }
      : {
          etapa: "conteudo",
          frase: `${s.pautasAbertas} ${s.pautasAbertas === 1 ? "pauta esperando" : "pautas esperando"} e nenhum artigo no ar. O primeiro leva cerca de um minuto.`,
          acaoTexto: "Escrever o primeiro",
          acaoHref: "/strategy",
        };
  }

  if (s.visitas === 0) {
    return {
      etapa: "alcance",
      frase: `${s.artigosPublicados} ${s.artigosPublicados === 1 ? "artigo no ar" : "artigos no ar"} e nenhuma visita em 28 dias. Busca orgânica leva semanas — divulgar o link encurta a espera.`,
      acaoTexto: "Ver os artigos",
      acaoHref: "/contents",
    };
  }

  if (s.conversas === 0) {
    return {
      etapa: "conversao",
      frase: `${s.visitas} ${s.visitas === 1 ? "pessoa leu" : "pessoas leram"} e nenhuma chamou você. O trabalho já foi feito; falta o convite no fim do artigo.`,
      acaoTexto: "Ajustar o botão",
      acaoHref: "/settings/blog",
    };
  }

  if (s.perguntasIa > 0 && s.citacoesIa === 0) {
    return {
      etapa: "ia",
      frase: s.rivalCitado
        ? `A IA não cita você em nenhuma das ${s.perguntasIa} perguntas do seu setor. Cita ${s.rivalCitado}.`
        : `A IA não cita você em nenhuma das ${s.perguntasIa} perguntas do seu setor.`,
      acaoTexto: "Ver as perguntas",
      acaoHref: "/visibility",
    };
  }

  if (s.notaGoogle < 70) {
    return {
      etapa: "site",
      frase: `A operação anda, mas o site tira ${s.notaGoogle} de 100 no Google. É o teto do que os artigos conseguem alcançar.`,
      acaoTexto: "Ver o que corrigir",
      acaoHref: "/audit",
    };
  }

  return {
    etapa: "nenhum",
    frase: `${s.artigosPublicados} ${s.artigosPublicados === 1 ? "artigo trouxe" : "artigos trouxeram"} ${s.visitas} ${s.visitas === 1 ? "visita" : "visitas"} e ${s.conversas} ${s.conversas === 1 ? "conversa" : "conversas"} em 28 dias. Nada travado.`,
    acaoTexto: "Escrever o próximo",
    acaoHref: "/strategy",
  };
}
