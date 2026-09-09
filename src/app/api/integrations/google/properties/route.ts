import { NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";
import { listarPropriedades } from "@/lib/google/search-console";
import { listarPropriedadesGa4 } from "@/lib/google/ga4";

// Lista o que a conta conectada enxerga, para preencher os dois seletores
// da tela de Integrações. Chamado uma vez ao abrir a tela - não guarda
// nada, só mostra as opções.
export async function GET() {
  const { workspace } = await requireUserAndWorkspace();

  try {
    const [gsc, ga4] = await Promise.all([
      listarPropriedades(workspace.id),
      listarPropriedadesGa4(workspace.id),
    ]);
    return NextResponse.json({ gsc, ga4 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "falha ao listar" },
      { status: 502 },
    );
  }
}
