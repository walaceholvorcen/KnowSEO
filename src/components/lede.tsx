import type { ReactNode } from "react";

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
