import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, Clock, ExternalLink, FileText, Link2, Loader2, Paperclip, Play, RotateCcw, Send, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hrefSeguro } from "@/lib/href-seguro";
import { brlReais } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  TIPO_MATERIAL, useAnexarNoMaterial, useComentarMaterial, useMarcarMaterial, useMaterialAberto,
  useRemoverAnexoDoMaterial, useRevisarMaterial, type EntregaDoMaterial,
} from "@/hooks/useMaterialParceiro";

/* ═══════════════════════════════════════════════════════════════════════════
   O CARD DO MATERIAL (Gabriela, 29/09/2026)

   A mesma janela pros dois lados, como o card do post: o parceiro lê o
   briefing, sobe a entrega e conversa; a social mídia vê a entrega, dá o ok
   ou pede ajuste. O `papel` vem do banco (material_abrir), não da tela: quem
   decide o que cada um pode fazer é quem tem a chave.

   Mais simples que o card do post de propósito: material não tem legenda,
   roteiro, capa nem data de postagem. Tem briefing, anexos e entrega.
   ═══════════════════════════════════════════════════════════════════════════ */

const ETAPA: Record<string, { txt: string; cls: string }> = {
  aguardando: { txt: "Novo", cls: "bg-orange-100 text-orange-700" },
  em_producao: { txt: "Fazendo", cls: "bg-blue-100 text-blue-700" },
  ajuste: { txt: "Em ajuste", cls: "bg-violet-100 text-violet-700" },
  entregue: { txt: "Entregue", cls: "bg-green-100 text-green-700" },
};

const dataBR = (iso: string | null | undefined) => {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : null;
};

