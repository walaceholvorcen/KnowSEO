// Contraste da cor da marca do cliente.
//
// A cor escolhida pelo cliente pinta o cabeçalho do blog, a capa gerada e o
// botão de CTA, sempre com texto por cima. O código antigo assumia texto
// branco: quem escolhesse amarelo ou lima publicava um blog ilegível e só
// descobria olhando. Aqui a decisão do texto vem da cor, não do palpite.

const PAPEL = "#f3f4f1";
const TINTA = "#15191c";

export function parseHex(hex: string): [number, number, number] | null {
  const limpo = hex.trim().replace(/^#/, "");
  const completo =
    limpo.length === 3
      ? limpo
          .split("")
          .map((c) => c + c)
          .join("")
      : limpo;

  if (!/^[0-9a-fA-F]{6}$/.test(completo)) return null;

  return [
    parseInt(completo.slice(0, 2), 16),
    parseInt(completo.slice(2, 4), 16),
    parseInt(completo.slice(4, 6), 16),
  ];
}

// Luminância relativa da WCAG. O canal passa por gama antes de entrar na
// média ponderada - é por isso que amarelo puro é "claro" e azul puro não.
function luminancia(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  if (!a || !b) return 1;

  const la = luminancia(a);
  const lb = luminancia(b);
  const [claro, escuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (escuro + 0.05);
}

// Texto legível sobre a cor da marca: papel sobre cor escura, tinta sobre
// cor clara. Devolve tinta quando o hex é inválido - falha para o lado
// legível em vez de sumir.
export function textoSobre(corDeFundo: string): string {
  // Hex inválido não pinta fundo nenhum: o navegador deixa passar o fundo
  // claro da página. Texto claro ali sumiria, então a falha vai para tinta.
  if (!parseHex(corDeFundo)) return TINTA;

  return contrastRatio(corDeFundo, PAPEL) >= contrastRatio(corDeFundo, TINTA)
    ? PAPEL
    : TINTA;
}

// A cor serve como texto sobre papel? Usada onde a marca aparece como link
// ou rótulo, não como preenchimento - aí não dá para inverter o texto.
export function serveComoTexto(cor: string): boolean {
  return contrastRatio(cor, PAPEL) >= 4.5;
}

// A cor se separa do papel da página?
//
// Legibilidade do texto já está resolvida por textoSobre(). O que sobra de
// risco é a cor clara demais: o cabeçalho e o botão viram um retângulo
// invisível sobre o fundo claro do blog. Amarelo-limão falha aqui, e é
// exatamente o aviso que faltava no seletor.
export function destacaDoFundo(cor: string): boolean {
  return contrastRatio(cor, PAPEL) >= 1.5;
}
