import { pagina } from "@/components/ui";

// Esqueleto que aparece NO INSTANTE do clique em qualquer item do menu.
//
// Sem este arquivo, toda tela do painel (todas são dinâmicas: dependem da
// sessão) fazia o navegador esperar a resposta completa do servidor antes de
// mudar qualquer coisa - o clique parecia não ter pegado, e o cliente achava
// que o sistema tinha travado. Com ele, o Next pré-carrega este esqueleto
// junto com o link e troca a tela na hora; o conteúdo real entra no lugar
// quando chega.
//
// A forma imita a de toda tela do painel (veredito com ação à direita,
// depois linhas com filete), para a troca não "pular" quando o dado chega.
export default function Carregando() {
  const barra =
    "rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-800";

  return (
    <div className={pagina()} aria-busy="true">
      <span className="sr-only" role="status">
        Carregando
      </span>

      <div className="mb-8 flex items-start justify-between gap-8 border-b border-slate-200 pb-6 dark:border-slate-800">
        <div className="w-full max-w-[52ch] space-y-3">
          <div className={`h-6 w-4/5 ${barra}`} />
          <div className={`h-6 w-3/5 ${barra}`} />
          <div className={`mt-4 h-4 w-2/5 ${barra}`} />
        </div>
        <div className={`h-9.5 w-32 shrink-0 rounded-lg ${barra}`} />
      </div>

      <div className={`mb-2 h-4 w-40 ${barra}`} />
      <div className={`mb-6 h-4 w-72 ${barra}`} />

      <ul>
        {[72, 56, 64, 48, 60].map((largura, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-4 border-b border-slate-200 py-4 last:border-0 dark:border-slate-800"
          >
            <div className="w-full space-y-2">
              <div className={`h-4 ${barra}`} style={{ width: `${largura}%` }} />
              <div className={`h-3 w-1/4 ${barra}`} />
            </div>
            <div className={`h-7 w-12 shrink-0 ${barra}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}
