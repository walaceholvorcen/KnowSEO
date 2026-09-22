import Link from "next/link";
import { Check } from "lucide-react";
import { botao, pagina } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatarData } from "@/lib/datas";
import { semEsquema } from "@/lib/blog-endereco";
import { Lede, Linha, Secao, Regua } from "@/components/lede";
import { scoreBand } from "@/lib/audit/rules";
import { ROTULO_MOTOR } from "@/lib/ai-visibility/resumo";
import type { Gargalo, Etapa } from "@/lib/gargalo";
import type { DomainStatus, OnboardingSteps } from "@/types";
import { EvolucaoDosArtigos } from "./evolucao";
import { Numero, Painel, Vazio } from "./painel";
import { MODULOS_VISIVEIS } from "@/lib/modulos";
import { DIAS_JANELA, type DadosInicio } from "./dados";

// O passo "veja as primeiras visitas" saiu: ver um número não é
// configuração, é consequência. A configuração acaba quando o blog está
// pronto para produzir - daí em diante o painel mostra a operação, não a
// lista de tarefas.
const STEPS: {
  key: keyof OnboardingSteps;
  title: string;
  description: string;
  href: string;
}[] = [
  {
    key: "brand_dna",
    title: "Defina o DNA da marca",
    description: "O que a empresa faz, para quem escreve e em que tom.",
    href: "/settings/brand",
  },
  {
    key: "site_analyzed",
    title: "Mapeie as páginas do seu site",
    description: "É o que permite link interno automático nos artigos.",
    href: "/settings/blog",
  },
  {
    key: "domain_connected",
    title: "Conecte seu domínio",
    description: "Use o seu domínio no lugar do subdomínio gratuito.",
    href: "/settings/blog",
  },
  {
    key: "first_article_published",
    title: "Publique o primeiro artigo",
    description: "Escolha uma pauta e deixe a IA escrever.",
    href: "/strategy",
  },
];

const cor = (banda: ReturnType<typeof scoreBand>) =>
  banda === "excelente" || banda === "bom"
    ? "bg-nota-excelente"
    : banda === "atencao"
      ? "bg-nota-atencao"
      : "bg-nota-critico";

const FAIXA: Record<ReturnType<typeof scoreBand>, string> = {
  excelente: "Excelente",
  bom: "Bom",
  atencao: "Precisa atenção",
  critico: "Crítico",
};

// Nota com régua: a escala graduada é a assinatura visual do produto, e é
// ela que diz que 88 é "Bom" e que faltam dois pontos para "Excelente".
function NotaComRegua({ rotulo, nota }: { rotulo: string; nota: number }) {
  const banda = scoreBand(nota);
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {rotulo}
        </span>
        <Numero valor={nota} de="de 100" />
      </div>
      <Regua score={nota} corMarcador={cor(banda)} className="mt-2" />
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {FAIXA[banda]}
      </p>
    </div>
  );
}

// Uma célula por pergunta do Raio X: cheia quando algum assistente citou a
// marca naquela pergunta. A proporção vira forma, não só fração escrita.
function Celulas({ total, cheias }: { total: number; cheias: number }) {
  return (
    <div className="mt-3 flex items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 min-w-0 flex-1 rounded-full",
            i < cheias
              ? "bg-cobalto-500 dark:bg-cobalto-400"
              : "bg-slate-200 dark:bg-slate-800",
          )}
        />
      ))}
    </div>
  );
}

// Visitas dia a dia. É a diferença entre foto e filme: o total sozinho não
// conta se a semana passada foi melhor que esta.
function BarrasPorDia({ porDia }: { porDia: number[] }) {
  const max = Math.max(...porDia, 1);
  return (
    <div className="mt-3 flex h-16 items-end gap-[3px]" aria-hidden="true">
      {porDia.map((v, i) => (
        <span
          key={i}
          className={cn(
            "min-w-0 flex-1 rounded-sm",
            v > 0
              ? "bg-cobalto-500/80 dark:bg-cobalto-400/80"
              : "bg-slate-200 dark:bg-slate-800",
          )}
          style={{ height: v > 0 ? `${Math.max(8, (v / max) * 100)}%` : "2px" }}
        />
      ))}
    </div>
  );
}

