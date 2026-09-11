import Link from "next/link";
import { Check } from "lucide-react";
import { botao } from "@/components/ui";
import { Secao } from "@/components/lede";
import { cn } from "@/lib/utils";
import {
  dataCurta,
  type Jornada,
  type ProximaVerificacao,
} from "@/lib/audit/jornada";

// Cores das duas séries do gráfico, validadas no validador da skill de
// dataviz contra os fundos claro (#f7f8f6) e escuro (#101312). Um tom só da
// marca em dois passos: verde, âmbar e vermelho são das faixas de nota e não
// podem virar "série 2". O cinza reprovou (lê como desativado). O tracejado
// da IA é a segunda codificação - a série não depende só da cor - e os
// rótulos diretos no fim da linha resolvem o contraste baixo do tom claro.
const COR_GOOGLE = "stroke-cobalto-600 dark:stroke-[#7389f1]";
const COR_IA = "stroke-[#94a6fa] dark:stroke-[#3450d4]";
const PONTO_GOOGLE = "bg-cobalto-600 dark:bg-[#7389f1]";
const PONTO_IA = "bg-[#94a6fa] dark:bg-[#3450d4]";

// Card que ocupa o lugar do antigo "Páginas analisadas" - um número que
// não pedia ação nenhuma, no lugar mais visível da tela. Agora o terceiro
// card responde "e agora?".
export function ProximaVerificacaoCard({
  proxima,
}: {
  proxima: ProximaVerificacao;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Próxima verificação
      </p>
      <p className="mt-2 text-slate-900 dark:text-slate-100">
        {proxima.quando ? (
          <span className="tabular font-display text-5xl leading-none tracking-tight">
            {dataCurta(proxima.quando)}
          </span>
        ) : (
          <span className="text-4xl font-semibold leading-none tracking-tight">
            Agora
          </span>
        )}
      </p>
      <p
        className={cn(
          "mt-4 text-sm font-medium",
          proxima.atrasada
            ? "text-nota-atencao"
            : "text-slate-700 dark:text-slate-300",
        )}
      >
        {proxima.resumo}
      </p>
    </div>
  );
}

const LEITURA_DA_ETAPA: Record<Jornada["atual"], string> = {
  correcao: "O próximo passo é fechar os itens de prioridade alta da lista abaixo.",
  efeito:
    "A sua parte já está no site. Agora é a vez do Google: a posição costuma mudar semanas depois da correção, e é nessa janela que vale acompanhar.",
  manutencao:
    "A base está feita. Daqui para frente a auditoria vigia o que quebra sozinho, e o crescimento vem de conteúdo e de ser citado pela IA.",
  diagnostico: "",
};

