import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Image as ImageIcon, Loader2, Link2, ExternalLink, Check, CalendarDays, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useExternalClients, type ExternalClient, type ExternalClientInput, type PortalSettings } from "@/hooks/useCriaPost";
import { useCrmClients } from "@/hooks/useCrm";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { validateUpload } from "@/lib/upload-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BrandColorPicker } from "@/components/accounts/BrandColorPicker";
import { ClientColorPicker } from "@/components/shared/ClientColorPicker";
import { confirmar } from "@/components/shared/Confirm";

// ═══════════════════════════════════════════════════════════════════════
// ABA PORTAL
//
// Isto era um popup. Espremia marca do cliente, cor do calendário, vínculo
// com o CRM e as abas do link num retângulo com scroll, e ninguém entendia
// o que era o quê. Virou aba, com espaço, dividida em duas metades óbvias:
// o que o CLIENTE vê × o que só VOCÊ vê.
// ═══════════════════════════════════════════════════════════════════════
export function ClientePortalTab({ client, onCopyLink, onOpenPortal, copying }: {
  client: ExternalClient;
  onCopyLink: () => void;
  onOpenPortal: () => void;
  copying: boolean;
}) {
  const { update, setActive } = useExternalClients();
  const { data: crmClients = [] } = useCrmClients();
  const { user } = useAuth();
  const logoRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Estado inicial do formulário a partir do cliente. Ficava copiado em três lugares
  // (montagem, refetch e "Descartar"), e a cor divergia entre eles.
  // COR: nunca "chuta" uma cor padrão aqui. Antes o formulário abria com #EA4918 quando o
  // campo estava vazio e, ao salvar QUALQUER coisa do portal, gravava essa cor por cima.
  // Foi assim que o cliente ficou laranja na agenda mesmo depois de a pessoa escolher
  // outra cor na ficha.
  const formDoCliente = (c: ExternalClient): ExternalClientInput => ({
    name: c.name, instagram_handle: c.instagram_handle ?? "", notes: c.notes ?? "",
    color: c.color ?? null, crm_client_id: c.crm_client_id ?? null,
    logo_url: c.logo_url ?? null, brand_color: c.brand_color ?? null,
    portal_settings: c.portal_settings ?? {},
  });

  const [f, setF] = useState<ExternalClientInput>(() => formDoCliente(client));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setF(formDoCliente(client));
    setDirty(false);
  }, [client]);

  const set = (patch: Partial<ExternalClientInput>) => { setF((p) => ({ ...p, ...patch })); setDirty(true); };
  const ps = f.portal_settings ?? {};
  const setPs = (patch: PortalSettings) => set({ portal_settings: { ...ps, ...patch } });

  const salvar = async () => {
    if (!f.name.trim()) { toast.error("O nome não pode ficar vazio."); return; }
    await update.mutateAsync({ id: client.id, ...f });
    setDirty(false);
    toast.success("Portal atualizado.");
  };

  const subirLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !user) return;
    const v = validateUpload(file, "managerAvatar");
    if (!v.ok) { toast.error(v.reason); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/cria-post-client-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      set({ logo_url: `${data.publicUrl}?t=${Date.now()}` });
      toast.success("Logo enviada. Não esqueça de salvar.");
    } catch { toast.error("Erro ao enviar a logo."); }
    finally { setUploading(false); }
  };

  const brand = f.brand_color ?? "#EA4918";

  return (
    <div className="space-y-5 pb-24">
      {/* Ações do link */}
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-display font-bold text-foreground">Link de aprovação</p>
          <p className="text-[12px] font-body text-muted-foreground">É esta página que o cliente abre. Sem senha, sem cadastro.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onCopyLink} disabled={copying}>
          {copying ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5 mr-1.5" />} Copiar link
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenPortal}><ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ─────────── O QUE O CLIENTE VÊ ─────────── */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <header>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-display font-bold text-foreground">O que o cliente vê</h3>
            </div>
            <p className="text-[12px] font-body text-muted-foreground mt-0.5">Tudo aqui aparece na página que ele abre.</p>
          </header>

          {/* Prévia, mostra o efeito antes de salvar. */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="p-4 flex items-center gap-3" style={{ background: `${brand}12` }}>
              <div className="w-11 h-11 rounded-xl bg-background border border-border overflow-hidden grid place-items-center shrink-0">
                {f.logo_url ? <img src={f.logo_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-display font-bold truncate" style={{ color: brand }}>{f.name || "Nome do cliente"}</p>
                {f.instagram_handle && <p className="text-[11px] font-body text-muted-foreground truncate">@{f.instagram_handle.replace(/^@/, "")}</p>}
              </div>
              <span className="ml-auto text-[11px] font-body font-bold px-3 py-1.5 rounded-lg text-white shrink-0" style={{ background: brand }}>Aprovar</span>
            </div>
            <p className="text-[10.5px] font-body text-muted-foreground text-center py-1.5 bg-muted/40">prévia</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nome exibido *</Label>
            <Input value={f.name} onChange={(e) => set({ name: e.target.value })} className="rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">@ do Instagram</Label>
            <Input value={f.instagram_handle ?? ""} onChange={(e) => set({ instagram_handle: e.target.value })} placeholder="@cliente" className="rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Logo da marca</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={() => logoRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar imagem"}
              </Button>
              {f.logo_url && <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => set({ logo_url: null })}>Remover</Button>}
              <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={subirLogo} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Cor da marca</Label>
            <p className="text-[11px] font-body text-muted-foreground -mt-1">Pinta os botões e destaques da página dele.</p>
            <BrandColorPicker value={f.brand_color ?? null} onChange={(c) => set({ brand_color: c })} />
            <div className="flex items-center flex-wrap gap-2 pt-1">
              <span className="text-[10px] font-body uppercase tracking-wide text-muted-foreground">Outra</span>
              <input type="color" value={f.brand_color ?? "#EA4918"} onChange={(e) => set({ brand_color: e.target.value })}
                className="h-7 w-9 rounded-lg border border-border bg-transparent p-0.5 cursor-pointer" aria-label="Cor personalizada" />
              {f.brand_color && <button type="button" onClick={() => set({ brand_color: null })} className="text-[11px] font-body text-muted-foreground hover:text-foreground">Limpar</button>}
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <Label className="text-xs">Abas do link</Label>
            <Toggle on={!!ps.show_calendar} onClick={() => setPs({ show_calendar: !ps.show_calendar })}
              icon={CalendarDays} title="Calendário"
              desc="Ele vê o que já foi aprovado e quando sai. Corta metade das perguntas no WhatsApp." />
            <Toggle on={!!ps.show_report} onClick={() => setPs({ show_report: !ps.show_report })}
              icon={BarChart3} title="Relatório"
              desc="Resumo do que foi entregue no período, com a marca dele. Vira prova de trabalho." />
            {(ps.show_calendar || ps.show_report) && (
              <p className="text-[11.5px] font-body text-muted-foreground">
                Com isso o link deixa de ser “aprove os posts” e vira a <strong>área do cliente</strong>.
              </p>
            )}
          </div>
        </section>

        {/* ─────────── SÓ VOCÊ VÊ ─────────── */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4 h-fit">
          <header>
            <div className="flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-display font-bold text-foreground">Só você vê</h3>
            </div>
            <p className="text-[12px] font-body text-muted-foreground mt-0.5">Organização interna. O cliente nunca enxerga nada disto.</p>
          </header>

          {/* COR DO CLIENTE: é a MESMA cor da ficha, não uma segunda cor "só do
              calendário". Salvar aqui grava nas duas pontas (o hook propaga pro
              cadastro central, e o banco espelha de volta), então a agenda, o kanban,
              a lista e o calendário mostram sempre a mesma cor. */}
          <div className="space-y-1.5">
            <Label className="text-xs">Cor do cliente</Label>
            <p className="text-[11px] font-body text-muted-foreground -mt-1">A mesma cor da ficha. Pinta o card na agenda, no calendário e na lista.</p>
            <div className="rounded-xl border border-border p-2.5">
              <ClientColorPicker value={f.color ?? null} onChange={(c) => set({ color: c })} onClear={() => set({ color: null })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Ficha do cliente</Label>
            <select value={f.crm_client_id ?? ""} onChange={(e) => set({ crm_client_id: e.target.value || null })}
              className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm">
              <option value="">Sem vínculo</option>
              {crmClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="text-[11px] font-body text-muted-foreground">
              Liga esta página à ficha no Cria Gestão. Sem o vínculo, posts, relatório e financeiro ficam soltos.
            </p>
          </div>

          <div className="pt-2 border-t border-border/60">
            <Button variant="ghost" className="text-destructive hover:text-destructive px-0"
              onClick={async () => {
                if (!(await confirmar({ titulo: "Desativar este cliente no Cria Post?", descricao: "O link de aprovação dele para de funcionar na hora.", acao: "Desativar" }))) return;
                await setActive.mutateAsync({ id: client.id, active: false });
                toast.success("Cliente desativado no Cria Post.");
              }}>
              Desativar no Cria Post
            </Button>
          </div>
        </section>
      </div>

      {/* Barra de salvar, só aparece quando há mudança. */}
      {dirty && (
        <div className="sticky bottom-4 z-10 rounded-2xl border border-primary/30 bg-card shadow-lg px-4 py-3 flex items-center gap-3">
          <p className="text-[13px] font-body text-foreground flex-1">Você tem alterações não salvas.</p>
          <Button variant="outline" size="sm" onClick={() => { setF(formDoCliente(client)); setDirty(false); }}>Descartar</Button>
          <Button size="sm" onClick={salvar} disabled={update.isPending}>
            {update.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />} Salvar
          </Button>
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onClick, icon: Icon, title, desc }: {
  on: boolean; onClick: () => void; icon: typeof CalendarDays; title: string; desc: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn("w-full flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
        on ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40")}>
      <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border",
        on ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40")}>
        {on && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13px] font-body font-semibold text-foreground">
          <Icon className="h-3.5 w-3.5" /> {title}
        </span>
        <span className="block text-[11.5px] font-body text-muted-foreground leading-tight mt-0.5">{desc}</span>
      </span>
    </button>
  );
}

export default ClientePortalTab;
