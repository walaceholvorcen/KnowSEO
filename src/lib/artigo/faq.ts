// Perguntas frequentes no fim do artigo (pedidas no prompt, brand-prompt.ts).
//
// O schema FAQPage sai do próprio HTML, não de um campo à parte: se o
// cliente edita uma pergunta no editor, o dado estruturado acompanha, e
// artigo sem a seção simplesmente não ganha o schema.
//
// O título da seção é fixo por idioma para o gerador escrever e esta
// função achar a mesma coisa.

export const TITULO_FAQ = {
  es: "Preguntas frecuentes",
  pt: "Perguntas frequentes",
  en: "Frequently asked questions",
} as const;

const EH_FAQ = /^(preguntas frecuentes|perguntas frequentes|frequently asked questions|faq)$/i;

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
  nbsp: " ",
};

function texto(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e: string) => ENTIDADES[e])
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pares pergunta/resposta da seção de perguntas frequentes: o H2 com o
 * título da seção, cada H3 é uma pergunta e o que vem até o próximo H3 é a
 * resposta. Termina no próximo H2. Sem seção, ou com menos de 2 pares, [].
 */
export function perguntasFrequentes(html: string | null | undefined): { pergunta: string; resposta: string }[] {
  if (!html) return [];
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
  const i = h2s.findIndex((m) => EH_FAQ.test(texto(m[1]).replace(/[:?¿]/g, "").trim()));
  if (i < 0) return [];

  const inicio = h2s[i].index! + h2s[i][0].length;
  const fim = h2s[i + 1]?.index ?? html.length;
  const secao = html.slice(inicio, fim);

  const pares = [...secao.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[\s>]|$)/gi)]
    .map((m) => ({ pergunta: texto(m[1]), resposta: texto(m[2]) }))
    .filter((p) => p.pergunta && p.resposta);
  return pares.length >= 2 ? pares : [];
}
