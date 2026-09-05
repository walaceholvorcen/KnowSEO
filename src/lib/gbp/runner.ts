import { findPlace } from "./places";
import { runRules, computeScore } from "./rules";
import type { Finding, PlaceProfile } from "./types";

export interface GbpAuditResult {
  profile: PlaceProfile;
  findings: Finding[];
  score: number;
}

// null quando a busca não encontra o negócio - diferente de "encontrou mas
// está com problema", que é o caminho normal dos achados.
export async function auditProfile(
  query: string,
): Promise<GbpAuditResult | null> {
  const profile = await findPlace(query);
  if (!profile) return null;

  const findings = runRules(profile);
  return { profile, findings, score: computeScore(findings) };
}
