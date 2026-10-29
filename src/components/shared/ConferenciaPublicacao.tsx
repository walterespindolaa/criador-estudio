import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Film, Images, Instagram, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ehStory, useConexaoDoPost, useConferirPublicacao, useCotaIg, type OpcoesIg,
} from "@/hooks/usePublicarInstagram";

/* ═══════════════════════════════════════════════════════════════════════════
   CONFERÊNCIA FINAL ANTES DE PUBLICAR (Walter, 28/10/2026)

   "Precisa só ter uma confirmação final do social media pra verificar se o
   cliente está 100% correto." Uma tela só: o perfil onde vai sair em
   destaque (e o aviso se o @ conectado não bate com o @ cadastrado do
   cliente), a mídia, a legenda, quando sai e as opções. Só libera depois do
   "Conferi". Sem aprovação do cliente, pede o motivo, que fica registrado.
   ═══════════════════════════════════════════════════════════════════════════ */

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

const MOTIVOS = ["Cliente aprovou pelo WhatsApp", "Post urgente ou data comemorativa", "Combinado em contrato"];

type Detalhe = {
  title: string | null; caption: string | null; format: string | null;
  scheduled_date: string | null; scheduled_time: string | null;
  approval_status: string | null; external_client_id: string | null; ig_opcoes: OpcoesIg | null;
  cliente: { name: string | null; instagram_handle: string | null; logo_url: string | null; color: string | null } | null;
  capa: string | null; ehVideo: boolean; nMidias: number;
};

function quandoTxt(data: string | null, hora: string | null) {
  if (!data) return "sem data";
  const d = new Date(`${data}T12:00:00`);
  const dia = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");
  const h = /^\d{1,2}:\d{2}/.test(hora ?? "") ? (hora as string).slice(0, 5) : "09:00";
  return `${dia} às ${h} (Brasília)`;
}

const limpo = (h: string | null | undefined) => (h ?? "").trim().replace(/^@/, "").toLowerCase();

function nomeFormato(f: string | null) {
  const x = (f ?? "").toLowerCase();
  if (x === "carrossel") return "Carrossel";
  if (x === "foto") return "Foto";
  if (ehStory(x)) return "Story";
  return "Reels";
}

