import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyButton } from "@/components/shared/CopyButton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, ShieldOff, ShieldCheck, Trash2, Loader2 } from "lucide-react";

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

function FieldBox({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">{label}</p>
      {children}
    </div>
  );
}

export function UserDetailsDrawer({ open, onOpenChange, userId }: UserDetailsDrawerProps) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [validity, setValidity] = useState<string>("lifetime");
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const isSelf = !!data && !!currentUser && data.id === currentUser.id;
  const isSuspended = data?.subscription_status === "suspended";

  const invokeAction = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-user-actions", { body: payload });
    if (error || (data as { error?: string })?.error) {
      throw new Error((data as { error?: string })?.error ?? "action_failed");
    }
    return data;
  };

  const resendMutation = useMutation({
    mutationFn: () => invokeAction({ user_id: userId, action: "resend_access" }),
    onSuccess: () => toast.success("E-mail de redefinição enviado."),
    onError: (e: Error) => toast.error(`Falha ao enviar: ${e.message}`),
  });

  const setValidityMutation = useMutation({
    mutationFn: () => invokeAction({ user_id: userId, action: "set_validity", validity }),
    onSuccess: () => {
      toast.success("Validade atualizada.");
      queryClient.invalidateQueries({ queryKey: ["admin-user-details", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(`Falha: ${e.message}`),
  });

  const toggleSuspendMutation = useMutation({
    mutationFn: () => invokeAction({ user_id: userId, action: isSuspended ? "reactivate" : "suspend" }),
    onSuccess: () => {
      toast.success(isSuspended ? "Acesso reativado." : "Acesso suspenso.");
      queryClient.invalidateQueries({ queryKey: ["admin-user-details", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(`Falha: ${e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => invokeAction({ user_id: userId, action: "delete" }),
    onSuccess: () => {
      toast.success("Usuário excluído.");
      setConfirmDelete(false);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(`Falha ao excluir: ${e.message}`),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-2xl"
        >
          <DialogHeader>
            <DialogTitle className="font-display">Detalhes do usuário</DialogTitle>
            <DialogDescription className="font-body text-sm truncate">
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
            <div className="space-y-6 mt-4 min-w-0">
              <section className="space-y-2 min-w-0">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Conta</h3>
                <div className="space-y-2 min-w-0">
                  <FieldBox label="Nome">
                    <p className="text-sm font-body text-foreground break-words">{data.name || "—"}</p>
                  </FieldBox>
                  <FieldBox label="E-mail">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex-1 min-w-0 truncate text-sm font-body text-foreground">{data.email || "—"}</span>
                      {data.email && <CopyButton text={data.email} />}
                    </div>
                  </FieldBox>
                  <FieldBox label="Plano">
                    <p className="text-sm font-body text-foreground truncate">{data.plan ?? "—"}</p>
                  </FieldBox>
                  <FieldBox label="Role">
                    <p className="text-sm font-body text-foreground truncate">{data.role ?? "—"}</p>
                  </FieldBox>
                  <FieldBox label="Status de acesso">
                    <p className="text-sm font-body text-foreground truncate">{data.subscription_status ?? "—"}</p>
                  </FieldBox>
                  <FieldBox label="Validade do acesso">
                    <p className="text-sm font-body text-foreground break-words">{formatValidity(data.access_expires_at)}</p>
                  </FieldBox>
                </div>
              </section>

              <section className="space-y-2 min-w-0">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Perfil</h3>
                <div className="space-y-2 min-w-0">
                  <FieldBox label="Nicho">
                    <p className="text-sm font-body text-foreground break-words">{data.niche || "—"}</p>
                  </FieldBox>
                  <FieldBox label="Cadastro">
                    <p className="text-sm font-body text-foreground truncate">{formatDate(data.created_at)}</p>
                  </FieldBox>
                </div>
              </section>

              <section className="space-y-3 min-w-0">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Ações</h3>

                <FieldBox label="Mudar validade">
                  <div className="flex flex-wrap items-center gap-2 mt-1 min-w-0">
                    <Select value={validity} onValueChange={setValidity}>
                      <SelectTrigger className="rounded-lg h-9 flex-1 min-w-[120px] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15d">15 dias</SelectItem>
                        <SelectItem value="1m">1 mês</SelectItem>
                        <SelectItem value="3m">3 meses</SelectItem>
                        <SelectItem value="6m">6 meses</SelectItem>
                        <SelectItem value="1y">1 ano</SelectItem>
                        <SelectItem value="lifetime">Vitalício</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => setValidityMutation.mutate()}
                      disabled={setValidityMutation.isPending}
                    >
                      {setValidityMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Salvar
                    </Button>
                  </div>
                </FieldBox>

                <div className="flex flex-wrap gap-2 min-w-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resendMutation.mutate()}
                    disabled={resendMutation.isPending || !data.email}
                  >
                    {resendMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Mail className="h-3 w-3 mr-1" />}
                    Reenviar acesso
                  </Button>

                  {!isSelf && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleSuspendMutation.mutate()}
                      disabled={toggleSuspendMutation.isPending}
                    >
                      {toggleSuspendMutation.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : isSuspended ? (
                        <ShieldCheck className="h-3 w-3 mr-1" />
                      ) : (
                        <ShieldOff className="h-3 w-3 mr-1" />
                      )}
                      {isSuspended ? "Reativar" : "Suspender"}
                    </Button>
                  )}

                  {!isSelf && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmDelete(true)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Excluir
                    </Button>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              Isso apaga o usuário e todos os dados dele (perfil, posts, mídia, parcerias).
              Ação irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); deleteMutation.mutate(); }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
