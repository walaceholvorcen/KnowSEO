import { pagina } from "@/components/ui";
import { Lock } from "lucide-react";
import { Lede } from "@/components/lede";

// A auditoria de verdade (src/lib/gbp) está pronta e testada - guardada
// como upsell futuro, não removida. Trocar este componente pelo
// <GbpBoard /> real é o único passo para reativar o módulo.
export function GbpLocked() {
  return (
    <div className={pagina()}>
      <Lede
        apoio="Quando ativado, o negócio digita nome e cidade e recebe nota + achados do próprio perfil no Google - sem conectar nada."
      >
        Google Meu Negócio ainda não está disponível no seu plano.
      </Lede>

      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <Lock size={15} />
        Fale com a gente para liberar este recurso.
      </div>
    </div>
  );
}
