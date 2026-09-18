"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { botao } from "@/components/ui";

// O botão "Salvar" de toda tela de configurações, com a resposta junto.
//
// Antes o único sinal de que algo foi gravado era a palavra do próprio
// botão trocar de "Salvar" para "Salvo" - no mesmo lugar, no mesmo tom, a
// 200ms de distância. Ninguém via. Agora o botão mostra que está trabalhando
// (roda girando, texto "Salvando...") e a confirmação aparece ao lado, em
// verde, com visto. Some sozinha em 4s: passado esse tempo a pessoa já
// mexeu em outro campo e o "Salvo" verde estaria mentindo.
export function BotaoSalvar({
  salvando,
  salvo,
  disabled = false,
  onClick,
  rotulo = "Salvar",
  children,
}: {
  salvando: boolean;
  salvo: boolean;
  disabled?: boolean;
  /** Quando existe, o botão vira type="button" e chama isto. */
  onClick?: () => void;
  rotulo?: string;
  /** O que mais mora na linha do botão (avisos, ações secundárias). */
  children?: React.ReactNode;
}) {
  // Um salvamento novo zera o prazo do anterior. Ajustado durante o render,
  // como a doc do React recomenda para estado que segue uma prop - num
  // efeito, cada clique renderizaria duas vezes.
  const [expirou, setExpirou] = useState(false);
  const [salvandoAntes, setSalvandoAntes] = useState(salvando);
  if (salvando !== salvandoAntes) {
    setSalvandoAntes(salvando);
    if (salvando) setExpirou(false);
  }

  useEffect(() => {
    if (!salvo || salvando) return;
    const t = setTimeout(() => setExpirou(true), 4000);
    return () => clearTimeout(t);
  }, [salvo, salvando]);

  const visivel = salvo && !salvando && !expirou;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type={onClick ? "button" : "submit"}
        onClick={onClick}
        disabled={salvando || disabled}
        className={botao("primario")}
      >
        {salvando && (
          <Loader2
            size={15}
            aria-hidden
            className="animate-spin motion-reduce:animate-none"
          />
        )}
        {salvando ? "Salvando..." : rotulo}
      </button>

      {/* A região vive sempre no DOM: é o que faz o leitor de tela anunciar
          "Salvo" quando o texto entra. Sem ela, só quem enxerga saberia. */}
      <p
        role="status"
        aria-live="polite"
        className="flex items-center gap-1.5 text-sm font-semibold text-nota-excelente"
      >
        {visivel && (
          <>
            <Check size={15} strokeWidth={2.5} aria-hidden />
            Salvo
          </>
        )}
      </p>

      {children}
    </div>
  );
}
