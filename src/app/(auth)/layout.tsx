import type { Metadata } from "next";
import { Logotipo } from "@/components/marca";

export const metadata: Metadata = {
  title: "Know SEO",
};

// Régua estática com uma nota de exemplo. É a mesma linguagem do painel
// (ticks a cada 10, limiares marcados), redesenhada nas cores do azul-marinho
// da marca. Puro SVG, sem dado real: a legenda abaixo diz que é ilustrativa.
function ReguaExemplo({ nota }: { nota: number }) {
  const ticks = Array.from({ length: 11 }, (_, i) => i * 10);
  const limiares = [50, 70, 90];
  return (
    <svg viewBox="0 0 300 24" className="w-full" aria-hidden="true">
      <line x1="0" y1="19" x2="300" y2="19" stroke="#25324f" strokeWidth="1" />
      {ticks.map((t) => (
        <line
          key={t}
          x1={t * 3}
          y1={limiares.includes(t) ? 8 : 13}
          x2={t * 3}
          y2="19"
          stroke={limiares.includes(t) ? "#3d4f78" : "#25324f"}
          strokeWidth={limiares.includes(t) ? 1.5 : 1}
        />
      ))}
      <rect
        x={nota * 3 - 1.5}
        y="4"
        width="3"
        height="15"
        rx="1.5"
        fill="#5fbf8d"
      />
    </svg>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Painel da marca: o azul-marinho do logotipo, uma pergunta e uma
          leitura do instrumento. Fica escuro nos dois modos - é a cor da
          marca, não um tema. */}
      <aside className="relative hidden overflow-hidden bg-[#070c1b] lg:flex lg:flex-col lg:px-12 lg:py-10 xl:px-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_18%_0%,rgb(30_80_200/0.22),transparent)]"
        />

        <Logotipo className="relative text-xl text-white" />

        <div className="relative flex flex-1 flex-col justify-center">
          <div className="max-w-md space-y-8">
            <div>
              <p className="text-balance text-[1.7rem] font-semibold leading-snug text-white">
                Quando a IA responde pelo seu mercado, ela cita a sua marca?
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-[#93a4c9]">
                Auditoria de SEO, radar de citação em inteligência artificial,
                e conteúdo guiado por dados do Google num painel só.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-[#93a4c9]">Nota do site</span>
                <span className="tabular font-display text-2xl font-semibold text-white">
                  72
                  <span className="ml-2 text-sm font-normal text-[#5fbf8d]">
                    Boa
                  </span>
                </span>
              </div>
              <div className="mt-3">
                <ReguaExemplo nota={72} />
              </div>

              <div className="mt-6 flex items-baseline justify-between gap-4 border-t border-white/10 pt-5">
                <span className="text-sm text-[#93a4c9]">Radar GEO</span>
                <span className="text-sm text-white">
                  6 de 10 respostas citam a marca
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Coluna do formulário */}
      <main className="flex flex-col items-center justify-center bg-slate-50 px-5 py-10 dark:bg-background">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex justify-center lg:hidden">
            <Logotipo className="text-xl text-slate-900 dark:text-slate-100" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
