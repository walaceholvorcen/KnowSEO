// Terminações de dois níveis: em "cliente.com.br" o domínio comprado tem
// três partes, e sem esta lista "cliente.com.br" seria lido como subdomínio
// de "com.br" - o passo a passo mandaria criar um registro que não existe.
const DUAS_PARTES = new Set([
  "com.br", "net.br", "org.br", "com.ar", "com.mx", "com.co", "co.uk",
  "org.uk", "com.au", "co.jp", "com.pt", "com.es",
]);

/** O domínio comprado, sem subdomínio - onde mora a zona de DNS. */
export function ehDominioRaiz(dominio: string): boolean {
  const partes = dominio.toLowerCase().split(".");
  if (partes.length <= 2) return true;
  return partes.length === 3 && DUAS_PARTES.has(partes.slice(-2).join("."));
}

/**
 * Único formato de domínio próprio que o blog pode ocupar: subdomínio de 3º
 * nível ou mais ("blog.cliente.com"). Apontar o apex ou o www para nós
 * trocaria o site inteiro do cliente pelo blog. `.vercel.app` não entra
 * porque o certificado *.vercel.app cobre um nível só e a Vercel não aceita
 * esse host como domínio de projeto - o endereço morreria no TLS. IP e host
 * sem ponto não são domínio de ninguém. Vale no navegador e no servidor.
 */
export function isSafeCustomDomain(input: string): boolean {
  const host = input.trim().toLowerCase().replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return false; // sem ponto, IPv6, esquema, caminho
  if (/^\d+(\.\d+){3}$/.test(host)) return false; // IPv4
  if (host === "vercel.app" || host.endsWith(".vercel.app")) return false;
  if (host.startsWith("www.")) return false;
  return !ehDominioRaiz(host);
}
