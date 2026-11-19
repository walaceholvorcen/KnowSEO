import { after } from "next/server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { roboDeIA } from "@/lib/ia-trafego";

// Anota a passagem de um robô de IA por uma página do blog do cliente.
//
// O contador de visitas roda no navegador, e robô não executa JavaScript:
// por isso esta anotação é feita no servidor, pelo cabeçalho do pedido.
//
// A gravação vai para depois da resposta (`after`): o robô não espera o
// banco, e uma falha aqui nunca derruba a página - é medição, não função.
export async function registrarRoboDeIA(
  blogId: string,
  articleId: string | null,
  caminho: string,
): Promise<void> {
  const robo = roboDeIA((await headers()).get("user-agent"));
  if (!robo) return;

  after(async () => {
    const { error } = await createAdminClient().from("analytics_events").insert({
      blog_id: blogId,
      article_id: articleId,
      event_type: "ai_bot",
      agente: robo.agente,
      path: caminho,
    });
    // Antes da migração 0025 o banco recusa o tipo novo: fica só no log.
    if (error) console.warn(`[robô de IA] não gravou ${robo.agente}: ${error.message}`);
  });
}
