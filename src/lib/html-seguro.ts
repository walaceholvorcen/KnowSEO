import sanitizeHtml from "sanitize-html";

// O corpo do artigo é HTML, e HTML de três origens que não controlamos: a
// saída do modelo (que lê a web e pode ter sido induzido por um texto
// plantado numa página), o que o operador cola no editor, e o que já estava
// gravado antes desta trava. Tudo passa por aqui antes de ir ao banco e
// antes de ir à tela - no painel, onde roda com a sessão da agência, e no
// blog público, na página do cliente.
//
// Lista do que entra, não do que sai: tag ou atributo novo que ninguém
// previu fica de fora por padrão. Revisão de segurança de 17/09, item S1c.

const OPCOES: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2", "h3", "h4", "p", "br", "hr",
    "ul", "ol", "li",
    "strong", "b", "em", "i", "u", "s", "sub", "sup", "mark", "small",
    "a", "blockquote", "code", "pre",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
    "figure", "figcaption", "img",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    img: ["src", "alt", "width", "height", "loading"],
    th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
  },
  // Sem javascript:, data: nem vbscript: - o vetor clássico de link que
  // executa ao clicar. Caminho relativo continua valendo (link interno).
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  // <script> e <style> somem com o conteúdo; o resto das tags proibidas
  // some e deixa o texto de dentro, para o artigo não perder frase.
  nonTextTags: ["script", "style", "textarea", "noscript", "iframe", "object"],
  transformTags: {
    // Link que abre em outra aba sem noopener entrega window.opener à
    // página de destino.
    a: (tag, attribs) => ({
      tagName: tag,
      attribs:
        attribs.target === "_blank"
          ? { ...attribs, rel: "noopener noreferrer" }
          : attribs,
    }),
  },
};

export function htmlSeguro(html: string | null | undefined): string {
  return html ? sanitizeHtml(html, OPCOES) : "";
}

// JSON dentro de <script type="application/ld+json">. JSON.stringify não
// escapa "<": um título de artigo com "</script><script>..." fecharia o
// bloco e abriria outro, executável, na página pública do cliente.
export function jsonParaScript(valor: unknown): string {
  return JSON.stringify(valor)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
