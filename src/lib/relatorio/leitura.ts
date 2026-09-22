// A leitura do período: o parágrafo que o cliente lê antes dos números.
//
// É interpretação, não cálculo novo - só usa o que já foi medido. Feita por
// regra, não por IA: o relatório vai assinado para o cliente final, e um
// modelo inventando "o tráfego cresceu por causa do artigo X" seria a pior
// mentira possível num produto que vende prova.
//
// A ordem das frases é a ordem da conversa que a agência teria: o que
// aconteceu, o que explica, o que isso vale em conversa, e em que pé está a
// base técnica. O próximo passo fecha - relatório sem próximo passo vira
// boletim.

export type Contexto = {
  dias: number;
  /** "nos últimos 28 dias" ou "entre 01 e 16 de set". */
  texto: string;
  visitas: number;
  conversas: number;
  taxa: number;
  semBase: boolean;
  visitasAntes: number;
  conversasAntes: number;
  /** Artigos que foram ao ar dentro do período. */
  publicados: number;
  /** Artigos publicados no total, até hoje. */
  noAr: number;
  melhor: { titulo: string; visitas: number; conversas: number } | null;
  auditoria: { google: number; ia: number; googleAntes: number | null } | null;
  geo: { citadas: number; perguntas: number; rival: string | null } | null;
};

export type Leitura = {
  paragrafos: string[];
  proximoPasso: { texto: string; href: string; rotulo: string };
};

const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const visitas = (v: number) => `${n(v)} ${v === 1 ? "visita" : "visitas"}`;
const conversas = (v: number) => `${n(v)} ${v === 1 ? "conversa" : "conversas"}`;
const artigos = (v: number) => `${n(v)} ${v === 1 ? "artigo" : "artigos"}`;

/** Volume abaixo disto não permite concluir nada sobre a chamada para ação. */
const VOLUME_MINIMO = 30;

function oQueAconteceu(c: Contexto): string {
  if (c.visitas === 0) {
    return c.noAr === 0
      ? `Nenhum artigo no ar ainda, então não havia o que medir ${c.texto}.`
      : `Nenhuma visita ${c.texto}, com ${artigos(c.noAr)} publicados. Quando um artigo novo entra, o Google leva de duas a oito semanas para começar a mandar gente.`;
  }
  if (c.semBase) {
    return `Este é o primeiro período com medição: ${visitas(c.visitas)} ${c.texto}. A partir daqui cada relatório passa a ter com o que comparar.`;
  }
  const delta = c.visitas - c.visitasAntes;
  if (delta === 0) {
    return `As visitas ficaram iguais às dos ${c.dias} dias anteriores: ${visitas(c.visitas)}. Estabilidade com pouco volume costuma ser falta de conteúdo novo, não teto de mercado.`;
  }
  const pct = c.visitasAntes > 0 ? Math.round((delta / c.visitasAntes) * 100) : null;
  const variacao = pct === null ? "" : ` (${delta > 0 ? "+" : "−"}${Math.abs(pct)}%)`;
  return delta > 0
    ? `As visitas subiram de ${n(c.visitasAntes)} para ${n(c.visitas)}${variacao} em relação aos ${c.dias} dias anteriores.`
    : `As visitas caíram de ${n(c.visitasAntes)} para ${n(c.visitas)}${variacao} em relação aos ${c.dias} dias anteriores. Queda com poucos artigos no ar costuma ser oscilação normal, não penalidade.`;
}

function oQueExplica(c: Contexto): string {
  if (c.publicados > 0) {
    return `${artigos(c.publicados)} ${c.publicados === 1 ? "foi ao ar" : "foram ao ar"} ${c.texto}, somando ${artigos(c.noAr)} publicados. O efeito de um texto novo aparece semanas depois de publicado, então parte do que está aqui ainda é resultado do que foi escrito antes.`;
  }
  if (c.noAr === 0) {
    return "Nenhum artigo publicado até agora. O primeiro passo é ter texto no ar respondendo o que o cliente pergunta antes de comprar.";
  }
  return `Nenhum artigo novo ${c.texto}: tudo o que apareceu veio do acervo de ${artigos(c.noAr)}. Acervo parado rende cada vez menos - é o que explica período sem crescimento.`;
}