// Tema do mercado: o que o cliente publicou contra o que os concorrentes
// publicaram, na mesma escala. Normalizar por linha faria 2 artigos
// parecerem do tamanho de 22.
function BarraDoTema({
  cliente,
  concorrentes,
  maior,
}: {
  cliente: number;
  concorrentes: number;
  maior: number;
}) {
  const pct = (n: number) => `${Math.round((n / maior) * 100)}%`;
  return (
    <div className="mt-1.5 flex h-1.5 gap-px" aria-hidden="true">
      <span
        className="rounded-l-sm bg-cobalto-600 dark:bg-cobalto-400"
        style={{ width: pct(cliente) }}
      />
      <span
        className="rounded-r-sm bg-slate-300 dark:bg-slate-700"
        style={{ width: pct(concorrentes) }}
      />
    </div>
  );
}

// Qual painel leva o filete de "travado". A corrente é a mesma que o
// diagnóstico de gargalo percorre: a frase de cima e o painel marcado nunca
// podem contar histórias diferentes.
const ETAPA: Record<string, Etapa[]> = {
  site: ["site"],
  geo: ["ia"],
  pautas: ["pauta"],
  conteudo: ["conteudo"],
  // Alcance e conversão moram no mesmo painel: os dois são o que o blog
  // publicado devolveu. Sem "conversao" aqui, o gargalo mais comum depois
  // das primeiras visitas não marcava painel nenhum.
  resultado: ["alcance", "conversao"],
};

