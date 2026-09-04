// Detecção de link de WhatsApp colado no campo de URL.
//
// O CTA tem dois tipos e cada um grava um evento diferente: "link" vira
// cta_click, "whatsapp" vira whatsapp_click. Quem cola um link do WhatsApp
// no campo de URL e deixa o tipo em "Link" continua com um botão que
// funciona - mas o relatório passa a contar conversa de WhatsApp como
// clique genérico. O número fica certo na tela e errado no dado.

const HOSTS_WHATSAPP = [
  "wa.me",
  "api.whatsapp.com",
  "web.whatsapp.com",
  "whatsapp.com",
  "chat.whatsapp.com",
];

// Devolve só os dígitos do número, ou null se a URL não for do WhatsApp.
export function numeroWhatsAppNaUrl(url: string): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (!HOSTS_WHATSAPP.includes(host)) return null;

  // Duas formas convivem: wa.me/<numero> e .../send?phone=<numero>.
  const doCaminho = parsed.pathname.replace(/\D/g, "");
  const doParametro = (parsed.searchParams.get("phone") ?? "").replace(
    /\D/g,
    "",
  );

  const numero = doParametro || doCaminho;

  // Convite de grupo (chat.whatsapp.com/<codigo>) não tem número: o código
  // vira uma sequência de dígitos sem sentido se não filtrarmos aqui.
  if (host === "chat.whatsapp.com") return null;

  // Menor que isso não é telefone com código de país.
  return numero.length >= 8 ? numero : null;
}

// Normaliza o domínio próprio para hostname puro.
//
// resolveBlogByHost() compara o host da requisição com custom_domain. Se o
// campo guardar "https://cliente.com/", a comparação nunca casa e o domínio
// próprio simplesmente não funciona - sem erro em lugar nenhum.
export function normalizarDominio(valor: string): string {
  const limpo = valor.trim().toLowerCase();
  if (!limpo) return "";

  const semEsquema = limpo.replace(/^[a-z]+:\/\//, "");
  return semEsquema.split("/")[0].replace(/\.$/, "");
}
