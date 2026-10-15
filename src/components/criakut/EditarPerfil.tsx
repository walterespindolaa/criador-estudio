import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Instagram, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSalvarPerfilCriakut, useSalvarServicos } from "@/hooks/useCriakut";
import { CidadeInput } from "./CidadeInput";
import { EscolherFuncoes } from "./EscolherFuncoes";
import {
  ESTILOS, NICHOS, PODE_BUSCAR, UNIDADES, ehContratante, ehGestao, limparInstagram, ofereceServico, slugValido,
  type PerfilCriakut, type Servico, type Unidade,
} from "@/lib/criakut";
import { cn } from "@/lib/utils";

/* EDITAR A MINHA PÁGINA. Um painel só pra tudo que é texto: quem eu sou,
   o que faço, estilos, nichos, serviços e se a página aparece na busca.
   Foto e capa têm botões próprios em cima da página, que é onde se espera.

   15/10/2026 (Walter): virou popup no meio da tela (era gaveta grudada do lado),
   com título e Salvar sempre à vista, campos em blocos, "Status" virou
   Disponibilidade (é o selo verde do topo) e o Instagram conectado no Cria
   aparece como conectado, em vez de um campo solto que podia apontar pra
   outro perfil que não o dos posts mostrados. */

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 font-display text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground after:h-px after:flex-1 after:bg-border">{titulo}</h3>
      {children}
    </section>
  );
}

function Linha({ titulo, texto, checked, onChange }: { titulo: string; texto: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3.5 py-3">
      <span><span className="block text-[13.5px] font-bold">{titulo}</span><span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{texto}</span></span>
      <Switch checked={checked} onCheckedChange={onChange} className="shrink-0" />
    </label>
  );
}

/** O Instagram conectado no Cria (o mesmo que alimenta os posts da página). */
function useMeuInstagramConectado(ativo: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["criakut-ig-conectado", user?.id],
    enabled: ativo && !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("social_connections").select("username")
        .eq("user_id", user!.id).eq("provider", "instagram").is("crm_client_id", null).maybeSingle();
      return (data?.username as string | null | undefined) ?? null;
    },
  });
}

type Form = Pick<PerfilCriakut, "nome" | "slug" | "funcao" | "cidade" | "atende_remoto" | "sobre" | "status_texto" | "recado_do_dia" | "estilos" | "nichos" | "instagram" | "publicado"
  | "mostrar_cidade" | "mostrar_instagram" | "busco" | "busco_texto" | "outras_funcoes">;

