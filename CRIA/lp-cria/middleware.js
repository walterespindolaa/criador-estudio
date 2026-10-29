/* Subdomínios das LPs curtas de tráfego (29/10/2026).
   criador.criasocialclub.com.br e socialmedia.criasocialclub.com.br abrem a
   LP de cada público direto na raiz, sem /comecar no endereço.

   Por que middleware: a raiz "/" é um arquivo (index.html, a home) e a Vercel
   serve arquivo antes de olhar os rewrites do vercel.json. O middleware roda
   antes de tudo, então troca o conteúdo da raiz só nesses dois hosts. No
   domínio principal ele não faz nada e a home segue igual.
   O header x-middleware-rewrite é o mesmo que o rewrite() do @vercel/functions
   devolve; usado direto pra não precisar de package.json nesta pasta. */
export const config = { matcher: ["/"] };

const LP = {
  "criador.criasocialclub.com.br": "/lp-criador",
  "socialmedia.criasocialclub.com.br": "/lp-socialmidia",
};

export default function middleware(request) {
  const host = (request.headers.get("host") || "").toLowerCase().split(":")[0];
  const alvo = LP[host];
  if (!alvo) return;
  const atual = new URL(request.url);
  const destino = new URL(alvo, atual.origin);
  destino.search = atual.search;
  return new Response(null, { headers: { "x-middleware-rewrite": destino.toString() } });
}
