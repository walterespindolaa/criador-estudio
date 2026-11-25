import type { ReactNode } from "react";
import { MessageSquare, Repeat2, Send, ThumbsUp } from "lucide-react";
import { posicaoCorte } from "@/components/kanban/LinkedInLegenda";

/* ═══════════════════════════════════════════════════════════════════════════
   POST COM CARA DE LINKEDIN (mockup aprovado em 25/11/2026)

   Walter, 25/11/2026: "a parte de preview". Um cartão só, usado no editor do
   criador, no Cria Post da social mídia e no portal de aprovação do cliente,
   pra post de LinkedIn não aparecer com cara de Instagram. O texto corta onde
   o feed corta ("ver mais", ver LinkedInLegenda) e a hashtag fica azul. A
   mídia vem pronta de quem chama (cada tela tem seu carrossel).
   ═══════════════════════════════════════════════════════════════════════════ */

export function MolduraLinkedIn({ nome, avatarUrl, texto, children, vazio = "O texto do post aparece aqui" }: {
  nome: string;
  avatarUrl?: string | null;
  texto?: string | null;
  children?: ReactNode;
  vazio?: string;
}) {
  const t = (texto ?? "").trim();
  const corte = t ? posicaoCorte(t) : null;
  const visivel = corte === null ? t : t.slice(0, corte).trimEnd();
  const inicial = (nome || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="bg-[#F4F2EE] p-2">
      <div className="overflow-hidden rounded-lg border border-[#E0DFDC] bg-white text-[#1d1d1d]" style={{ fontFamily: "-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif" }}>
        <div className="flex gap-2 px-3 pt-3 pb-1.5">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#0A66C2]/15 grid place-items-center">
            <span className="text-xs font-bold text-[#0A66C2]">{inicial}</span>
            {avatarUrl?.trim() && <img src={avatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{nome}</p>
            <p className="text-[11px] text-[#666]">Agora · 🌐</p>
          </div>
        </div>
        {t ? (
          <p className="whitespace-pre-line px-3 pb-2.5 text-[13px] leading-[1.43]">
            {visivel.split(/(#[\p{L}\p{N}_]+)/u).map((p, i) => p.startsWith("#") ? <span key={i} className="font-semibold text-[#0A66C2]">{p}</span> : p)}
            {corte !== null && <span className="text-[#666]">…ver mais</span>}
          </p>
        ) : <p className="px-3 pb-2.5 text-[12px] italic text-[#999]">{vazio}</p>}
        {children}
        {/* Sem contagem de reações e comentários: eram números inventados ("128",
            "24 comentários") e pareciam dado real (Walter, 25/11/2026). */}
        <div className="flex justify-around border-t border-[#E8E8E8] px-1 py-2 text-[11.5px] font-semibold text-[#5e5e5e]">
          <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" />Gostei</span>
          <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />Comentar</span>
          <span className="flex items-center gap-1"><Repeat2 className="h-3.5 w-3.5" />Compartilhar</span>
          <span className="flex items-center gap-1"><Send className="h-3.5 w-3.5" />Enviar</span>
        </div>
      </div>
    </div>
  );
}
