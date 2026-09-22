import Link from "next/link";
import { cn } from "@/lib/utils";
import { scoreBand } from "@/lib/audit/rules";
import { BAND_LABEL } from "@/components/lede";
import type { Leitura } from "@/lib/relatorio/leitura";
import type { Evento, Periodo } from "@/lib/relatorio";

// As peças que fazem o relatório contar a história inteira, e não só somar
// visitas: a corrente do trabalho no topo, o movimento dia a dia e a leitura
// escrita do período. Moram fora de relatorio.tsx porque aquele arquivo já
// é a folha (cabeçalho, período, impressão, tabela por artigo).

const DIA = 86_400_000;

/**
 * Os quatro elos, na ordem em que o trabalho acontece: o site precisa estar
 * são, o conteúdo precisa existir, a busca precisa trazer gente, e a gente
 * precisa virar conversa. Ver os quatro juntos é o que responde "em que pé
 * estamos" sem abrir outra tela.
 */
export function CorrenteDoTrabalho({
  auditoria,
  geo,
  publicados,
  noAr,
  visitas,
  variacaoVisitas,
  conversas,
  taxa,
}: {
  auditoria: { google: number; ia: number; googleAntes: number | null } | null;
  geo: { citadas: number; perguntas: number; rival: string | null } | null;
  publicados: number;
  noAr: number;
  visitas: number;
  variacaoVisitas: string | null;
  conversas: number;
  taxa: number;
}) {
  const faixa = auditoria ? BAND_LABEL[scoreBand(auditoria.google)] : null;

  const elos = [
    {
      etapa: "Diagnóstico",
      titulo: "Saúde do site",
      valor: auditoria ? String(auditoria.google) : "—",
      sufixo: auditoria ? "de 100" : null,
      apoio: auditoria
        ? `${faixa} no Google · ${auditoria.ia} de 100 para IA`
        : "Nenhuma auditoria rodada ainda",
    },
    {
      etapa: "Reconhecimento",
      titulo: "Citações em IA",
      valor: geo ? String(geo.citadas) : "—",
      sufixo: geo ? `de ${geo.perguntas}` : null,
      apoio: geo
        ? geo.citadas > 0
          ? "perguntas do setor em que a marca aparece"
          : `a IA responde citando ${geo.rival ?? "outras empresas"}`
        : "Raio X ainda não rodou",
    },
    {
      etapa: "Produção",
      titulo: "Artigos",
      valor: String(publicados),
      sufixo: "no período",
      apoio: `${noAr} ${noAr === 1 ? "publicado no total" : "publicados no total"}`,
    },
    {
      etapa: "Alcance",
      titulo: "Visitas",
      valor: visitas.toLocaleString("pt-BR"),
      sufixo: null,
      apoio: variacaoVisitas ?? "primeiro período medido",
    },
    {
      etapa: "Resultado",
      titulo: "Conversas",
      valor: conversas.toLocaleString("pt-BR"),
      sufixo: null,
      // Abaixo de 30 visitas a porcentagem é falsa precisão: "22,2%" sobre 9
      // visitas convence mais do que o dado permite. A fração diz a verdade.
      apoio:
        conversas === 0
          ? "ninguém chamou"
          : visitas < 30
            ? `${conversas} de ${visitas} visitas`
            : `${taxa.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de quem leu`,
    },
  ];

  return (
    <ol className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-3 lg:grid-cols-5 dark:border-slate-800 dark:bg-slate-800">
      {elos.map((elo) => (
        <li key={elo.titulo} className="bg-white p-4 dark:bg-slate-900 print:break-inside-avoid">
          <p className="text-xs text-slate-500 dark:text-slate-400">{elo.etapa}</p>
          <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-300">
            {elo.titulo}
          </p>
          <p className="mt-2 flex items-baseline gap-1 font-display text-slate-900 dark:text-slate-100">
            <span className="tabular text-3xl leading-none tracking-tight">{elo.valor}</span>
            {elo.sufixo && (
              <span className="whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                {elo.sufixo}
              </span>
            )}
          </p>
          <p className="mt-2 text-sm leading-snug text-slate-500 dark:text-slate-400">{elo.apoio}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * Visitas por dia. O total esconde o formato: 6 visitas num dia só é
 * divulgação pontual; 6 espalhadas em 20 dias é busca começando a trazer
 * gente. Barra por dia, sem eixo cheio de número - a leitura é o desenho.
 */
export function VisitasPorDia({
  eventos,
  periodo,
}: {
  eventos: Evento[];
  periodo: Periodo;
}) {
  const inicio = periodo.inicio.getTime();
  const dias = Array.from({ length: periodo.dias }, (_, i) => ({
    dia: new Date(inicio + i * DIA),
    visitas: 0,
  }));

  for (const e of eventos) {
    if (e.event_type !== "pageview") continue;
    const t = Date.parse(e.created_at);
    if (t < inicio || t >= periodo.fim.getTime()) continue;
    dias[Math.floor((t - inicio) / DIA)].visitas++;
  }

  const maior = Math.max(...dias.map((d) => d.visitas));
  if (maior === 0) return null;

  const rotulo = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 print:break-inside-avoid">
      <div className="flex h-24 items-end gap-[3px]" role="img" aria-label={`Visitas por dia: pico de ${maior}`}>
        {dias.map((d) => (
          <div
            key={d.dia.toISOString()}
            title={`${rotulo(d.dia)}: ${d.visitas} ${d.visitas === 1 ? "visita" : "visitas"}`}
            className="flex-1 rounded-sm bg-slate-100 dark:bg-slate-800"
            style={{ height: "100%" }}
          >
            {/* Trilho cinza atrás e barra cobalto na altura do dia: dia
                zerado continua ocupando lugar, senão o gráfico mente sobre
                o intervalo entre um pico e outro. */}
            <div className="flex h-full flex-col justify-end">
              <div
                className="rounded-sm bg-cobalto-600 dark:bg-cobalto-400"
                style={{ height: `${Math.max((d.visitas / maior) * 100, d.visitas ? 6 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{rotulo(dias[0].dia)}</span>
        <span className="tabular">pico de {maior} num dia</span>
        <span>{rotulo(dias[dias.length - 1].dia)}</span>
      </div>
    </div>
  );
}

/** O parágrafo que a agência escreveria, montado do que foi medido. */
export function LeituraDoPeriodo({
  leitura,
  publico,
}: {
  leitura: Leitura;
  publico: boolean;
}) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 print:break-inside-avoid">
      <div className="max-w-[68ch] space-y-3 text-slate-700 dark:text-slate-300">
        {leitura.paragrafos.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">O que fazer agora</p>
        <p className="mt-1 max-w-[68ch] text-slate-700 dark:text-slate-300">
          {leitura.proximoPasso.texto}
        </p>
        {!publico && (
          <Link
            href={leitura.proximoPasso.href}
            className={cn(
              "mt-2 inline-block font-medium text-cobalto-700 hover:underline dark:text-cobalto-300 print:hidden",
            )}
          >
            {leitura.proximoPasso.rotulo}
          </Link>
        )}
      </div>
    </div>
  );
}
