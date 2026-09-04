import { NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";

// Rota temporária de diagnóstico. Reporta o FORMATO da credencial e o
// resultado de uma chamada mínima - nunca o valor da chave.
export async function GET() {
  await requireUserAndWorkspace();

  const key = process.env.ANTHROPIC_API_KEY ?? "";

  const shape = {
    definida: key.length > 0,
    tamanho: key.length,
    prefixo: key.slice(0, 11),
    temEspacoOuQuebra: /\s/.test(key),
    aspasSobrando: /^["']|["']$/.test(key),
  };

  let chamada: Record<string, unknown> = { tentada: false };

  if (key) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-opus-5",
          max_tokens: 5,
          messages: [{ role: "user", content: "oi" }],
        }),
      });
      const body = await res.text();
      chamada = {
        tentada: true,
        status: res.status,
        resposta: body.slice(0, 200),
      };
    } catch (err) {
      chamada = { tentada: true, erro: String(err).slice(0, 200) };
    }
  }

  return NextResponse.json({ shape, chamada });
}
