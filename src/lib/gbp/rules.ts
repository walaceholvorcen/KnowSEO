import type { Finding, PlaceProfile, Severity } from "./types";

// Piso abaixo do qual o mercado local costuma desconfiar da nota. Não é
// "corrigível" com um clique - por isso vira achado de severidade info, não
// quick_win: avisa, não manda "resolver" uma nota que o cliente não controla
// diretamente.
const NOTA_MINIMA_SAUDAVEL = 4.0;

// Referência comum para negócio local competir bem em buscas por perto.
const AVALIACOES_MINIMAS = 10;

// Abaixo disto o perfil parece abandonado, mesmo sem estar oficialmente
// fechado. Fotos são o primeiro filtro visual de quem decide clicar ou não.
const FOTOS_MINIMAS = 3;

type Rule = (p: PlaceProfile) => Finding | null;

const perfilFechado: Rule = (p) => {
  if (p.businessStatus === "OPERATIONAL" || p.businessStatus === null) {
    return null;
  }
  return {
    code: "gbp_fechado",
    severity: "critical",
    title:
      p.businessStatus === "CLOSED_PERMANENTLY"
        ? "Perfil marcado como fechado permanentemente"
        : "Perfil marcado como temporariamente fechado",
    impact:
      "O Google esconde ou penaliza a posição de negócios marcados como fechados, mesmo funcionando normalmente.",
    evidence: `Status no Google: ${p.businessStatus}.`,
    fix: "Entre no perfil (business.google.com) e reabra o status do negócio.",
  };
};

const semTelefone: Rule = (p) =>
  p.phone
    ? null
    : {
        code: "gbp_sem_telefone",
        severity: "high",
        title: "Nenhum telefone visível no perfil",
        impact:
          "Quem pesquisa perto de você espera ligar direto do resultado - sem telefone, a pessoa desiste ou liga pro concorrente ao lado.",
        evidence: "Campo de telefone vazio no Google.",
        fix: "Adicione um telefone que alguém realmente atenda.",
      };

const semSite: Rule = (p) =>
  p.website
    ? null
    : {
        code: "gbp_sem_site",
        severity: "high",
        title: "Nenhum site vinculado ao perfil",
        impact:
          "O perfil não manda tráfego para o blog nem para a página de contato - todo clique de \"site\" no Google morre ali.",
        evidence: "Campo de site vazio no Google.",
        fix: "Vincule o site (ou o blog) ao perfil.",
      };

const semHorario: Rule = (p) =>
  p.hasOpeningHours
    ? null
    : {
        code: "gbp_sem_horario",
        severity: "medium",
        title: "Horário de funcionamento não informado",
        impact:
          "Sem horário, o Google mostra \"Horários podem ser diferentes\" - isso reduz a confiança de quem está decidindo visitar agora.",
        evidence: "Nenhum horário configurado no perfil.",
        fix: "Preencha o horário de cada dia da semana no perfil.",
      };

const poucasFotos: Rule = (p) =>
  p.photoCount >= FOTOS_MINIMAS
    ? null
    : {
        code: "gbp_poucas_fotos",
        severity: "quick_win",
        title: `Poucas fotos no perfil (${p.photoCount})`,
        impact:
          "Perfil com poucas fotos passa a impressão de abandonado, mesmo com nota alta.",
        evidence: `A API do Google devolveu ${p.photoCount} ${p.photoCount === 1 ? "foto" : "fotos"} para este perfil - pode haver mais fotos enviadas por clientes que a busca não trouxe.`,
        fix: "Suba pelo menos 5 fotos recentes: fachada, ambiente interno e o serviço em ação.",
      };

const poucasAvaliacoes: Rule = (p) =>
  p.reviewCount >= AVALIACOES_MINIMAS
    ? null
    : {
        code: "gbp_poucas_avaliacoes",
        severity: "quick_win",
        title: `Poucas avaliações (${p.reviewCount})`,
        impact:
          "Volume de avaliações pesa no ranqueamento local tanto quanto a nota média - dois perfis com nota 5 não competem igual se um tem 3 avaliações e o outro 80.",
        evidence: `${p.reviewCount} ${p.reviewCount === 1 ? "avaliação" : "avaliações"} registradas.`,
        fix: "Peça avaliação a cada cliente atendido - um link direto no WhatsApp do pós-venda já ajuda.",
      };

const notaBaixa: Rule = (p) => {
  if (p.rating === null || p.rating >= NOTA_MINIMA_SAUDAVEL) return null;
  return {
    code: "gbp_nota_baixa",
    severity: "info",
    title: `Nota abaixo do que o mercado local costuma exigir (${p.rating.toFixed(1)})`,
    impact:
      "Nota abaixo de 4.0 afasta parte de quem compara opções antes de decidir - e o Google não corrige isso por conta própria.",
    evidence: `Nota atual: ${p.rating.toFixed(1)} em ${p.reviewCount} ${p.reviewCount === 1 ? "avaliação" : "avaliações"}.`,
    fix: "Isto não se corrige na tela de configuração do perfil - peça avaliação de clientes satisfeitos com mais frequência para diluir as notas baixas.",
  };
};

const RULES: Rule[] = [
  perfilFechado,
  semTelefone,
  semSite,
  semHorario,
  poucasFotos,
  poucasAvaliacoes,
  notaBaixa,
];

export function runRules(profile: PlaceProfile): Finding[] {
  return RULES.map((rule) => rule(profile)).filter(
    (f): f is Finding => f !== null,
  );
}

// Peso fixo por severidade. Ao contrário da auditoria de site, aqui não há
// "páginas afetadas" para diluir ou concentrar o impacto - é um perfil só,
// então a penalidade proporcional ao alcance não se aplica.
const PESO: Record<Severity, number> = {
  critical: 40,
  high: 20,
  medium: 10,
  quick_win: 6,
  info: 0,
};

export function computeScore(findings: Finding[]): number {
  const penalidade = findings.reduce((soma, f) => soma + PESO[f.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalidade));
}
