import Link from "next/link";
import { Lede } from "@/components/lede";
import { botao, pagina } from "@/components/ui";
import { Logotipo } from "@/components/marca";

// 404 no tom do produto: veredito e ação, como toda tela. Sem ele o Next
// mostrava a página padrão em inglês, fora da paleta e sem saída.
export default function NotFound() {
  return (
    <div className={pagina("estreita")}>
      <Link href="/dashboard" className="mb-10 inline-block">
        <Logotipo className="text-base text-slate-900 dark:text-slate-100" />
      </Link>
      <Lede
        apoio="O endereço pode ter mudado ou nunca existiu."
        acao={
          <Link href="/dashboard" className={botao("primario")}>
            Ir para o Início
          </Link>
        }
      >
        Essa página não existe.
      </Lede>
    </div>
  );
}
