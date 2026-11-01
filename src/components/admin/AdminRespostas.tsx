import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   CAIXA DE RESPOSTAS (01/11/2026, mockup aprovado)

   Os e-mails de "quem parou" saem assinados por Gabi e Walter, com reply-to
   num domínio que o Resend recebe. O edge email-entrada grava cada resposta
   em email_respostas, já lida pela IA (assunto, resumo, rascunho). Aqui o
   admin lê, edita o rascunho e manda (edge email-responder). Nada sai sozinho.
   Em cima, a faixa "por que as pessoas saem" (RPC admin_reengajamento_resumo).
   As tabelas são novas e não estão no types.ts (travado): cliente sem tipo.
   ═══════════════════════════════════════════════════════════════════════════ */

const db = supabase as unknown as SupabaseClient;

type Resposta = {
  id: string; recebido_em: string; de_email: string; de_nome: string | null; user_id: string | null;
  assunto: string | null; texto: string | null; categoria: string | null; resumo: string | null;
  sugestao: string | null; status: "nova" | "respondida" | "arquivada"; resposta: string | null; respondido_em: string | null;
};
type Resumo = {
  motivos: Record<string, number>; categorias: Record<string, number>;
  enviados_30d: number; responderam_30d: number; voltaram_30d: number;
};

const CAT: Record<string, { rotulo: string; cor: string }> = {
  motivo_saida: { rotulo: "motivo de saída", cor: "bg-[#FDE7DC] text-[#B4441A]" },
  duvida: { rotulo: "dúvida", cor: "bg-[#FCF0DC] text-[#8a5a0c]" },
  quer_voltar: { rotulo: "quer voltar", cor: "bg-[#E6F0E8] text-[#2E5A3A]" },
  pedido_funcao: { rotulo: "pedido de função", cor: "bg-[#EEE8FB] text-[#6D4AC7]" },
  problema: { rotulo: "problema", cor: "bg-red-100 text-red-700" },
  elogio: { rotulo: "elogio", cor: "bg-[#EDEAE6] text-[#5d554e]" },
  outro: { rotulo: "outro", cor: "bg-[#EDEAE6] text-[#5d554e]" },
};
const MOTIVO: Record<string, string> = {
  caro: "Ficou caro", sem_tempo: "Não tive tempo de usar", faltou_funcao: "Faltou uma função",
  outra_ferramenta: "Fui pra outra ferramenta", outro: "Outro motivo",
};
const Etiqueta = ({ c }: { c: string | null }) => {
  const x = CAT[c ?? "outro"] ?? CAT.outro;
  return <span className={cn("text-[10.5px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap", x.cor)}>{x.rotulo}</span>;
};
const quando = (d: string) => formatDistanceToNow(new Date(d), { locale: ptBR, addSuffix: true });

