import { useEffect, useRef, useState } from "react";
import { useExternalClients, type ExternalClient, type ExternalClientInput, type PortalSettings } from "@/hooks/useCriaPost";
import { useCrmClients } from "@/hooks/useCrm";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { validateUpload } from "@/lib/upload-validation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Image as ImageIcon, Eye, EyeOff, Check } from "lucide-react";
import { BrandColorPicker } from "@/components/accounts/BrandColorPicker";
import { ClientColorPicker } from "@/components/shared/ClientColorPicker";

// Cores de RESERVA do calendário geral: usadas só pra dar um tom a quem ainda não tem
// cor escolhida (índice modular no ManagerCalendar). NÃO é mais uma paleta de escolha,
// a escolha vive no ClientColorPicker (paleta única, src/lib/brand-palette.ts).
export const CLIENT_COLORS = ["#EA4918", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#EF4444", "#14B8A6", "#A855F7", "#6366F1", "#F97316", "#0EA5E9", "#84CC16", "#D946EF", "#8B5E34", "#0061EE", "#DC2626"];

// Edição do cliente de aprovação por link: logo e cor do portal, vínculo com o
// cadastro central, notas e cor do calendário. Extraído da antiga lista do Cria Post
// pra viver dentro do hub do cliente (ClienteHub) sem duplicar telas.
// Interruptor de aba do portal, mostra o que o cliente ganha ao ligar.
function PortalToggle({ on, onClick, title, desc }: { on: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
        on ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}>
      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${
        on ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
        {on && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-body font-semibold text-foreground">{title}</span>
        <span className="block text-[11.5px] font-body text-muted-foreground leading-tight">{desc}</span>
      </span>
    </button>
  );
}

export function ExternalClientDialog({ open, onOpenChange, client }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client: ExternalClient | null;
}) {
  const { update, setActive } = useExternalClients();
  const { data: crmClients = [] } = useCrmClients();
  const { user } = useAuth();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  // Cor: abre com o que está gravado, SEM chutar um padrão. Antes abria em #EA4918
  // quando o campo estava vazio e qualquer salvamento gravava esse laranja por cima
  // da cor escolhida na ficha.
  const [f, setF] = useState<ExternalClientInput>({ name: "", instagram_handle: "", notes: "", color: null, crm_client_id: null, logo_url: null, brand_color: null, portal_settings: {} });

  useEffect(() => {
    if (open && client) {
      setF({ name: client.name, instagram_handle: client.instagram_handle ?? "", notes: client.notes ?? "", color: client.color ?? null, crm_client_id: client.crm_client_id ?? null, logo_url: client.logo_url ?? null, brand_color: client.brand_color ?? null, portal_settings: client.portal_settings ?? {} });
    }
  }, [open, client]);

  const ps = f.portal_settings ?? {};
  const setPs = (patch: PortalSettings) => setF((p) => ({ ...p, portal_settings: { ...(p.portal_settings ?? {}), ...patch } }));

  if (!client) return null;

  const submit = async () => {
    if (!f.name.trim()) return;
    await update.mutateAsync({ id: client.id, ...f });
    onOpenChange(false);
  };

  // Reusa a infra de upload do bucket avatars (mesma dos logos da gestora).
  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    const v = validateUpload(file, "managerAvatar");
    if (!v.ok) { toast.error(v.reason); return; }
    setUploadingLogo(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/cria-post-client-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setF((p) => ({ ...p, logo_url: `${data.publicUrl}?t=${Date.now()}` }));
      toast.success("Logo enviada!");
    } catch {
      toast.error("Erro ao enviar a logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Personalizar cliente</DialogTitle>
          <p className="text-[12.5px] font-body text-muted-foreground">
            Duas coisas diferentes moram aqui: o que <strong>o cliente vê</strong> na página de aprovação, e o que <strong>só você vê</strong> no seu painel.
          </p>
        </DialogHeader>

        <div className="space-y-5">
          {/* ───────── O QUE O CLIENTE VÊ ───────── */}
          <section className="rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary shrink-0" />
              <p className="text-[12px] font-body font-bold uppercase tracking-wider text-primary">O que o cliente vê</p>
            </div>
            <p className="text-[11.5px] font-body text-muted-foreground -mt-1">
              Isso aparece na página que você manda pra ele aprovar os posts.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-body">Nome exibido *</Label>
              <Input value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} className="rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-body">@ do Instagram</Label>
              <Input value={f.instagram_handle ?? ""} onChange={(e) => setF((p) => ({ ...p, instagram_handle: e.target.value }))} placeholder="@cliente" className="rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-body">Logo da marca</Label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl border border-border bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {f.logo_url ? <img src={f.logo_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
                </div>
                <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                  {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar imagem"}
                </Button>
                {f.logo_url && <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setF((p) => ({ ...p, logo_url: null }))}>Remover</Button>}
                <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleLogoSelect} />
              </div>
              <Input value={f.logo_url ?? ""} onChange={(e) => setF((p) => ({ ...p, logo_url: e.target.value || null }))} placeholder="ou cole a URL da imagem" className="rounded-xl text-xs" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-body">Cor da marca</Label>
              <p className="text-[11px] font-body text-muted-foreground -mt-1">Pinta os botões e destaques da página de aprovação com a cara do cliente.</p>
              <BrandColorPicker value={f.brand_color ?? null} onChange={(c) => setF((p) => ({ ...p, brand_color: c }))} />
              <div className="flex items-center flex-wrap gap-2 pt-1">
                <span className="text-[10px] font-body uppercase tracking-wide text-muted-foreground">Outra</span>
                <input type="color" value={f.brand_color ?? "#EA4918"} onChange={(e) => setF((p) => ({ ...p, brand_color: e.target.value }))}
                  className="h-7 w-9 rounded-lg border border-border bg-transparent p-0.5 cursor-pointer" aria-label="Cor personalizada" />
                {f.brand_color && <button type="button" onClick={() => setF((p) => ({ ...p, brand_color: null }))} className="text-[11px] font-body text-muted-foreground hover:text-foreground">Limpar</button>}
              </div>
            </div>

            {/* ── O que mais o cliente encontra no link ──
                O portal já sabe montar as duas abas. Aqui a gestora decide se liga.
                Com as duas ligadas, o link deixa de ser "aprove os posts" e vira
                a área do cliente: aprovações + calendário + relatório num lugar só. */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs font-body">Abas do link</Label>
              <PortalToggle
                on={!!ps.show_calendar}
                onClick={() => setPs({ show_calendar: !ps.show_calendar })}
                title="Calendário"
                desc="O cliente vê o que já foi aprovado e quando sai. Corta metade das perguntas no WhatsApp."
              />
              <PortalToggle
                on={!!ps.show_report}
                onClick={() => setPs({ show_report: !ps.show_report })}
                title="Relatório"
                desc="Resumo do que foi entregue no período, com a marca dele. Vira prova de trabalho."
              />
              {(ps.show_calendar || ps.show_report) && (
                <p className="text-[11px] font-body text-muted-foreground">
                  O link vira a <strong>área do cliente</strong>: aprovações{ps.show_calendar ? " + calendário" : ""}{ps.show_report ? " + relatório" : ""}, tudo com a marca dele.
                </p>
              )}
            </div>
          </section>

          {/* ───────── O QUE SÓ VOCÊ VÊ ───────── */}
          <section className="rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-[12px] font-body font-bold uppercase tracking-wider text-muted-foreground">Só você vê</p>
            </div>

            {/* COR DO CLIENTE: é a MESMA cor da ficha. Era uma segunda paleta (16 cores)
                pra um segundo campo, e por isso o post na agenda ficava com uma cor e o
                resto do app com outra. Salvar aqui grava também no cadastro central. */}
            <div className="space-y-1.5">
              <Label className="text-xs font-body">Cor do cliente</Label>
              <p className="text-[11px] font-body text-muted-foreground -mt-1">A mesma cor da ficha. Pinta o card na agenda, no calendário e na lista. O cliente nunca vê esta cor.</p>
              <div className="rounded-xl border border-border p-2.5">
                <ClientColorPicker value={f.color ?? null}
                  onChange={(c) => setF((p) => ({ ...p, color: c }))}
                  onClear={() => setF((p) => ({ ...p, color: null }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-body">Ficha do cliente</Label>
              <select
                value={f.crm_client_id ?? ""}
                onChange={(e) => {
                  const id = e.target.value || null;
                  const c = id ? crmClients.find((x) => x.id === id) : null;
                  setF((p) => ({
                    ...p,
                    crm_client_id: id,
                    ...(c ? { name: c.name, instagram_handle: c.instagram ?? "", notes: c.notes ?? "" } : {}),
                  }));
                }}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">Sem vínculo</option>
                {crmClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="text-[11px] text-muted-foreground font-body">
                Liga esta página de aprovação à ficha do cliente no Cria Gestão. Sem o vínculo, posts, relatório e financeiro ficam soltos.
              </p>
            </div>

            {/* As anotações saíram daqui: agora moram na Visão geral do cliente,
                que é onde a pessoa procura por elas. */}
            <p className="text-[11px] font-body text-muted-foreground rounded-xl bg-muted/40 px-3 py-2">
              Procurando as <strong>anotações</strong>? Elas passaram pra aba <strong>Visão geral</strong> do cliente.
            </p>
          </section>
        </div>
        <DialogFooter className="mt-4 sm:justify-between">
          <Button variant="ghost" className="text-destructive mr-auto" onClick={async () => { await setActive.mutateAsync({ id: client.id, active: false }); onOpenChange(false); }}>Desativar</Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={update.isPending || !f.name.trim()}>{update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