function oQueViraConversa(c: Contexto): string {
  if (c.conversas > 0 && c.melhor && c.melhor.conversas > 0) {
    return `${conversas(c.conversas)} ${c.conversas === 1 ? "saiu" : "saíram"} do blog, e "${c.melhor.titulo}" respondeu por ${c.melhor.conversas} ${c.melhor.conversas === 1 ? "delas" : "delas"}. Esse é o assunto que aproxima de quem compra - vale escrever mais sobre ele.`;
  }
  if (c.conversas > 0) {
    return `${conversas(c.conversas)} ${c.conversas === 1 ? "saiu" : "saíram"} do blog ${c.texto}, ${n(c.taxa)}% de quem leu.`;
  }
  if (c.visitas === 0) {
    return "Sem visita não há conversa: o gargalo está antes, em aparecer na busca.";
  }
  return c.visitas < VOLUME_MINIMO
    ? `Ninguém chamou ${c.texto}. Com ${visitas(c.visitas)} ainda não dá para culpar o botão de contato: o que falta é público, e público vem de mais texto publicado.`
    : `Ninguém chamou, com ${visitas(c.visitas)}. Esse volume já permite concluir: o problema não é audiência, é a oferta no fim do artigo. Vale rever o que o botão promete.`;
}

function aBaseTecnica(c: Contexto): string | null {
  const partes: string[] = [];
  if (c.auditoria) {
    const { google, ia, googleAntes } = c.auditoria;
    const mudou =
      googleAntes === null || googleAntes === google
        ? ""
        : ` (${google > googleAntes ? "+" : "−"}${Math.abs(google - googleAntes)} desde a auditoria anterior)`;
    partes.push(
      `O site está em ${google} de 100 no Google${mudou} e ${ia} de 100 na prontidão para ser citado por IA.`,
    );
  }
  if (c.geo && c.geo.perguntas > 0) {
    partes.push(
      c.geo.citadas > 0
        ? `Em ${c.geo.perguntas} perguntas que um cliente faria a um assistente de IA, a marca apareceu em ${c.geo.citadas}.`
        : `Em ${c.geo.perguntas} perguntas que um cliente faria a um assistente de IA, a marca não apareceu nenhuma vez${c.geo.rival ? `; no lugar dela a IA cita ${c.geo.rival}` : ""}.`,
    );
  }
  return partes.length ? partes.join(" ") : null;
}

function proximoPasso(c: Contexto): Leitura["proximoPasso"] {
  if (c.noAr === 0) {
    return {
      rotulo: "Escolher a primeira pauta",
      href: "/strategy",
      texto: "Publicar o primeiro artigo é o que liga o resto: sem texto no ar não há busca, citação nem visita para medir.",
    };
  }
  if (c.auditoria && c.auditoria.google < 70) {
    return {
      rotulo: "Corrigir o site",
      href: "/audit",
      texto: `Com ${c.auditoria.google} de 100 no Google, o site tem problema técnico segurando o conteúdo. Corrigir isso rende mais do que publicar mais.`,
    };
  }
  if (c.visitas >= VOLUME_MINIMO && c.conversas === 0) {
    return {
      rotulo: "Rever a chamada para ação",
      href: "/settings/blog",
      texto: "Já existe gente lendo e ninguém chamando. O ajuste com maior retorno agora é o que o artigo oferece no fim.",
    };
  }
  if (c.geo && c.geo.perguntas > 0 && c.geo.citadas === 0) {
    return {
      rotulo: "Responder o que a IA não sabe",
      href: "/visibility",
      texto: "Cada pergunta que a IA respondeu citando outra empresa vira um artigo. É o caminho mais curto entre o diagnóstico e o texto certo.",
    };
  }
  return {
    rotulo: "Escolher a próxima pauta",
    href: "/strategy",
    texto: "O que mantém a curva subindo é cadência: assunto novo publicado antes de o anterior parar de render.",
  };
}

export function leituraDoPeriodo(c: Contexto): Leitura {
  const base = aBaseTecnica(c);
  return {
    paragrafos: [oQueAconteceu(c), oQueExplica(c), oQueViraConversa(c), ...(base ? [base] : [])],
    proximoPasso: proximoPasso(c),
  };
}
