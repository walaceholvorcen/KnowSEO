"use client";

import { Montserrat } from "next/font/google";
import { useId } from "react";
import { cn } from "@/lib/utils";

// A marca em vetor, reconstruída a partir do logotipo oficial (SEO / KNOW
// empilhados, itálico pesado, K azul com uma lâmina diagonal atravessando a
// haste). Vetor em vez de PNG: fica nítido em qualquer tamanho, herda a cor
// do texto ao redor (funciona no painel azul-marinho e no fundo claro) e
// pesa menos que uma imagem.
//
// A Montserrat Black itálica é a voz exclusiva do logotipo - não entra em
// nenhum outro texto da interface, que segue na IBM Plex.
const fonteMarca = Montserrat({
  subsets: ["latin"],
  weight: "900",
  style: "italic",
  display: "swap",
});

// O K da marca: haste + dois braços, cortados por uma lâmina diagonal que
// atravessa a haste e escapa pelo canto inferior esquerdo. O corte é feito
// com máscara (fica transparente, não pintado), então o glifo assenta sobre
// qualquer fundo.
function MarcaK({ className }: { className?: string }) {
  // A marca aparece mais de uma vez na mesma página (painel + celular).
  // Sem id único por instância, url(#...) resolve para a primeira - que
  // pode estar num container display:none, e aí o navegador não pinta nada.
  const uid = useId();
  const grad = `marca-k-grad-${uid}`;
  const corte = `marca-k-corte-${uid}`;
  return (
    <svg
      viewBox="-48 0 148 100"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={grad} x1="0.1" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#5FB2FF" />
          <stop offset="1" stopColor="#0E47C9" />
        </linearGradient>
        <mask id={corte}>
          <rect x="-120" y="-20" width="300" height="140" fill="#fff" />
          {/* fenda paralela aos braços, cruzando a haste abaixo do cotovelo */}
          <polygon points="-42,110 45,-10 60,-10 -27,110" fill="#000" />
        </mask>
      </defs>
      <g transform="translate(10 0) skewX(-12)">
        <g fill={`url(#${grad})`} mask={`url(#${corte})`}>
          <path d="M0,0 H22 V100 H0 Z" />
          <path d="M22,58 L64,0 H86 L44,58 Z" />
          <path d="M22,58 H44 L80,100 H58 Z" />
        </g>
        {/* a lâmina viaja dentro da fenda e escapa pela base */}
        <polygon points="-33,100 14,35 23,35 -24,100" fill={`url(#${grad})`} />
      </g>
    </svg>
  );
}

// Logotipo completo, numa linha: "Know SEO" com o K da marca. O tamanho vem
// do font-size do container (text-lg, text-xl...), a cor das letras vem de
// text-*; o K é sempre azul.
export function Logotipo({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Know SEO"
      className={cn(
        fonteMarca.className,
        "block select-none whitespace-nowrap uppercase leading-none tracking-[0.015em]",
        className,
      )}
    >
      <span aria-hidden="true">
        <MarcaK className="-ml-[0.26em] inline-block h-[0.715em] w-auto" />
        NOW SEO
      </span>
    </span>
  );
}
