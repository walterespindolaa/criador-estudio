import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, Check, ChevronDown, FileText, ImageIcon, Loader2, Package, Paperclip,
  Plus, Sparkles, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

/* ═══════════════════════════════════════════════════════════════════════════
   PEDIR MATERIAL PELO LINK (lado do CLIENTE, sem login)

   Um componente, dois links: o de aprovação (onde ele fica no fim da página) e
   o link SÓ de pedidos (/materiais/:token), que a social mídia manda toda
   segunda no WhatsApp.

   O que mudou em 21/09/2026, pedido da Gabriela, tudo na mesma queixa ("tá
   muito sem graça" e "não precisa estar TOOOODA copy"):

   · O HISTÓRICO ERA UM MURO DE TEXTO. Um pedido pronto do mês passado abria a
     descrição inteira na tela, com sete parágrafos de roteiro, empurrando o
     formulário pra baixo e fazendo o link parecer um documento. Agora cada
     pedido é uma linha; a descrição abre no clique, pra quem quiser conferir.
   · Os PRONTOS vêm fechados. Já foram feitos: servem de histórico, não de
     assunto do dia.
   · ANEXO. "Se tiver algum exemplo do material que ele precisa, ou print." Vai
     pela edge material-anexo, porque o cliente não tem login (ver lá).
   · Tipo POST/CARROSSEL na lista, que faltava.
   ═══════════════════════════════════════════════════════════════════════════ */
const MAT_KINDS: { key: string; label: string }[] = [
  { key: "apresentacao", label: "Apresentação" },
  { key: "flyer", label: "Flyer" },
  { key: "arte_avulsa", label: "Arte avulsa" },
  { key: "post_carrossel", label: "Post / Carrossel" },
  { key: "logo", label: "Logo" },
  { key: "outro", label: "Outro" },
];
const MAT_STATUS: Record<string, { label: string; cls: string }> = {
  solicitado: { label: "Recebido", cls: "bg-amber-100 text-amber-700" },
  a_fazer: { label: "Na fila", cls: "bg-slate-100 text-slate-600" },
  em_aprovacao: { label: "Em aprovação", cls: "bg-blue-100 text-blue-700" },
  ajuste: { label: "Em ajuste", cls: "bg-orange-100 text-orange-700" },
  finalizado: { label: "Pronto", cls: "bg-green-100 text-green-700" },
};

export type MaterialAnexo = { kind: string; name: string; url: string; type?: string | null; size?: number | null };
export type MaterialRow = {
  id: string; title: string; description: string | null; kind: string; status: string;
  created_at: string; due_date: string | null; updated_at: string | null;
  attachments?: MaterialAnexo[] | null;
};

