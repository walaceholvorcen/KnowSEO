import type { MetadataRoute } from "next";

// robots.txt do APP. Cada blog tem o seu, separado, em
// src/app/sites/[domain]/robots.txt - aquele libera tudo, porque o blog
// existe para ser encontrado.
//
// Este existe por uma regra de produto: nada do cliente vive junto do nosso
// domínio. O caminho /b/<cliente> é prévia para a agência conferir o blog
// antes de o endereço do cliente estar de pé; não é endereço público e não
// pode ser indexado embaixo da nossa marca. Até aqui o app não tinha
// robots.txt nenhum (404) e /b/ respondia 200 para qualquer rastreador.
//
// Vale só para o nosso host: num host de cliente o proxy manda /robots.txt
// para o robots daquele blog, que segue liberado.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: ["/b/", "/api/"] }],
  };
}