export function ConferenciaPublicacao({
  postId, open, onOpenChange, agora = false, semAprovacao = false, onConcluido,
}: {
  postId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Publicar já, em vez de no horário do post. */
  agora?: boolean;
  /** O cliente ainda não aprovou: pede o motivo. */
  semAprovacao?: boolean;
  onConcluido?: () => void;
}) {
  const { data: cx } = useConexaoDoPost(open ? postId : null);
  const { data: cota } = useCotaIg(postId, open);
  const conferir = useConferirPublicacao(postId);
  const [conferi, setConferi] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [outro, setOutro] = useState("");

  useEffect(() => { if (open) { setConferi(false); setMotivo(null); setOutro(""); } }, [open]);

  const { data: d, isLoading } = useQuery<Detalhe | null>({
    queryKey: ["conferencia", postId],
    enabled: open && !!postId,
    staleTime: 0,
    queryFn: async () => {
      const { data: p } = await sbFrom("posts")
        .select("title, caption, format, scheduled_date, scheduled_time, approval_status, external_client_id, ig_opcoes")
        .eq("id", postId).maybeSingle();
      if (!p) return null;
      const post = p as unknown as Omit<Detalhe, "cliente" | "capa" | "ehVideo" | "nMidias">;
      let cliente: Detalhe["cliente"] = null;
      if (post.external_client_id) {
        const { data: c } = await sbFrom("external_clients").select("name, instagram_handle, logo_url, color")
          .eq("id", post.external_client_id).maybeSingle();
        cliente = (c as unknown as Detalhe["cliente"]) ?? null;
      }
      const { data: m } = await sbFrom("external_media_refs")
        .select("thumbnail_url, view_url, file_type, bunny_video_id, provider")
        .eq("post_id", postId).or("substituida.is.null,substituida.eq.false")
        .order("position", { ascending: true, nullsFirst: true });
      const midias = (m as unknown as Array<{ thumbnail_url: string | null; view_url: string | null; file_type: string | null; bunny_video_id: string | null; provider: string | null }> | null) ?? [];
      const primeira = midias[0];
      const ehVideo = !!primeira && ((primeira.file_type ?? "").startsWith("video/") || !!primeira.bunny_video_id || (primeira.provider ?? "").startsWith("bunny"));
      const capa = primeira ? (primeira.thumbnail_url || (!ehVideo ? primeira.view_url : null)) : null;
      return { ...post, cliente, capa, ehVideo, nMidias: midias.length };
    },
  });

  const handleConectado = limpo(cx?.username);
  const handleCadastro = limpo(d?.cliente?.instagram_handle);
  const naoBate = !!handleConectado && !!handleCadastro && handleConectado !== handleCadastro;
  const motivoFinal = motivo === "outro" ? outro.trim() : motivo;
  const pronto = conferi && (!semAprovacao || !!motivoFinal) && !!cx?.pode_publicar && !conferir.isPending;
  const op = d?.ig_opcoes ?? {};
  const extras = useMemo(() => {
    const l: string[] = [];
    if (op.collaborators?.length) l.push(`Collab ${op.collaborators.map((c) => "@" + c).join(", ")}`);
    if (op.user_tags?.length) l.push(`${op.user_tags.length} ${op.user_tags.length === 1 ? "pessoa marcada" : "pessoas marcadas"}`);
    if (op.alt_text) l.push("Texto alternativo");
    if (op.trial) l.push(op.trial === "MANUAL" ? "Reels de teste (você decide)" : "Reels de teste (automático)");
    if (op.share_to_feed === false) l.push("Só na aba Reels");
    return l;
  }, [op]);
  const cotaCheia = !!cota && cota.total > 0 && cota.usado >= cota.total;

  const liberar = () => {
    if (!pronto) return;
    conferir.mutate({ motivo: semAprovacao ? motivoFinal : null, agora }, {
      onSuccess: () => { onOpenChange(false); onConcluido?.(); },
    });
  };

  const horaCurta = d?.scheduled_time && /^\d{1,2}:\d{2}/.test(d.scheduled_time) ? d.scheduled_time.slice(0, 5) : "09:00";
  const rotuloBotao = agora ? "Conferi, publicar agora"
    : semAprovacao ? `Liberar pra ${quandoTxt(d?.scheduled_date ?? null, d?.scheduled_time ?? null).replace(" (Brasília)", "")}`
    : `Conferi, pode sair às ${horaCurta}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-1.5rem)] max-h-[92vh] overflow-y-auto rounded-3xl p-0 gap-0">
        <div className="h-1 bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#515BD4]" />
        <div className="p-5 space-y-4">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="font-display text-xl">{semAprovacao ? "Publicar sem aprovação" : "Conferência final"}</DialogTitle>
            <DialogDescription className="text-xs">Confira o perfil, a mídia e a legenda. O post só sai depois disso.</DialogDescription>
          </DialogHeader>

          {isLoading || !d ? (
            <div className="py-10 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (<>
            {/* Perfil em destaque: é o erro que mais dói (post no perfil errado). */}
            <div className={cn("flex items-center gap-3 rounded-2xl p-3 border-2", naoBate ? "border-destructive bg-destructive/5" : "border-foreground bg-muted/40")}>
              {d.cliente?.logo_url ? (
                <img src={d.cliente.logo_url} alt="" className="w-14 h-14 rounded-full object-cover shrink-0" />
              ) : (
                <span className="w-14 h-14 rounded-full grid place-items-center shrink-0 bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4]">
                  <Instagram className="h-6 w-6 text-white" />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Vai sair neste perfil</p>
                <p className="font-display font-extrabold text-xl leading-tight truncate">{cx?.username ? `@${cx.username}` : "Instagram não conectado"}</p>
                <p className="text-xs text-foreground/80 truncate">{d.cliente?.name ?? "Seu perfil"}</p>
              </div>
            </div>
            {naoBate && (
              <p className="text-xs rounded-xl bg-destructive/10 text-destructive px-3 py-2 flex gap-2" role="alert">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>O @ cadastrado deste cliente é <b>@{handleCadastro}</b>, mas o Instagram conectado é <b>@{handleConectado}</b>. Confira antes de liberar.</span>
              </p>
            )}
            {/* AGORA x DATA DO POST (Walter, 29/10/2026): um post marcado pra 03/11
                saiu no dia 29 porque "Publicar" era publicar na hora. Aqui fica
                impossível não ver. */}
            {agora && d.scheduled_date && (
              <p className="text-[13px] rounded-xl bg-red-50 border border-red-200 text-red-900 px-3 py-2 flex gap-2" role="alert">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <span>Vai sair <b>AGORA</b>, não na data do post ({quandoTxt(d.scheduled_date, d.scheduled_time).replace(" (Brasília)", "")}). Pra sair na data, feche e use <b>Agendar</b>.</span>
              </p>
            )}
            {cx && !cx.pode_publicar && (
              <p className="text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">{cx.motivo ?? "Este Instagram não pode publicar pelo Cria."}</p>
            )}

            {semAprovacao && (
              <p className="text-[13px] rounded-xl bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">
                <b>O cliente ainda não aprovou este post.</b> Pode sair mesmo assim, mas fica registrado no post quem liberou, quando e por quê.
              </p>
            )}

            <div className="flex gap-3">
              <div className="w-24 h-32 rounded-xl overflow-hidden shrink-0 bg-muted grid place-items-center relative">
                {d.capa ? <img src={d.capa} alt="" className="w-full h-full object-cover" />
                  : d.ehVideo ? <Film className="h-6 w-6 text-muted-foreground" /> : <Images className="h-6 w-6 text-muted-foreground" />}
                <span className="absolute top-1 left-1 text-[10px] font-bold text-white bg-black/50 rounded px-1.5 py-0.5">{nomeFormato(d.format)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold text-[15px] leading-snug">{d.title || "Post sem título"}</p>
                <p className="mt-1 text-[13px] text-foreground/80 whitespace-pre-line line-clamp-6">{d.caption?.trim() || (ehStory(d.format) ? "Story não leva legenda." : "Sem legenda.")}</p>
              </div>
            </div>

            <dl className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-1.5 text-[13px] border-t pt-3">
              <dt className="text-muted-foreground">Quando</dt>
              <dd className={cn("font-semibold", agora && "text-red-700")}>{agora ? "Agora, na hora" : quandoTxt(d.scheduled_date, d.scheduled_time)}</dd>
              <dt className="text-muted-foreground">Formato</dt>
              <dd className="font-semibold">{nomeFormato(d.format)}{d.nMidias > 1 ? ` · ${d.nMidias} mídias` : ""}</dd>
              <dt className="text-muted-foreground">Extras</dt>
              <dd className="font-semibold">{extras.length ? extras.join(" · ") : "nenhum"}</dd>
              {d.external_client_id && (<>
                <dt className="text-muted-foreground">Aprovação</dt>
                <dd className="font-semibold">{d.approval_status === "aprovado" ? "aprovado pelo cliente" : "não aprovado"}</dd>
              </>)}
              {op.musica_celular && (<>
                <dt className="text-muted-foreground">Música</dt>
                <dd className="font-semibold text-amber-800">marcada pra postar pelo celular</dd>
              </>)}
            </dl>
            {cotaCheia && (
              <p className="text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">
                Esta conta já usou {cota!.usado} de {cota!.total} publicações pela API nas últimas 24 horas. O Cria tenta de novo quando liberar.
              </p>
            )}

            {semAprovacao && (
              <div>
                <p className="text-[13px] font-bold mb-1.5">Por que vai sair sem aprovação?</p>
                <div role="radiogroup" aria-label="Motivo" className="flex flex-wrap gap-1.5">
                  {[...MOTIVOS, "outro"].map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={motivo === m} onClick={() => setMotivo(m)}
                      className={cn("h-9 px-3 rounded-full text-xs font-semibold border transition-colors",
                        motivo === m ? "bg-foreground text-background border-foreground" : "bg-background border-border hover:bg-muted")}>
                      {m === "outro" ? "Outro motivo" : m}
                    </button>
                  ))}
                </div>
                {motivo === "outro" && (
                  <Input value={outro} onChange={(e) => setOutro(e.target.value)} maxLength={200} placeholder="Escreva o motivo" className="mt-2 h-10 rounded-xl" autoFocus />
                )}
              </div>
            )}

            <button type="button" role="checkbox" aria-checked={conferi} onClick={() => setConferi((v) => !v)}
              className="w-full flex items-start gap-2.5 text-left rounded-2xl border px-3 py-3 hover:bg-muted/40">
              <span className={cn("mt-0.5 w-5 h-5 rounded-md grid place-items-center shrink-0 border-2", conferi ? "bg-foreground border-foreground" : "border-muted-foreground/50")}>
                {conferi && <Check className="h-3.5 w-3.5 text-background" strokeWidth={3} />}
              </span>
              <span className="text-[13px] leading-snug">Conferi: o perfil é o do cliente certo, a mídia e a legenda são as {semAprovacao ? "certas" : "aprovadas"} e a data está certa.</span>
            </button>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1 h-12 rounded-full" onClick={() => onOpenChange(false)}>Voltar</Button>
              <Button type="button" onClick={liberar} disabled={!pronto}
                className="flex-[1.6] h-12 rounded-full bg-[#EA4918] hover:bg-[#d23f12] text-white font-bold">
                {conferir.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1.5" />{rotuloBotao}</>}
              </Button>
            </div>
          </>)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
