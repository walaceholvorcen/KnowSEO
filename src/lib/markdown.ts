// Renderizador mínimo de markdown para a resposta dos assistentes de IA.
//
// Por que não uma biblioteca: o texto vem de terceiros (o modelo, com busca
// na web) e só precisa de título, lista, negrito, itálico, link e código
// inline. Um parser completo traria HTML cru, imagens e tabelas que a tela
// não quer — e uma dependência a mais para vigiar. Aqui o HTML é escapado
// ANTES de qualquer marcação, então nada que venha no texto vira tag.

const escapar = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Negrito, itálico e link só valem fora de código inline: `**x**` dentro de
// crase é texto literal, como em qualquer markdown.
function inline(texto: string): string {
  return texto
    .split(/(`[^`]+`)/)
    .map((parte) => {
      if (parte.startsWith("`") && parte.endsWith("`") && parte.length > 2) {
        return `<code>${parte.slice(1, -1)}</code>`;
      }
      return (
        parte
          // Só http/https: o texto já foi escapado, então `javascript:` ou
          // aspas na URL nunca chegam aqui inteiras. rel noopener por ser
          // link para fora do painel.
          .replace(
            /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
          )
          .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
          .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>")
          .replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, "$1<em>$2</em>")
      );
    })
    .join("");
}

export function markdownParaHtml(md: string): string {
  const linhas = escapar(md).replace(/\r\n?/g, "\n").split("\n");
  const saida: string[] = [];
  let paragrafo: string[] = [];
  let lista: "ul" | "ol" | null = null;

  const fecharParagrafo = () => {
    if (paragrafo.length) {
      saida.push(`<p>${inline(paragrafo.join(" "))}</p>`);
      paragrafo = [];
    }
  };
  const fecharLista = () => {
    if (lista) {
      saida.push(`</${lista}>`);
      lista = null;
    }
  };

  for (const linha of linhas) {
    const titulo = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(linha);
    const item = /^\s*(?:[-*]|(\d+)[.)])\s+(.+)$/.exec(linha);

    if (titulo) {
      fecharParagrafo();
      fecharLista();
      const nivel = titulo[1].length;
      saida.push(`<h${nivel}>${inline(titulo[2])}</h${nivel}>`);
    } else if (item) {
      fecharParagrafo();
      const tipo = item[1] ? "ol" : "ul";
      if (lista !== tipo) {
        fecharLista();
        lista = tipo;
        saida.push(`<${tipo}>`);
      }
      saida.push(`<li>${inline(item[2])}</li>`);
    } else if (linha.trim() === "") {
      fecharParagrafo();
      fecharLista();
    } else {
      // Linha solta logo abaixo de item de lista continua o item, como no
      // markdown; fora de lista, junta ao parágrafo em andamento.
      if (lista && /^\s+/.test(linha)) {
        saida[saida.length - 1] = saida[saida.length - 1].replace(
          /<\/li>$/,
          ` ${inline(linha.trim())}</li>`,
        );
      } else {
        fecharLista();
        paragrafo.push(linha.trim());
      }
    }
  }
  fecharParagrafo();
  fecharLista();
  return saida.join("\n");
}
