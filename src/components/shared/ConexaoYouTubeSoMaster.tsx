import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Loader2, Unplug, Youtube } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { conectarRede } from "@/hooks/usePublicarRedes";

/* CONECTAR O YOUTUBE NAS CONEXÕES (Walter, 25/11/2026: "libere no sistema na
   parte de conexoes a parte de conectar meu youtube").
   Continua só pro master, igual à publicação (decisão de 03/11/2026): pra
   abrir pra todos falta a verificação do Google. Mesmo fluxo do painel do
   post (redes-oauth), gravando a conexão da própria conta (sem cliente). */

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

type ConexaoYt = { username: string | null; profile_picture_url: string | null; needs_reconnect: boolean | null };

export function ConexaoYouTubeSoMaster() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const qc = useQueryClient();
  const master = profile?.role === "admin";

  const cx = useQuery<ConexaoYt | null>({
    queryKey: ["youtube-conexao-propria", user?.id],
    enabled: master && !!user?.id,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await sbFrom("social_connections")
        .select("username,profile_picture_url,needs_reconnect")
        .eq("user_id", user!.id).eq("provider", "youtube").is("crm_client_id", null)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ConexaoYt) ?? null;
    },
  });

  const desconectar = useMutation({
    mutationFn: async () => {
      const { error } = await sbFrom("social_connections").delete()
        .eq("user_id", user!.id).eq("provider", "youtube").is("crm_client_id", null);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["youtube-conexao-propria"] }); qc.invalidateQueries({ queryKey: ["rede-conexao"] }); toast.success("YouTube desconectado."); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Volta do login do Google: avisa e limpa a URL.
  useEffect(() => {
    if (!master) return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("rede") !== "youtube" || !q.get("conexao")) return;
    if (q.get("conexao") === "ok") toast.success("YouTube conectado.");
    else toast.error(`Não deu pra conectar o YouTube: ${q.get("m") ?? "tente de novo"}`);
    q.delete("rede"); q.delete("conexao"); q.delete("m");
    window.history.replaceState(null, "", window.location.pathname + (q.toString() ? `?${q}` : ""));
    qc.invalidateQueries({ queryKey: ["youtube-conexao-propria"] });
  }, [master, qc]);

  if (!master) return null;
  const c = cx.data;
  return (
    <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
      <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
        <Youtube className="h-5 w-5 text-primary" /> YouTube
        <span className="text-[10.5px] font-body font-bold rounded-full px-2 py-0.5 bg-amber-100 text-amber-900">teste · só master</span>
      </h3>
      <p className="text-sm text-muted-foreground font-body leading-relaxed">Conecte seu canal pra publicar Shorts e vídeos direto do post, na hora ou na data marcada.</p>
      {cx.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : c ? (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
          <div className="flex items-center gap-3 min-w-0">
            {c.profile_picture_url
              ? <img src={c.profile_picture_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
              : <div className="w-10 h-10 rounded-full bg-[#FF0000] grid place-items-center text-white shrink-0"><Youtube className="h-5 w-5" /></div>}
            <div className="min-w-0">
              <p className="text-sm font-body font-semibold text-foreground truncate">{c.username ?? "Canal conectado"}</p>
              <p className="text-xs font-body text-muted-foreground">{c.needs_reconnect ? "Conexão vencida" : "Conectado"}</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
            {c.needs_reconnect && (
              <Button variant="hero" size="sm" onClick={() => void conectarRede("youtube", null)}><Youtube className="h-4 w-4 mr-2" /> Reconectar</Button>
            )}
            <Button variant="outline" size="sm" disabled={desconectar.isPending} onClick={() => desconectar.mutate()}><Unplug className="h-4 w-4 mr-2" /> Desconectar</Button>
          </div>
        </div>
      ) : (
        <Button variant="hero" onClick={() => void conectarRede("youtube", null)} className="w-full sm:w-auto"><Youtube className="h-4 w-4 mr-2" /> Conectar YouTube</Button>
      )}
    </div>
  );
}
