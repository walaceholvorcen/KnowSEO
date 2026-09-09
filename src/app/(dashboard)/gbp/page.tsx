import { GbpLocked } from "./gbp-locked";

// Tipos mantidos aqui porque gbp-board.tsx (guardado para quando o módulo
// for reativado) ainda os importa deste arquivo.
export interface GbpAuditRow {
  id: string;
  query: string;
  status: string;
  place_name: string | null;
  place_address: string | null;
  maps_uri: string | null;
  score: number | null;
  created_at: string;
}

export interface GbpFindingRow {
  id: number;
  audit_id: string;
  code: string;
  severity: string;
  title: string;
  impact: string | null;
  evidence: string | null;
  fix: string | null;
}

// Módulo construído e testado, guardado como upsell: reativar é trocar
// <GbpLocked /> por <GbpBoard /> (buscando audits/findings como antes,
// ver histórico do arquivo) - nenhuma lógica foi apagada.
export default async function GbpPage() {
  return <GbpLocked />;
}
