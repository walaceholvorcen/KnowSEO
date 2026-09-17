import { getDomain, getPublicSuffix } from "tldts";

/**
 * O domínio comprado, sem subdomínio - onde mora a zona de DNS.
 *
 * Usa a Public Suffix List (tldts) em vez de uma lista fixa de terminações:
 * a lista antiga tinha 12 entradas e deixava "cliente.gob.es", "cliente.com.pe"
 * ou "cliente.co.nz" passarem como subdomínio - e aí o domínio raiz do cliente
 * podia virar endereço do blog. Só sufixos ICANN contam (o padrão do tldts):
 * sufixos privados como vercel.app são tratados à parte em isSafeCustomDomain.
 * Host que nem vira URL conta como raiz: na dúvida, recusar.
 */
export function ehDominioRaiz(dominio: string): boolean {
  let host: string;
  try {
    // new URL baixa a caixa, tira a porta e converte IDN para punycode.
    host = new URL(`http://${dominio.trim()}`).hostname.replace(/\.$/, "");
  } catch {
    return true;
  }
  return host === getDomain(host) || host === getPublicSuffix(host);
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
