import { useEffect, useState, type ReactNode } from "react";
import { Plus, Trash2, Check, Link2, Copy, RotateCcw, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  useCollabs, COLLAB_STATUSES, COLLAB_STATUS_LABEL, PROPOSAL_LABEL, type CollabStatus,
} from "@/hooks/useCollabs";
import { useProfile } from "@/hooks/useProfile";
import { useCreateFinRecord } from "@/hooks/useFinance";
import { useModules } from "@/hooks/useModules";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function CollabDialog({ open, onOpenChange, collabId }: {
  open: boolean; onOpenChange: (o: boolean) => void; collabId: string | null;
}) {
  const { collabs, createCollab, updateCollab, createDeliverable, togglePublished, deleteDeliverable, generateProposal, revokeProposal } = useCollabs();
  const editing = collabId ? collabs.find((c) => c.id === collabId) ?? null : null;
  const { profile } = useProfile();
  const { modules } = useModules();
  const createFin = useCreateFinRecord();
  const hasCaixa = modules.some((m) => m.code === "financeiro" && m.status === "active");
  const pixKey = (profile as { pix_key?: string | null } | null)?.pix_key ?? null;

  const [brand, setBrand] = useState("");
  const [contact, setContact] = useState("");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<CollabStatus>("lead");
  const [deadline, setDeadline] = useState("");
  const [objective, setObjective] = useState("");
  const [briefing, setBriefing] = useState("");
  const [notes, setNotes] = useState("");
  const [newDeliv, setNewDeliv] = useState("");
  const [pValid, setPValid] = useState("");
  const [pTerms, setPTerms] = useState("");

  useEffect(() => {
    if (!open) return;
    setBrand(editing?.brand ?? "");
    setContact(editing?.contact ?? "");
    setValue(editing?.value != null ? String(editing.value) : "");
    setStatus(editing?.status ?? "lead");
    setDeadline(editing?.deadline ?? "");
    setObjective(editing?.objective ?? "");
    setBriefing(editing?.briefing_url ?? "");
    setNotes(editing?.notes ?? "");
    setNewDeliv("");
    setPValid(editing?.proposal_valid_until ?? "");
    setPTerms(editing?.proposal_terms ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, collabId]);

  function payload() {
    return {
      brand: brand.trim(),
      contact: contact.trim() || null,
      value: value.trim() === "" ? null : Number(value),
      status,
      deadline: deadline || null,
      objective: objective.trim() || null,
      briefing_url: briefing.trim() || null,
      notes: notes.trim() || null,
    };
  }

  function save() {
    if (!brand.trim()) return;
    if (editing) updateCollab.mutate({ id: editing.id, ...payload() }, { onSuccess: () => onOpenChange(false) });
    else createCollab.mutate(payload(), { onSuccess: () => onOpenChange(false) });
  }

  function addDeliverable() {
    if (!editing || !newDeliv.trim()) return;
    createDeliverable.mutate({ collab_id: editing.id, label: newDeliv.trim(), sort_order: editing.deliverables.length });
    setNewDeliv("");
  }

  const proposalUrl = editing?.proposal_token ? `${window.location.origin}/proposta/${editing.proposal_token}` : "";
  const copyLink = () => { if (proposalUrl) navigator.clipboard?.writeText(proposalUrl).then(() => toast.success("Link copiado.")).catch(() => {}); };
  const genProposal = () => {
    if (!editing) return;
    generateProposal.mutate(
      { collabId: editing.id, brand: editing.brand, validUntil: pValid || null, terms: pTerms.trim() || null },
      { onSuccess: (token) => { navigator.clipboard?.writeText(`${window.location.origin}/proposta/${token}`).catch(() => {}); } },
    );
  };

  const markReceived = async () => {
    if (!editing) return;
    updateCollab.mutate({ id: editing.id, status: "pago" });
    if (hasCaixa && (editing.value ?? 0) > 0) {
      try {
        await createFin.mutateAsync({
          type: "entrada", context: "pf", category: "Collabs",
          description: `Publi · ${editing.brand}`, amount: editing.value ?? 0,
          status: "pago", payment_method: "Pix",
          date: new Date().toISOString().slice(0, 10),
        });
        toast.success("Recebido! Lançado no Cria Caixa.");
      } catch { /* fin record falhou, mas o status já foi marcado */ }
    } else {
      toast.success("Marcado como recebido.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>{editing ? "Editar collab" : "Nova collab"}</DialogTitle></DialogHeader>

        <div className="space-y-3.5">
          <Field label="Marca *"><Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ex.: Boticário" /></Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Contato / @"><Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="@marca" /></Field>
            <Field label="Cachê (R$)"><Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="0,00" /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select value={status} onValueChange={(v) => setStatus(v as CollabStatus)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLLAB_STATUSES.map((s) => <SelectItem key={s} value={s}>{COLLAB_STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Prazo"><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
          </div>

          <Field label="Objetivo"><Input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Ex.: divulgar o lançamento da linha X" /></Field>
          <Field label="Link do briefing"><Input value={briefing} onChange={(e) => setBriefing(e.target.value)} placeholder="https://..." /></Field>
          <Field label="Notas"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Detalhes da parceria..." /></Field>

          {editing ? (
            <div>
              <Label className="text-xs text-muted-foreground">Entregáveis ({editing.done}/{editing.total})</Label>
              <div className="mt-1.5 space-y-1.5">
                {editing.deliverables.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 bg-muted/40 rounded-xl px-2.5 py-2">
                    <button
                      type="button"
                      onClick={() => togglePublished.mutate({ id: d.id, published: !d.published })}
                      className={cn("h-5 w-5 rounded-full grid place-items-center flex-shrink-0 border transition-colors",
                        d.published ? "bg-green-600 border-green-600 text-white" : "border-muted-foreground/40 text-transparent")}
                      title={d.published ? "Publicado" : "Marcar como publicado"}
                    ><Check className="h-3 w-3" /></button>
                    <span className={cn("text-sm flex-1 truncate", d.published && "line-through text-muted-foreground")}>{d.label}</span>
                    <button type="button" onClick={() => deleteDeliverable.mutate(d.id)} className="text-muted-foreground hover:text-red-600 flex-shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input value={newDeliv} onChange={(e) => setNewDeliv(e.target.value)} placeholder="Ex.: Reel 1"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDeliverable(); } }} className="h-9" />
                  <Button type="button" variant="outline" onClick={addDeliverable} className="rounded-xl h-9 px-3"><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Salve a collab para adicionar os entregáveis (reels, stories…) e acompanhar o progresso.</p>
          )}

          {editing && (
            <div className="border-t border-border pt-3.5 space-y-3">
              <Label className="text-xs font-bold text-foreground">Orçamento / proposta</Label>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Válido até"><Input type="date" value={pValid} onChange={(e) => setPValid(e.target.value)} /></Field>
                <div className="flex items-end">
                  {editing.proposal_status !== "none" && (
                    <span className="text-[11px] font-semibold rounded-lg px-2 py-1 bg-primary/10 text-primary">{PROPOSAL_LABEL[editing.proposal_status]}</span>
                  )}
                </div>
              </div>
              <Field label="Termos (aparecem na proposta)">
                <Textarea value={pTerms} onChange={(e) => setPTerms(e.target.value)} rows={2} placeholder="Ex.: 1 rodada de ajustes · direito de uso por 90 dias" />
              </Field>
              {editing.proposal_token ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground truncate flex-1">{proposalUrl}</span>
                    <button type="button" onClick={copyLink} className="text-muted-foreground hover:text-primary flex-shrink-0"><Copy className="h-3.5 w-3.5" /></button>
                  </div>
                  {editing.proposal_status === "ajuste" && editing.proposal_client_comment && (
                    <div className="text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2">A marca pediu: "{editing.proposal_client_comment}"</div>
                  )}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={genProposal} className="rounded-xl h-9 text-xs gap-1.5 flex-1"><RotateCcw className="h-3.5 w-3.5" /> Gerar novo link</Button>
                    <Button type="button" variant="ghost" onClick={() => revokeProposal.mutate(editing.id)} className="rounded-xl h-9 text-xs text-muted-foreground">Revogar</Button>
                  </div>
                </div>
              ) : (
                <Button type="button" onClick={genProposal} disabled={generateProposal.isPending} className="rounded-xl w-full gap-2"><Link2 className="h-4 w-4" /> Gerar orçamento e copiar link</Button>
              )}

              {editing?.proposal_status === "aceita" && (
                <div className="border-t border-border pt-3 space-y-2.5">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Pagamento</Label>
                  {pixKey ? (
                    <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2 text-xs text-muted-foreground">
                      <span className="flex-1 truncate">Chave Pix exibida à marca: <b className="text-foreground">{pixKey}</b></span>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">Defina sua chave Pix em Configurações → Perfil pra ela aparecer na proposta.</p>
                  )}
                  {editing.status === "pago" ? (
                    <div className="flex items-center gap-2 text-sm font-semibold text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">✓ Pagamento recebido</div>
                  ) : (
                    <Button type="button" onClick={markReceived} className="w-full rounded-xl gap-2 bg-green-600 hover:bg-green-700 text-white">
                      <Wallet className="h-4 w-4" /> Marcar como recebido
                    </Button>
                  )}
                  {hasCaixa && editing.status !== "pago" && <p className="text-[11px] text-muted-foreground text-center">Vai lançar uma entrada no Cria Caixa.</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          <Button onClick={save} disabled={!brand.trim()} className="rounded-xl">{editing ? "Salvar" : "Criar collab"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
