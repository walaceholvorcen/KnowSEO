import type { PlaceProfile } from "./types";

// Places API (New) - só busca dados públicos, sem o cliente autorizar nada.
// Diferente da Business Profile API (que exige OAuth por cliente e
// aprovação de acesso do Google), esta chave é só do nosso projeto no
// Google Cloud, com faturamento ativado.
//
// Por isso o que dá para auditar é limitado ao que é público: não existe
// aqui "descrição do negócio" nem "serviços cadastrados" nem se o dono
// respondeu alguma avaliação - só a Business Profile API vê isso.
const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

// Pedimos só os campos que as regras usam. Cada campo aqui tem custo na
// cobrança do Google Maps Platform - pedir mais do que usamos é dinheiro
// jogado fora em toda auditoria.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.googleMapsUri",
  "places.businessStatus",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.currentOpeningHours",
  "places.rating",
  "places.userRatingCount",
  "places.photos",
  "places.primaryTypeDisplayName",
].join(",");

export function isGbpConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

export const GBP_NOT_CONFIGURED_MESSAGE =
  "Auditoria de Google Meu Negócio desativada: falta configurar a chave da API de Places no ambiente.";

interface PlaceApiResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  currentOpeningHours?: { weekdayDescriptions?: string[] };
  rating?: number;
  userRatingCount?: number;
  photos?: unknown[];
}

function toProfile(r: PlaceApiResult): PlaceProfile {
  return {
    placeId: r.id,
    name: r.displayName?.text ?? "(sem nome)",
    address: r.formattedAddress ?? null,
    mapsUri: r.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${r.id}`,
    businessStatus:
      r.businessStatus === "CLOSED_TEMPORARILY" ||
      r.businessStatus === "CLOSED_PERMANENTLY"
        ? r.businessStatus
        : "OPERATIONAL",
    phone: r.nationalPhoneNumber ?? null,
    website: r.websiteUri ?? null,
    hasOpeningHours: Boolean(r.currentOpeningHours?.weekdayDescriptions?.length),
    rating: r.rating ?? null,
    reviewCount: r.userRatingCount ?? 0,
    photoCount: r.photos?.length ?? 0,
    primaryType: null,
  };
}

// Devolve o primeiro resultado (mais relevante) para a busca de texto, ou
// null se não achar nada. O chamador mostra nome + endereço encontrados
// para o cliente confirmar que é o negócio certo antes de confiar na nota.
export async function findPlace(query: string): Promise<PlaceProfile | null> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY ?? "",
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: query, languageCode: "pt-BR" }),
  });

  if (!res.ok) {
    throw new Error(`Places API respondeu ${res.status}`);
  }

  const data = (await res.json()) as { places?: PlaceApiResult[] };
  const first = data.places?.[0];
  return first ? toProfile(first) : null;
}
