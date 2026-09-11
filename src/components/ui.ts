import { cn } from "@/lib/utils";

// O vocabulário de controles do painel, num lugar só.
//
// Antes cada tela escrevia o próprio botão: havia cinco variações do botão
// principal (altura, tamanho de texto e espaçamento diferentes) e nenhum
// estado de foco ou de clique desenhado. Num produto que se vende por
// precisão, "Salvar" tem a mesma forma em toda tela - é o que separa um
// painel construído de um painel montado.
//
// São funções que devolvem classe, não componentes: servem igual para
// <button> e para <Link>, sem embrulhar nenhum dos dois.

type Variante = "primario" | "secundario" | "fantasma";
type Tamanho = "sm" | "md";

const BASE_BOTAO =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold " +
  "transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none";

const VARIANTE: Record<Variante, string> = {
  // Filete claro no topo e sombra curta com desfoque: o botão lê como tecla,
  // não como retângulo pintado. O cobalto segue sendo a única cor da marca.
  primario:
    "bg-cobalto-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(21_25_28/0.2)] " +
    "hover:bg-cobalto-700 dark:bg-cobalto-500 dark:hover:bg-cobalto-600",
  secundario:
    "border border-slate-300 bg-white text-slate-800 shadow-[0_1px_2px_rgb(21_25_28/0.06)] " +
    "hover:border-slate-400 hover:bg-slate-50 " +
    "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800",
  fantasma:
    "text-cobalto-700 hover:bg-cobalto-50 dark:text-cobalto-300 dark:hover:bg-cobalto-900/40",
};

// Em tela de toque a altura sobe para 44px, o mínimo para o dedo acertar sem
// esbarrar no vizinho. No mouse fica compacto, como painel de ferramenta.
// As alturas batem com as do campo de texto (38px e 34px: linha de 20px +
// preenchimento + borda). Com h-9 o botão ficava 2px mais baixo que o campo
// ao lado dele - o desalinhamento que ninguém nomeia e todo mundo sente.
const TAMANHO: Record<Tamanho, string> = {
  sm: "h-8.5 px-3 text-sm pointer-coarse:h-10",
  md: "h-9.5 px-4 text-sm pointer-coarse:h-11",
};

export function botao(variante: Variante = "primario", tamanho: Tamanho = "md") {
  return cn(BASE_BOTAO, VARIANTE[variante], TAMANHO[tamanho]);
}

const BASE_CAMPO =
  "rounded-lg border border-slate-300 bg-white text-slate-900 shadow-[inset_0_1px_1px_rgb(21_25_28/0.04)] " +
  "placeholder:text-slate-500 transition-[border-color,box-shadow] duration-150 " +
  "focus:border-cobalto-500 focus:outline-none focus:ring-3 focus:ring-cobalto-500/15 " +
  "disabled:opacity-60 motion-reduce:transition-none " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 " +
  "dark:focus:border-cobalto-400 dark:focus:ring-cobalto-400/20";

export function campo(tamanho: Tamanho = "md") {
  return cn(
    BASE_CAMPO,
    tamanho === "sm" ? "px-3 py-1.5 text-sm" : "px-3 py-2 text-sm",
  );
}

// Largura da tela. "larga" para as telas de análise, onde uma linha precisa
// caber rótulo, régua e número lado a lado; "estreita" para formulário, onde
// campo largo demais obriga o olho a atravessar a tela para ler o rótulo.
//
// A coluna única de 768px em todas as telas era um dos motivos de o painel
// ler como artigo: num monitor largo, uma faixa de texto centralizada.
export function pagina(largura: "larga" | "estreita" = "larga") {
  return cn(
    "mx-auto w-full px-5 py-8 sm:px-8 lg:px-10 lg:py-10",
    largura === "larga" ? "max-w-5xl" : "max-w-3xl",
  );
}
