// O calendário de publicação. Função pura: a tela desenha, o robô diário
// obedece, e os dois leem a mesma regra daqui.
//
// A decisão que organiza o módulo: **`scheduled_at` é a única verdade**. O
// esquema até aceita `status = 'scheduled'`, mas um terceiro estado teria de
// ser tratado em seis lugares que hoje perguntam "é rascunho?" - o autosave,
// a contagem de pendências no Início, a lista de Conteúdos - em troca de
// nada. Artigo agendado continua rascunho; o que o agenda é a data.
//
// Tudo em UTC. O dia escolhido é gravado à meia-noite UTC, e o robô diário
// roda às 8h UTC: a data vale o dia inteiro, sem a armadilha de um fuso
// empurrar a publicação para a véspera.

const DIA_MS = 86_400_000;

/** Meia-noite UTC do dia deste instante. */
export function diaUTC(quando: Date | string): Date {
  const d = new Date(quando);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** "2026-10" -> primeiro e último dia do mês, meia-noite UTC. */
export function limitesDoMes(mes: string): { inicio: Date; fim: Date } {
  const [ano, m] = mes.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, m - 1, 1));
  const fim = new Date(Date.UTC(ano, m, 0));
  return { inicio, fim };
}

/** "2026-10" do mês deste instante. */
export function mesDe(quando: Date): string {
  return `${quando.getUTCFullYear()}-${String(quando.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** O mês anterior e o seguinte, para a navegação da tela. */
export function mesVizinho(mes: string, passo: -1 | 1): string {
  const { inicio } = limitesDoMes(mes);
  return mesDe(new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + passo, 1)));
}

/** Sábado e domingo ficam fora: é quando o leitor B2B não está procurando. */
export function ehDiaUtil(d: Date): boolean {
  const semana = d.getUTCDay();
  return semana !== 0 && semana !== 6;
}

/** Os dias úteis de um intervalo, inclusive nas pontas. */
export function diasUteis(de: Date, ate: Date): Date[] {
  const dias: Date[] = [];
  for (let t = diaUTC(de).getTime(); t <= diaUTC(ate).getTime(); t += DIA_MS) {
    const d = new Date(t);
    if (ehDiaUtil(d)) dias.push(d);
  }
  return dias;
}

/**
 * Espalha `quantidade` artigos pelos dias úteis do intervalo.
 *
 * É a peça que transforma um dia de trabalho num mês de cadência: em vez de
 * escolher doze datas à mão, a agência escreve os artigos e distribui uma
 * vez. O espaçamento é parelho de ponta a ponta - seis artigos em outubro
 * caem a cada quatro dias úteis, não três na primeira semana e nada depois.
 *
 * Mais artigos que dias úteis: cada dia recebe um e o resto fica sem data,
 * em vez de dois no mesmo dia. Publicar dois artigos no mesmo dia desperdiça
 * cadência, que é justamente o que se está tentando construir.
 */
export function distribuirDatas(
  quantidade: number,
  de: Date,
  ate: Date,
): Date[] {
  const dias = diasUteis(de, ate);
  if (quantidade < 1 || dias.length === 0) return [];
  if (quantidade === 1) return [dias[0]];
  if (quantidade >= dias.length) return dias;

  const passo = (dias.length - 1) / (quantidade - 1);
  return Array.from({ length: quantidade }, (_, i) => dias[Math.round(i * passo)]);
}

/** Chegou a hora deste artigo ir ao ar? É a regra do robô diário. */
export function venceu(scheduledAt: string | null, agora: Date): boolean {
  if (!scheduledAt) return false;
  const quando = Date.parse(scheduledAt);
  return Number.isFinite(quando) && quando <= agora.getTime();
}

export interface DiaDoCalendario {
  dia: Date;
  /** Falso nos dias do mês vizinho que completam a primeira e a última semana. */
  doMes: boolean;
  hoje: boolean;
  util: boolean;
}

/**
 * As semanas do mês, de segunda a domingo.
 *
 * Segunda e não domingo: o mercado é a Espanha, onde a semana começa na
 * segunda - e é também o dia em que o acompanhamento semanal roda.
 */
export function semanasDoMes(mes: string, hoje: Date): DiaDoCalendario[][] {
  const { inicio, fim } = limitesDoMes(mes);
  // getUTCDay(): 0 é domingo. Com a semana começando na segunda, domingo é
  // o sétimo dia, não o primeiro.
  const desloca = (inicio.getUTCDay() + 6) % 7;
  const primeiro = new Date(inicio.getTime() - desloca * DIA_MS);
  const hojeUTC = diaUTC(hoje).getTime();

  const semanas: DiaDoCalendario[][] = [];
  let t = primeiro.getTime();
  // Sempre semanas inteiras, e a última é a que contém o último dia do mês:
  // um mês nunca precisa de uma sexta linha vazia.
  do {
    const semana: DiaDoCalendario[] = [];
    for (let i = 0; i < 7; i++) {
      const dia = new Date(t);
      semana.push({
        dia,
        doMes: dia.getUTCMonth() === inicio.getUTCMonth(),
        hoje: dia.getTime() === hojeUTC,
        util: ehDiaUtil(dia),
      });
      t += DIA_MS;
    }
    semanas.push(semana);
  } while (t <= fim.getTime());
  return semanas;
}

/** "2026-10-14", que é o valor de um <input type="date">. */
export function paraInput(d: Date | string): string {
  return diaUTC(d).toISOString().slice(0, 10);
}

/** O que o <input type="date"> devolve, de volta para instante gravável. */
export function doInput(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const t = Date.parse(`${valor}T00:00:00.000Z`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