export function JornadaDoSite({ jornada }: { jornada: Jornada }) {
  const { etapas, atual, proxima, evolucao, ganhoGoogle } = jornada;
  const primeira = evolucao[0];
  const ultima = evolucao[evolucao.length - 1];

  return (
    <section>
      <Secao>A jornada deste site</Secao>
      <p className="max-w-[68ch] text-sm text-slate-600 dark:text-slate-400">
        {ganhoGoogle !== null && ganhoGoogle > 0 && (
          <>
            Desde {dataCurta(primeira.data)}, a nota Google subiu{" "}
            <span className="tabular font-display text-slate-900 dark:text-slate-100">
              {ganhoGoogle}
            </span>{" "}
            pontos, de{" "}
            <span className="tabular font-display">{primeira.google}</span> para{" "}
            <span className="tabular font-display">{ultima.google}</span>.{" "}
          </>
        )}
        {LEITURA_DA_ETAPA[atual]}
      </p>

      {/* Sequência real - uma etapa depende da anterior -, por isso ganha
          ordem e marcador. É a mesma linguagem da régua de expectativa do
          Início. */}
      <ol className="mt-6 grid gap-4 sm:grid-cols-4 sm:gap-0">
        {etapas.map((e, i) => (
          <li key={e.chave} className="relative flex gap-3 sm:block sm:pr-4">
            {i < etapas.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute hidden h-px sm:block sm:left-7 sm:right-0 sm:top-3",
                  e.estado === "feita"
                    ? "bg-cobalto-600 dark:bg-cobalto-400"
                    : "bg-slate-300 dark:bg-slate-700",
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "relative flex size-6 shrink-0 items-center justify-center rounded-full",
                e.estado === "feita" &&
                  "bg-cobalto-600 text-white dark:bg-cobalto-500",
                e.estado === "atual" &&
                  "bg-slate-50 ring-2 ring-cobalto-600 dark:bg-background dark:ring-cobalto-400",
                e.estado === "futura" &&
                  "bg-slate-50 ring-1 ring-slate-300 dark:bg-background dark:ring-slate-700",
              )}
            >
              {e.estado === "feita" ? (
                <Check size={13} strokeWidth={3} />
              ) : e.estado === "atual" ? (
                <span className="size-2 rounded-full bg-cobalto-600 dark:bg-cobalto-400" />
              ) : null}
            </span>
            <span className="block min-w-0 sm:mt-3">
              <span
                className={cn(
                  "block text-sm font-medium",
                  e.estado === "futura"
                    ? "text-slate-500 dark:text-slate-400"
                    : "text-slate-900 dark:text-slate-100",
                )}
              >
                {e.nome}
                {e.estado === "atual" && (
                  <span className="sr-only"> (etapa atual)</span>
                )}
              </span>
              <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
                {e.detalhe}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {evolucao.length > 1 && <GraficoNotas pontos={evolucao} />}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {proxima.quando
            ? `Próxima verificação: ${dataCurta(proxima.quando)}`
            : "Próxima verificação: assim que corrigir"}
        </p>
        <p className="mt-1 max-w-[68ch] text-sm text-slate-600 dark:text-slate-400">
          {proxima.motivo}
        </p>
        {atual !== "correcao" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {atual === "efeito" ? (
              <Link href="/market" className={botao("secundario", "sm")}>
                Ver o que o Google já mostra
              </Link>
            ) : (
              <Link href="/visibility" className={botao("secundario", "sm")}>
                Ver citações em IA
              </Link>
            )}
            <Link href="/strategy" className={botao("fantasma", "sm")}>
              Escolher o próximo artigo
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// Evolução das duas notas, numa escala só (as duas vão de 0 a 100; nunca
// dois eixos). Linhas e grade em SVG
// esticado com traço que não escala; pontos, rótulos e dica em HTML por
// cima - assim o texto não deforma com a largura da tela.
function GraficoNotas({ pontos }: { pontos: Jornada["evolucao"] }) {
  const n = pontos.length;
  const x = (i: number) => (i / (n - 1)) * 100;
  // Piso da escala: a dezena abaixo da menor nota, com folga de 10, nunca
  // acima de 50 (o primeiro limiar precisa caber). Com o piso em 0, toda nota
  // real ficava na metade de cima e o gráfico era meio vazio. O piso aparece
  // escrito no eixo, então a escala não engana ninguém.
  const menor = Math.min(...pontos.flatMap((p) => [p.google, p.ia]));
  const piso = Math.max(0, Math.min(40, Math.floor((menor - 10) / 10) * 10));
  const y = (v: number) =>
    100 - ((Math.min(100, Math.max(piso, v)) - piso) / (100 - piso)) * 100;
  const linha = (pegar: (p: (typeof pontos)[number]) => number) =>
    pontos.map((p, i) => `${x(i)},${y(pegar(p))}`).join(" ");

  const ultimo = pontos[n - 1];
  // Rótulos diretos no fim das linhas. Quando as duas notas terminam
  // perto (96 e 100), eles se afastam o bastante para não se sobrepor.
  let yGoogle = y(ultimo.google);
  let yIa = y(ultimo.ia);
  if (Math.abs(yGoogle - yIa) < 14) {
    const meio = (yGoogle + yIa) / 2;
    const googleAcima = ultimo.google >= ultimo.ia;
    yGoogle = meio + (googleAcima ? -7 : 7);
    yIa = meio + (googleAcima ? 7 : -7);
  }

  const larguraFaixa = 100 / (n - 1);

  return (
    <figure className="mt-8">
      <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
        <span className="flex items-center gap-2">
          <svg width="20" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="20" y2="4" strokeWidth="2" className={COR_GOOGLE} />
          </svg>
          Nota Google
        </span>
        <span className="flex items-center gap-2">
          <svg width="20" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="20" y2="4" strokeWidth="2" strokeDasharray="5 3" className={COR_IA} />
          </svg>
          Nota IA
        </span>
      </figcaption>

      <div className="mt-4 flex gap-3">
        {/* Limiares das faixas à esquerda: os mesmos 50/70/90 da régua. */}
        <div className="relative h-36 w-6 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400" aria-hidden="true">
          {[90, 70, 50, piso].filter((t, i, a) => a.indexOf(t) === i).map((t) => (
            <span
              key={t}
              className="tabular absolute right-0 -translate-y-1/2"
              style={{ top: `${y(t)}%` }}
            >
              {t}
            </span>
          ))}
        </div>

        <div className="relative h-36 min-w-0 flex-1">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            aria-hidden="true"
          >
            {[50, 70, 90].map((t) => (
              <line
                key={t}
                x1="0"
                x2="100"
                y1={y(t)}
                y2={y(t)}
                strokeWidth="1"
                strokeDasharray="2 4"
                vectorEffect="non-scaling-stroke"
                className="stroke-slate-300 dark:stroke-slate-700"
              />
            ))}
            <line
              x1="0"
              x2="100"
              y1="100"
              y2="100"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              className="stroke-slate-300 dark:stroke-slate-700"
            />
            <polyline
              points={linha((p) => p.ia)}
              fill="none"
              strokeWidth="2"
              strokeDasharray="5 4"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className={COR_IA}
            />
            <polyline
              points={linha((p) => p.google)}
              fill="none"
              strokeWidth="2"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className={COR_GOOGLE}
            />
          </svg>

          {/* Pontos com anel da cor do fundo, para não se fundirem quando as
              duas séries se cruzam. */}
          {pontos.map((p, i) => (
            <span key={p.data} aria-hidden="true">
              <span
                className={cn(
                  "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-slate-50 dark:ring-background",
                  PONTO_IA,
                )}
                style={{ left: `${x(i)}%`, top: `${y(p.ia)}%` }}
              />
              <span
                className={cn(
                  "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-slate-50 dark:ring-background",
                  PONTO_GOOGLE,
                )}
                style={{ left: `${x(i)}%`, top: `${y(p.google)}%` }}
              />
            </span>
          ))}

          {/* Área de toque maior que o ponto: a faixa vertical inteira de
              cada auditoria acende a linha-guia e a dica. Foco por teclado
              faz o mesmo. */}
          {pontos.map((p, i) => {
            const borda = i === 0 ? "esquerda" : i === n - 1 ? "direita" : null;
            return (
              <div
                key={`faixa-${p.data}`}
                tabIndex={0}
                aria-label={`${dataCurta(p.data)}: nota Google ${p.google}, nota IA ${p.ia}`}
                className="group absolute inset-y-0 outline-none"
                style={{
                  left: `${Math.max(0, x(i) - larguraFaixa / 2)}%`,
                  width: `${borda ? larguraFaixa / 2 : larguraFaixa}%`,
                }}
              >
                <span
                  className={cn(
                    "absolute inset-y-0 w-px bg-slate-400 opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-slate-500",
                    borda === "esquerda" ? "left-0" : borda === "direita" ? "right-0" : "left-1/2",
                  )}
                />
                <span
                  className={cn(
                    "pointer-events-none absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-[0_4px_12px_rgb(21_25_28/0.18)] transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-slate-100 dark:text-slate-900",
                    borda === "esquerda"
                      ? "left-0"
                      : borda === "direita"
                        ? "right-0"
                        : "left-1/2 -translate-x-1/2",
                  )}
                >
                  <span className="block text-slate-300 dark:text-slate-600">
                    {dataCurta(p.data)}
                  </span>
                  <span className="tabular block font-display">
                    Google {p.google} · IA {p.ia}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        {/* Rótulos diretos: o valor atual de cada linha, em tinta de texto;
            quem carrega a identidade é o traço ao lado. */}
        <div className="relative h-36 w-12 shrink-0 text-sm" aria-hidden="true">
          <span
            className="tabular absolute left-0 flex -translate-y-1/2 items-center gap-1.5 font-display text-slate-900 dark:text-slate-100"
            style={{ top: `${yGoogle}%` }}
          >
            <span className={cn("h-0.5 w-2", PONTO_GOOGLE)} />
            {ultimo.google}
          </span>
          <span
            className="tabular absolute left-0 flex -translate-y-1/2 items-center gap-1.5 font-display text-slate-600 dark:text-slate-300"
            style={{ top: `${yIa}%` }}
          >
            <span className={cn("h-0.5 w-2", PONTO_IA)} />
            {ultimo.ia}
          </span>
        </div>
      </div>

      <div className="mt-2 flex justify-between pl-9 pr-15 text-xs text-slate-500 dark:text-slate-400" aria-hidden="true">
        <span>{dataCurta(pontos[0].data)}</span>
        <span>{dataCurta(ultimo.data)}</span>
      </div>

      <table className="sr-only">
        <caption>Evolução das notas por auditoria</caption>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Nota Google</th>
            <th scope="col">Nota IA</th>
          </tr>
        </thead>
        <tbody>
          {pontos.map((p) => (
            <tr key={p.data}>
              <td>{dataCurta(p.data)}</td>
              <td>{p.google}</td>
              <td>{p.ia}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
