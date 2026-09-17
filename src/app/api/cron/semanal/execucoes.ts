import { createAdminClient } from "@/lib/supabase/admin";

// Registro de cada disparo do cron em `cron_execucoes` (migração 0013).
//
// Existe porque a reauditoria de segunda passou semanas sem rodar e ninguém
// tinha como saber: o log da Vercel some, e "nenhuma auditoria agendada" na
// tela não distingue "o cron não disparou" de "disparou e não achou nada
// vencido". Com o registro, a tela afirma quando rodou e quantas tarefas
// falharam.
//
// Só no servidor: usa o client admin (a tabela não tem policy de leitura, de
// propósito - o log cita blogs de todos os clientes). Nunca importar em
// componente "use client".

export interface ExecucaoCron {
  iniciada_em: string;
  terminada_em: string | null;
  tarefas: number | null;
  falhas: number | null;
}

// Nenhuma função aqui lança: registrar é acessório. Se a 0013 não foi
// aplicada, o cron segue auditando e só avisa no log - quebrar o
// acompanhamento por falta da tabela de log seria trocar o problema de lugar.

export async function abrirExecucao(rota: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from("cron_execucoes")
    .insert({ rota })
    .select("id")
    .single();
  if (error) {
    console.warn(`[cron] sem registro de execução (migração 0013?): ${error.message}`);
    return null;
  }
  return (data as { id: string }).id;
}

export async function fecharExecucao(
  id: string | null,
  campos: { tarefas: number; falhas: number; detalhe: unknown },
): Promise<void> {
  if (!id) return;
  const { error } = await createAdminClient()
    .from("cron_execucoes")
    .update({ ...campos, terminada_em: new Date().toISOString() })
    .eq("id", id);
  if (error) console.warn(`[cron] não fechou o registro ${id}: ${error.message}`);
}

/** Último disparo do acompanhamento semanal, ou null se nunca rodou (ou se a
 *  tabela ainda não existe - para a tela, dá no mesmo). */
export async function ultimaExecucaoDoCron(): Promise<ExecucaoCron | null> {
  const { data, error } = await createAdminClient()
    .from("cron_execucoes")
    .select("iniciada_em,terminada_em,tarefas,falhas")
    .eq("rota", "/api/cron/semanal")
    .order("iniciada_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data as ExecucaoCron | null;
}
