// Contas dos gráficos de linha por dia (tráfego de IA e desempenho no
// Google). Função pura: o componente só desenha o que sai daqui.

const DIA_MS = 86_400_000;

/** "2026-11-19" do instante, no fuso de quem opera o painel. */
export function diaNoFuso(instante: Date | string, fuso: string): string {
  const d = new Date(instante);
  try {
    // en-CA formata como AAAA-MM-DD.
    return new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(d);
  } catch {
    // Fuso inválido (cookie adulterado) cai em UTC em vez de derrubar a tela.
    return d.toISOString().slice(0, 10);
  }
}

/** Todos os dias de `de` até `ate`, inclusive nas pontas ("AAAA-MM-DD"). */
export function diasEntre(de: string, ate: string): string[] {
  const inicio = Date.parse(`${de}T00:00:00.000Z`);
  const fim = Date.parse(`${ate}T00:00:00.000Z`);
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim < inicio) return [];
  const dias: string[] = [];
  for (let t = inicio; t <= fim; t += DIA_MS) {
    dias.push(new Date(t).toISOString().slice(0, 10));
  }
  return dias;
}

/** O dia `n` dias antes de `dia`. */
export function diasAntes(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T00:00:00.000Z`) - n * DIA_MS)
    .toISOString()
    .slice(0, 10);
}

/** "19/11" - o dia como aparece no eixo e na dica. */
export function diaCurto(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

/**
 * As marcas do eixo vertical: de zero até cobrir o maior valor, em passo
 * redondo (1, 2, 5, 10, 20, 50...), com quatro ou cinco marcas.
 *
 * Passo redondo porque o eixo se lê sem conta: "0, 50, 100, 150" e não
 * "0, 34, 68, 102". `passoMinimo` é 1 para contagem (não existe meia
 * leitura) e menor para taxa.
 */
export function marcasDoEixo(max: number, passoMinimo = 1): number[] {
  const alvo = max > 0 ? max : passoMinimo * 4;
  const bruto = alvo / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const redondo =
    [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= bruto - 1e-9) ??
    10 * potencia;
  const passo = Math.max(passoMinimo, redondo);
  const quantas = Math.max(1, Math.ceil(alvo / passo - 1e-9));
  return Array.from({ length: quantas + 1 }, (_, i) => Number((i * passo).toFixed(6)));
}

/**
 * Parte uma série nos trechos contínuos, para a linha não atravessar um
 * buraco. `null` é "não há dado" (antes de a contagem existir, dia que o
 * Google ainda não fechou) - diferente de zero, que é dado.
 */
export function trechos(valores: (number | null)[]): { i: number; v: number }[][] {
  const partes: { i: number; v: number }[][] = [];
  let atual: { i: number; v: number }[] = [];
  valores.forEach((v, i) => {
    if (v === null) {
      if (atual.length) partes.push(atual);
      atual = [];
    } else {
      atual.push({ i, v });
    }
  });
  if (atual.length) partes.push(atual);
  return partes;
}
