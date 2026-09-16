// Cores da marca lidas do próprio logo.
//
// O cliente sabe qual é a cor dele, mas raramente sabe o código hexadecimal -
// e pedir isso trava o cadastro na primeira tela. Aqui os pixels do logo que
// ele já tem em mãos respondem por ele: agrupamos as cores, descartamos o
// fundo e devolvemos a mais presente e uma segunda que contraste com ela.
//
// Função pura sobre os pixels (o `canvas` do navegador entrega o array): dá
// para testar sem imagem e sem rede.

export interface Paleta {
  principal: string;
  secundaria: string;
}

const hex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

function hsl(r: number, g: number, b: number): [number, number, number] {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rr
      ? ((gg - bb) / d + (gg < bb ? 6 : 0)) * 60
      : max === gg
        ? ((bb - rr) / d + 2) * 60
        : ((rr - gg) / d + 4) * 60;
  return [h, s, l];
}

/** Distância de matiz no círculo: 170° e 350° são opostos, não vizinhos. */
function distanciaDeMatiz(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

interface Grupo {
  soma: [number, number, number];
  n: number;
}

/**
 * Cor principal e secundária a partir dos pixels RGBA do logo.
 *
 * `passo` pula pixels: um logo de 1000×1000 tem um milhão deles e a cor
 * dominante não muda por olhar um em cada dez.
 */
export function paletaDoLogo(pixels: ArrayLike<number>, passo = 10): Paleta | null {
  const grupos = new Map<string, Grupo>();

  for (let i = 0; i < pixels.length; i += 4 * passo) {
    const [r, g, b, a] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
    // Transparente é fundo, não cor da marca. Branco quase puro idem: é o
    // papel em que quase todo logo é entregue.
    if (a < 200) continue;
    if (r > 242 && g > 242 && b > 242) continue;

    // Agrupa em 16 níveis por canal: sem isso o antisserrilhado da borda
    // vira centenas de tons quase iguais e nenhum ganha.
    const chave = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const atual = grupos.get(chave) ?? { soma: [0, 0, 0] as [number, number, number], n: 0 };
    atual.soma[0] += r;
    atual.soma[1] += g;
    atual.soma[2] += b;
    atual.n++;
    grupos.set(chave, atual);
  }

  const ordenados = [...grupos.values()]
    .sort((a, b) => b.n - a.n)
    .map((g) => {
      const media: [number, number, number] = [
        g.soma[0] / g.n,
        g.soma[1] / g.n,
        g.soma[2] / g.n,
      ];
      return { media, n: g.n, hsl: hsl(...media) };
    });

  if (ordenados.length === 0) return null;

  // Uma cor com saturação vence o preto e o cinza mesmo com menos pixels:
  // logo escrito em preto sobre branco tem uma cor de marca, e é a do
  // símbolo. Só vale se o tom aparecer de verdade (5% dos pixels lidos).
  const total = ordenados.reduce((s, g) => s + g.n, 0);
  const colorido = ordenados.find(
    (g) => g.hsl[1] >= 0.25 && g.hsl[2] > 0.12 && g.hsl[2] < 0.92 && g.n / total >= 0.05,
  );
  const principal = colorido ?? ordenados[0];

  // A segunda precisa ser distinguível da primeira: outro matiz, ou o mesmo
  // matiz em claridade bem diferente. Senão o cliente escolhe duas cores que
  // parecem uma só.
  const segunda = ordenados.find(
    (g) =>
      g !== principal &&
      (distanciaDeMatiz(g.hsl[0], principal.hsl[0]) >= 25 ||
        Math.abs(g.hsl[2] - principal.hsl[2]) >= 0.25),
  );

  return {
    principal: hex(...principal.media),
    // Sem segunda cor no logo (logo de uma cor só), a secundária é a
    // principal escurecida: continua sendo a marca, e serve de acento.
    secundaria: segunda
      ? hex(...segunda.media)
      : hex(
          principal.media[0] * 0.55,
          principal.media[1] * 0.55,
          principal.media[2] * 0.55,
        ),
  };
}