export function MaterialAbertoDialog({ materialId, aoFechar }: { materialId: string | null; aoFechar: () => void }) {
  const { data: m, isLoading, isError } = useMaterialAberto(materialId);
  const comentar = useComentarMaterial(materialId);
  const anexar = useAnexarNoMaterial(materialId);
  const remover = useRemoverAnexoDoMaterial(materialId);
  const marcar = useMarcarMaterial(materialId);
  const revisar = useRevisarMaterial();
  const [texto, setTexto] = useState("");
  const [link, setLink] = useState("");
  const [pedindoAjuste, setPedindoAjuste] = useState(false);
  const [motivo, setMotivo] = useState("");
  const inputArquivo = useRef<HTMLInputElement | null>(null);
  const fimDaConversa = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setTexto(""); setLink(""); setPedindoAjuste(false); setMotivo(""); }, [materialId]);
  useEffect(() => { fimDaConversa.current?.scrollIntoView({ block: "end" }); }, [m?.comentarios?.length]);

  const souParceiro = m?.papel === "parceiro";
  const rodadaAtual = m?.revisoes ?? 0;
  const entregas = (m?.entregas ?? []) as EntregaDoMaterial[];
  const entregasAtuais = entregas.filter((e) => (e.rodada ?? 0) === rodadaAtual);
  const entregasAntigas = entregas.filter((e) => (e.rodada ?? 0) !== rodadaAtual);
  const entregue = m?.producao_status === "entregue";
  // Mesma regra do "Pra você revisar" dos posts: entregue e ainda não andou.
  const praRevisar = !souParceiro && entregue && !["em_aprovacao", "finalizado"].includes(m?.status ?? "");
  const cor = m?.cliente_cor || "#4B3FA8";

  const mandar = () => {
    const t = texto.trim();
    if (!t) return;
    comentar.mutate(t, { onSuccess: () => setTexto("") });
  };

  const escolherArquivos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of arquivos) {
      try { await anexar.mutateAsync({ arquivo: f }); } catch { /* o toast já avisou */ }
    }
  };

  return (
    <Dialog open={!!materialId} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-[1000px] w-[calc(100vw-2rem)] p-0 sm:p-0 gap-0 rounded-2xl border-0 overflow-hidden h-[90vh] flex flex-col bg-card [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">{m?.titulo ?? "Material"}</DialogTitle>
        {isLoading ? (
          <div className="grid place-items-center flex-1"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : isError || !m ? (
          <div className="grid place-items-center flex-1 p-8 text-center">
            <div>
              <p className="font-display font-bold">Não consegui abrir este material</p>
              <p className="text-sm text-muted-foreground font-body mt-1">Ele pode ter sido tirado de você ou excluído.</p>
              <Button variant="outline" className="mt-4 rounded-xl" onClick={aoFechar}>Fechar</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Faixa da marca: cor e logo do cliente, igual ao card do post. */}
            <div className="shrink-0 px-5 py-4 text-white flex items-start gap-3" style={{ background: `linear-gradient(135deg, ${cor}, ${cor}cc)` }}>
              <span className="w-11 h-11 rounded-xl bg-white/20 grid place-items-center overflow-hidden shrink-0 font-display font-bold">
                {m.cliente_logo ? <img src={m.cliente_logo} alt="" className="w-full h-full object-cover" /> : m.cliente_nome.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-body text-white/85 truncate">
                  {m.cliente_nome} · {souParceiro ? `via ${m.agencia_nome ?? "agência"}` : `com ${m.parceiro_nome ?? "ninguém ainda"}`}
                </p>
                <h2 className="font-display font-extrabold text-[18px] leading-tight">{m.titulo}</h2>
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white text-foreground">
                    {TIPO_MATERIAL[m.tipo ?? ""] ?? "Material"}
                  </span>
                  {ETAPA[m.producao_status] && m.assignee_id && (
                    <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", ETAPA[m.producao_status].cls)}>{ETAPA[m.producao_status].txt}</span>
                  )}
                  {m.prazo_producao && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20">
                      <Clock className="h-3 w-3" /> prazo {dataBR(m.prazo_producao)}
                    </span>
                  )}
                  {m.cache != null && Number(m.cache) > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20">{brlReais(Number(m.cache))}</span>
                  )}
                  {m.revisoes > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20">{m.revisoes}ª revisão</span>
                  )}
                </div>
              </div>
              <button type="button" onClick={aoFechar} aria-label="Fechar" className="shrink-0 w-9 h-9 grid place-items-center rounded-full hover:bg-white/15">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_360px] overflow-y-auto lg:overflow-hidden">
              {/* ── ESQUERDA: briefing, anexos, entrega ── */}
              <div className="p-5 lg:overflow-y-auto space-y-5">
                {praRevisar && (
                  <div className="rounded-2xl border-2 border-green-200 bg-green-50/60 p-3.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-green-800 flex items-center gap-1.5 mb-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Entrega pra você revisar
                    </p>
                    <p className="text-[12px] font-body text-green-900/75 mb-2.5">Confira os arquivos abaixo e decida.</p>
                    {pedindoAjuste ? (
                      <div className="space-y-2">
                        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} autoFocus
                          placeholder={`O que ${m.parceiro_nome?.split(" ")[0] ?? "o parceiro"} precisa mudar? Junte tudo num texto só.`}
                          className="resize-none text-[13px] bg-card" />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" className="rounded-xl h-8" onClick={() => { setPedindoAjuste(false); setMotivo(""); }}>Cancelar</Button>
                          <Button size="sm" className="rounded-xl h-8 bg-violet-600 hover:bg-violet-700 text-white" disabled={revisar.isPending || !motivo.trim()}
                            onClick={() => revisar.mutate({ id: m.id, acao: "ajuste", motivo }, { onSuccess: () => { setPedindoAjuste(false); setMotivo(""); } })}>
                            {revisar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RotateCcw className="h-3.5 w-3.5 mr-1" /> Mandar ajuste</>}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" className="rounded-xl h-8 bg-green-600 hover:bg-green-700 text-white" disabled={revisar.isPending}
                          title="Vai pra coluna Em aprovação do quadro, pra mostrar ao cliente"
                          onClick={() => revisar.mutate({ id: m.id, acao: "aprovar", destino: "em_aprovacao" })}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Tá ok, mostrar pro cliente
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl h-8" disabled={revisar.isPending}
                          onClick={() => revisar.mutate({ id: m.id, acao: "aprovar", destino: "finalizado" })}>
                          Finalizar
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl h-8 border-violet-300 text-violet-700 hover:bg-violet-50" disabled={revisar.isPending}
                          onClick={() => setPedindoAjuste(true)}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Pedir ajuste
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <section>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Briefing</p>
                  {m.briefing
                    ? <p className="text-[14px] font-body leading-relaxed whitespace-pre-wrap">{m.briefing}</p>
                    : <p className="text-[13px] font-body text-muted-foreground">Sem briefing escrito. Pergunte na conversa ao lado.</p>}
                  {m.data_cliente && (
                    <p className="text-[12px] font-body text-muted-foreground mt-2">Data que o cliente precisa: <b className="text-foreground">{dataBR(m.data_cliente)}</b></p>
                  )}
                </section>

                {m.anexos.length > 0 && (
                  <section>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5" /> Arquivos e referências da social mídia
                    </p>
                    <ul className="space-y-1.5">
                      {m.anexos.map((a, i) => (
                        <li key={i}>
                          <a href={hrefSeguro(a.url)} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-[13px] font-body hover:border-primary/50 hover:text-primary">
                            {a.kind === "drive" ? <Link2 className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
                            <span className="truncate flex-1">{a.name}</span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* ── A ENTREGA ── */}
                {m.assignee_id && (
                  <section className={cn("rounded-2xl border-2 p-4", entregue ? "border-green-200 bg-green-50/40" : "border-border")}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/80 flex items-center gap-1.5 mb-2">
                      <Check className="h-3.5 w-3.5" /> {souParceiro ? "Sua entrega" : "Entrega do parceiro"}
                      {m.revisoes > 0 && <span className="normal-case tracking-normal font-body text-muted-foreground">· rodada {m.revisoes + 1}</span>}
                    </p>
                    {entregasAtuais.length === 0 ? (
                      <p className="text-[13px] font-body text-muted-foreground mb-2">
                        {souParceiro ? "Suba o arquivo final ou cole o link (Drive, WeTransfer, Canva)." : "Nada entregue nesta rodada ainda."}
                      </p>
                    ) : (
                      <ul className="space-y-1.5 mb-2">
                        {entregasAtuais.map((e, i) => (
                          <li key={`${e.url}-${i}`} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                            {e.kind === "link" ? <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" /> : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
                            <a href={hrefSeguro(e.url)} target="_blank" rel="noopener noreferrer" className="truncate flex-1 text-[13px] font-body hover:text-primary hover:underline">{e.name}</a>
                            {souParceiro && !entregue && (
                              <button type="button" aria-label="Remover" disabled={remover.isPending} onClick={() => remover.mutate(e.url)}
                                className="text-muted-foreground hover:text-destructive w-8 h-8 grid place-items-center rounded-lg shrink-0">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {souParceiro && !entregue && (
                      <div className="space-y-2">
                        <input ref={inputArquivo} type="file" multiple hidden onChange={escolherArquivos} />
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button type="button" variant="outline" className="rounded-xl h-9" disabled={anexar.isPending} onClick={() => inputArquivo.current?.click()}>
                            {anexar.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />} Subir arquivo
                          </Button>
                          <div className="flex gap-2 flex-1">
                            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="ou cole o link"
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (link.trim()) anexar.mutate({ link }, { onSuccess: () => setLink("") }); } }}
                              className="h-9 rounded-xl" />
                            <Button type="button" variant="outline" className="rounded-xl h-9" disabled={!link.trim() || anexar.isPending}
                              onClick={() => anexar.mutate({ link }, { onSuccess: () => setLink("") })}>
                              <Link2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap pt-1">
                          {(m.producao_status === "aguardando" || m.producao_status === "ajuste") && (
                            <Button type="button" variant="outline" className="rounded-xl h-9" disabled={marcar.isPending} onClick={() => marcar.mutate("em_producao")}>
                              <Play className="h-4 w-4 mr-1.5" /> Estou fazendo
                            </Button>
                          )}
                          <Button type="button" className="rounded-xl h-9 bg-green-600 hover:bg-green-700 text-white" disabled={marcar.isPending || entregasAtuais.length === 0}
                            title={entregasAtuais.length === 0 ? "Anexe a entrega primeiro" : undefined}
                            onClick={() => marcar.mutate("entregue")}>
                            {marcar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1.5" /> Marcar entregue</>}
                          </Button>
                        </div>
                      </div>
                    )}
                    {souParceiro && entregue && (
                      <p className="text-[12px] font-body text-green-800">Entregue{m.entregue_em ? ` em ${new Date(m.entregue_em).toLocaleDateString("pt-BR")}` : ""}. Se a social mídia pedir ajuste, o material volta pra você com o motivo.</p>
                    )}

                    {entregasAntigas.length > 0 && (
                      <details className="mt-3">
                        <summary className="text-[12px] font-body text-muted-foreground cursor-pointer">Rodadas anteriores ({entregasAntigas.length})</summary>
                        <ul className="mt-1.5 space-y-1">
                          {entregasAntigas.map((e, i) => (
                            <li key={`${e.url}-${i}`}>
                              <a href={hrefSeguro(e.url)} target="_blank" rel="noopener noreferrer" className="text-[12px] font-body text-muted-foreground hover:text-primary hover:underline">
                                Rodada {(e.rodada ?? 0) + 1} · {e.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </section>
                )}
                {!m.assignee_id && !souParceiro && (
                  <p className="text-[13px] font-body text-muted-foreground">Este material ainda não foi enviado pra ninguém. Use o "Enviar para" na edição do material.</p>
                )}
              </div>

              {/* ── DIREITA: conversa ── */}
              <div className="border-t lg:border-t-0 lg:border-l border-border flex flex-col min-h-[320px] lg:min-h-0 bg-muted/20">
                <p className="px-4 pt-4 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Conversa</p>
                <div className="flex-1 min-h-0 overflow-y-auto px-4 space-y-2 pb-3">
                  {m.comentarios.length === 0 && (
                    <p className="text-[12.5px] font-body text-muted-foreground">Nenhuma mensagem ainda. Dúvida sobre o briefing? Pergunte aqui.</p>
                  )}
                  {m.comentarios.map((c) => {
                    const meu = (c.papel === "parceiro") === souParceiro;
                    return (
                      <div key={c.id} className={cn("max-w-[88%] rounded-2xl px-3 py-2 text-[13px] font-body whitespace-pre-wrap",
                        meu ? "ml-auto bg-primary text-primary-foreground" : "bg-card border border-border")}>
                        {c.texto}
                        <span className={cn("block text-[10px] mt-1", meu ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {c.papel === "parceiro" ? (m.parceiro_nome?.split(" ")[0] ?? "Parceiro") : "Social mídia"} · {new Date(c.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={fimDaConversa} />
                </div>
                {(souParceiro || m.assignee_id) && (
                  <div className="p-3 border-t border-border flex gap-2 bg-card">
                    <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Escreva..."
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); mandar(); } }}
                      className="resize-none text-[13px] min-h-0" />
                    <Button size="icon" className="rounded-xl h-auto w-11 shrink-0" disabled={!texto.trim() || comentar.isPending} onClick={mandar} aria-label="Mandar">
                      {comentar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
