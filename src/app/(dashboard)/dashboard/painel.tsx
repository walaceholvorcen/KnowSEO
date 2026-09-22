import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Peça de composição do Início: um instrumento por assunto, com o mesmo
// cabeçalho. Cada assunto tem uma leitura de forma diferente (régua,
// células, barras) e misturar tudo numa lista só apagaria essa diferença.
//
// O painel NÃO tem borda nem canto próprio: ele é uma célula dentro da
// Bancada. Antes cada um era um card arredondado solto, e a tela mais
// aberta do produto virava a grade de cards de qualquer outro dashboard -
// exatamente a forma que a `Linha` foi criada para substituir no resto do
// app. Numa bancada única, o elo travado é uma célula marcada dentro de um
// aparelho só, que é o que a corrente quer dizer.
export function Painel({
  titulo,
  href,
  acao,
  travado,
  apontado,
  rodape,
  className,
  children,
}: {
  titulo: string;
  href: string;
  /** Texto do link do cabeçalho. Padrão: "Abrir". */
  acao?: string;
  /** Elo travado da corrente: ganha o filete e o aviso. */
  travado?: boolean;
  /** Não está travado, mas é o painel que responde ao veredito do topo. */
  apontado?: boolean;
  rodape?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col bg-white dark:bg-slate-900",
        className,
      )}
    >
      {/* Filete no topo, não borda colorida em volta: marca o elo travado
          sem transformar o painel inteiro em alerta. */}
      {travado && <div className="h-0.5 bg-nota-atencao" />}
      {!travado && apontado && <div className="h-0.5 bg-cobalto-500" />}

      <div className="flex items-baseline justify-between gap-3 px-5 pt-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {titulo}
        </h3>
        <Link
          href={href}
          className="group flex shrink-0 items-center gap-1 text-sm text-cobalto-700 hover:underline dark:text-cobalto-300"
        >
          {acao ?? "Abrir"}
          <ArrowRight size={13} aria-hidden />
        </Link>
      </div>

      {travado && (
        <p className="px-5 pt-1 text-sm text-nota-atencao">
          É aqui que está travado
        </p>
      )}
      {!travado && apontado && (
        <p className="px-5 pt-1 text-sm text-cobalto-700 dark:text-cobalto-300">
          É daqui que fala o resumo lá em cima
        </p>
      )}

      <div className="flex-1 px-5 pb-5 pt-3">{children}</div>

      {rodape && (
        <div className="border-t border-slate-200 px-5 py-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {rodape}
        </div>
      )}
    </section>
  );
}

/**
 * A bancada: os instrumentos de uma etapa num corpo só, separados por
 * filete de 1px (gap-px sobre o fundo da borda) em vez de flutuarem como
 * cards independentes.
 */
export function Bancada({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-800 lg:grid-cols-2">
      {children}
    </div>
  );
}

/** Número grande com unidade, no tipo de display. */
export function Numero({
  valor,
  de,
  vazio = "—",
}: {
  valor: number | null;
  de?: string;
  vazio?: string;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="tabular font-display text-3xl text-slate-900 dark:text-slate-100">
        {valor === null ? vazio : valor}
      </span>
      {de && valor !== null && (
        <span className="text-sm text-slate-500 dark:text-slate-400">{de}</span>
      )}
    </span>
  );
}

/** Estado vazio de painel: diz o que falta e como sair dali. */
export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-slate-500 dark:text-slate-400">{children}</p>
  );
}
