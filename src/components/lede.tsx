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
  // Header de ferramenta, não manchete. A primeira versão abria toda tela
  // com uma frase enorme em serifada - e o produto inteiro passou a parecer
  // revista, como o feedback apontou. O veredito continua sendo a primeira
  // coisa lida, mas agora no tom de painel: sans, peso, ação à direita na
  // mesma faixa - "o que está acontecendo e o que fazer", lado a lado.
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-x-8 gap-y-4 border-b border-slate-200 dark:border-slate-800 pb-6">
      <div className="min-w-0 max-w-[52ch]">
        {/* h1, não parágrafo: o veredito é o título da tela. Como <p>, a
            página inteira não tinha título para leitor de tela nem para a
            navegação por cabeçalhos. */}
        <h1 className="text-balance text-xl font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
          {children}
        </h1>
        {apoio && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {apoio}
          </p>
        )}
      </div>
      {acao && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{acao}</div>
      )}
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
      className={`border-b border-slate-200 dark:border-slate-800 py-3 last:border-0 ${className}`}
    >
      {children}
    </li>
  );
}

// Rótulo de seção. Sem caixa alta e sem tracking - o rótulo é orientação,
// não decoração.
export function Secao({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-1 mt-10 text-sm font-semibold text-slate-900 dark:text-slate-100">
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

  const corMarcador =
    band === "excelente" || band === "bom"
      ? "bg-nota-excelente"
      : band === "atencao"
        ? "bg-nota-atencao"
        : "bg-nota-critico";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5 font-display text-slate-900 dark:text-slate-100">
        <span className="tabular text-5xl leading-none tracking-tight">
          {score === null ? "—" : score}
        </span>
        {score !== null && (
          <span className="text-base text-slate-500 dark:text-slate-400">
            de 100
          </span>
        )}
      </p>
      {score !== null && band && (
        <Regua score={score} corMarcador={corMarcador} />
      )}
      {band && (
        <p className={cn("mt-2 text-sm font-medium", corTexto)}>
          {BAND_LABEL[band]}
        </p>
      )}
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

// Limiares das faixas - os mesmos de scoreBand(). A régua não inventa escala:
// as marcas altas estão exatamente onde a nota muda de faixa.
const LIMIARES = [50, 70, 90];

// A nota lida numa régua graduada de 0 a 100.
//
// É o gesto de instrumento do produto, e o único ousado do painel: a nota
// deixa de ser um número solto e vira uma leitura numa escala, com as
// fronteiras das faixas marcadas. O cliente vê que 88 é "Bom" e também que
// está a dois pontos de "Excelente" - coisa que o número sozinho escondia.
//
// O marcador colorido substitui o filete antigo como a forma da faixa; a
// palavra logo abaixo continua lá para quem não distingue as cores.
// Exportada: o Início lê a mesma nota em miniatura na linha "Saúde do site".
export function Regua({
  score,
  corMarcador,
  className,
}: {
  score: number;
  corMarcador: string;
  className?: string;
}) {
  const posicao = Math.min(100, Math.max(0, score));
  return (
    <div className={cn("relative mt-4 h-3.5", className)} aria-hidden="true">
      <div className="absolute inset-x-0 bottom-0 h-px bg-slate-300 dark:bg-slate-700" />
      {Array.from({ length: 11 }, (_, i) => i * 10).map((valor) => (
        <span
          key={valor}
          className={cn(
            "absolute bottom-0 w-px -translate-x-1/2",
            LIMIARES.includes(valor)
              ? "h-2 bg-slate-400 dark:bg-slate-500"
              : "h-1 bg-slate-300 dark:bg-slate-700",
          )}
          style={{ left: `${valor}%` }}
        />
      ))}
      <span
        className={cn(
          "absolute bottom-0 h-3.5 w-[3px] -translate-x-1/2 rounded-full ring-2 ring-white dark:ring-slate-900",
          corMarcador,
        )}
        style={{ left: `${posicao}%` }}
      />
    </div>
  );
}
