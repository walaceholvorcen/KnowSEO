// A jornada de um site depois da auditoria.
//
// O problema que isto resolve é de produto, não de SEO: o cliente audita,
// corrige, vê a nota subir de 55 para 96 - e para. Para ele, "subiu o nível,
// acabou". Só que a nota alta é o começo da parte que dá resultado, por dois
// motivos que a tela precisa dizer com data:
//
//   1. O Google não reage na hora. A correção vale no site no minuto em que
//      é feita, mas a posição muda de 2 a 8 semanas depois, quando o Google
//      volta a rastrear. Quem para de olhar no dia em que a nota sobe perde
//      exatamente a janela em que o efeito aparece.
//   2. Site não fica parado. Página nova, plugin atualizado, publicação que
//      quebra um link - e ninguém avisa. Uma nota 96 hoje não é 96 daqui a
//      dois meses sem alguém conferir.
//
// Então a auditoria deixa de ser exame e vira acompanhamento: uma sequência
// real de etapas (cada uma depende da anterior) e uma data de próxima
// verificação com o motivo dela. Tudo calculado do histórico que já existe;
// nenhuma IA, nenhum dado inventado. Os prazos são a expectativa típica, e a
// tela diz que são expectativa.

const DIA = 86_400_000;

/** Janela típica entre a correção e o reflexo na posição do Google. */
const EFEITO_INICIO_DIAS = 14;
const EFEITO_FIM_DIAS = 56;
/** Correção recente: vale confirmar que ela se manteve. */
const CONFIRMAR_DIAS = 7;
/** Cadência de manutenção. SEO não pede mais que isso; menos, deixa passar. */
const REVISAO_DIAS = 30;

export interface AuditoriaDoSite {
  id: string;
  created_at: string;
  score_google: number | null;
  score_ai: number | null;
  /** A auditoria tinha algum achado crítico ou alto. */
  comPrioridade: boolean;
}

export type EstadoEtapa = "feita" | "atual" | "futura";
export type ChaveEtapa = "diagnostico" | "correcao" | "efeito" | "manutencao";

export interface Etapa {
  chave: ChaveEtapa;
  nome: string;
  estado: EstadoEtapa;
  detalhe: string;
}

export interface ProximaVerificacao {
  /** ISO. null quando a recomendação é agir agora. */
  quando: string | null;
  resumo: string;
  motivo: string;
  automatica: boolean;
  atrasada: boolean;
}

export interface Jornada {
  etapas: Etapa[];
  atual: ChaveEtapa;
  proxima: ProximaVerificacao;
  evolucao: { data: string; google: number; ia: number }[];
  /** Pontos que a nota Google ganhou (ou perdeu) desde a primeira auditoria. */
  ganhoGoogle: number | null;
}

// Datas em UTC de propósito: o mesmo texto no servidor e no navegador, sem
// o dia "pular" por fuso na hidratação.
export function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

const somarDias = (iso: string, dias: number) =>
  new Date(new Date(iso).getTime() + dias * DIA).toISOString();

/** Próxima segunda-feira 07:00 UTC - o horário do cron em vercel.json. */
function proximaSegunda(agora: Date): string {
  const d = new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 7),
  );
  const faltam = (8 - d.getUTCDay()) % 7;
  d.setUTCDate(d.getUTCDate() + faltam);
  if (d.getTime() <= agora.getTime()) d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString();
}

