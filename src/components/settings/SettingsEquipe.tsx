import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Mail, Clock, CheckCircle2 } from "lucide-react";

type Member = {
  id: string; member_email: string; member_id: string | null;
  status: string; invited_at: string; accepted_at: string | null;
};

export function SettingsEquipe() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [inviting, setInviting] = useState(false);

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ["account-members", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_members")
        .select("id, member_email, member_id, status, invited_at, accepted_at")
        .eq("owner_id", user!.id)
        .order("invited_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const handleInvite = async () => {
    const e = email.trim().toLowerCase();
    if (!e) { toast.error("Informe o e-mail"); return; }
    if (e === user?.email?.toLowerCase()) { toast.error("Você não pode convidar a si mesmo"); return; }
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("account-invite", { body: { email: e, name } });
      if (error || (data as { error?: string })?.error) {
        throw new Error((data as { error?: string })?.error ?? "invite_failed");
      }
      toast.success("Convite enviado!");
      setEmail(""); setName("");
      queryClient.invalidateQueries({ queryKey: ["account-members", user?.id] });
    } catch {
      toast.error("Erro ao enviar convite.");
    } finally {
      setInviting(false);
    }
  };

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("account_members").update({ status: "revoked" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-members", user?.id] });
      toast.success("Acesso revogado");
    },
    onError: () => toast.error("Erro ao revogar"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-bold text-foreground mb-1">Convidar social media</h3>
        <p className="text-sm text-muted-foreground font-body mb-3">
          Dê acesso a quem gerencia seu conteúdo. A pessoa entra, vê sua conta e pode mexer nos cards — mas nunca no seu plano, billing ou dados pessoais.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="Nome (opcional)" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl sm:w-48" />
          <Input type="email" placeholder="email@dela.com" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl flex-1" />
          <Button onClick={handleInvite} disabled={inviting} className="rounded-xl">
            {inviting ? "Enviando..." : "Convidar"}
          </Button>
        </div>
      </div>

      <div>
        <h4 className="font-display font-semibold text-sm text-foreground mb-2">Acessos</h4>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : members.filter((m) => m.status !== "revoked").length === 0 ? (
          <p className="text-sm text-muted-foreground font-body">Nenhuma social media com acesso ainda.</p>
        ) : (
          <div className="space-y-2">
            {members.filter((m) => m.status !== "revoked").map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-body text-foreground truncate">{m.member_email}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {m.status === "active" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Ativo</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium"><Clock className="h-3.5 w-3.5" /> Pendente</span>
                  )}
                  <button onClick={() => revoke.mutate(m.id)} className="text-muted-foreground hover:text-red-600 transition-colors" aria-label="Revogar acesso">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
