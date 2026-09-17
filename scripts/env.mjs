// Lê o .env.local sem imprimir nada: os scripts precisam da service key, e
// ela não pode aparecer em log de terminal.
import fs from "node:fs";

export function lerEnv() {
  const arquivo = new URL("../.env.local", import.meta.url);
  const env = { ...process.env };
  if (fs.existsSync(arquivo)) {
    for (const linha of fs.readFileSync(arquivo, "utf8").split(/\r?\n/)) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const headers = { apikey: chave, Authorization: `Bearer ${chave}` };
  return {
    env,
    rest: (caminho, init = {}) =>
      fetch(`${url}/rest/v1/${caminho}`, {
        ...init,
        headers: { ...headers, "Content-Type": "application/json", ...init.headers },
      }),
  };
}