export function montarJornada({
  historico,
  abertosPrioridade,
  agora,
  acompanhamentoAtivo,
}: {
  /** Auditorias concluídas do MESMO site, em qualquer ordem. */
  historico: AuditoriaDoSite[];
  /** Achados críticos e altos na auditoria mais recente. */
  abertosPrioridade: number;
  agora: Date;
  acompanhamentoAtivo: boolean;
}): Jornada | null {
  const cronologico = [...historico].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  if (!cronologico.length) return null;

  const primeira = cronologico[0];
  const ultima = cronologico[cronologico.length - 1];

  // A correção termina na primeira auditoria a partir da qual nenhuma outra
  // voltou a ter item de prioridade alta. Se uma prioridade reapareceu no
  // meio, a data é a da recuperação, não a da primeira vez.
  let correcao: string | null = null;
  if (abertosPrioridade === 0 && !ultima.comPrioridade) {
    let i = cronologico.length - 1;
    while (i > 0 && !cronologico[i - 1].comPrioridade) i--;
    correcao = cronologico[i].created_at;
  }

  const etapas: Etapa[] = [
    {
      chave: "diagnostico",
      nome: "Diagnóstico",
      estado: "feita",
      detalhe: `Primeira auditoria em ${dataCurta(primeira.created_at)}`,
    },
  ];

  etapas.push(
    correcao
      ? {
          chave: "correcao",
          nome: "Correção",
          estado: "feita",
          detalhe: `Sem pendência de prioridade alta desde ${dataCurta(correcao)}`,
        }
      : {
          chave: "correcao",
          nome: "Correção",
          estado: "atual",
          detalhe: `${abertosPrioridade} ${abertosPrioridade === 1 ? "item de prioridade alta aberto" : "itens de prioridade alta abertos"}`,
        },
  );

  let efeitoFeito = false;
  if (!correcao) {
    etapas.push({
      chave: "efeito",
      nome: "Efeito no Google",
      estado: "futura",
      detalhe: "De 2 a 8 semanas depois da correção",
    });
  } else {
    const inicio = somarDias(correcao, EFEITO_INICIO_DIAS);
    const fim = somarDias(correcao, EFEITO_FIM_DIAS);
    if (agora.getTime() < new Date(fim).getTime()) {
      etapas.push({
        chave: "efeito",
        nome: "Efeito no Google",
        estado: "atual",
        detalhe:
          agora.getTime() < new Date(inicio).getTime()
            ? `Costuma aparecer entre ${dataCurta(inicio)} e ${dataCurta(fim)}`
            : `Na janela em que costuma aparecer, até ${dataCurta(fim)}`,
      });
    } else {
      efeitoFeito = true;
      etapas.push({
        chave: "efeito",
        nome: "Efeito no Google",
        estado: "feita",
        detalhe: `Janela típica encerrada em ${dataCurta(fim)}`,
      });
    }
  }

  etapas.push({
    chave: "manutencao",
    nome: "Manutenção",
    estado: efeitoFeito ? "atual" : "futura",
    detalhe: acompanhamentoAtivo
      ? "Reauditoria automática toda segunda"
      : "Uma verificação por mês",
  });

  const atual = etapas.find((e) => e.estado === "atual")?.chave ?? "manutencao";

  // ------------------------------------------------ próxima verificação
  let proxima: ProximaVerificacao;
  if (abertosPrioridade > 0) {
    proxima = {
      quando: null,
      resumo: "Corrija e rode de novo",
      motivo:
        "Corrija os itens de prioridade alta e rode a auditoria de novo. Ela confirma a correção no site na hora - não precisa esperar o Google.",
      automatica: false,
      atrasada: false,
    };
  } else {
    const recente =
      correcao !== null &&
      agora.getTime() - new Date(correcao).getTime() < EFEITO_INICIO_DIAS * DIA;
    const quando = somarDias(
      ultima.created_at,
      recente ? CONFIRMAR_DIAS : REVISAO_DIAS,
    );
    const motivo = recente
      ? "Confirmar que a correção se manteve: atualização de plugin, de tema ou uma publicação nova às vezes desfaz o que foi arrumado."
      : "Todo site muda - página nova, plugin atualizado, link que quebra - e o Google não avisa. Uma verificação por mês pega isso antes de custar posição.";

    if (acompanhamentoAtivo) {
      proxima = {
        quando: proximaSegunda(agora),
        resumo: "Automática, toda segunda",
        motivo: `${motivo} Já está agendada: reauditamos o site toda segunda-feira, sem você precisar clicar.`,
        automatica: true,
        atrasada: false,
      };
    } else {
      const atrasada = new Date(quando).getTime() < agora.getTime();
      proxima = {
        quando,
        resumo: atrasada
          ? "Atrasada"
          : recente
            ? "Confirmar a correção"
            : "Revisão mensal",
        motivo: atrasada
          ? `A última verificação foi em ${dataCurta(ultima.created_at)}. ${motivo}`
          : motivo,
        automatica: false,
        atrasada,
      };
    }
  }

  const evolucao = cronologico
    .filter((a) => a.score_google !== null && a.score_ai !== null)
    .map((a) => ({
      data: a.created_at,
      google: a.score_google as number,
      ia: a.score_ai as number,
    }));

  return {
    etapas,
    atual,
    proxima,
    evolucao,
    ganhoGoogle:
      evolucao.length > 1
        ? evolucao[evolucao.length - 1].google - evolucao[0].google
        : null,
  };
}
