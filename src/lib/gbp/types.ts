export type Severity = "critical" | "high" | "medium" | "quick_win" | "info";

export interface Finding {
  code: string;
  severity: Severity;
  title: string;
  impact: string;
  evidence: string;
  fix: string;
}

// Sinais do perfil, extraídos da Places API (New). Só campos públicos, sem
// login do dono - por isso não existe "descrição" nem "serviços" aqui: são
// dados que só a Business Profile API expõe, com OAuth por cliente.
//
// Regras recebem isto e nada mais - sem rede, sem SDK. É o que torna a
// pontuação testável com objeto fixo, no mesmo espírito das regras de SEO.
export interface PlaceProfile {
  placeId: string;
  name: string;
  address: string | null;
  mapsUri: string;
  businessStatus: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | null;
  phone: string | null;
  website: string | null;
  hasOpeningHours: boolean;
  rating: number | null;
  reviewCount: number;
  photoCount: number;
  primaryType: string | null;
}