function Chips({ opcoes, valor, onChange }: { opcoes: string[]; valor: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => {
        const on = valor.includes(o);
        return (
          <button key={o} type="button" onClick={() => onChange(on ? valor.filter((x) => x !== o) : [...valor, o])}
            className={cn("rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors",
              on ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

const reaisDe = (c: number | null) => (c == null ? "" : String(c / 100).replace(".", ","));
const centavosDe = (t: string) => {
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return t.trim() === "" || Number.isNaN(n) ? null : Math.round(n * 100);
};

export function EditarPerfil({ open, onOpenChange, perfil, servicos }: {
  open: boolean; onOpenChange: (v: boolean) => void; perfil: PerfilCriakut; servicos: Servico[];
}) {
  const salvar = useSalvarPerfilCriakut();
  const salvarServ = useSalvarServicos();
  const [f, setF] = useState<Form>(() => ({ ...perfil }));
  const [serv, setServ] = useState<(Servico & { precoTxt: string })[]>([]);

  useEffect(() => {
    if (!open) return;
    // Só os campos editáveis: a página chega com listas e números junto, que não são colunas.
    const { nome, slug, funcao, cidade, atende_remoto, sobre, status_texto, recado_do_dia, estilos, nichos, instagram, publicado } = perfil;
    setF({ nome, slug, funcao, cidade, atende_remoto, sobre, status_texto, recado_do_dia, estilos, nichos, instagram, publicado,
      mostrar_cidade: perfil.mostrar_cidade ?? true, mostrar_instagram: perfil.mostrar_instagram ?? true,
      busco: perfil.busco ?? [], busco_texto: perfil.busco_texto ?? null, outras_funcoes: perfil.outras_funcoes ?? [] });
    setServ(servicos.map((s) => ({ ...s, precoTxt: reaisDe(s.preco_centavos) })));
  }, [open, perfil, servicos]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const ocupado = salvar.isPending || salvarServ.isPending;
  /* Perfil por função (Walter, 14/10/2026): criadora não vende serviço, então
     não vê tabela de preço; prestador não contrata, então não vê "o que busco". */
  const contratante = ehContratante(f.funcao);
  const oferece = ofereceServico(f.funcao);
  const busca = f.funcao === "criadora" || ehGestao(f.funcao);
  const igConectado = useMeuInstagramConectado(open).data ?? null;
  const agencia = f.funcao === "agencia";

  const gravar = async () => {
    if (f.nome.trim().length < 2) { toast.error("Coloque seu nome."); return; }
    if (!slugValido(f.slug)) { toast.error("Endereço: só letras minúsculas, números e hífen (3 a 40)."); return; }
    const ig = igConectado ? limparInstagram(igConectado) : limparInstagram(f.instagram);
    if (!igConectado && f.instagram?.trim() && !ig) { toast.error("Instagram: só o @ (letras, números, ponto e _)."); return; }
    try {
      await salvar.mutateAsync({ ...f, outras_funcoes: f.funcao === "criadora" ? [] : (f.outras_funcoes ?? []).filter((x) => x !== f.funcao), nome: f.nome.trim(), busco_texto: f.busco_texto?.trim() || null, busco: busca ? f.busco : [], sobre: f.sobre?.trim() || null,
        status_texto: f.status_texto?.trim() || null, recado_do_dia: f.recado_do_dia?.trim() || null,
        cidade: f.cidade || null, instagram: ig });
      if (oferece) await salvarServ.mutateAsync(serv.map((s, i) => ({ ...s, preco_centavos: centavosDe(s.precoTxt), ordem: i })));
      toast.success("Página atualizada!");
      onOpenChange(false);
    } catch { /* os hooks já avisam */ }
  };

  const chip = (on: boolean) => cn("rounded-full border px-3 py-1.5 text-[12px] font-semibold", on ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] gap-0 overflow-hidden p-0 sm:p-0">
        <div className="shrink-0 border-b border-border px-5 pb-3 pt-5 pr-14 sm:px-6">
          <DialogTitle className="font-display text-[21px] leading-tight">Editar minha página</DialogTitle>
          <DialogDescription className="mt-1 text-[12.5px]">O que você escrever aqui aparece pra quem abrir sua página no Criakut.</DialogDescription>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          <Bloco titulo="Quem é você">
            <div className="grid gap-1.5"><Label>Nome da página</Label><Input value={f.nome} maxLength={80} onChange={(e) => set("nome", e.target.value)} /></div>
            <div className="grid gap-1.5">
              <Label>Endereço</Label>
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-[12px] text-muted-foreground">criakut/</span>
                <Input value={f.slug} maxLength={40} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>O que você faz</Label>
              <EscolherFuncoes tamanho="sm" principal={f.funcao} outras={f.outras_funcoes ?? []}
                onChange={(p, o) => setF((x) => ({ ...x, funcao: p, outras_funcoes: o, busco: (x.busco ?? []).filter((b) => b !== p && !o.includes(b)) }))} />
            </div>
          </Bloco>

          <Bloco titulo="Onde você atende">
            <CidadeInput value={f.cidade ?? null} onChange={(v) => set("cidade", v)} placeholder="Sua cidade (digite e escolha)" />
            {oferece && <Linha titulo="Atende remoto" texto="Clientes de qualquer cidade te acham." checked={f.atende_remoto} onChange={(v) => set("atende_remoto", v)} />}
            <Linha titulo="Mostrar minha cidade" texto='Desligado, ninguém te acha na busca "perto de mim".' checked={f.mostrar_cidade ?? true} onChange={(v) => set("mostrar_cidade", v)} />
          </Bloco>

          {busca && (
            <Bloco titulo="O que você procura">
              <div className="flex flex-wrap gap-1.5">
                {PODE_BUSCAR.filter((x) => x.valor !== f.funcao && !(f.outras_funcoes ?? []).includes(x.valor)).map((x) => {
                  const on = (f.busco ?? []).includes(x.valor);
                  return (
                    <button key={x.valor} type="button" onClick={() => set("busco", on ? (f.busco ?? []).filter((y) => y !== x.valor) : [...(f.busco ?? []), x.valor])} className={chip(on)}>
                      {x.nome}
                    </button>
                  );
                })}
              </div>
              <Textarea rows={2} maxLength={300} value={f.busco_texto ?? ""} placeholder="Ex.: Editor que entenda de Reels de clínica, 8 vídeos por mês" className="placeholder:text-muted-foreground/50" onChange={(e) => set("busco_texto", e.target.value)} />
            </Bloco>
          )}

          <Bloco titulo="Sua apresentação">
            <div className="grid gap-1.5">
              <Label>{agencia ? "Sobre a agência" : "Sobre você"}</Label>
              <Textarea rows={4} maxLength={600} value={f.sobre ?? ""} className="placeholder:text-muted-foreground/50" onChange={(e) => set("sobre", e.target.value)}
                placeholder={agencia ? "Oi, a gente é a… O que vocês fazem, pra quem, e do que têm orgulho." : "Oi, eu sou a… O que você faz, pra quem, e do que tem orgulho."} />
              <span className="text-right text-[11px] text-muted-foreground">{(f.sobre ?? "").length}/600</span>
            </div>
            <div className="grid gap-1.5">
              <Label className="flex items-center gap-2">Disponibilidade <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">selo verde no topo</span></Label>
              <Input value={f.status_texto ?? ""} maxLength={120} placeholder="Ex.: Agenda aberta pra 2 clientes em novembro" className="placeholder:text-muted-foreground/50" onChange={(e) => set("status_texto", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Recado do dia</Label>
              <Input value={f.recado_do_dia ?? ""} maxLength={160} placeholder="Ex.: Procurando editor de vídeo pra Reels de clínica" className="placeholder:text-muted-foreground/50" onChange={(e) => set("recado_do_dia", e.target.value)} />
              <span className="text-[11.5px] text-muted-foreground">Aparece em destaque na sua página. Troque quando quiser.</span>
            </div>
          </Bloco>

          <Bloco titulo={contratante ? "Seu conteúdo" : "Pra quem você trabalha"}>
            <div className="grid gap-1.5"><Label>{contratante ? "Seu nicho" : "Nichos que atende"}</Label><Chips opcoes={NICHOS} valor={f.nichos} onChange={(v) => set("nichos", v)} /></div>
            <div className="grid gap-1.5"><Label>Seu estilo</Label><Chips opcoes={ESTILOS} valor={f.estilos} onChange={(v) => set("estilos", v)} /></div>
          </Bloco>

          <Bloco titulo="Instagram">
            {igConectado ? (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-400 to-amber-300 text-white"><Instagram className="h-4 w-4" /></span>
                <span><b className="block text-[13.5px]">@{igConectado}</b>
                  <span className="flex items-center gap-1 text-[11.5px] font-bold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Conectado no Cria</span></span>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Input value={f.instagram ?? ""} maxLength={40} placeholder="@seuperfil" onChange={(e) => set("instagram", e.target.value)} />
                <span className="text-[11.5px] text-muted-foreground">Conecte seu Instagram no Cria (em Insights) e seus últimos posts e seguidores aparecem na página sozinhos.</span>
              </div>
            )}
            <Linha titulo="Mostrar posts e seguidores" texto="Seus últimos posts aparecem na aba Instagram da página." checked={f.mostrar_instagram ?? true} onChange={(v) => set("mostrar_instagram", v)} />
          </Bloco>

          {oferece && (
            <Bloco titulo="Serviços e preços">
              <div className="rounded-2xl border border-border bg-card p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13.5px] font-bold">{serv.length === 0 ? "Nenhum serviço ainda" : `${serv.length} ${serv.length === 1 ? "serviço" : "serviços"}`}</span>
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-primary" onClick={() => setServ((s) => [...s, { titulo: "", detalhe: "", preco_centavos: null, precoTxt: "", unidade: "peca", ordem: s.length }])}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
                  </Button>
                </div>
                <div className="space-y-2.5">
                  {serv.map((s, i) => (
                    <div key={i} className="grid gap-1.5 rounded-xl bg-muted/40 p-2.5">
                      <div className="flex gap-2">
                        <Input value={s.titulo} maxLength={80} placeholder="Ex.: Carrossel até 7 slides" className="placeholder:text-muted-foreground/50" onChange={(e) => setServ((l) => l.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)))} />
                        <Button type="button" size="icon" variant="ghost" aria-label="Remover serviço" onClick={() => setServ((l) => l.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                      <Input value={s.detalhe ?? ""} maxLength={160} placeholder="Ex.: 2 ajustes inclusos (opcional)" className="placeholder:text-muted-foreground/50" onChange={(e) => setServ((l) => l.map((x, j) => (j === i ? { ...x, detalhe: e.target.value } : x)))} />
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-muted-foreground">R$</span>
                        <Input inputMode="decimal" className="w-28" value={s.precoTxt} placeholder="90" onChange={(e) => setServ((l) => l.map((x, j) => (j === i ? { ...x, precoTxt: e.target.value } : x)))} />
                        <select value={s.unidade} onChange={(e) => setServ((l) => l.map((x, j) => (j === i ? { ...x, unidade: e.target.value as Unidade } : x)))}
                          className="h-10 rounded-md border border-input bg-background px-2 text-[13px]">
                          {UNIDADES.map((u) => <option key={u.valor} value={u.valor}>{u.sufixo.replace("/", "por ").trim()}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Preço em branco aparece como "a combinar".</p>
              </div>
            </Bloco>
          )}

          <Bloco titulo="Visibilidade">
            <Linha titulo="Mostrar minha página na busca" texto="Desligado, só você vê. Dá pra esconder de novo quando quiser." checked={f.publicado} onChange={(v) => set("publicado", v)} />
          </Bloco>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border bg-background px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
          <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => onOpenChange(false)} disabled={ocupado}>Cancelar</Button>
          <Button className="h-11 flex-1 rounded-xl" disabled={ocupado} onClick={() => void gravar()}>
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