export function AdminRespostas({ aoAbrirConta }: { aoAbrirConta?: (id: string) => void }) {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<Resposta["status"]>("nova");
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ["admin-respostas"],
    queryFn: async () => {
      const { data, error } = await db.from("email_respostas").select("*").order("recebido_em", { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []) as Resposta[];
    },
  });
  const { data: resumo } = useQuery({
    queryKey: ["admin-respostas-resumo"],
    queryFn: async () => {
      const { data, error } = await db.rpc("admin_reengajamento_resumo");
      if (error) throw error;
      return data as Resumo;
    },
  });

  const contagem = useMemo(() => ({
    nova: lista.filter((r) => r.status === "nova").length,
    respondida: lista.filter((r) => r.status === "respondida").length,
    arquivada: lista.filter((r) => r.status === "arquivada").length,
  }), [lista]);
  const visiveis = lista.filter((r) => r.status === filtro);
  const aberta = lista.find((r) => r.id === abertaId) ?? null;

  useEffect(() => { setRascunho(aberta?.status === "respondida" ? aberta.resposta ?? "" : aberta?.sugestao ?? ""); }, [aberta?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const recarregar = () => {
    for (const k of ["admin-respostas", "admin-respostas-resumo", "admin-respostas-novas"]) qc.invalidateQueries({ queryKey: [k] });
  };

  const mandar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("email-responder", { body: { id: aberta!.id, texto: rascunho } });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Resposta enviada"); recarregar(); },
    onError: () => toast.error("Não consegui mandar. Tenta de novo."),
  });
  const refazer = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("email-responder", { body: { id: aberta!.id, refazer: true } });
      if (error) throw error;
      return (data as { sugestao?: string | null })?.sugestao ?? "";
    },
    onSuccess: (s) => { if (s) setRascunho(s); recarregar(); },
    onError: () => toast.error("A IA não respondeu agora. Tenta de novo."),
  });
  const mudarStatus = useMutation({
    mutationFn: async (status: Resposta["status"]) => {
      const { error } = await db.from("email_respostas").update({ status }).eq("id", aberta!.id);
      if (error) throw error;
    },
    onSuccess: () => { recarregar(); setAbertaId(null); },
    onError: () => toast.error("Não consegui atualizar."),
  });

  const motivos = Object.entries(resumo?.motivos ?? {}).sort((a, b) => b[1] - a[1]);
  const maxMotivo = Math.max(1, ...motivos.map(([, n]) => n));
  const categorias = Object.entries(resumo?.categorias ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      {/* Por que as pessoas saem */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-display font-bold text-[15px]">Motivos de saída</p>
          {motivos.length === 0 ? <p className="text-xs text-muted-foreground mt-2">Ninguém clicou num motivo ainda.</p> : motivos.map(([m, n]) => (
            <div key={m} className="mt-2.5 text-[13px]">
              <div className="flex justify-between"><span>{MOTIVO[m] ?? m}</span><span className="text-muted-foreground">{n}</span></div>
              <div className="mt-1 h-2.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-[#CE4A1D]" style={{ width: `${(n / maxMotivo) * 100}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-display font-bold text-[15px]">Respostas por assunto</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {categorias.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma resposta nos últimos 90 dias.</p>
              : categorias.map(([c, n]) => <span key={c} className={cn("text-[11px] font-bold rounded-full px-2 py-0.5", (CAT[c] ?? CAT.outro).cor)}>{(CAT[c] ?? CAT.outro).rotulo} {n}</span>)}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-display font-bold text-[15px]">E-mails enviados</p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Últimos 30 dias: {resumo?.enviados_30d ?? 0} enviados, {resumo?.responderam_30d ?? 0} responderam
            {resumo?.enviados_30d ? ` (${Math.round(((resumo.responderam_30d ?? 0) / resumo.enviados_30d) * 100)}%)` : ""}, {resumo?.voltaram_30d ?? 0} assinaram depois.
          </p>
        </div>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[340px_1fr]">
        {/* Lista */}
        <div className={cn("rounded-2xl border border-border bg-card p-3", aberta && "hidden lg:block")}>
          <div className="inline-flex rounded-full bg-muted p-1 gap-1 text-[12.5px] font-bold">
            {(["nova", "respondida", "arquivada"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setFiltro(s)}
                className={cn("rounded-full px-3 py-1.5", filtro === s ? "bg-card shadow-sm" : "text-muted-foreground")}>
                {s === "nova" ? `Novas ${contagem.nova}` : s === "respondida" ? "Respondidas" : "Arquivadas"}
              </button>
            ))}
          </div>
          <div className="mt-2">
            {isLoading ? <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
              : visiveis.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">{filtro === "nova" ? "Nenhuma resposta nova." : "Nada aqui."}</p>
              : visiveis.map((r) => (
                <button key={r.id} type="button" onClick={() => setAbertaId(r.id)}
                  className={cn("w-full text-left border-b border-border/60 last:border-0 px-1 py-2.5 text-[13.5px]", r.id === abertaId && "bg-muted/60 rounded-xl px-2.5")}>
                  <div className="flex items-center gap-2">
                    {r.status === "nova" && <span className="h-2 w-2 rounded-full bg-[#CE4A1D] shrink-0" />}
                    <b className={cn("truncate", r.status !== "nova" && "font-medium")}>{r.de_nome ?? r.de_email}</b>
                    <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">{quando(r.recebido_em)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 min-w-0">
                    <Etiqueta c={r.categoria} />
                    <span className="text-xs text-muted-foreground truncate">{r.resumo ?? r.texto?.slice(0, 80)}</span>
                  </div>
                </button>
              ))}
          </div>
        </div>

        {/* Conversa */}
        <div className={cn("rounded-2xl border border-border bg-card p-4", !aberta && "hidden lg:block")}>
          {!aberta ? (
            <p className="text-sm text-muted-foreground py-16 text-center">Escolha uma resposta na lista.</p>
          ) : (
            <>
              <button type="button" onClick={() => setAbertaId(null)} className="lg:hidden mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </button>
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="min-w-0">
                  <p className="font-display font-bold text-[17px] truncate">{aberta.de_nome ?? aberta.de_email}</p>
                  <p className="text-xs text-muted-foreground truncate">{aberta.de_email}{aberta.assunto ? ` · respondeu "${aberta.assunto.replace(/^re:\s*/i, "")}"` : ""}</p>
                </div>
                {aberta.user_id && aoAbrirConta && (
                  <button type="button" onClick={() => aoAbrirConta(aberta.user_id!)} className="ml-auto rounded-full border border-border px-3 py-1.5 text-xs font-bold">Ver conta</button>
                )}
              </div>
              <p className="mt-3 whitespace-pre-line rounded-2xl bg-muted/60 px-4 py-3 text-[14.5px] leading-relaxed">{aberta.texto}</p>
              {(aberta.resumo || aberta.categoria) && (
                <div className="mt-3 rounded-2xl border border-dashed border-[#CFC3F2] bg-[#FAF8FF] px-4 py-3">
                  <p className="text-[11px] font-bold tracking-wide text-[#6D4AC7]">LEITURA DA IA</p>
                  <p className="mt-1 text-[13.5px]"><Etiqueta c={aberta.categoria} /> {aberta.resumo}</p>
                </div>
              )}
              <p className="mt-4 mb-1.5 text-xs font-bold text-muted-foreground">
                {aberta.status === "respondida" ? `Resposta enviada ${aberta.respondido_em ? quando(aberta.respondido_em) : ""}` : "Resposta (rascunho da IA, edite à vontade)"}
              </p>
              <textarea value={rascunho} onChange={(e) => setRascunho(e.target.value)} rows={9} readOnly={aberta.status === "respondida"}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm leading-relaxed outline-none focus:border-primary/50" />
              {aberta.status !== "respondida" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={mandar.isPending || rascunho.trim().length < 2} onClick={() => mandar.mutate()}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#2E5A3A] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">
                    {mandar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Mandar resposta
                  </button>
                  <button type="button" disabled={refazer.isPending} onClick={() => refazer.mutate()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-[13px] font-bold disabled:opacity-50">
                    {refazer.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refazer rascunho
                  </button>
                  <button type="button" onClick={() => mudarStatus.mutate(aberta.status === "arquivada" ? "nova" : "arquivada")}
                    className="ml-auto rounded-full border border-border px-4 py-2 text-[13px] font-bold">
                    {aberta.status === "arquivada" ? "Voltar pra novas" : "Arquivar"}
                  </button>
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Sai de "Gabi e Walter, do Cria" e, se a pessoa responder de novo, volta pra esta caixa.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Quantas respostas novas (pro número na pílula da aba). */
export function useRespostasNovas() {
  return useQuery({
    queryKey: ["admin-respostas-novas"],
    queryFn: async () => {
      const { count } = await db.from("email_respostas").select("id", { count: "exact", head: true }).eq("status", "nova");
      return count ?? 0;
    },
    refetchInterval: 120000,
  });
}
