import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { botao, pagina } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Lede, Linha, Secao, Regua } from "@/components/lede";
import { scoreBand } from "@/lib/audit/rules";
import type { Gargalo, Etapa } from "@/lib/gargalo";
import type { OnboardingSteps } from "@/types";
import { EvolucaoDosArtigos } from "./evolucao";
import { DIAS_JANELA, type DadosInicio } from "./dados";

// O passo "veja as primeiras visitas" saiu: ver um número não é
// configuração, é consequência. A configuração acaba quando o blog está
// pronto para produzir - daí em diante o painel mostra a operação, não a
// lista de tarefas.
const STEPS: {
  key: keyof OnboardingSteps;
  title: string;
  description: string;
  href: string;
}[] = [
  {
    key: "brand_dna",
    title: "Defina o DNA da marca",
    description: "O que a empresa faz, para quem escreve e em que tom.",
    href: "/settings/brand",
  },
  {
    key: "site_analyzed",
    title: "Mapeie as páginas do seu site",
    description: "É o que permite link interno automático nos artigos.",
    href: "/settings/blog",
  },
  {
    key: "domain_connected",
    title: "Conecte seu domínio",
    description: "Use o seu domínio no lugar do subdomínio gratuito.",
    href: "/settings/blog",
  },
  {
    key: "first_article_published",
    title: "Publique o primeiro artigo",
    description: "Escolha uma pauta e deixe a IA escrever.",
    href: "/strategy",
  },
];

// A corrente do produto, na ordem em que uma coisa depende da outra. É a
// mesma ordem que o diagnóstico de gargalo percorre, para que a frase de
// cima e a lista de baixo nunca contem histórias diferentes.
const ETAPA_DA_LINHA: Record<string, Etapa> = {
  site: "site",
  pautas: "pauta",
  artigos: "conteudo",
  visitas: "alcance",
  conversas: "conversao",
  ia: "ia",
};

// Visitas dia a dia, em barras. É a diferença entre foto e filme: o total
// sozinho não conta se a semana passada foi melhor que esta. Escala pelo
// maior dia da janela; dia sem visita fica só com a linha de base.
function BarrasPorDia({ porDia }: { porDia: number[] }) {
  const max = Math.max(...porDia, 1);
  const largura = porDia.length * 5.5 - 1.5;
  return (
    <svg
      viewBox={`0 0 ${largura} 26`}
      className="h-7 w-28"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line
        x1="0"
        y1="25.5"
        x2={largura}
        y2="25.5"
        className="stroke-slate-300 dark:stroke-slate-700"
        strokeWidth="1"
      />
      {porDia.map((v, i) => {
        if (v === 0) return null;
        const altura = Math.max(2, (v / max) * 22);
        return (
          <rect
            key={i}
            x={i * 5.5}
            y={24 - altura}
            width="4"
            height={altura}
            rx="1"
            className="fill-cobalto-500/80 dark:fill-cobalto-400/80"
          />
        );
      })}
    </svg>
  );
}

// Uma célula por pergunta do Radar: cheia quando algum assistente citou a
// marca naquela pergunta. A proporção vira forma, não só fração escrita.
function Celulas({ total, cheias }: { total: number; cheias: number }) {
  return (
    <div className="flex h-7 w-28 items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 min-w-0 flex-1 rounded-full",
            i < cheias
              ? "bg-cobalto-500 dark:bg-cobalto-400"
              : "bg-slate-200 dark:bg-slate-800",
          )}
        />
      ))}
    </div>
  );
}

