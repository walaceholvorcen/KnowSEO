import { pagina } from "@/components/ui";
import { Lock } from "lucide-react";
import { Lede } from "@/components/lede";

// A auditoria de verdade (src/lib/gbp) está pronta e testada - guardada
// como upsell futuro, não removida. Trocar este componente pelo
// <GbpBoard /> real é o único passo para reativar o módulo.
// Canal de vendas da PLATAFORMA (Know SEO), nunca do tenant: é quem libera
// o recurso no plano. O nome antigo (NEXT_PUBLIC_CONTATO) foi preenchido em
// produção com o WhatsApp de um cliente, e o botão "fale com a gente" de
// todas as agências mandava para ele. Dado de contato do cliente mora em
// cta_config, que só vale no blog público dele. Sem a variável, a frase
// fica sem link em vez de apontar para um endereço inventado.
const contato = process.env.NEXT_PUBLIC_CONTATO_VENDAS;

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
        {contato ? (
          <a
            href={contato}
            className="font-medium text-cobalto-700 hover:underline dark:text-cobalto-300"
          >
            Fale com a gente para liberar este recurso.
          </a>
        ) : (
          "Fale com a gente para liberar este recurso."
        )}
      </div>
    </div>
  );
}
