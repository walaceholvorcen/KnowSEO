"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const UM_ANO = 60 * 60 * 24 * 365;

// Grava no cookie `fuso` o fuso do navegador de quem opera o painel, para o
// servidor formatar as datas no dia certo (src/lib/datas.ts). Só recarrega
// quando o cookie faltava ou divergia - e como a gravação acontece antes do
// refresh, a segunda passada já encontra o valor igual e não entra em laço.
// Quem escolheu o fuso à mão em Configurações (`fuso_manual=1`) não é
// sobrescrito: viajar com o notebook não deve desfazer a escolha.
export function DetectarFuso() {
  const router = useRouter();
  useEffect(() => {
    const cookies = Object.fromEntries(
      document.cookie.split("; ").map((c) => c.split("=")),
    );
    if (cookies.fuso_manual === "1") return;
    const detectado = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Cookie adulterado ("%E0") faz decodeURIComponent lançar: vale como
    // "sem fuso" e é regravado.
    let atual = "";
    try {
      atual = decodeURIComponent(cookies.fuso ?? "");
    } catch {}
    if (!detectado || atual === detectado) return;
    // Com cookie bloqueado a gravação não pega, o valor nunca bate e cada
    // carga refrescaria de novo. Uma tentativa por sessão basta.
    try {
      if (sessionStorage.getItem("fuso_tentado") === detectado) return;
      sessionStorage.setItem("fuso_tentado", detectado);
    } catch {}
    document.cookie = `fuso=${encodeURIComponent(detectado)}; path=/; max-age=${UM_ANO}; samesite=lax`;
    router.refresh();
  }, [router]);
  return null;
}