export function InicioBoard({
  blogNome,
  feitos,
  gargalo,
  dados,
}: {
  blogNome: string;
  feitos: OnboardingSteps;
  gargalo: Gargalo;
  dados: DadosInicio;
}) {
  const faltando = STEPS.filter((s) => !feitos[s.key]);
  const configurando = faltando.length > 0;

  const banda = dados.notaGoogle != null ? scoreBand(dados.notaGoogle) : null;
  const corMarcador =
    banda === "excelente" || banda === "bom"
      ? "bg-nota-excelente"
      : banda === "atencao"
        ? "bg-nota-atencao"
        : "bg-nota-critico";

  const totalCelulas = dados.perguntasRodada || dados.perguntas;

  const linhas: {
    id: string;
    titulo: string;
    valor: number | null;
    sufixo?: string;
    estado?: ReturnType<typeof scoreBand> | null;
    href: string;
    vazio: string;
    /** Texto para valor 0 quando 0 não significa "nunca medido". */
    zero?: string;
    leitura?: React.ReactNode;
  }[] = [
    {
      id: "site",
      titulo: "Saúde do site",
      valor: dados.notaGoogle,
      sufixo: "de 100",
      estado: banda,
      href: "/audit",
      vazio: "Nunca auditado",
      leitura:
        dados.notaGoogle != null ? (
          <div className="w-28">
            <Regua
              score={dados.notaGoogle}
              corMarcador={corMarcador}
              className="mt-0"
            />
          </div>
        ) : undefined,
    },
    {
      id: "pautas",
      titulo: "Pautas esperando",
      valor: dados.pautas,
      href: "/strategy",
      vazio: "Nenhuma sugerida",
    },
    {
      id: "artigos",
      titulo: "Artigos no ar",
      valor: dados.publicados,
      href: "/contents",
      vazio: "Nenhum publicado",
    },
    {
      id: "visitas",
      titulo: `Visitas em ${DIAS_JANELA} dias`,
      valor: dados.visitas,
      href: "/reports",
      vazio: "Ninguém ainda",
      leitura:
        dados.visitas > 0 ? (
          <BarrasPorDia porDia={dados.visitasPorDia} />
        ) : undefined,
    },
    {
      id: "conversas",
      titulo: `Conversas em ${DIAS_JANELA} dias`,
      valor: dados.conversas,
      href: "/reports",
      vazio: "Ninguém chamou",
    },
    {
      id: "ia",
      titulo: "Perguntas em que a IA cita você",
      valor: dados.citacoes,
      sufixo: totalCelulas ? `de ${totalCelulas}` : undefined,
      href: "/visibility",
      vazio: "Nunca consultado",
      // 0 depois de uma rodada é uma medição, não ausência dela.
      zero: "Nenhuma citação na última rodada",
      leitura:
        dados.citacoes !== null && totalCelulas > 0 ? (
          <Celulas total={totalCelulas} cheias={dados.citacoes} />
        ) : undefined,
    },
  ];

  return (
    <div className={pagina()}>
      <Lede
        apoio={configurando ? undefined : `Blog ${blogNome}.`}
        acao={
          <Link href={gargalo.acaoHref} className={botao("primario")}>
            {gargalo.acaoTexto}
          </Link>
        }
      >
        {configurando
          ? "Faltam alguns ajustes antes do blog começar a produzir sozinho."
          : gargalo.frase}
      </Lede>

      {configurando && (
        <>
          <Secao>Configuração</Secao>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {STEPS.length - faltando.length} de {STEPS.length} prontos. Cada
            passo concluído libera mais um artigo.
          </p>
          <ul className="mt-4">
            {STEPS.map((step) => {
              const feito = feitos[step.key];
              return (
                <Linha key={step.key}>
                  <Link
                    href={step.href}
                    className="group flex items-baseline gap-3"
                  >
                    <span className="w-4 shrink-0 text-nota-excelente">
                      {feito && <Check size={16} />}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={
                          feito
                            ? "text-slate-400 dark:text-slate-500"
                            : "text-slate-900 dark:text-slate-100 group-hover:text-cobalto-600 dark:group-hover:text-cobalto-400"
                        }
                      >
                        {step.title}
                      </span>
                      {!feito && (
                        <span className="mt-0.5 block text-slate-500 dark:text-slate-400">
                          {step.description}
                        </span>
                      )}
                    </span>
                  </Link>
                </Linha>
              );
            })}
          </ul>
        </>
      )}

      <Secao>A operação</Secao>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Uma coisa depende da anterior. A ordem é a da corrente.
      </p>

      <ul className="mt-4">
        {linhas.map((l) => {
          // O elo travado ganha o filete e o rótulo; os outros ficam
          // quietos. Marcar todos seria o mesmo que não marcar nenhum.
          const travado = ETAPA_DA_LINHA[l.id] === gargalo.etapa;
          const corFaixa =
            l.estado === "excelente" || l.estado === "bom"
              ? "text-nota-excelente"
              : l.estado === "atencao"
                ? "text-nota-atencao"
                : l.estado === "critico"
                  ? "text-nota-critico"
                  : "";

          return (
            <Linha key={l.id}>
              <Link
                href={l.href}
                className="group flex items-center justify-between gap-4"
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  {travado && (
                    <span className="h-0.5 w-4 shrink-0 translate-y-[-0.3em] bg-nota-atencao" />
                  )}
                  <span className="min-w-0">
                    <span className="text-slate-900 dark:text-slate-100 group-hover:text-cobalto-600 dark:group-hover:text-cobalto-400">
                      {l.titulo}
                    </span>
                    <span className="mt-0.5 block text-slate-500 dark:text-slate-400">
                      {travado ? (
                        <span className="text-nota-atencao">
                          É aqui que está travado
                        </span>
                      ) : l.estado ? (
                        <span className={corFaixa}>
                          {l.estado === "atencao"
                            ? "Precisa atenção"
                            : l.estado === "critico"
                              ? "Crítico"
                              : l.estado === "bom"
                                ? "Bom"
                                : "Excelente"}
                        </span>
                      ) : l.valor === null ? (
                        l.vazio
                      ) : l.valor === 0 ? (
                        (l.zero ?? l.vazio)
                      ) : (
                        ""
                      )}
                    </span>
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-4">
                  {/* A leitura em miniatura: régua, barras ou células. Slot
                      de largura fixa para os números baterem em coluna. */}
                  <span className="hidden w-28 sm:block">{l.leitura}</span>
                  {/* Sufixo em coluna de largura fixa (presente mesmo
                      vazio): é o que faz os números baterem em coluna de
                      uma linha para a outra. */}
                  <span className="flex items-baseline gap-1.5">
                    <span className="tabular min-w-[2ch] text-right font-display text-3xl text-slate-900 dark:text-slate-100">
                      {l.valor === null ? "—" : l.valor}
                    </span>
                    <span className="w-14 text-sm text-slate-400 dark:text-slate-500">
                      {l.valor !== null ? (l.sufixo ?? "") : ""}
                    </span>
                  </span>
                  <ArrowRight
                    size={16}
                    className="text-slate-300 group-hover:text-cobalto-600 dark:text-slate-700 dark:group-hover:text-cobalto-400"
                  />
                </span>
              </Link>
            </Linha>
          );
        })}
      </ul>

      <EvolucaoDosArtigos primeiraPublicacao={dados.primeiraPublicacao} />
    </div>
  );
}