const dataBR = (iso: string | null | undefined) => {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}` : null;
};
/* A data do pedido sai do carimbo em UTC. Sem converter pro fuso de Brasília,
   tudo que o cliente manda depois das 21h aparecia com a data do dia seguinte. */
const dataCriacaoBR = (iso: string | null | undefined) => {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })
      .format(new Date(iso));
  } catch { return dataBR(iso); }
};
const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const kb = (n?: number | null) => (n ? `${Math.max(1, Math.round(n / 1024))} KB` : "");

/* ── UMA LINHA POR PEDIDO, QUE ABRE ──
   Fechada mostra o essencial: o que é, o tipo, o prazo e em que pé está. Só
   abre quando a pessoa pede, e aí sim vem a descrição inteira e os anexos. */
function LinhaPedido({ p, abertoPorPadrao }: { p: MaterialRow; abertoPorPadrao: boolean }) {
  const [aberto, setAberto] = useState(abertoPorPadrao);
  const st = MAT_STATUS[p.status] ?? MAT_STATUS.solicitado;
  const anexos = Array.isArray(p.attachments) ? p.attachments : [];
  const temDetalhe = !!p.description?.trim() || anexos.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => temDetalhe && setAberto((v) => !v)}
        className={`w-full text-left px-3.5 py-3 flex items-start gap-3 ${temDetalhe ? "hover:bg-muted/40 transition-colors" : "cursor-default"}`}
        aria-expanded={aberto}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-body font-semibold text-foreground leading-snug">{p.title}</p>
          <p className="text-[11px] text-muted-foreground font-body flex items-center gap-x-2 gap-y-0.5 flex-wrap mt-0.5">
            <span>{MAT_KINDS.find((k) => k.key === p.kind)?.label ?? "Material"}</span>
            {p.due_date && (
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> pra {dataBR(p.due_date)}</span>
            )}
            <span>pedido em {dataCriacaoBR(p.created_at)}</span>
            {anexos.length > 0 && (
              <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" /> {anexos.length}</span>
            )}
          </p>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
        {temDetalhe && (
          <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 mt-0.5 transition-transform ${aberto ? "rotate-180" : ""}`} />
        )}
      </button>

      {aberto && temDetalhe && (
        <div className="px-3.5 pb-3.5 pt-0.5 border-t border-border/70 space-y-2.5">
          {p.description?.trim() && (
            <p className="text-[12.5px] text-foreground/85 font-body whitespace-pre-wrap leading-relaxed pt-2.5">
              {p.description}
            </p>
          )}
          {anexos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {anexos.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-2.5 py-1.5 text-[11.5px] font-body font-semibold text-foreground hover:border-primary/50 hover:text-primary transition-colors">
                  {a.type?.startsWith("image/") ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                  <span className="max-w-[160px] truncate">{a.name}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SolicitarMaterial({ token, abertoPorPadrao = false, semMoldura = false }: {
  token: string | undefined;
  /** No link so de pedidos o formulario ja vem aberto: e o unico motivo da pagina. */
  abertoPorPadrao?: boolean;
  /** Sem o card branco em volta (quando a pagina em volta ja e o card). */
  semMoldura?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(abertoPorPadrao);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("arte_avulsa");
  const [desc, setDesc] = useState("");
  const [prazo, setPrazo] = useState("");
  const [anexos, setAnexos] = useState<MaterialAnexo[]>([]);
  const [subindo, setSubindo] = useState(false);
  const [verProntos, setVerProntos] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const listQ = useQuery({
    queryKey: ["portal-materials", token], enabled: !!token,
    queryFn: async () => {
      const { data, error } = await sbRpc("list_materials_by_token", { _token: token });
      if (error) throw error;
      return (data as MaterialRow[]) ?? [];
    },
  });

  /* O upload não vai direto pro Storage: o cliente não tem login e nenhum
     bucket aceita escrita anônima. Quem grava é a edge, conferindo o token. */
  const anexar = async (arquivo: File) => {
    if (anexos.length >= 5) { toast.error("Cinco anexos por pedido já é bastante."); return; }
    if (arquivo.size > 8 * 1024 * 1024) { toast.error("O arquivo passa de 8 MB. Mande um print ou um PDF menor."); return; }
    setSubindo(true);
    try {
      const base64 = await new Promise<string>((ok, falha) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result ?? ""));
        fr.onerror = () => falha(new Error("Não consegui ler o arquivo."));
        fr.readAsDataURL(arquivo);
      });
      const { data, error } = await supabase.functions.invoke("material-anexo", {
        body: { token, nome: arquivo.name, tipo: arquivo.type, base64 },
      });
      if (error) throw new Error(error.message);
      const d = data as { ok?: boolean; anexo?: MaterialAnexo; message?: string; error?: string };
      if (!d?.ok || !d.anexo) throw new Error(d?.message || d?.error || "Não consegui anexar.");
      setAnexos((p) => [...p, d.anexo!]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui anexar.");
    } finally {
      setSubindo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const send = useMutation({
    mutationFn: async () => {
      const { error } = await sbRpc("request_material_by_token", {
        _token: token, _title: title.trim(), _description: desc.trim(), _kind: kind,
        _due_date: prazo || null, _attachments: anexos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido enviado! Já avisamos quem cuida do seu conteúdo.");
      setTitle(""); setDesc(""); setKind("arte_avulsa"); setPrazo(""); setAnexos([]);
      if (!abertoPorPadrao) setOpen(false);
      qc.invalidateQueries({ queryKey: ["portal-materials", token] });
    },
    onError: () => toast.error("Não foi possível enviar. Tente de novo."),
  });

  const pedidos = listQ.data ?? [];
  const abertos = pedidos.filter((p) => p.status !== "finalizado");
  const prontos = pedidos.filter((p) => p.status === "finalizado");

  const miolo = (
    <>
      {/* CABEÇALHO. Antes era um título e um parágrafo cinza empatados com o
          resto da página. Agora abre com cor da marca e diz o que fazer. */}
      <div className="px-4 py-4 sm:px-6 bg-gradient-to-br from-primary/[0.07] to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/12 flex items-center justify-center shrink-0">
            <Package className="h-5.5 w-5.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-display font-extrabold text-foreground leading-tight">Precisa de um material?</h3>
            <p className="text-[13px] text-muted-foreground font-body leading-snug">
              Apresentação, flyer, arte avulsa, post, logo. Peça aqui e acompanhe em que pé está.
            </p>
          </div>
          {!open && (
            <Button onClick={() => setOpen(true)} className="shrink-0 rounded-2xl h-11">
              <Plus className="h-4 w-4 mr-1.5" /> Solicitar
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-5 sm:px-6 space-y-4 border-t border-border pt-4">
          <div>
            <label className="text-xs font-body font-bold text-foreground">O que você precisa?</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Flyer de promoção de fim de ano"
              className="mt-1.5 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-body outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div>
            <label className="text-xs font-body font-bold text-foreground">Tipo</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {MAT_KINDS.map((k) => (
                <button key={k.key} type="button" onClick={() => setKind(k.key)}
                  className={`text-[13px] font-body font-semibold rounded-xl px-3 py-2 border transition-colors ${kind === k.key ? "bg-primary text-primary-foreground border-primary" : "bg-white text-muted-foreground border-border hover:border-primary/40"}`}>
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-body font-bold text-foreground">Pra quando?</label>
            <p className="text-[11px] text-muted-foreground font-body">Se deixar em branco, entra pra hoje e a gente combina o prazo.</p>
            <input type="date" value={prazo} min={hojeISO()} onChange={(e) => setPrazo(e.target.value)}
              className="mt-1.5 w-full sm:w-56 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-body outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div>
            <label className="text-xs font-body font-bold text-foreground">Detalhes (opcional)</label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Cores, texto, referências, medidas…" className="mt-1.5 rounded-2xl" />
          </div>

          {/* ANEXO: um exemplo vale dez linhas de explicação. */}
          <div>
            <label className="text-xs font-body font-bold text-foreground">Tem um exemplo? (opcional)</label>
            <p className="text-[11px] text-muted-foreground font-body">Print, foto ou PDF de algo parecido com o que você quer. Até 8 MB cada.</p>
            <input ref={fileRef} type="file" className="hidden"
              accept="image/png,image/jpeg,image/webp,image/gif,image/heic,application/pdf"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void anexar(f); }} />
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {anexos.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-2.5 py-1.5 text-[11.5px] font-body font-semibold text-foreground">
                  {a.type?.startsWith("image/") ? <ImageIcon className="h-3.5 w-3.5 text-primary" /> : <FileText className="h-3.5 w-3.5 text-primary" />}
                  <span className="max-w-[150px] truncate">{a.name}</span>
                  <span className="text-muted-foreground font-normal">{kb(a.size)}</span>
                  <button type="button" aria-label="Remover anexo"
                    onClick={() => setAnexos((p) => p.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              {anexos.length < 5 && (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={subindo}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-[12.5px] font-body font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-60">
                  {subindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                  {subindo ? "Enviando…" : "Anexar"}
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2.5 pt-0.5">
            <Button className="flex-1 h-12 rounded-2xl" disabled={send.isPending || subindo || !title.trim()} onClick={() => send.mutate()}>
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar pedido"}
            </Button>
            {!abertoPorPadrao && (
              <Button variant="ghost" className="h-12 rounded-2xl" onClick={() => setOpen(false)} disabled={send.isPending}>Cancelar</Button>
            )}
          </div>
        </div>
      )}

      {pedidos.length > 0 && (
        <div className="px-4 pb-5 sm:px-6 border-t border-border pt-4 space-y-4">
          {abertos.length > 0 && (
            <div>
              <p className="text-[12px] font-body font-bold text-muted-foreground uppercase tracking-wide mb-2.5">
                Em andamento ({abertos.length})
              </p>
              <div className="space-y-2">
                {abertos.map((p) => <LinhaPedido key={p.id} p={p} abertoPorPadrao={false} />)}
              </div>
            </div>
          )}

          {/* PRONTOS FECHADOS. Já foram entregues: são histórico, e abrir tudo
              fazia o link virar um documento de sete parágrafos. */}
          {prontos.length > 0 && (
            <div>
              <button type="button" onClick={() => setVerProntos((v) => !v)}
                className="w-full flex items-center gap-2 text-[12px] font-body font-bold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
                <Check className="h-3.5 w-3.5 text-green-600" />
                Prontos ({prontos.length})
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${verProntos ? "rotate-180" : ""}`} />
              </button>
              {verProntos && (
                <div className="space-y-2 mt-2.5 opacity-90">
                  {prontos.map((p) => <LinhaPedido key={p.id} p={p} abertoPorPadrao={false} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {pedidos.length === 0 && !listQ.isLoading && !open && (
        <div className="px-4 pb-5 sm:px-6 pt-1">
          <p className="text-[12.5px] font-body text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Nenhum pedido ainda. O primeiro leva menos de um minuto.
          </p>
        </div>
      )}
    </>
  );

  if (semMoldura) return <section>{miolo}</section>;
  return (
    <section className="mt-8 lg:mt-10">
      <div className="bg-white border border-border rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(27,26,24,0.05)]">
        {miolo}
      </div>
    </section>
  );
}
