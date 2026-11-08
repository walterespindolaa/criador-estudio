import { iaFetch, IA_URL } from "./ia.ts";

/* LEITURA DAS RESPOSTAS DE E-MAIL (30/10/2026). Usada pelo email-entrada
   (quando a resposta chega) e pelo email-responder ("Refazer rascunho"). */

export const CATEGORIAS = ["motivo_saida", "quer_voltar", "duvida", "problema", "pedido_funcao", "elogio", "outro"];

export type Conta = { id: string; name: string | null; account_type: string | null; subscription_status: string | null; n_posts: number; n_ideias: number };

export async function lerResposta(a: { assunto: string | null; nome: string | null; texto: string; conta?: Conta | null; pedido?: string | null }) {
  let categoria = "outro", resumo: string | null = null, sugestao: string | null = null;
  const contexto = a.conta
    ? `Conta no Cria: tipo ${a.conta.account_type ?? "criador"}, assinatura ${a.conta.subscription_status ?? "nenhuma"}, ${a.conta.n_ideias} ideias, ${a.conta.n_posts} posts.`
    : "Remetente sem conta encontrada no Cria.";
  const r = await iaFetch(IA_URL, {
    method: "POST",
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content:
          "Você lê respostas de e-mail que clientes mandam pro Cria Social Club (app de produção de conteúdo pra criadores e social mídias). " +
          "Os e-mails foram assinados por Gabi e Walter, os fundadores. Responda só JSON: " +
          `{"categoria": um de ${JSON.stringify(CATEGORIAS)}, "resumo": uma frase curta do que a pessoa disse, ` +
          `"sugestao": rascunho de resposta em português do Brasil, primeira pessoa do plural, assinado "Gabi e Walter", ` +
          "tom próximo e direto, no máximo 5 frases, sem travessão, sem prometer prazo nem desconto que a pessoa não pediu}." +
          (a.pedido ? ` Ajuste pedido pra este rascunho: ${a.pedido}` : "") },
        { role: "user", content: `${contexto}\nAssunto: ${a.assunto ?? ""}\nNome: ${a.nome ?? a.conta?.name ?? ""}\n\nMensagem:\n${a.texto.slice(0, 3000)}` },
      ],
    }),
  }, { funcao: "email-resposta", contaId: a.conta?.id ?? null });
  if (!r.ok) throw new Error(`ia ${r.status}`);
  const j = await r.json();
  const o = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
  if (CATEGORIAS.includes(o.categoria)) categoria = o.categoria;
  resumo = typeof o.resumo === "string" ? o.resumo.slice(0, 300) : null;
  sugestao = typeof o.sugestao === "string" ? o.sugestao.slice(0, 2000) : null;
  return { categoria, resumo, sugestao };
}
