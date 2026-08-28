import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Briefcase, Check, CheckCircle2, Clock, Copy as CopyIcon, ExternalLink, Folder,
  Loader2, MessageCircle, Palette, Play, RotateCcw, Send,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { hojeBR } from "@/lib/date-br";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  useAcoesDoParceiro, useCardDoParceiro, useFilaDoParceiro, type CardDaFila,
} from "@/hooks/useParceiro";

/* ═══════════════════════════════════════════════════════════════════════════
   MINHAS DEMANDAS, a tela do parceiro (designer, editor, copy)

   É a fila por prazo do protótipo: tudo que foi delegado pra pessoa, de TODAS
   as agências que a acoplaram, agrupado por dia de entrega e com o card
   abrindo por cima. Quadro, semana e mês vêm na fase 2; esta é a visão que
   responde "o que eu faço hoje?".
   ═══════════════════════════════════════════════════════════════════════════ */

const FORMATO: Record<string, string> = {
  reels: "Reels", carrossel: "Carrossel", foto: "Estático", story: "Story",
  video: "Vídeo", shorts: "Shorts", live: "Live",
};

const dataBR = (iso: string | null) => {
  if (!iso) return null;
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return null;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
};

/** Agrupa por dia de entrega, com os sem prazo no fim ("Combinar prazo"). */
function porDia(cards: CardDaFila[]) {
  const mapa = new Map<string, CardDaFila[]>();
  for (const c of cards) {
    const chave = c.prazo_producao ?? "sem-prazo";
    mapa.set(chave, [...(mapa.get(chave) ?? []), c]);
  }
  return [...mapa.entries()].sort(([a], [b]) => {
    if (a === "sem-prazo") return 1;
    if (b === "sem-prazo") return -1;
    return a.localeCompare(b);
  });
}

function rotuloDoDia(chave: string, hoje: string): { titulo: string; tom: "hoje" | "perto" | "folga" | "atrasado" } {
  if (chave === "sem-prazo") return { titulo: "Sem prazo combinado", tom: "folga" };
  const [a, m, d] = chave.split("-").map(Number);
  const rot = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
  if (chave < hoje) return { titulo: `Atrasado · ${rot}`, tom: "atrasado" };
  if (chave === hoje) return { titulo: "Hoje", tom: "hoje" };
  const amanha = new Date(a, m - 1, d - 1).toISOString().slice(0, 10) === hoje;
  return amanha ? { titulo: "Amanhã", tom: "perto" } : { titulo: rot, tom: "folga" };
}

const EstadoPill = ({ s }: { s: CardDaFila["producao_status"] }) => (
  <span className={cn("shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full",
    s === "aguardando" && "bg-foreground text-background",
    s === "em_producao" && "bg-blue-100 text-blue-700",
    s === "ajuste" && "bg-violet-100 text-violet-700",
    s === "entregue" && "bg-green-100 text-green-700")}>
    {s === "aguardando" ? "Novo" : s === "em_producao" ? "Fazendo" : s === "ajuste" ? "Ajuste" : "Entregue"}
  </span>
);

