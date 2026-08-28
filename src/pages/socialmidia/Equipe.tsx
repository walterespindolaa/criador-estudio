import { useState } from "react";
import { Loader2, UserPlus, Users, Plus, Trash2, Pause, Play, Check, CreditCard, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  useTeamMembers, useCollabSeats, useInviteMember, useUpdateMemberStatus, useRemoveMember,
  useSetMemberModule, useBuySeats, TEAM_MODULES, TEAM_MODULE_DEFAULT,
} from "@/hooks/useTeam";
import { useManageSubscription } from "@/hooks/useManageSubscription";
import { useCrmClients } from "@/hooks/useCrm";
import { confirmar } from "@/components/shared/Confirm";

export default function Equipe() {
  const { data: members = [], isLoading } = useTeamMembers();
  const { data: seats } = useCollabSeats();
  const { data: clients = [] } = useCrmClients();
  const invite = useInviteMember();
  const setStatus = useUpdateMemberStatus();
  const removeMember = useRemoveMember();
  const setModule = useSetMemberModule();
  const buySeats = useBuySeats();
  // Portal do Stripe: é onde a pessoa vê TODAS as assinaturas dela (inclusive
  // uma órfã de antes da correção dos assentos) e cancela sozinha, sem suporte.
  const { openPortal, isLoading: portalLoading } = useManageSubscription();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  /* TIPO DE ACESSO. Colaborador entra na conta e consome assento; parceiro
     (designer, editor, copy) só recebe cards, de graça, e não escolhe módulo
     nem cliente: o acesso dele nasce da delegação, card a card. */
  const [tipoAcesso, setTipoAcesso] = useState<"colaborador" | "parceiro">("colaborador");
  const [papelParceiro, setPapelParceiro] = useState("designer");
  const [name, setName] = useState("");
  const [mods, setMods] = useState<Set<string>>(new Set(TEAM_MODULE_DEFAULT));
  const [scope, setScope] = useState<"all" | "some">("all");
  const [cliIds, setCliIds] = useState<Set<string>>(new Set());

  const used = members.filter((m) => m.status === "ativo").length;
  const total = seats?.total ?? 1;
  const full = used >= total;

  const resetForm = () => { setEmail(""); setName(""); setMods(new Set(TEAM_MODULE_DEFAULT)); setScope("all"); setCliIds(new Set()); };
  const openInvite = () => {
    if (full) { toast.error("Sem assentos livres. Adicione um assento primeiro."); return; }
    resetForm(); setOpen(true);
  };

  const toggleMod = (code: string) => setMods((s) => { const n = new Set(s); n.has(code) ? n.delete(code) : n.add(code); return n; });
  const toggleCli = (id: string) => setCliIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const doInvite = () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error("Informe um e-mail válido."); return; }
    if (mods.size === 0) { toast.error("Marque ao menos um módulo."); return; }
    if (scope === "some" && cliIds.size === 0) { toast.error("Escolha ao menos um cliente ou marque 'Todos'."); return; }
    invite.mutate(
      tipoAcesso === "parceiro"
        ? { email: e, name: name.trim() || undefined, role: papelParceiro }
        : { email: e, name: name.trim() || undefined, modules: [...mods], all_clients: scope === "all", client_ids: scope === "some" ? [...cliIds] : [] },
      { onSuccess: () => { setOpen(false); resetForm(); } },
    );
  };

  return (
    <div className="space-y-5">
      {/* Explicação (só com time montado; sem time, o bloco de venda explica) */}
      {members.length > 0 && (
      <div className="flex items-start gap-2 rounded-xl bg-primary/[0.04] border border-primary/15 px-4 py-3">
        <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-[13px] font-body text-foreground/80 leading-relaxed">
          Convide colaboradores pra trabalhar <strong>dentro da sua conta</strong>, você escolhe, no convite, <strong>quais módulos e clientes</strong> cada um acessa. O <strong>1º colaborador é grátis</strong>; a partir do 2º, R$ 29,90/mês por pessoa.
        </p>
      </div>
      )}

      {/* Assentos */}
      <div data-tour="eq-assentos" className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 flex-wrap">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Users className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-display font-bold text-foreground">Assentos: {used} de {total} em uso</p>
          <p className="text-[12px] font-body text-muted-foreground">1 grátis + {seats?.paid ?? 0} pago(s). Cada assento extra é R$ 29,90/mês.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => buySeats.mutate((seats?.paid ?? 0) + 1)} disabled={buySeats.isPending}>
          {buySeats.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CreditCard className="h-4 w-4 mr-1.5" />}
          Adicionar assento
        </Button>
        {(seats?.paid ?? 0) > 0 && (
          <Button variant="ghost" size="sm" onClick={() => void openPortal()} disabled={portalLoading}
            className="text-muted-foreground hover:text-foreground">
            {portalLoading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
            Gerenciar cobrança
          </Button>
        )}
      </div>

      <Button data-tour="eq-convidar" onClick={openInvite}><UserPlus className="h-4 w-4 mr-2" /> Convidar colaborador</Button>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : members.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-5 sm:p-6">
          <span aria-hidden className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative">
            <h2 className="text-lg font-display font-extrabold text-foreground">Sua operação não precisa depender só de você</h2>
            <p className="text-[13px] font-body text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Colaborador entra <strong className="text-foreground">dentro da sua conta</strong>, com o próprio login, vendo só o que você liberar: por módulo E por cliente. Sem senha compartilhada, sem print no WhatsApp.
            </p>

            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 mt-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2">Te soa familiar?</p>
                <div className="space-y-1.5">
                  {[
                    "O designer manda a arte no WhatsApp e VOCÊ sobe post por post",
                    "Você viaja e a operação inteira para junto",
                    "Alguém pediu sua senha pra ajudar e você (com razão) travou",
                  ].map((b) => (
                    <div key={b} className="flex items-start gap-2 text-[13px] font-body text-foreground">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[hsl(var(--cria-amarelo))]" /> {b}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2">Na prática</p>
                <div className="space-y-1.5">
                  {[
                    "O designer entra só no Cria Post dos clientes dele: sobe a arte direto no kanban e você só aprova",
                    "A assistente cuida da Agenda e do CRM sem enxergar o seu Caixa",
                    "Saiu do time? Pausa o acesso num clique e o assento fica livre",
                  ].map((b) => (
                    <div key={b} className="flex items-start gap-2 text-[13px] font-body text-foreground">
                      <Check className="h-4 w-4 shrink-0 mt-0.5 text-[hsl(var(--cria-verde))]" /> {b}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <Button onClick={openInvite}><UserPlus className="h-4 w-4 mr-2" /> Convidar meu 1º colaborador</Button>
              <p className="text-[12px] font-body text-muted-foreground">
                O <strong className="text-foreground">1º colaborador é grátis</strong>. A partir do 2º, R$ 29,90/mês por pessoa.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((m) => {
            const enabled = new Set(m.permissions.map((p) => p.module_code));
            const scopedPerm = m.permissions.find((p) => !p.all_clients && p.client_ids?.length);
            const paused = m.status === "pausado";
            const ROTULO: Record<string, string> = { designer: "Designer", editor_video: "Editor de vídeo", copy: "Copy", trafego: "Tráfego" };
            const papelParc = ROTULO[m.role ?? ""];
            return (
              <div key={m.id} className={cn("bg-card border border-border rounded-2xl p-4", paused && "opacity-70")}>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary font-display font-bold">
                    {(m.name || m.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-body font-semibold text-foreground truncate">{m.name || "(sem nome)"}</p>
                    <p className="text-[12px] font-body text-muted-foreground truncate">{m.email}</p>
                  </div>
                  {/* O papel na cara: sem isto a Gabriela olhava a lista e não
                      sabia quem era colaborador e quem era a designer. */}
                  <span className={cn("text-[10px] font-body font-bold px-2.5 py-1 rounded-full",
                    papelParc ? "bg-violet-100 text-violet-700" : "bg-primary/10 text-primary")}>
                    {papelParc ? `Parceiro · ${papelParc}` : "Colaborador"}
                  </span>
                  <span className={cn("text-[10px] font-body px-2 py-0.5 rounded-full", paused ? "bg-muted text-muted-foreground" : "bg-emerald-500/12 text-emerald-600")}>
                    {paused ? "Pausado" : "Ativo"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setStatus.mutate({ id: m.id, status: paused ? "ativo" : "pausado" })}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title={paused ? "Reativar" : "Pausar"}>
                      {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </button>
                    <button onClick={async () => { if (await confirmar({ titulo: "Remover este colaborador?", descricao: "Ele perde o acesso à sua conta na hora. O assento volta pra você.", acao: "Remover" })) removeMember.mutate(m.id); }}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Remover">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {papelParc ? (
                  <div className="mt-3 pt-3 border-t border-border/60">
                    <p className="text-[12px] font-body text-muted-foreground leading-relaxed">
                      Recebe só os posts que você mandar pelo <strong className="text-foreground">"Enviar para"</strong> dentro
                      do post, com prazo e a identidade do cliente. Não vê CRM, financeiro nem a carteira.
                    </p>
                  </div>
                ) : (
                <div className="mt-3 pt-3 border-t border-border/60">
                  <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Módulos liberados{scopedPerm ? ` · ${scopedPerm.client_ids.length} cliente(s) específico(s)` : " · todos os clientes"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TEAM_MODULES.map((mod) => {
                      const on = enabled.has(mod.code);
                      return (
                        <button key={mod.code}
                          onClick={() => setModule.mutate({ memberRowId: m.id, moduleCode: mod.code, enabled: !on })}
                          className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-body border transition-colors",
                            on ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
                          {on && <Check className="h-3 w-3" />} {mod.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Popup de convite: módulos + clientes ANTES de convidar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg sm:max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-display font-extrabold">Convidar colaborador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Nome (opcional)</p>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ana Souza" className="h-9" />
              </div>
              <div>
                <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">E-mail</p>
                <Input value={email} type="email" onChange={(e) => setEmail(e.target.value)} placeholder="colaborador@email.com" className="h-9" />
              </div>
            </div>

            {/* Tipo de acesso: a escolha que muda todo o resto do formulário. */}
            <div>
              <p className="text-[11px] font-body font-semibold text-foreground mb-1.5">Tipo de acesso</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onClick={() => setTipoAcesso("colaborador")}
                  className={cn("rounded-xl border-2 bg-white px-3 py-2.5 text-left transition-all",
                    tipoAcesso === "colaborador"
                      ? "border-primary shadow-[0_4px_14px_rgba(234,73,24,0.16)]"
                      : "border-border hover:border-primary/50 hover:shadow-sm")}>
                  <span className="block text-[13px] font-body font-bold text-foreground">Colaborador</span>
                  <span className="block text-[11px] font-body text-muted-foreground leading-snug mt-0.5">
                    Trabalha dentro da sua conta, nos módulos e clientes que você escolher. Usa assento.
                  </span>
                </button>
                <button type="button" onClick={() => setTipoAcesso("parceiro")}
                  className={cn("rounded-xl border-2 bg-white px-3 py-2.5 text-left transition-all",
                    tipoAcesso === "parceiro"
                      ? "border-violet-500 shadow-[0_4px_14px_rgba(124,58,237,0.18)]"
                      : "border-border hover:border-violet-400 hover:shadow-sm")}>
                  <span className="flex items-center gap-1.5 text-[13px] font-body font-bold text-foreground">
                    Parceiro de produção
                    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">grátis</span>
                  </span>
                  <span className="block text-[11px] font-body text-muted-foreground leading-snug mt-0.5">
                    Designer, editor ou copy. Só vê os posts que você enviar pra ele, com prazo e a identidade do cliente.
                  </span>
                </button>
              </div>
              {tipoAcesso === "parceiro" && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {[
                    { v: "designer", r: "Designer" },
                    { v: "editor_video", r: "Editor de vídeo" },
                    { v: "copy", r: "Copy" },
                    { v: "trafego", r: "Tráfego" },
                  ].map((o) => (
                    <button key={o.v} type="button" onClick={() => setPapelParceiro(o.v)}
                      className={cn("px-2.5 py-1.5 rounded-lg text-[12px] font-body border transition-colors",
                        papelParceiro === o.v ? "bg-violet-100 border-violet-400 text-violet-800" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
                      {o.r}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Módulos (só colaborador: parceiro não tem módulo, tem card) */}
            {tipoAcesso === "colaborador" && (
            <div>
              <p className="text-[11px] font-body font-semibold text-foreground mb-1.5">O que ele pode acessar</p>
              <div className="flex flex-wrap gap-2">
                {TEAM_MODULES.map((mod) => {
                  const on = mods.has(mod.code);
                  return (
                    <button key={mod.code} type="button" onClick={() => toggleMod(mod.code)}
                      className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-body border transition-colors",
                        on ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
                      {on && <Check className="h-3 w-3" />} {mod.label}
                      {mod.code === "cria_caixa" && (
                        <span className="ml-0.5 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-500/15">financeiro</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {mods.has("cria_caixa") && (
                <div className="mt-2 flex items-start gap-2 rounded-xl bg-amber-500/[0.08] border border-amber-500/25 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-[11.5px] font-body text-amber-900/80 leading-relaxed">
                    O <strong>Cria Caixa</strong> libera o financeiro da <strong>empresa</strong> (faturamento, despesas e mensalidades dos clientes). O colaborador <strong>não vê o seu financeiro pessoal</strong>.
                  </p>
                </div>
              )}
            </div>
            )}

            {/* Escopo de clientes */}
            {tipoAcesso === "colaborador" && (
            <div>
              <p className="text-[11px] font-body font-semibold text-foreground mb-1.5">Quais clientes</p>
              <div className="flex gap-2 mb-2">
                <button type="button" onClick={() => setScope("all")}
                  className={cn("px-3 py-1.5 rounded-lg text-[12px] font-body border transition-colors", scope === "all" ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-muted-foreground")}>
                  Todos os clientes
                </button>
                <button type="button" onClick={() => setScope("some")}
                  className={cn("px-3 py-1.5 rounded-lg text-[12px] font-body border transition-colors", scope === "some" ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-muted-foreground")}>
                  Clientes específicos
                </button>
              </div>
              {scope === "some" && (
                clients.length === 0 ? (
                  <p className="text-[11px] font-body text-muted-foreground">Você ainda não tem clientes cadastrados.</p>
                ) : (
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-border divide-y divide-border/60">
                    {clients.map((c) => {
                      const on = cliIds.has(c.id);
                      return (
                        <button key={c.id} type="button" onClick={() => toggleCli(c.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors">
                          <span className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0", on ? "bg-primary border-primary" : "border-muted-foreground/40")}>
                            {on && <Check className="h-3 w-3 text-primary-foreground" />}
                          </span>
                          <span className="text-[13px] font-body text-foreground truncate">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )
              )}
            </div>
            )}
            <p className="text-[11px] font-body text-muted-foreground">
              {tipoAcesso === "parceiro"
                ? 'Ele recebe um e-mail pra definir a senha e cai direto na tela "Minhas demandas". Depois é só abrir um post e usar o "Enviar para".'
                : "Ele recebe um e-mail pra definir a senha e já entra na sua conta. Dá pra ajustar tudo isso depois."}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={doInvite} disabled={invite.isPending}>
              {invite.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Enviar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
