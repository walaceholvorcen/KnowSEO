// Decide se uma tarefa do cron semanal falhou e com que detalhe.
//
// Função pura e fora da rota porque as duas etapas "resolvem" mesmo quando
// dão errado: registrarAuditoria devolve `{ ok: false }` e executarRodada
// devolve o resumo com `failed` - chave da Anthropic inválida dá 401 em cada
// pergunta e a promessa resolve normal. Contar só rejeição registrava
// "falhas: 0" com tudo quebrado.

/** Segredos com prefixo conhecido (Anthropic, OpenAI, Perplexity, Google)
 *  saem do texto: o detalhe vai para `cron_execucoes` e para o log. */
function semSegredo(texto: string): string {
  return texto.replace(/\b(sk-[\w-]{8,}|pplx-[\w-]{8,}|AIza[\w-]{8,})/g, "[chave omitida]");
}

/** null = deu certo; string = o que registrar como erro da tarefa. */
export function resultadoDaTarefa(
  rotulo: string,
  r: PromiseSettledResult<unknown>,
): string | null {
  if (r.status === "rejected") {
    const motivo = r.reason instanceof Error ? r.reason.message : String(r.reason);
    return semSegredo(motivo).slice(0, 300);
  }

  const v = r.value as
    | { ok?: boolean; erro?: string; mensagem?: string; failed?: number; total?: number; primeiroErro?: string }
    | null
    | undefined;
  if (!v || typeof v !== "object") return null;

  if (v.ok === false) {
    // Sem erro nem mensagem o log saía "falhou: X undefined", que não diz se
    // faltou o campo ou se a falha não tem detalhe.
    return semSegredo(v.erro ?? v.mensagem ?? "sem detalhe").slice(0, 300);
  }

  if (typeof v.failed === "number" && v.failed > 0) {
    const base = `${rotulo}: ${v.failed} de ${v.total ?? "?"} perguntas falharam`;
    return semSegredo(v.primeiroErro ? `${base} (${v.primeiroErro})` : base).slice(0, 300);
  }

  return null;
}
