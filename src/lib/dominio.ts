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
