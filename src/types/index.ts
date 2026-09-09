// Tipos de linha do banco (mão-escritos, alinhados ao schema em
// supabase/migrations/0001_init.sql). Não são gerados automaticamente -
// se o schema mudar, atualize aqui também.

export type Plan = "free" | "pro" | "agency";
export type MemberRole = "owner" | "editor" | "viewer";
export type DomainStatus = "pending" | "active" | "error";
export type Language = "es" | "pt" | "en";
export type FunnelStage = "top" | "middle" | "bottom";
export type Difficulty = "baja" | "media" | "alta";
export type OpportunityScore = "buena" | "muy_buena" | "excelente";
export type KeywordStatus = "suggested" | "approved" | "rejected" | "written";
export type KeywordSource = "ai" | "dataforseo" | "manual";
export type ArticleStatus = "draft" | "scheduled" | "published";
export type GenerationStatus = "idle" | "generating" | "done" | "error";
export type EventType = "pageview" | "cta_click" | "whatsapp_click";

export interface OnboardingSteps {
  brand_dna: boolean;
  domain_connected: boolean;
  analytics_connected: boolean;
  first_article_published: boolean;
  site_analyzed: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  credits: number;
  onboarding_steps: OnboardingSteps;
  created_at: string;
}

export interface BlogTheme {
  primary_color: string;
  logo_url: string | null;
  tagline: string | null;
}

export interface CtaConfig {
  type: "link" | "whatsapp";
  button_text: string;
  button_url: string | null;
  whatsapp_number: string | null;
}

export interface Blog {
  id: string;
  workspace_id: string;
  name: string;
  subdomain: string;
  custom_domain: string | null;
  domain_status: DomainStatus;
  language: Language;
  theme: BlogTheme;
  cta_config: CtaConfig;
  gsc_property: string | null;
  ga4_property_id: string | null;
  created_at: string;
}

export interface BrandDna {
  blog_id: string;
  description: string | null;
  target_audience: string | null;
  tone: string;
  writing_style: string | null;
  banned_topics: string | null;
  banned_words: string | null;
  updated_at: string;
}

export interface Keyword {
  id: string;
  blog_id: string;
  keyword: string;
  suggested_title: string | null;
  funnel_stage: FunnelStage | null;
  search_volume: number | null;
  difficulty: Difficulty | null;
  opportunity_score: OpportunityScore | null;
  status: KeywordStatus;
  source: KeywordSource;
  created_at: string;
}

export interface Article {
  id: string;
  blog_id: string;
  keyword_id: string | null;
  title: string;
  slug: string;
  excerpt: string | null;
  content_html: string | null;
  cover_image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: ArticleStatus;
  scheduled_at: string | null;
  published_at: string | null;
  generation_status: GenerationStatus;
  carousel_slides: { headline: string; body?: string }[] | null;
  created_at: string;
  updated_at: string;
}

export interface InternalLink {
  id: string;
  blog_id: string;
  url: string;
  title: string | null;
  description: string | null;
  created_at: string;
}

export interface AnalyticsEvent {
  id: number;
  blog_id: string;
  article_id: string | null;
  event_type: EventType;
  path: string | null;
  referrer: string | null;
  visitor_id: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Motor de Visibilidade em IA (GEO)
// ---------------------------------------------------------------------------
export type QueryIntent = "discovery" | "comparison" | "local" | "problem";
export type CitationMatchType = "domain" | "brand" | "none";

export interface AiQuery {
  id: string;
  blog_id: string;
  question: string;
  intent: QueryIntent | null;
  active: boolean;
  source: "ai" | "manual";
  created_at: string;
}

export interface AiVisibilityCheck {
  id: number;
  blog_id: string;
  query_id: string;
  provider: string;
  cited: boolean;
  match_type: CitationMatchType | null;
  position: number | null;
  competitors: string[];
  answer_excerpt: string | null;
  checked_at: string;
}
