import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AdminProfile } from "@/hooks/useAdmin";

interface UserDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminProfile | null;
}

function initials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

function formatValidity(accessExpiresAt: string | null | undefined): string {
  if (!accessExpiresAt) return "Vitalício / sem prazo";
  try {
    const date = new Date(accessExpiresAt);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const formatted = format(date, "dd/MM/yyyy", { locale: ptBR });
    if (diff <= 0) return `${formatted} (expirado)`;
    return `${formatted} (${days} dia${days === 1 ? "" : "s"})`;
  } catch {
    return "—";
  }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 min-w-0">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <p className="text-sm font-body text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

export function UserDetailsDrawer({ open, onOpenChange, user }: UserDetailsDrawerProps) {
  if (!user) return null;

  const planLabel = user.plan ?? "free";
  const roleLabel = user.role ?? "user";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl"
      >
        <DialogHeader>
          <DialogTitle className="font-display">Detalhes do usuário</DialogTitle>
          <DialogDescription className="font-body text-sm">{user.name || user.id.slice(0, 8)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <section className="space-y-2">
            <div className="flex items-center gap-3 px-1">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/15 flex items-center justify-center overflow-hidden shrink-0">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-display font-bold text-primary">{initials(user.name)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-body font-semibold text-foreground truncate">{user.name || "—"}</p>
                <p className="text-xs text-muted-foreground font-body truncate">{user.id}</p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Conta</h3>
            <div className="space-y-2">
              <Field label="Nome" value={user.name || "—"} />
              <Field label="E-mail" value={user.email || "— (não disponível na tabela profiles)"} />
              <Field label="Plano" value={planLabel} />
              <Field label="Role" value={roleLabel} />
              <Field label="Status de acesso" value={user.subscription_status ?? "—"} />
              <Field label="Validade do acesso" value={formatValidity(user.access_expires_at)} />
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Perfil</h3>
            <div className="space-y-2">
              <Field label="Nicho" value={user.niche || "—"} />
              {user.instagram_handle && (
                <Field label="Instagram" value={`@${user.instagram_handle.replace(/^@/, "")}`} />
              )}
              <Field label="Cadastro" value={formatDate(user.created_at)} />
              <Field label="Último acesso" value={formatDate(user.last_seen_at)} />
              <Field label="Onboarding" value={user.onboarding_completed ? "Concluído" : "Pendente"} />
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
