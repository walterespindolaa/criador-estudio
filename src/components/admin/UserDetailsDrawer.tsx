import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/shared/CopyButton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

type UserDetails = {
  id: string;
  name: string | null;
  email: string | null;
  plan: string | null;
  role: string | null;
  subscription_status: string | null;
  access_expires_at: string | null;
  trial_ends_at: string | null;
  niche: string | null;
  created_at: string | null;
};

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

function Field({ label, value, copyable }: { label: string; value: React.ReactNode; copyable?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 min-w-0">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <p className="text-sm font-body text-foreground truncate">{value}</p>
      </div>
      {copyable && <CopyButton text={copyable} />}
    </div>
  );
}

export function UserDetailsDrawer({ open, onOpenChange, userId }: UserDetailsDrawerProps) {
  const { data, isLoading, error } = useQuery<UserDetails | null>({
    queryKey: ["admin-user-details", userId],
    enabled: open && !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        args: unknown,
      ) => Promise<{ data: UserDetails | null; error: unknown }>)(
        "get_user_details",
        { _user_id: userId },
      );
      if (error) throw error;
      return data;
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl"
      >
        <DialogHeader>
          <DialogTitle className="font-display">Detalhes do usuário</DialogTitle>
          <DialogDescription className="font-body text-sm">
            {data?.name || (isLoading ? "Carregando…" : userId?.slice(0, 8) || "")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 mt-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive font-body mt-4">Não foi possível carregar os detalhes.</p>
        ) : data ? (
          <div className="space-y-6 mt-4">
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Conta</h3>
              <div className="space-y-2">
                <Field label="Nome" value={data.name || "—"} />
                <Field label="E-mail" value={data.email || "—"} copyable={data.email ?? undefined} />
                <Field label="Plano" value={data.plan ?? "—"} />
                <Field label="Role" value={data.role ?? "—"} />
                <Field label="Status de acesso" value={data.subscription_status ?? "—"} />
                <Field label="Validade do acesso" value={formatValidity(data.access_expires_at)} />
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Perfil</h3>
              <div className="space-y-2">
                <Field label="Nicho" value={data.niche || "—"} />
                <Field label="Cadastro" value={formatDate(data.created_at)} />
              </div>
            </section>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
