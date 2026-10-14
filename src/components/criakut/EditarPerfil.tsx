import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSalvarPerfilCriakut, useSalvarServicos } from "@/hooks/useCriakut";
import {
  ESTILOS, FUNCOES, NICHOS, UNIDADES, slugValido,
  type FuncaoCriakut, type PerfilCriakut, type Servico, type Unidade,
} from "@/lib/criakut";
import { cn } from "@/lib/utils";

/* EDITAR A MINHA PÁGINA. Um painel só pra tudo que é texto: quem eu sou,
   o que faço, estilos, nichos, serviços e se a página aparece na busca.
   Foto e capa têm botões próprios em cima da página, que é onde se espera. */

type Form = Pick<PerfilCriakut, "nome" | "slug" | "funcao" | "cidade" | "atende_remoto" | "sobre" | "status_texto" | "recado_do_dia" | "estilos" | "nichos" | "instagram" | "publicado">;

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
    setF({ nome, slug, funcao, cidade, atende_remoto, sobre, status_texto, recado_do_dia, estilos, nichos, instagram, publicado });
    setServ(servicos.map((s) => ({ ...s, precoTxt: reaisDe(s.preco_centavos) })));
  }, [open, perfil, servicos]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const ocupado = salvar.isPending || salvarServ.isPending;

  const gravar = async () => {
    if (f.nome.trim().length < 2) { toast.error("Coloque seu nome."); return; }
    if (!slugValido(f.slug)) { toast.error("Endereço: só letras minúsculas, números e hífen (3 a 40)."); return; }
    try {
      await salvar.mutateAsync({ ...f, nome: f.nome.trim(), sobre: f.sobre?.trim() || null,
        status_texto: f.status_texto?.trim() || null, recado_do_dia: f.recado_do_dia?.trim() || null,
        cidade: f.cidade?.trim() || null, instagram: f.instagram?.replace(/^@/, "").trim() || null });
      await salvarServ.mutateAsync(serv.map((s, i) => ({ ...s, preco_centavos: centavosDe(s.precoTxt), ordem: i })));
      toast.success("Página atualizada!");
      onOpenChange(false);
    } catch { /* os hooks já avisam */ }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">Editar minha página</SheetTitle>
          <SheetDescription>O que você escrever aqui aparece pra quem abrir sua página no Criakut.</SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <div className="grid gap-1.5"><Label>Nome</Label><Input value={f.nome} maxLength={80} onChange={(e) => set("nome", e.target.value)} /></div>
          <div className="grid gap-1.5">
            <Label>Endereço da página</Label>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground whitespace-nowrap">criakut/</span>
              <Input value={f.slug} maxLength={40} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>O que você faz</Label>
            <div className="flex flex-wrap gap-1.5">
              {FUNCOES.map((x) => (
                <button key={x.valor} type="button" onClick={() => set("funcao", x.valor as FuncaoCriakut)}
                  className={cn("rounded-full border px-3 py-1 text-[12px] font-semibold", f.funcao === x.valor ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>
                  {x.nome}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div className="grid gap-1.5"><Label>Cidade</Label><Input value={f.cidade ?? ""} maxLength={80} placeholder="Itajaí" onChange={(e) => set("cidade", e.target.value)} /></div>
            <label className="flex items-center gap-2 pb-2 text-[13px] font-semibold"><Switch checked={f.atende_remoto} onCheckedChange={(v) => set("atende_remoto", v)} />Atende remoto</label>
          </div>
          <div className="grid gap-1.5">
            <Label>Sobre você ("Oi, eu sou a…")</Label>
            <Textarea rows={4} maxLength={600} value={f.sobre ?? ""} placeholder="O que você faz, pra quem, e do que tem orgulho." onChange={(e) => set("sobre", e.target.value)} />
            <span className="text-[11px] text-muted-foreground text-right">{(f.sobre ?? "").length}/600</span>
          </div>
          <div className="grid gap-1.5"><Label>Status</Label><Input value={f.status_texto ?? ""} maxLength={120} placeholder="Agenda aberta pra 2 clientes em novembro" onChange={(e) => set("status_texto", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Recado do dia</Label><Input value={f.recado_do_dia ?? ""} maxLength={160} placeholder="Procurando editor de vídeo pra Reels de clínica" onChange={(e) => set("recado_do_dia", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Seu estilo</Label><Chips opcoes={ESTILOS} valor={f.estilos} onChange={(v) => set("estilos", v)} /></div>
          <div className="grid gap-1.5"><Label>Nichos que atende</Label><Chips opcoes={NICHOS} valor={f.nichos} onChange={(v) => set("nichos", v)} /></div>
          <div className="grid gap-1.5"><Label>Instagram</Label><Input value={f.instagram ?? ""} maxLength={40} placeholder="@seuperfil" onChange={(e) => set("instagram", e.target.value)} /></div>

          <div className="rounded-2xl border border-border p-3.5">
            <div className="flex items-center justify-between mb-2">
              <Label>Serviços e preços</Label>
              <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setServ((s) => [...s, { titulo: "", detalhe: "", preco_centavos: null, precoTxt: "", unidade: "peca", ordem: s.length }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
            </div>
            {serv.length === 0 && <p className="text-[12px] text-muted-foreground">Nenhum serviço ainda.</p>}
            <div className="space-y-2.5">
              {serv.map((s, i) => (
                <div key={i} className="grid gap-1.5 rounded-xl bg-muted/40 p-2.5">
                  <div className="flex gap-2">
                    <Input value={s.titulo} maxLength={80} placeholder="Carrossel até 7 slides" onChange={(e) => setServ((l) => l.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)))} />
                    <Button type="button" size="icon" variant="ghost" aria-label="Remover serviço" onClick={() => setServ((l) => l.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Input value={s.detalhe ?? ""} maxLength={160} placeholder="2 ajustes inclusos (opcional)" onChange={(e) => setServ((l) => l.map((x, j) => (j === i ? { ...x, detalhe: e.target.value } : x)))} />
                  <div className="flex gap-2 items-center">
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

          <label className="flex items-start gap-3 rounded-2xl border border-border p-3.5">
            <Switch checked={f.publicado} onCheckedChange={(v) => set("publicado", v)} className="mt-0.5" />
            <span><span className="block text-[13.5px] font-bold">Mostrar minha página na busca</span>
              <span className="block text-[12px] text-muted-foreground">Desligado, só você vê. Você pode esconder de novo quando quiser.</span></span>
          </label>

          <Button className="w-full rounded-xl h-11" disabled={ocupado} onClick={() => void gravar()}>
            {ocupado ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Salvar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