export function InicioBoard({
  blogNome,
  endereco,
  statusDominio,
  feitos,
  gargalo,
  dados,
  fuso,
}: {
  blogNome: string;
  /** URL pública do blog, com esquema (urlPublicaDoBlog). */
  endereco: string;
  statusDominio: DomainStatus;
  feitos: OnboardingSteps;
  gargalo: Gargalo;
  dados: DadosInicio;
  /** Fuso de quem opera o painel, lido do cookie na página. */
  fuso: string;
}) {
  const formatDate = (iso: string) => formatarData(iso, fuso, "longa");
  const faltando = STEPS.filter((s) => !feitos[s.key]);
  const configurando = faltando.length > 0;

  const totalCelulas = dados.perguntasRodada || dados.perguntas;
  const delta =
    dados.notaGoogle != null && dados.notaGoogleAnterior != null
      ? dados.notaGoogle - dados.notaGoogleAnterior
      : null;
  const maiorTema = Math.max(
    1,
    ...dados.temas.map((t) => t.paginasCliente + t.paginasConcorrentes),
  );
  const travado = (chave: string) => ETAPA[chave].includes(gargalo.etapa);

  return (
    <div className={pagina()}>
      <Lede
        apoio={
          configurando ? undefined : (
            <>
              Blog {blogNome}, em{" "}
              <a
                href={endereco}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cobalto-700 hover:underline dark:text-cobalto-300"
              >
                {semEsquema(endereco)}
              </a>
              {statusDominio !== "active" && dados.publicados > 0 && (
                <>
                  {" · "}
                  <Link
                    href="/settings/blog"
                    className="text-nota-atencao hover:underline"
                  >
                    domínio próprio ainda não confirmado
                  </Link>
                </>
              )}
            </>
          )
        }
        acao={
          <Link href={gargalo.acaoHref} className={botao("primario")}>
            {gargalo.acaoTexto}
          </Link>
        }
      >
        {configurando
          ? "Faltam alguns ajustes antes do blog começar a produzir sozinho."
          : gargalo.frase}
      </Lede>

      {configurando && (
        <>
          <Secao>Configuração</Secao>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {STEPS.length - faltando.length} de {STEPS.length} prontos.
          </p>
          <ul className="mt-4">
            {STEPS.map((step) => {
              const feito = feitos[step.key];
              return (
                <Linha key={step.key}>
                  <Link
                    href={step.href}
                    className="group flex items-baseline gap-3"
                  >
                    <span className="w-4 shrink-0 text-nota-excelente">
                      {feito && <Check size={16} />}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={
                          feito
                            ? "text-slate-500 dark:text-slate-400"
                            : "text-slate-900 group-hover:text-cobalto-600 dark:text-slate-100 dark:group-hover:text-cobalto-400"
                        }
                      >
                        {step.title}
                      </span>
                      {!feito && (
                        <span className="mt-0.5 block text-slate-500 dark:text-slate-400">
                          {step.description}
                        </span>
                      )}
                    </span>
                  </Link>
                </Linha>
              );
            })}
          </ul>
        </>
      )}

      <Secao>Diagnóstico</Secao>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        O que o Google e os assistentes de IA encontram hoje.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Painel
          titulo="Saúde do site"
          href="/audit"
          acao={dados.notaGoogle == null ? "Auditar" : "Ver auditoria"}
          travado={travado("site")}
          rodape={
            dados.auditoriaEm ? (
              <>
                Auditado em {formatDate(dados.auditoriaEm)}
                {delta !== null && delta !== 0 && (
                  <>
                    {" · "}
                    <span
                      className={
                        delta > 0 ? "text-nota-excelente" : "text-nota-atencao"
                      }
                    >
                      {delta > 0 ? "+" : ""}
                      {delta} no Google desde a anterior
                    </span>
                  </>
                )}
              </>
            ) : undefined
          }
        >
          {dados.notaGoogle == null ? (
            <Vazio>
              O site nunca foi auditado. São 26 regras técnicas e de entidade,
              em menos de um minuto.
            </Vazio>
          ) : (
            <>
              <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
                <NotaComRegua rotulo="No Google" nota={dados.notaGoogle} />
                {dados.notaIa != null && (
                  <NotaComRegua rotulo="Para a IA" nota={dados.notaIa} />
                )}
              </div>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                {dados.achadosTotal === 0
                  ? "Nenhum problema encontrado."
                  : dados.achadosGraves > 0
                    ? `${dados.achadosGraves} ${dados.achadosGraves === 1 ? "problema grave" : "problemas graves"} de ${dados.achadosTotal} encontrados.`
                    : `${dados.achadosTotal} ${dados.achadosTotal === 1 ? "ajuste" : "ajustes"}, nenhum grave.`}
              </p>
            </>
          )}
        </Painel>

        <Painel
          titulo="Raio X - GEO"
          href="/visibility"
          acao={dados.citacoes === null ? "Analisar" : "Ver análise"}
          travado={travado("geo")}
          rodape={
            dados.geoEm ? (
              <>
                {dados.motoresMedidos
                  .map((m) => ROTULO_MOTOR[m] ?? m)
                  .join(", ")}{" "}
                em {formatDate(dados.geoEm)}
                {dados.fontes > 0 && ` · ${dados.fontes} sites citados`}
              </>
            ) : undefined
          }
        >
          {dados.citacoes === null ? (
            <Vazio>
              Ninguém perguntou ainda. A análise faz {totalCelulas || 10}{" "}
              perguntas de comprador aos assistentes e mede se a marca aparece.
            </Vazio>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {/* Só afirma o que foi medido: um motor leva o nome dele. */}
                  {dados.motoresMedidos.length === 1
                    ? `Perguntas em que o ${ROTULO_MOTOR[dados.motoresMedidos[0]] ?? dados.motoresMedidos[0]} cita você`
                    : `Perguntas em que os ${dados.motoresMedidos.length} assistentes citam você`}
                </span>
                <Numero valor={dados.citacoes} de={`de ${totalCelulas}`} />
              </div>
              <Celulas total={totalCelulas} cheias={dados.citacoes} />
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                {dados.rivalCitado
                  ? `No seu lugar a IA cita ${dados.rivalCitado}.`
                  : dados.citacoes > 0
                    ? "Nenhum concorrente domina as respostas."
                    : "Nenhuma citação na última rodada."}
              </p>
            </>
          )}
        </Painel>

        {MODULOS_VISIVEIS.mercado && (
        <Painel
          titulo="Mercado"
          href="/market"
          acao={dados.mercadoEm ? "Ver temas" : "Analisar mercado"}
          className="lg:col-span-2"
          rodape={
            dados.mercadoEm ? (
              <>
                Analisado em {formatDate(dados.mercadoEm)}
                {dados.chances > 0 &&
                  ` · ${dados.chances} ${dados.chances === 1 ? "termo onde você já quase ganha" : "termos onde você já quase ganha"}`}
              </>
            ) : undefined
          }
        >
          {dados.temas.length === 0 ? (
            <Vazio>
              Aponte de 2 a 4 concorrentes diretos e o sistema lê o que eles
              publicaram, tema a tema, para mostrar onde falta conteúdo seu.
            </Vazio>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {dados.temas.map((t) => (
                <li key={t.termo}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-slate-900 dark:text-slate-100">
                      {t.termo}
                    </span>
                    <span className="tabular shrink-0 text-sm text-slate-500 dark:text-slate-400">
                      {t.paginasCliente} seus · {t.paginasConcorrentes} deles
                    </span>
                  </div>
                  <BarraDoTema
                    cliente={t.paginasCliente}
                    concorrentes={t.paginasConcorrentes}
                    maior={maiorTema}
                  />
                </li>
              ))}
            </ul>
          )}
        </Painel>
        )}
      </div>

      <Secao>Produção</Secao>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        O que está na fila e o que já foi ao ar.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Painel
          titulo="Pautas esperando escolha"
          href="/strategy"
          acao={dados.pautas === 0 ? "Buscar pautas" : "Escolher"}
          travado={travado("pautas")}
        >
          <Numero
            valor={dados.pautas}
            de={dados.pautas === 1 ? "pauta" : "pautas"}
          />
          {dados.proximasPautas.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Nenhuma sugerida ainda.
            </p>
          ) : (
            <ul className="mt-3">
              {dados.proximasPautas.map((p) => (
                <Linha key={p.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-slate-900 dark:text-slate-100">
                      {p.termo}
                    </span>
                    <span className="tabular shrink-0 text-sm text-slate-500 dark:text-slate-400">
                      {p.volume
                        ? `${p.volume.toLocaleString("pt-BR")}/mês`
                        : "sem volume"}
                    </span>
                  </div>
                </Linha>
              ))}
            </ul>
          )}
        </Painel>

        <Painel
          titulo="Conteúdo"
          href="/contents"
          acao="Ver conteúdos"
          travado={travado("conteudo")}
          rodape={
            dados.rascunhos > 0 ? (
              <>
                {dados.rascunhos}{" "}
                {dados.rascunhos === 1
                  ? "rascunho esperando revisão"
                  : "rascunhos esperando revisão"}
              </>
            ) : undefined
          }
        >
          <Numero
            valor={dados.publicados}
            de={dados.publicados === 1 ? "artigo no ar" : "artigos no ar"}
          />
          {dados.ultimosArtigos.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Nenhum artigo publicado.
            </p>
          ) : (
            <ul className="mt-3">
              {dados.ultimosArtigos.map((a) => (
                <Linha key={a.id}>
                  <Link
                    href={`/contents/${a.id}`}
                    className="group flex items-baseline justify-between gap-3"
                  >
                    <span className="min-w-0 truncate text-slate-900 group-hover:text-cobalto-600 dark:text-slate-100 dark:group-hover:text-cobalto-400">
                      {a.titulo}
                    </span>
                    <span className="tabular shrink-0 text-sm text-slate-500 dark:text-slate-400">
                      {a.visitas} {a.visitas === 1 ? "visita" : "visitas"}
                    </span>
                  </Link>
                </Linha>
              ))}
            </ul>
          )}
        </Painel>
      </div>

      <Secao>Resultado</Secao>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Os últimos {DIAS_JANELA} dias no blog publicado.
      </p>

      <div className="mt-4">
        <Painel
          titulo={`Visitas e conversas em ${DIAS_JANELA} dias`}
          href="/reports"
          acao="Ver relatórios"
          travado={travado("resultado")}
        >
          <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
            <div>
              <span className="block text-sm text-slate-600 dark:text-slate-400">
                Visitas
              </span>
              <Numero valor={dados.visitas} />
            </div>
            <div>
              <span className="block text-sm text-slate-600 dark:text-slate-400">
                Conversas
              </span>
              <Numero valor={dados.conversas} />
            </div>
          </div>
          {dados.visitas > 0 ? (
            <BarrasPorDia porDia={dados.visitasPorDia} />
          ) : (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Ninguém leu ainda. O tráfego de artigo novo costuma aparecer
              depois de algumas semanas.
            </p>
          )}
        </Painel>
      </div>

      <EvolucaoDosArtigos primeiraPublicacao={dados.primeiraPublicacao} />
    </div>
  );
}
