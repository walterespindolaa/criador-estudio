import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Pencil, PauseCircle, PlayCircle, Trash2, Loader2, PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type AgencyClient = { id: string; name: string | null; email: string | null; parked_until: string | null; created_at: string };

export function AgencyClients({ seatsFree }: { seatsFree: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setActiveAccount } = useActiveAccount();

  const { data: clients = [], isLoading } = useQuery<AgencyClient[]>({
    queryKey: ["agency-clients", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("agency_clients");
      if (error) throw error;
      return (data ?? []) as AgencyClient[];
    },
  });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AgencyClient | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["agency-clients", user?.id] });
    qc.invalidateQueries({ queryKey: ["agency-seats-used", user?.id] });
  };

  const action = async (clientId: string, act: string, extra?: Record<string, unknown>) => {
    setBusyId(clientId);
    try {
      const { data, error } = await supabase.functions.invoke("manager-client-actions", { body: { action: act, clientId, ...extra } });
      const err = (data as { error?: string })?.error;
      if (error || err) {
        toast.error(err === "seats_full" ? "Sem assento livre pra reativar — pause outro ou expanda."
          : err === "email_update_failed" ? "Não consegui trocar o e-mail (já em uso?)."
          : "Não consegui concluir a ação.");
        return false;
      }
      refresh();
      return true;
    } catch (e) {
      console.error("[manager-client-actions] failed:", e);
      toast.error("Falha ao chamar o servidor.");
      return false;
    } finally { setBusyId(null); }
  };

  const openEdit = (c: AgencyClient) => { setEditing(c); setEditName(c.name ?? ""); setEditEmail(c.email ?? ""); };
  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    const ok = await action(editing.id, "edit", { name: editName.trim(), email: editEmail.trim() });
    setSavingEdit(false);
    if (ok) { toast.success("Cliente atualizado."); setEditing(null); }
  };

  const manage = (id: string) => { setActiveAccount(id); navigate("/app"); };

  if (isLoading) return <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" /></div>;
  if (clients.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-display font-semibold text-foreground mb-3">Clientes da agência</h3>
      <div className="space-y-2">
        {clients.map((c) => {
          const parked = !!c.parked_until;
          const busy = busyId === c.id;
          return (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-body font-semibold text-foreground truncate">{c.name || "Sem nome"}</p>
                <p className="text-xs font-body text-muted-foreground truncate">{c.email}</p>
                {parked && (
                  <p className="text-[11px] font-body text-amber-600 mt-0.5 flex items-center gap-1">
                    <PackageOpen className="h-3 w-3" /> Em inventário até {new Date(c.parked_until!).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!parked && <Button size="sm" variant="outline" onClick={() => manage(c.id)}>Gerenciar <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>}
                <button title="Editar" aria-label="Editar" onClick={() => openEdit(c)} className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                {parked ? (
                  <button title="Reativar" aria-label="Reativar" disabled={busy || seatsFree <= 0} onClick={() => action(c.id, "unpark")} className="p-2 rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                  </button>
                ) : (
                  <button title="Pausar (inventário)" aria-label="Pausar" disabled={busy} onClick={() => action(c.id, "park")} className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4" />}
                  </button>
                )}
                <button title="Excluir" aria-label="Excluir" disabled={busy} onClick={() => { if (confirm(`Excluir a conta de ${c.name || c.email}? Isso é permanente.`)) action(c.id, "delete"); }} className="p-2 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !savingEdit && !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Editar cliente</DialogTitle>
            <DialogDescription className="font-body text-sm">Corrija o nome ou o e-mail de acesso do cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="font-body text-xs">Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={savingEdit} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs">E-mail de acesso</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} disabled={savingEdit} className="rounded-xl" />
              <p className="text-[11px] font-body text-muted-foreground">Trocar o e-mail muda o login do cliente. Avise ele.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={savingEdit}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={savingEdit || !editName.trim()}>{savingEdit && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
