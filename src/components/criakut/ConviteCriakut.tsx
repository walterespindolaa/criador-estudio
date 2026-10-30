import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Eye, Inbox, Hourglass } from "lucide-react";
import { useConviteCriakut } from "@/hooks/usePortfolioCria";
import { ROTULO_PAPEL } from "@/hooks/useParceiro";
import { iniciais } from "@/lib/criakut";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   CONVITE DO CRIAKUT NA HOME (Walter, 30/10/2026, mockup aprovado)

   Criador: no FINAL da home ("social mídia, designer e editor te acham por
   aqui"). Prestador: no TOPO da home dele, já preenchido com o que o sistema
   sabe (papel, peças entregues pelo Cria). Enquanto a página não está
   publicada, mostra o que falta; publicada, vira um cartão de resultados.
   "Agora não" esconde por 30 dias neste navegador.
   ═══════════════════════════════════════════════════════════════════════════ */

const CHAVE = "cria-convite-criakut-ate";
const escondido = () => {
  try { return Number(localStorage.getItem(CHAVE) ?? 0) > Date.now(); } catch { return false; }
};
const esconder30 = () => {
  try { localStorage.setItem(CHAVE, String(Date.now() + 30 * 86400000)); } catch { /* sem storage: só some nesta tela */ }
};

type Props = {
  variante: "criador" | "prestador";
  /** Criador: nicho do brandbook e se tem tom definido (o card não busca de novo). */
  nicho?: string | null;
  temTom?: boolean;
  nomeFallback?: string | null;
  fotoFallback?: string | null;
  className?: string;
};

function Item({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-[13px]">
      {ok
        ? <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-white text-primary"><Check className="h-3 w-3" strokeWidth={3} /></span>
        : <span className="h-[18px] w-[18px] shrink-0 rounded-full border-2 border-white/70" />}
      <span className={cn(!ok && "opacity-90")}>{children}</span>
    </li>
  );
}

export function ConviteCriakut({ variante, nicho, temTom, nomeFallback, fotoFallback, className }: Props) {
  const navigate = useNavigate();
  const { data: c } = useConviteCriakut();
  const [fechado, setFechado] = useState(escondido);
  if (!c) return null;

  const nome = c.nome || nomeFallback || "Você";
  const foto = c.foto_url || fotoFallback;
  const papel = c.papel ? ROTULO_PAPEL[c.papel] ?? c.papel : null;
  const abrir = () => navigate(c.base || (variante === "prestador" ? "/socialmidia/criakut" : "/app/criakut"));

  // Página publicada: cartão de resultados, sempre visível (não tem "agora não").
  if (c.publicado) {
    return (
      <section className={cn("rounded-[22px] border border-primary/20 bg-primary/[0.06] p-4 sm:p-5", className)}>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Sua página no Criakut</p>
            <p className="font-display text-[17px] font-bold leading-tight">Quem passou por lá nos últimos 30 dias</p>
          </div>
          <button type="button" onClick={abrir} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90">
            Ver minha página <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-card px-3 py-2"><Eye className="h-3.5 w-3.5 text-muted-foreground" /><b className="block font-display text-xl">{c.visitas_30d}</b><span className="text-[11px] text-muted-foreground">visitas</span></div>
          <div className="rounded-xl bg-card px-3 py-2"><Inbox className="h-3.5 w-3.5 text-muted-foreground" /><b className="block font-display text-xl">{c.pedidos_30d}</b><span className="text-[11px] text-muted-foreground">pedidos de orçamento</span></div>
          {variante === "prestador" && (
            <div className="rounded-xl bg-card px-3 py-2"><Hourglass className="h-3.5 w-3.5 text-muted-foreground" /><b className="block font-display text-xl">{c.portfolio_aguardando}</b><span className="text-[11px] text-muted-foreground">peças esperando liberação</span></div>
          )}
        </div>
      </section>
    );
  }

  if (fechado) return null;

  const itens = variante === "criador"
    ? [
        { ok: !!nicho && !!temTom, txt: "Nicho e tom (do brandbook)" },
        { ok: c.seguidores != null, txt: c.seguidores != null ? `${c.seguidores.toLocaleString("pt-BR")} seguidores no Instagram` : "Instagram conectado" },
        { ok: c.tem_capa, txt: "Foto de capa" },
        { ok: c.tem_busco, txt: "O que você procura (social mídia, edição…)" },
      ]
    : [
        { ok: !!papel, txt: papel ? `${papel} (do seu vínculo com as agências)` : "Sua especialidade" },
        { ok: c.entregas_no_cria > 0, txt: `${c.entregas_no_cria} ${c.entregas_no_cria === 1 ? "peça entregue" : "peças entregues"} pelo Cria` },
        { ok: c.portfolio >= 3, txt: c.portfolio_aguardando > 0 ? `Portfólio: ${c.portfolio} no ar, ${c.portfolio_aguardando} esperando liberação` : "Escolher peças pro portfólio" },
        { ok: c.servicos > 0 && !!c.cidade, txt: "Preço de partida e cidade" },
      ];
  const pct = Math.round((itens.filter((i) => i.ok).length / itens.length) * 100);

  return (
    <section className={cn("grid gap-5 rounded-[22px] bg-gradient-to-br from-primary to-[hsl(140,30%,38%)] p-5 text-primary-foreground md:grid-cols-[1.3fr_1fr] md:items-center", className)}>
      <div>
        <span className="inline-block rounded-full bg-white px-2.5 py-0.5 text-[10.5px] font-bold text-primary">CRIAKUT</span>
        <h3 className="mt-2 font-display text-[21px] font-extrabold leading-tight">
          {variante === "criador" ? "Social mídia, designer e editor te acham por aqui" : "Mostre seu trabalho pra quem contrata"}
        </h3>
        <p className="mt-1.5 text-[13px] opacity-90">
          {variante === "criador"
            ? "Sua página fica pronta em 2 minutos: o Cria já sabe seu nicho e seus números. Você só confere e publica."
            : "Social mídias e criadoras procuram prestador no Criakut. Sua página já sai com o que você faz aqui dentro."}
        </p>
        <ul className="mt-3 space-y-1.5">{itens.map((i) => <Item key={i.txt} ok={i.ok}>{i.txt}</Item>)}</ul>
        {variante === "prestador" && (
          <>
            <div className="mt-3 h-1.5 rounded-full bg-white/25"><div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} /></div>
            <p className="mt-1 text-[11.5px] opacity-85">{pct}% pronta</p>
          </>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={abrir} className="rounded-full bg-white px-4 py-2 text-[13px] font-bold text-primary hover:bg-white/90">
            {c.tem_pagina ? "Continuar minha página" : "Montar minha página"}
          </button>
          <button type="button" onClick={() => { esconder30(); setFechado(true); }} className="rounded-full border border-white/50 px-4 py-2 text-[13px] font-bold hover:bg-white/10">
            Agora não
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl bg-card text-foreground">
        {c.capa_url
          ? <img src={c.capa_url} alt="" className="h-14 w-full object-cover" />
          : <div className="h-14 bg-gradient-to-r from-[#E8622C] to-[#f2a76d]" />}
        <div className="px-3 pb-3">
          {foto
            ? <img src={foto} alt="" className="-mt-6 h-12 w-12 rounded-full border-[3px] border-card object-cover" />
            : <span className="-mt-6 grid h-12 w-12 place-items-center rounded-full border-[3px] border-card bg-primary font-extrabold text-primary-foreground">{iniciais(nome)}</span>}
          <b className="mt-1 block font-display text-[16px]">{nome}{variante === "prestador" && papel ? ` · ${papel}` : ""}</b>
          <p className="text-[12px] text-muted-foreground">
            {[variante === "criador" ? "Criador" : null, variante === "criador" ? nicho : null, c.cidade].filter(Boolean).join(" · ") || "Sua página no Criakut"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
            {variante === "criador" && c.seguidores != null && <span className="rounded-full border border-border px-2 py-0.5">{c.seguidores.toLocaleString("pt-BR")} seguidores</span>}
            {variante === "prestador" && c.entregas_no_cria > 0 && <span className="rounded-full border border-border px-2 py-0.5">{c.entregas_no_cria} peças entregues</span>}
            {variante === "prestador" && <span className="rounded-full border border-border px-2 py-0.5">{c.preco_min_centavos ? `a partir de ${(c.preco_min_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}` : "a partir de R$ —"}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ConviteCriakut;
