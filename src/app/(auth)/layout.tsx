import type { Metadata } from "next";
import { Logotipo } from "@/components/marca";

export const metadata: Metadata = {
  title: "Know SEO",
};

// A porta de entrada é a única tela que promete antes de provar. A versão
// anterior era uma divisão de tela com um card flutuando no meio do azul -
// "meio estranha, e só", nas palavras do dono.
//
// A direção é a mesma do painel (PROCESSO 15 e 23): o produto é instrumento
// de medição, não revista. Então a coluna da marca deixa de ser um slide com
// um card e vira a FACE do instrumento - escala gravada no fundo, uma leitura
// que assenta ao abrir, e o mostrador de citação preenchendo célula a célula.
// Um único momento de movimento, na abertura, que é quando ninguém está
// esperando nada (login é ocasional; o que se vê cem vezes por dia não anima).
//
// Números de exemplo, e a tela diz isso. Inventar dado real na porta de um
// produto que vende prova seria a pior abertura possível.

const NOTA_EXEMPLO = 72;
const CITADAS = 6;
const PERGUNTAS = 10;
const LIMIARES = [50, 70, 90];

/** A régua do painel, gravada em tamanho grande. A escala é a real. */
function EscalaGravada({ nota }: { nota: number }) {
  const ticks = Array.from({ length: 51 }, (_, i) => i * 2);
  return (
    <svg viewBox="0 0 300 40" className="w-full" aria-hidden="true">
      {/* Traço a cada 2 pontos, alto nos limiares das faixas: é a mesma
          graduação que a nota usa no painel, não um enfeite de régua. */}
      {ticks.map((t) => {
        const limiar = LIMIARES.includes(t);
        const dezena = t % 10 === 0;
        return (
          <line
            key={t}
            x1={t * 3}
            y1={limiar ? 14 : dezena ? 20 : 25}
            x2={t * 3}
            y2="30"
            stroke={limiar ? "#6c82f0" : dezena ? "#3d4f78" : "#232f4c"}
            strokeWidth={limiar ? 1.5 : 1}
          />
        );
      })}
      <line x1="0" y1="30" x2="300" y2="30" stroke="#2c3a5c" strokeWidth="1" />
      {LIMIARES.map((t) => (
        <text
          key={`r-${t}`}
          x={t * 3}
          y="9"
          textAnchor="middle"
          className="fill-[#5f7099] text-[7px]"
          style={{ fontFamily: "var(--font-mono, monospace)" }}
        >
          {t}
        </text>
      ))}
      {/* O cursor assenta na leitura ao abrir a tela. */}
      <g className="origem-esquerda animar-cursor" style={{ ["--x" as string]: `${nota * 3}px` }}>
        <rect x="-1.5" y="10" width="3" height="22" rx="1.5" fill="#5fbf8d" />
        <rect x="-5" y="10" width="10" height="22" rx="5" fill="#5fbf8d" opacity="0.14" />
      </g>
    </svg>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.08fr_1fr]">
      <style>{`
        @keyframes cursor-assenta { from { transform: translateX(0); } to { transform: translateX(var(--x)); } }
        @keyframes celula-acende { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: none; } }
        .animar-cursor { transform: translateX(var(--x)); animation: cursor-assenta 900ms cubic-bezier(0.23, 1, 0.32, 1) both; }
        .animar-celula { animation: celula-acende 420ms cubic-bezier(0.23, 1, 0.32, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .animar-cursor, .animar-celula { animation: none; }
        }
      `}</style>

      {/* Coluna da marca. Escura nos dois temas: é a cor da marca, não um tema. */}
      <aside className="relative hidden overflow-hidden bg-[#070c1b] lg:flex lg:flex-col lg:px-12 lg:py-10 xl:px-16">
        {/* Fundo gravado: linhas finas de instrumento e uma luz fria vinda do
            alto. Sem vidro, sem blur decorativo - é papel milimetrado, que é
            o mundo de onde o produto fala. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.55] [background-image:linear-gradient(to_right,rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.035)_1px,transparent_1px)] [background-size:26px_26px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_50%_at_20%_-5%,rgb(40_90_220/0.28),transparent_70%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-[linear-gradient(to_top,rgb(3_6_16/0.9),transparent)]"
        />

        <Logotipo className="relative text-xl text-white" />

        <div className="relative flex flex-1 flex-col justify-center">
          <div className="w-full max-w-lg">
            <p className="text-balance text-[2rem] font-semibold leading-[1.15] tracking-tight text-white">
              Quando a IA responde pelo seu mercado, ela cita a sua marca?
            </p>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#93a4c9]">
              Auditoria técnica, radar de citação em inteligência artificial e
              conteúdo guiado por dado — medido, não estimado.
            </p>

            {/* A leitura. Não é um card com número grande: é o mostrador. */}
            <div className="mt-12 border-t border-white/10 pt-8">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-[#93a4c9]">Nota do site</span>
                <span className="tabular font-display text-4xl font-semibold leading-none text-white">
                  {NOTA_EXEMPLO}
                  <span className="ml-3 align-middle text-sm font-normal text-[#5fbf8d]">
                    Boa
                  </span>
                </span>
              </div>
              <div className="mt-4">
                <EscalaGravada nota={NOTA_EXEMPLO} />
              </div>

              <div className="mt-8 flex items-center justify-between gap-6 border-t border-white/10 pt-6">
                <span className="text-sm text-[#93a4c9]">
                  Respostas de IA que citam a marca
                </span>
                <span className="flex items-center gap-2">
                  <span className="flex gap-1.5" aria-hidden="true">
                    {Array.from({ length: PERGUNTAS }, (_, i) => (
                      <span
                        key={i}
                        className="animar-celula h-5 w-2.5 rounded-[2px]"
                        style={{
                          background: i < CITADAS ? "#5fbf8d" : "rgb(255 255 255 / 0.09)",
                          animationDelay: `${500 + i * 45}ms`,
                        }}
                      />
                    ))}
                  </span>
                  <span className="tabular font-display text-sm text-white">
                    {CITADAS}/{PERGUNTAS}
                  </span>
                </span>
              </div>
            </div>

            <p className="mt-5 text-xs text-[#5f7099]">
              Leitura de exemplo. No painel, cada número vem da medição do seu
              site e das respostas dos assistentes de IA.
            </p>
          </div>
        </div>
      </aside>

      {/* Coluna do formulário */}
      <main className="flex flex-col items-center justify-center bg-slate-50 px-5 py-10 dark:bg-background">
        <div className="w-full max-w-sm">
          {/* No celular a coluna da marca não existe, e a tela ficava um
              formulário solto no branco. Esta faixa traz a marca e a mesma
              leitura, no tamanho que cabe. */}
          <div className="mb-10 overflow-hidden rounded-2xl bg-[#070c1b] px-6 py-5 lg:hidden">
            <Logotipo className="text-lg text-white" />
            <p className="mt-3 text-balance text-[15px] font-medium leading-snug text-white">
              Quando a IA responde pelo seu mercado, ela cita a sua marca?
            </p>
            <div className="mt-5 flex items-baseline justify-between gap-4">
              <span className="text-xs text-[#93a4c9]">Nota do site (exemplo)</span>
              <span className="tabular font-display text-2xl font-semibold leading-none text-white">
                {NOTA_EXEMPLO}
                <span className="ml-2 text-xs font-normal text-[#5fbf8d]">Boa</span>
              </span>
            </div>
            <div className="mt-2">
              <EscalaGravada nota={NOTA_EXEMPLO} />
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
