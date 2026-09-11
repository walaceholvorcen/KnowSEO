import Link from "next/link";
import { Linha, Secao } from "@/components/lede";
import { cn } from "@/lib/utils";
import { ROTULO_MOTOR } from "@/lib/ai-visibility/resumo";
import type { LeituraFontes } from "@/lib/ai-visibility/fontes";

const nomesDosMotores = (motores: string[]) =>
  motores.map((m) => ROTULO_MOTOR[m] ?? m).join(", ");

// As fontes da resposta, com a marca do cliente posicionada entre elas.
//
// Substitui as duas listas antigas ("quem a IA cita no seu lugar" e
// "diretórios"), que mostravam um número grande e igual em cada linha - "1,
// 1, 1" - e nada sobre onde o cliente estava. Aqui a proporção vira barra
// (perguntas em que a fonte aparece, sobre o total da rodada) e a linha da
// marca entra na posição que ela de fato ocupa: ver o próprio site em
// sétimo, atrás de dois diretórios, é o argumento inteiro.
export function FontesDoMercado({ leitura }: { leitura: LeituraFontes }) {
  const {
    fontes,
    totalFontes,
    totalPerguntas,
    perguntasDaMarca,
    fontesAFrente,
    concentracao,
  } = leitura;
  const fora = totalFontes - fontes.length;
  if (!fontes.length || !totalPerguntas) return null;

  type Item =
    | { tipo: "fonte"; fonte: (typeof fontes)[number] }
    | { tipo: "marca" };
  const itens: Item[] = fontes.map((fonte) => ({ tipo: "fonte", fonte }));
  itens.splice(Math.min(fontesAFrente, itens.length), 0, { tipo: "marca" });

  const temPlataforma = fontes.some((f) => f.tipo === "plataforma");
  const temEmpresa = fontes.some((f) => f.tipo === "empresa");

  const barra = (n: number, marca = false) => (
    <span className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 sm:block">
      <span
        className={cn(
          "block h-full rounded-full",
          marca
            ? "bg-cobalto-600 dark:bg-cobalto-400"
            : "bg-slate-400 dark:bg-slate-500",
        )}
        style={{ width: `${Math.max((n / totalPerguntas) * 100, n ? 4 : 0)}%` }}
      />
    </span>
  );

  const contagem = (n: number) => (
    <span className="tabular w-16 shrink-0 text-right text-sm text-slate-600 dark:text-slate-400">
      <span className="font-display text-base text-slate-900 dark:text-slate-100">
        {n}
      </span>{" "}
      de {totalPerguntas}
    </span>
  );

  return (
    <>
      <Secao>As fontes que a IA usa no seu mercado</Secao>
      <p className="max-w-[68ch] text-sm text-slate-600 dark:text-slate-400">
        {perguntasDaMarca === 0
          ? `A IA se apoiou em ${totalFontes} ${totalFontes === 1 ? "site" : "sites diferentes"} para responder as perguntas do seu setor. O seu não é um deles.`
          : fontesAFrente === 0
            ? "Nenhuma fonte aparece em mais perguntas que você."
            : `${fontesAFrente} ${fontesAFrente === 1 ? "fonte aparece" : "fontes aparecem"} em mais perguntas que você.`}
        {/* Só quando é notícia: num mercado de cauda longa, "5 sites
            levam 15%" é número verdadeiro que não diz nada. */}
        {concentracao &&
          concentracao.pct >= 40 &&
          ` As ${concentracao.fontes} maiores levam ${concentracao.pct}% das citações.`}
      </p>

      <ul className="mt-4">
        {itens.map((item) =>
          item.tipo === "marca" ? (
            <Linha key="__marca__">
              <div className="flex items-center justify-between gap-4">
                <span className="min-w-0">
                  <span className="font-semibold text-cobalto-700 dark:text-cobalto-300">
                    Seu site
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
                    {perguntasDaMarca === 0
                      ? "Nenhuma resposta usou você como fonte"
                      : "Perguntas em que algum assistente citou você"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-4">
                  {barra(perguntasDaMarca, true)}
                  {contagem(perguntasDaMarca)}
                </span>
              </div>
            </Linha>
          ) : (
            <Linha key={item.fonte.dominio}>
              <div className="flex items-center justify-between gap-4">
                <span className="min-w-0">
                  <a
                    href={`https://${item.fonte.dominio}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-slate-800 hover:text-cobalto-600 hover:underline dark:text-slate-200 dark:hover:text-cobalto-400"
                  >
                    {item.fonte.dominio}
                  </a>
                  <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
                    {item.fonte.tipo === "plataforma" ? "Plataforma" : "Concorrente"}
                    {" em "}
                    {nomesDosMotores(item.fonte.motores)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-4">
                  {barra(item.fonte.perguntas)}
                  {contagem(item.fonte.perguntas)}
                </span>
              </div>
            </Linha>
          ),
        )}
      </ul>
      {fora > 0 && (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Mais {fora} {fora === 1 ? "site foi citado" : "sites foram citados"} com menos frequência.
        </p>
      )}

      {/* O que fazer com cada tipo, dito uma vez para a lista toda em vez
          de um botão repetido em cada linha. */}
      <dl className="mt-5 space-y-2 text-sm">
        {temPlataforma && (
          <div>
            <dt className="inline font-medium text-slate-900 dark:text-slate-100">
              Plataforma:{" "}
            </dt>
            <dd className="inline text-slate-600 dark:text-slate-400">
              tenha um perfil completo e atualizado nela, com o mesmo nome do
              site. É onde a IA lê sobre empresas como a sua.
            </dd>
          </div>
        )}
        {temEmpresa && (
          <div>
            <dt className="inline font-medium text-slate-900 dark:text-slate-100">
              Concorrente:{" "}
            </dt>
            <dd className="inline text-slate-600 dark:text-slate-400">
              ele respondeu melhor ao que a IA procurava.{" "}
              <Link
                href="/market"
                className="font-medium text-cobalto-700 hover:underline dark:text-cobalto-300"
              >
                Comparar o que ele publica
              </Link>
            </dd>
          </div>
        )}
      </dl>
    </>
  );
}
