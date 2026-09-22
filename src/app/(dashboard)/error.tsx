"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Lede } from "@/components/lede";
import { botao, pagina } from "@/components/ui";
import { cn } from "@/lib/utils";

// A tela de erro do painel, no vocabulário da casa.
//
// O produto tinha `loading.tsx` justamente porque "o cliente achava que o
// sistema tinha travado" - e não tinha nada para a falha, o gêmeo da espera.
// Toda falha de servidor caía na tela crua do Next, com um digest
// hexadecimal, na frente do cliente da agência.
//
// Um arquivo cobre as nove telas do grupo: o Next monta este componente no
// lugar da página que quebrou, com a barra lateral inteira de pé.
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // O digest é a única ponte entre o que o cliente viu e o log da Vercel.
    console.error("[painel] falha ao montar a tela", error.digest, error);
  }, [error]);

  return (
    <div className={pagina()}>
      <Lede
        apoio="Não foi você. A tela não conseguiu carregar os dados desta vez - pode ter sido uma falha momentânea de conexão com o banco. Nada do que já estava salvo se perdeu."
        acao={
          <button type="button" onClick={reset} className={botao("primario")}>
            Tentar de novo
          </button>
        }
      >
        Esta tela não abriu.
      </Lede>

      <p className="text-slate-600 dark:text-slate-400">
        Se acontecer de novo, volte ao{" "}
        <Link href="/dashboard" className="font-medium text-cobalto-700 hover:underline dark:text-cobalto-300">
          Início
        </Link>{" "}
        e tente por outro caminho. As outras telas continuam funcionando.
      </p>

      {error.digest && (
        // Código curto, dito como o que é: a etiqueta que acha o erro no log.
        // Escondê-lo não ajuda ninguém; explicá-lo evita o susto do hexadecimal.
        <p className={cn("mt-6 text-sm text-slate-500 dark:text-slate-400")}>
          Código desta falha, se precisar nos mandar:{" "}
          <span className="tabular font-display">{error.digest}</span>
        </p>
      )}
    </div>
  );
}