export default function MinhasDemandas() {
  const { data: fila = [], isLoading } = useFilaDoParceiro();
  const [aberto, setAberto] = useState<string | null>(null);
  const hoje = hojeBR();
  const grupos = useMemo(() => porDia(fila), [fila]);
  const venceHoje = fila.filter((c) => c.prazo_producao === hoje).length;

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-sm shrink-0">
            <Briefcase className="h-5 w-5 text-white" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Minhas demandas</h1>
            <p className="text-muted-foreground font-body mt-0.5 text-sm">
              {fila.length === 0
                ? "Tudo entregue. Quando uma agência mandar um card, ele aparece aqui."
                : `${fila.length} peça${fila.length === 1 ? "" : "s"} na sua mão${venceHoje > 0 ? ` · ${venceHoje} vence${venceHoje === 1 ? "" : "m"} hoje` : ""}`}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : fila.length === 0 ? (
          <Card className="p-10 rounded-2xl border-dashed text-center">
            <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-3" />
            <p className="text-sm font-body font-medium text-foreground">Nenhuma demanda aberta</p>
            <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">
              As social mídias que te acoplaram mandam os posts direto pra cá, com roteiro, prazo e a
              identidade do cliente juntos. Você recebe aviso no celular na hora.
            </p>
          </Card>
        ) : (
          grupos.map(([chave, cards]) => {
            const r = rotuloDoDia(chave, hoje);
            return (
              <section key={chave} className="mb-5">
                <div className="flex items-center gap-2.5 mb-2 px-0.5">
                  <h2 className="font-display font-bold text-[15px] text-foreground">{r.titulo}</h2>
                  <span className={cn("text-[10px] font-bold px-2.5 py-0.5 rounded-full",
                    r.tom === "hoje" && "bg-red-100 text-red-700",
                    r.tom === "atrasado" && "bg-red-600 text-white",
                    r.tom === "perto" && "bg-amber-100 text-amber-700",
                    r.tom === "folga" && "bg-green-100 text-green-700")}>
                    {cards.length} entrega{cards.length === 1 ? "" : "s"}
                  </span>
                </div>
                <Card className="rounded-2xl border-border overflow-hidden divide-y divide-border">
                  {cards.map((c) => (
                    <button key={c.post_id} onClick={() => setAberto(c.post_id)}
                      className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors">
                      <span className="w-11 h-11 rounded-xl grid place-items-center text-white font-display font-bold shrink-0 overflow-hidden"
                        style={{ background: c.cliente_cor || "#7C90F0" }}>
                        {c.cliente_logo
                          ? <img src={c.cliente_logo} alt="" className="w-full h-full object-cover" />
                          : (c.cliente_nome || "C").charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display font-bold text-[14.5px] text-foreground leading-tight truncate">{c.titulo || "Sem título"}</span>
                        <span className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs font-body font-semibold text-foreground/85 truncate">{c.cliente_nome}</span>
                          <span className="text-[11px] font-body text-muted-foreground">via {c.agencia_nome}</span>
                          {c.formato && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{FORMATO[c.formato] ?? c.formato}</span>}
                          {c.publica_em && <span className="text-[11px] font-body text-muted-foreground">publica {dataBR(c.publica_em)}</span>}
                        </span>
                      </span>
                      <EstadoPill s={c.producao_status} />
                    </button>
                  ))}
                </Card>
              </section>
            );
          })
        )}
      </motion.div>

      <CardAbertoDialog postId={aberto} aoFechar={() => setAberto(null)} />
    </div>
  );
}

