import { useEffect, useState } from "react";
import { Loader2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  conectarRede, estadoConexaoRede, NOME_REDE, useConexoesProprias, useDesconectarRede,
  type ConexaoPropria, type RedeNova,
} from "@/hooks/usePublicarRedes";

/* ═══════════════════════════════════════════════════════════════════════════
   REDES PRA PUBLICAR (Configurações > Conexões). Mockup aprovado em 25/11/2026.

   Walter, 25/11/2026: "precisamos ajustar a conexao com o youtube, a conexao
   com linkedin etc". Ele não achava onde conectar o YouTube: só dava por
   dentro do post. Aqui ficam as contas DA conta (as dos clientes continuam na
   ficha do cliente). Só o master vê enquanto a publicação está em teste; o
   redes-oauth também barra quem não é master.
   ═══════════════════════════════════════════════════════════════════════════ */

const ORDEM: RedeNova[] = ["youtube", "tiktok", "linkedin"];
const ICONE: Record<RedeNova, { txt: string; cls: string }> = {
  youtube: { txt: "YT", cls: "bg-[#E62117]" },
  tiktok: { txt: "TT", cls: "bg-[#111]" },
  linkedin: { txt: "in", cls: "bg-[#0A66C2]" },
};

const dataCurta = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";

function BlocoRede({ rede, c, onDesconectar, desconectando }: { rede: RedeNova; c: ConexaoPropria | null; onDesconectar: () => void; desconectando: boolean }) {
  const [indo, setIndo] = useState(false);
  const nome = NOME_REDE[rede];
  const conectar = async () => { setIndo(true); await conectarRede(rede, null); setIndo(false); };
  const est = c ? estadoConexaoRede(c) : null;
  const alerta = !!est && (est.vencida || est.perto);

  let linha = "Não conectado";
  if (c && est) {
    const quem = c.username ? ` · ${c.username}` : "";
    if (est.vencida) linha = `Conexão vencida${quem}`;
    else if (est.perto) linha = `Vence em ${Math.max(est.dias ?? 0, 0)} dia${est.dias === 1 ? "" : "s"}${quem}`;
    else linha = `Conectado${quem}${rede === "linkedin" && est.venceEm ? ` · vale até ${dataCurta(est.venceEm)}` : ""}`;
  }

  return (
    <div className={cn("rounded-xl border p-3 space-y-2.5",
      alerta ? "border-amber-300 bg-amber-50" : c ? "border-primary/20 bg-primary/5" : "border-border")}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn("h-10 w-10 shrink-0 rounded-full grid place-items-center text-white text-[13px] font-body font-bold", ICONE[rede].cls)}>{ICONE[rede].txt}</div>
        <div className="min-w-0">
          <p className="text-sm font-body font-semibold text-foreground">{nome}</p>
          <p className={cn("text-xs font-body truncate", alerta ? "text-amber-800 font-bold" : c ? "text-emerald-700 font-bold" : "text-muted-foreground")}>{linha}</p>
        </div>
      </div>
      {c && rede === "linkedin" && !alerta && (
        <p className="text-[11.5px] font-body text-muted-foreground leading-snug">O LinkedIn não renova sozinho: a cada 60 dias você reconecta. O Cria avisa 7 dias antes.</p>
      )}
      {c && rede !== "linkedin" && !alerta && (
        <p className="text-[11.5px] font-body text-muted-foreground leading-snug">Renova sozinho. Só precisa reconectar se você tirar o acesso na conta da rede.</p>
      )}
      {est?.perto && (
        <p className="rounded-lg bg-amber-100 px-2.5 py-2 text-[12px] font-body text-amber-900 leading-snug">Posts agendados no LinkedIn depois de {dataCurta(est.venceEm)} não saem se a conexão vencer. Reconecte agora pra ganhar mais 60 dias.</p>
      )}
      {est?.vencida && (
        <p className="rounded-lg bg-amber-100 px-2.5 py-2 text-[12px] font-body text-amber-900 leading-snug">Posts agendados pro {nome} ficam parados até você reconectar.</p>
      )}
      <div className="flex gap-2 [&>button]:flex-1">
        {(!c || alerta) && (
          <Button variant="hero" size="sm" disabled={indo} onClick={() => void conectar()}>
            {indo ? <Loader2 className="h-4 w-4 animate-spin" /> : c ? "Reconectar" : `Conectar ${nome}`}
          </Button>
        )}
        {c && (
          <Button variant="outline" size="sm" disabled={desconectando} onClick={onDesconectar}>
            <Unplug className="h-4 w-4 mr-2" /> Desconectar
          </Button>
        )}
      </div>
    </div>
  );
}

export function RedesParaPublicar({ userId }: { userId: string | null | undefined }) {
  const lista = useConexoesProprias(userId);
  const desconectar = useDesconectarRede(userId);

  // Volta do login da rede: avisa e limpa a URL (mesma regra da caixa do post).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const r = q.get("rede"); const c = q.get("conexao");
    if (!r || !c) return;
    if (c === "ok") toast.success(`${NOME_REDE[r as RedeNova] ?? "Rede"} conectado.`);
    else toast.error(`Não deu pra conectar: ${q.get("m") ?? "tente de novo"}`);
    q.delete("rede"); q.delete("conexao"); q.delete("m");
    window.history.replaceState(null, "", window.location.pathname + (q.toString() ? `?${q}` : ""));
  }, []);

  const porRede = (r: RedeNova) => (lista.data ?? []).find((c) => c.provider === r) ?? null;

  return (
    <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
      <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
        Redes pra publicar
        <span className="text-[10.5px] font-body font-bold rounded-full px-2 py-0.5 bg-amber-100 text-amber-900">teste · só master</span>
      </h3>
      <p className="text-sm text-muted-foreground font-body leading-relaxed">Ligue as contas onde o Cria vai publicar por você. Cada rede pede o login dela uma vez.</p>
      {lista.isLoading
        ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        : (
          <div className="space-y-2.5">
            {ORDEM.map((r) => {
              const c = porRede(r);
              return <BlocoRede key={r} rede={r} c={c} desconectando={desconectar.isPending} onDesconectar={() => c && desconectar.mutate(c)} />;
            })}
          </div>
        )}
    </div>
  );
}
