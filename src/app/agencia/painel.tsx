import { LogOut } from "lucide-react";
import { Lede, Linha, Secao } from "@/components/lede";
import { Logotipo } from "@/components/marca";
import { botao, pagina } from "@/components/ui";
import { semEsquema } from "@/lib/blog-endereco";
import { formatarData } from "@/lib/datas";
import { vereditoDaAgencia, type Subconta } from "@/lib/agencia";
import { entrarNaSubconta, sairDaAgencia } from "./acoes";
import { NovaSubconta } from "./nova-subconta";

// O painel central da agência: todas as subcontas numa lista, com o que
// cada uma tem no ar e na fila, e a porta para entrar em cada uma.
//
// Separado da página para a vitrine poder desenhá-lo sem sessão.
export function AgenciaPainel({
  subcontas,
  fuso,
}: {
  subcontas: Subconta[];
  fuso: string;
}) {
  const dia = (instante: string) => formatarData(instante, fuso, "curta");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background">
      <header className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <div className="flex items-baseline gap-2">
            <Logotipo className="text-base text-slate-900 dark:text-slate-100" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Agência
            </span>
          </div>
          <form action={sairDaAgencia}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors duration-150 hover:bg-slate-200/70 hover:text-slate-900 pointer-coarse:min-h-11 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <LogOut size={16} aria-hidden="true" />
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className={pagina()}>
        <Lede apoio="Cada subconta é um cliente. Entre numa para trabalhar nela; o caminho de volta fica no topo do menu.">
          {vereditoDaAgencia(subcontas)}
        </Lede>

        {subcontas.length > 0 && (
          <ul>
            {subcontas.map((s) => (
              <Linha key={s.id}>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  {/* No celular o nome toma a linha inteira e o resto desce:
                      ao lado dos números ele encolhia até virar reticências
                      (mesmo defeito do calendário, PROCESSO 73b). */}
                  <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {s.nome}
                    </p>
                    {s.blog ? (
                      <a
                        href={s.blog.endereco}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm text-slate-500 hover:text-cobalto-600 dark:text-slate-400 dark:hover:text-cobalto-400"
                      >
                        {semEsquema(s.blog.endereco)}
                      </a>
                    ) : (
                      <p className="text-sm text-nota-atencao">
                        Blog ainda não montado
                      </p>
                    )}
                  </div>

                  {s.blog && (
                    <dl className="flex gap-6 text-sm">
                      <div className="w-24">
                        <dt className="text-xs text-slate-500 dark:text-slate-400">
                          No ar
                        </dt>
                        <dd className="text-slate-700 dark:text-slate-300">
                          <span className="tabular font-display text-slate-900 dark:text-slate-100">
                            {s.publicados}
                          </span>
                          {s.ultimoPublicado && (
                            <span className="block text-xs text-slate-500 dark:text-slate-400">
                              último {dia(s.ultimoPublicado)}
                            </span>
                          )}
                        </dd>
                      </div>
                      <div className="w-32">
                        <dt className="text-xs text-slate-500 dark:text-slate-400">
                          Na fila
                        </dt>
                        {/* O estado em palavra e em cor, nunca só em cor. */}
                        <dd
                          className={
                            s.estado === "fila-vazia"
                              ? "text-nota-atencao"
                              : "text-slate-700 dark:text-slate-300"
                          }
                        >
                          {s.agendados > 0 ? (
                            <>
                              <span className="tabular font-display text-slate-900 dark:text-slate-100">
                                {s.agendados}
                              </span>{" "}
                              {s.agendados === 1 ? "agendado" : "agendados"}
                              <span className="block text-xs text-slate-500 dark:text-slate-400">
                                próximo {dia(s.proximo!)}
                              </span>
                            </>
                          ) : (
                            <>
                              Nada agendado
                              {s.semData > 0 && (
                                <span className="block text-xs text-slate-500 dark:text-slate-400">
                                  {s.semData}{" "}
                                  {s.semData === 1
                                    ? "rascunho sem data"
                                    : "rascunhos sem data"}
                                </span>
                              )}
                            </>
                          )}
                        </dd>
                      </div>
                      {s.limite !== null && (
                        <div className="w-20">
                          <dt className="text-xs text-slate-500 dark:text-slate-400">
                            Cota do mês
                          </dt>
                          <dd className="tabular font-display text-slate-900 dark:text-slate-100">
                            {s.usados}/{s.limite}
                          </dd>
                        </div>
                      )}
                    </dl>
                  )}

                  <form action={entrarNaSubconta.bind(null, s.id)}>
                    <button type="submit" className={botao("secundario", "sm")}>
                      {s.blog ? "Entrar" : "Montar blog"}
                    </button>
                  </form>
                </div>
              </Linha>
            ))}
          </ul>
        )}

        <Secao>Nova subconta</Secao>
        <NovaSubconta />
      </main>
    </div>
  );
}
