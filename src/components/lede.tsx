import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { scoreBand, type ScoreBand } from "@/lib/audit/rules";

export const BAND_LABEL: Record<ScoreBand, string> = {
  excelente: "Excelente",
  bom: "Bom",
  atencao: "Precisa atenção",
  critico: "Crítico",
};

// Abertura de tela: o veredito escrito, não um título mais um grid de cards.
//
// Toda tela do produto responde a uma pergunta ("apareço na IA?", "o blog
// trouxe gente?"). Antes todas abriam iguais - título, subtítulo e uma
// fileira de cards com números soltos -, e o cliente tinha de descobrir
// sozinho se aquele número era bom. Aqui a frase dá a resposta e os números
// vivem dentro dela; a evidência vem depois.
//
// Sem destaque em palavra solta dentro da frase: negrito ou cor num único
// termo é justamente o tique que faz a tela parecer gerada.
export function Lede({
  children,
  apoio,
  acao,
}: {
  children: ReactNode;
  apoio?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <header className="mb-10 border-b border-slate-200 dark:border-slate-800 pb-8">
      <p className="max-w-[36ch] font-display text-3xl leading-[1.25] text-slate-900 dark:text-slate-100 sm:text-4xl">
        {children}
      </p>
      {apoio && (
        <p className="mt-3 max-w-[60ch] text-slate-600 dark:text-slate-400">
          {apoio}
        </p>
      )}
      {acao && <div className="mt-6 flex flex-wrap gap-3">{acao}</div>}
    </header>
  );
}

// Linha de lista. Filete em vez de card: a repetição de card arredondado a
// cada item é o que fazia todas as telas terem a mesma forma.
export function Linha({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <li
      className={`border-b border-slate-200 dark:border-slate-800 py-4 last:border-0 ${className}`}
    >
      {children}
    </li>
  );
}

// Rótulo de seção. Sem caixa alta e sem tracking - o rótulo é orientação,
// não decoração.
export function Secao({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-1 mt-12 text-lg font-medium text-slate-900 dark:text-slate-100">
      {children}
    </h2>
  );
}

// Cartão de nota com faixa. Terceiro lugar que precisa de "número de 0 a
// 100 + o que essa faixa significa" (auditoria de site, agora auditoria de
// perfil no Google) - motivo suficiente para sair de dentro de uma tela e
// virar peça compartilhada, em vez de reimplementar a mesma lógica de cor.
export function NotaCard({
  label,
  score,
  hint,
}: {
  label: string;
  score: number | null;
  hint: string;
}) {
  const band = score === null ? null : scoreBand(score);

  // A cor fica na faixa, não no número. Pintar o número obriga o cliente a
  // decorar o que cada cor quer dizer antes de entender a tela.
  const corTexto =
    band === "excelente" || band === "bom"
      ? "text-nota-excelente"
      : band === "atencao"
        ? "text-nota-atencao"
        : "text-nota-critico";

  const corFilete =
    band === "excelente" || band === "bom"
      ? "bg-nota-excelente"
      : band === "atencao"
        ? "bg-nota-atencao"
        : "bg-nota-critico";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5 font-display text-slate-900 dark:text-slate-100">
        <span className="tabular text-5xl leading-none">
          {score === null ? "—" : score}
        </span>
        {score !== null && (
          <span className="text-base text-slate-400 dark:text-slate-500">
            de 100
          </span>
        )}
      </p>
      {band && (
        <div className="mt-3 flex items-center gap-2">
          {/* O filete repete a faixa em forma, não só em cor - quem não
              distingue verde de vermelho ainda lê a palavra ao lado. */}
          <span className={cn("h-0.5 w-6 rounded-full", corFilete)} />
          <span className={cn("text-sm", corTexto)}>{BAND_LABEL[band]}</span>
        </div>
      )}
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}
