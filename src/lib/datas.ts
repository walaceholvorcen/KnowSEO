// Datas na tela, num lugar só.
//
// Guardar em UTC está certo; formatar em UTC estava errado. Uma auditoria
// rodada às 21:35 de 16/09 em São Paulo é 00:35 de 17/09 em UTC, e a tela
// dizia 17/09 - o operador via a auditoria "de amanhã". O fuso que manda é o
// de quem opera o painel, lido do cookie `fuso` (gravado pelo navegador em
// src/components/detectar-fuso.tsx ou escolhido em Configurações).
//
// Toda formatação passa o timeZone explícito: servidor e navegador escrevem
// o mesmo texto, e a hidratação não acusa divergência (#418).

export const FUSO_PADRAO = "America/Sao_Paulo";

export function fusoValido(fuso: string | undefined | null): fuso is string {
  if (!fuso) return false;
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}

export function formatarData(
  instante: Date | string,
  fuso: string,
  estilo: "curta" | "longa",
): string {
  // Fuso inválido cai em UTC em vez de derrubar a tela: um cookie adulterado
  // não pode quebrar a renderização.
  const timeZone = fusoValido(fuso) ? fuso : "UTC";
  return new Date(instante).toLocaleDateString(
    "pt-BR",
    estilo === "curta"
      ? { day: "2-digit", month: "2-digit", timeZone }
      : { day: "2-digit", month: "short", year: "numeric", timeZone },
  );
}

// Só no servidor (usa cookies() do Next). O import é dinâmico para o
// arquivo continuar importável pelo `node --test`, que não tem next/headers.
export async function lerFuso(): Promise<string> {
  const { cookies } = await import("next/headers");
  const fuso = (await cookies()).get("fuso")?.value;
  // Sem cookie (primeira visita, antes de o navegador gravar o detectado) o
  // padrão é São Paulo, não UTC: a base de operadores é brasileira, e UTC
  // erra o dia de toda auditoria feita depois das 21h. O componente de
  // detecção corrige e recarrega logo em seguida para quem está em outro fuso.
  return fusoValido(fuso) ? fuso : FUSO_PADRAO;
}

// Fuso do blog público: quem lê é o mercado do blog, não o operador. Sai do
// país do domínio (mesma dedução de paisDoBlog). Sem domínio de país
// reconhecido, UTC - melhor um fuso neutro que um palpite pelo idioma.
const FUSO_DO_PAIS: Record<string, string> = {
  es: "Europe/Madrid",
  br: "America/Sao_Paulo",
  mx: "America/Mexico_City",
  co: "America/Bogota",
  ar: "America/Argentina/Buenos_Aires",
  cl: "America/Santiago",
  pt_pt: "Europe/Lisbon",
};

export function fusoDoPais(pais: { chave: string; origem: string }): string {
  return pais.origem === "dominio" ? (FUSO_DO_PAIS[pais.chave] ?? "UTC") : "UTC";
}