/* ── O CARD ABERTO ────────────────────────────────────────────────────────── */
function CardAbertoDialog({ postId, aoFechar }: { postId: string | null; aoFechar: () => void }) {
  const { data: card, isLoading } = useCardDoParceiro(postId);
  const { marcar, comentar } = useAcoesDoParceiro(postId);
  const [texto, setTexto] = useState("");

  const enviar = async () => {
    const t = texto.trim();
    if (!t) return;
    await comentar.mutateAsync(t);
    setTexto("");
  };

  const copiarLegenda = async () => {
    if (!card?.legenda) return;
    await navigator.clipboard.writeText(card.legenda);
    toast.success("Legenda copiada.");
  };

  return (
    <Dialog open={!!postId} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-3xl p-0 gap-0 rounded-2xl overflow-hidden max-h-[88vh] overflow-y-auto">
        {isLoading || !card ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Capa na cor do cliente: o parceiro sabe de quem é antes de ler. */}
            <div className="h-24 shrink-0" style={{ background: `linear-gradient(135deg, ${card.marca.cor || "#4B3FA8"}, ${card.marca.cor || "#4B3FA8"}cc)` }} />
            <div className="grid md:grid-cols-[1fr_260px]">
              <div className="p-5">
                <DialogTitle className="font-display text-xl font-extrabold leading-tight">{card.titulo || "Sem título"}</DialogTitle>
                <p className="text-xs font-body text-muted-foreground mt-1.5">
                  <b className="text-foreground">{card.marca.nome}</b> · delegado por {card.agencia}
                  {card.publica_em && <> · publica em {dataBR(card.publica_em)}</>}
                </p>

                {card.gancho?.trim() && (
                  <div className="mt-4">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Gancho</p>
                    <p className="text-sm font-body bg-muted/50 border border-border rounded-xl px-3 py-2.5">{card.gancho}</p>
                  </div>
                )}

                {card.roteiro?.trim() && (
                  <div className="mt-4">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Roteiro</p>
                    <p className="text-sm font-body whitespace-pre-line bg-muted/50 border border-border rounded-xl px-3 py-2.5 leading-relaxed">{card.roteiro}</p>
                  </div>
                )}

                {card.legenda?.trim() && (
                  <div className="mt-4">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Legenda aprovada</p>
                    <p className="text-sm font-body whitespace-pre-line bg-muted/50 border border-border rounded-xl px-3 py-2.5 leading-relaxed">{card.legenda}</p>
                    <button onClick={() => void copiarLegenda()} className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] font-body font-bold text-primary">
                      <CopyIcon className="h-3.5 w-3.5" /> Copiar legenda
                    </button>
                  </div>
                )}

                {/* Conversa: as três vozes com etiqueta. É o fim do telefone sem fio. */}
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5" /> Conversa deste card
                  </p>
                  {card.comentarios.length === 0 && (
                    <p className="text-xs font-body text-muted-foreground mb-3">Nenhum comentário ainda.</p>
                  )}
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {card.comentarios.map((cm) => (
                      <div key={cm.id} className="rounded-xl border border-border bg-background px-3 py-2">
                        <p className="text-[10.5px] font-bold mb-0.5">
                          <span className={cn("px-1.5 py-0.5 rounded-full uppercase tracking-wide text-[9px]",
                            cm.papel === "parceiro" ? "bg-violet-100 text-violet-700"
                            : cm.papel === "cliente" || cm.papel === "client" ? "bg-green-100 text-green-700"
                            : "bg-pink-100 text-pink-700")}>
                            {cm.papel === "parceiro" ? "você" : (cm.papel === "cliente" || cm.papel === "client") ? "cliente" : "social mídia"}
                          </span>
                          <span className="text-muted-foreground font-medium ml-2">{new Date(cm.em).toLocaleDateString("pt-BR")}</span>
                        </p>
                        <p className="text-[13px] font-body leading-relaxed">{cm.texto}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={1}
                      placeholder="Escrever um comentário... a social mídia recebe na hora"
                      className="rounded-xl resize-none min-h-[42px] text-sm" />
                    <Button size="sm" onClick={() => void enviar()} disabled={!texto.trim() || comentar.isPending} className="rounded-xl h-[42px]">
                      {comentar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* A COLUNA DA DIREITA: prazo, marca, material, ações. */}
              <div className="bg-muted/40 border-l border-border p-4 space-y-4">
                <div className={cn("rounded-xl border px-3.5 py-3",
                  card.prazo_producao && card.prazo_producao <= hojeBR()
                    ? "bg-red-50 border-red-200" : "bg-background border-border")}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Clock className="h-3 w-3" /> Entrega combinada</p>
                  <p className={cn("font-display font-extrabold text-lg mt-0.5",
                    card.prazo_producao && card.prazo_producao <= hojeBR() ? "text-red-600" : "text-foreground")}>
                    {card.prazo_producao ? `${dataBR(card.prazo_producao)}` : "A combinar"}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-background px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2"><Palette className="h-3 w-3" /> A marca</p>
                  {card.marca.cor && (
                    <button
                      onClick={() => { void navigator.clipboard.writeText(card.marca.cor!); toast.success(`${card.marca.cor} copiado.`); }}
                      className="flex items-center gap-2 mb-2" title="Copiar o hex">
                      <span className="w-7 h-7 rounded-lg border border-border" style={{ background: card.marca.cor }} />
                      <span className="text-xs font-mono text-muted-foreground">{card.marca.cor}</span>
                    </button>
                  )}
                  {card.marca.handle && <p className="text-xs font-body text-muted-foreground">@{card.marca.handle.replace(/^@/, "")}</p>}
                  {(card.marca.hashtags?.length ?? 0) > 0 && (
                    <p className="text-[11px] font-body text-muted-foreground mt-1.5 leading-relaxed">{card.marca.hashtags!.slice(0, 6).join(" ")}</p>
                  )}
                </div>

                {card.pasta_drive && (
                  <a href={card.pasta_drive} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 py-3 text-sm font-body font-bold text-foreground hover:border-primary/40 transition-colors">
                    <Folder className="h-4 w-4 text-primary" /> Pasta de material
                    <ExternalLink className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                  </a>
                )}
                {card.referencia && (
                  <a href={card.referencia} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 py-3 text-sm font-body font-bold text-foreground hover:border-primary/40 transition-colors">
                    <Play className="h-4 w-4 text-primary" /> Referência
                    <ExternalLink className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                  </a>
                )}

                <div className="pt-1 space-y-2">
                  {card.producao_status !== "entregue" ? (
                    <>
                      <Button className="w-full rounded-xl bg-green-600 hover:bg-green-700" disabled={marcar.isPending}
                        onClick={() => marcar.mutate("entregue")}>
                        <Check className="h-4 w-4 mr-1.5" /> Marcar como entregue
                      </Button>
                      {card.producao_status !== "em_producao" && (
                        <Button variant="outline" className="w-full rounded-xl" disabled={marcar.isPending}
                          onClick={() => marcar.mutate("em_producao")}>
                          Estou fazendo
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button variant="outline" className="w-full rounded-xl" disabled={marcar.isPending}
                      onClick={() => marcar.mutate("em_producao")}>
                      <RotateCcw className="h-4 w-4 mr-1.5" /> Reabrir (voltei a mexer)
                    </Button>
                  )}
                  <p className="text-[10.5px] font-body text-muted-foreground leading-relaxed">
                    A arte final sobe na pasta de material ou pelo link no comentário. Ao marcar entregue,
                    a social mídia revisa e manda pro cliente aprovar.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
