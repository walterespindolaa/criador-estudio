import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Mail, Clock, CheckCircle2, Sparkles, Send, CalendarRange, PenLine, TrendingUp, BarChart3 } from "lucide-react";

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

  const flyerItems: { icon: typeof Send; color: string; bg: string; title: string; desc: string }[] = [
    { icon: Send, color: "#EA4918", bg: "rgba(234,73,24,.12)", title: "Posts prontos, você só aprova", desc: "Ela monta cada post e te manda aprovar por link. Chega de ida e volta no WhatsApp." },
    { icon: CalendarRange, color: "#0061EE", bg: "rgba(0,97,238,.12)", title: "Cronograma do mês", desc: "Um calendário público com tudo que vai sair, e as datas comemorativas do seu nicho." },
    { icon: PenLine, color: "#01A652", bg: "rgba(1,166,82,.12)", title: "Legendas e roteiros com IA", desc: "Textos no seu tom de voz, reescritos, encurtados ou expandidos em um clique." },
    { icon: TrendingUp, color: "#7C90F0", bg: "rgba(124,144,240,.14)", title: "Tendências e concorrentes", desc: "Ela acompanha o que está bombando e o que os concorrentes fazem pra te dar ideias." },
    { icon: BarChart3, color: "#FF77B9", bg: "rgba(255,119,185,.14)", title: "Relatório do resultado", desc: "No fim do mês, um relatório bonito do que foi publicado e do que performou." },
    { icon: Sparkles, color: "#FFCF03", bg: "rgba(255,207,3,.18)", title: "Tudo num lugar só", desc: "Ela trabalha dentro do seu Cria. Você acompanha sem perder o controle da sua conta." },
  ];

  return (
    <div className="space-y-6">
      {/* Flyer: o que uma social media entrega dentro do seu Cria */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full" style={{ background: "rgba(255,119,185,.12)" }} />
        <div className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full" style={{ background: "rgba(0,97,238,.08)" }} />
        <div className="relative p-5 sm:p-6">
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-body font-bold mb-3" style={{ background: "rgba(234,73,24,.12)", color: "#EA4918" }}>
            <Sparkles className="h-3.5 w-3.5" /> POR QUE TER UMA SOCIAL MEDIA
          </div>
          <h2 className="font-display font-extrabold text-foreground text-xl sm:text-2xl leading-tight mb-1">Ela cuida do seu conteúdo. Você cuida do seu negócio.</h2>
          <p className="text-sm text-muted-foreground font-body mb-5 max-w-2xl">Convide quem gerencia suas redes pra trabalhar dentro do seu Cria. Veja o que ela passa a entregar pra você:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {flyerItems.map((it) => (
              <div key={it.title} className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/60 p-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg shrink-0" style={{ background: it.bg, color: it.color }}><it.icon className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="font-display font-bold text-[13.5px] text-foreground leading-snug">{it.title}</p>
                  <p className="text-[12px] text-muted-foreground font-body leading-snug mt-0.5">{it.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-display font-bold text-foreground mb-1">Convidar social media</h3>
        <p className="text-sm text-muted-foreground font-body mb-3">
          Dê acesso a quem gerencia seu conteúdo. A pessoa entra, vê sua conta e pode mexer nos cards, mas nunca no seu plano, billing ou dados pessoais.
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
