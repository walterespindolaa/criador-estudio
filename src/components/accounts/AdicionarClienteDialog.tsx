import { useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isValidEmail } from "@/lib/sanitize";
import { useCrmClients, type CrmClient } from "@/hooks/useCrm";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   ADICIONAR CLIENTE (ASSENTO DA AGÊNCIA)

   O problema que este diálogo resolve: a gestora já tinha o cliente cadastrado
   na carteira, cadastrava de novo aqui pra dar o acesso, e ficava com dois
   cards do mesmo negócio (dois financeiros, duas agendas, duas vagas na
   carteira). Agora o caminho normal é ESCOLHER quem já existe. Cadastrar do
   zero continua existindo pra cliente que chegou hoje.

   Três passos, sempre terminando na revisão: o e-mail que vai aqui é o login
   do cliente, e ninguém quer descobrir que digitou errado depois que o convite
   já saiu.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ResultadoAdicionar = {
  email: string;
  inviteLink: string;
  crmStatus?: "vinculado" | "criado" | "carteira_cheia" | "falhou";
};

type Passo = "como" | "carteira" | "novo" | "revisar";

const nomeDe = (c: CrmClient) => (c.display_name || c.name || "Sem nome").trim();

function mensagemDeErro(code: string | undefined): string {
  switch (code) {
    case "seats_full": return "Seus assentos acabaram. Expanda o plano pra adicionar mais.";
    case "no_seats": return "Você ainda não tem um plano de agência ativo.";
    case "use_different_email": return "Use um e-mail diferente do seu de gestora.";
    case "rate_limited": return "Muitas tentativas. Aguarde um minuto.";
    case "email_already_registered": return "Esse e-mail já tem conta no Cria. Peça pra pessoa aceitar o vínculo.";
    case "already_your_client": return "Esse cliente já está vinculado à sua conta.";
    case "crm_client_not_found": return "Não achei essa ficha na sua carteira. Atualize a página e tente de novo.";
    case "crm_client_already_linked": return "Esse cliente já tem uma conta do Cria vinculada.";
    default: return "Não consegui adicionar agora.";
  }
}

export function AdicionarClienteDialog({
  open, onOpenChange, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: (r: ResultadoAdicionar) => void;
}) {
  const { data: clientes = [], isLoading } = useCrmClients();
  const [passo, setPasso] = useState<Passo>("como");
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<CrmClient | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Só entra na lista quem ainda não tem conta do Cria: oferecer quem já tem
  // seria oferecer o erro que estamos tentando eliminar.
  const disponiveis = useMemo(
    () => clientes.filter((c) => !c.cria_owner_id).sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), "pt-BR")),
    [clientes],
  );
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return disponiveis;
    return disponiveis.filter((c) =>
      `${nomeDe(c)} ${c.email ?? ""} ${c.company_name ?? ""} ${c.instagram ?? ""}`.toLowerCase().includes(q));
  }, [disponiveis, busca]);

  const reset = () => {
    setPasso("como"); setBusca(""); setEscolhido(null); setNome(""); setEmail("");
  };
  const fechar = (o: boolean) => {
    if (enviando) return;
    onOpenChange(o);
    if (!o) setTimeout(reset, 200);
  };

  const escolher = (c: CrmClient) => {
    setEscolhido(c);
    setNome(nomeDe(c));
    setEmail((c.email ?? "").trim());
    setPasso("revisar");
  };

  const criar = async () => {
    const n = nome.trim(); const e = email.trim();
    if (!n) { toast.error("Confira o nome do cliente."); return; }
    if (!isValidEmail(e)) { toast.error("Confira o e-mail: é por ele que o cliente entra no Cria."); return; }
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("manager-add-client", {
        body: { name: n, email: e, crm_client_id: escolhido?.id ?? undefined },
      });
      const code = (data as { error?: string })?.error;
      if (error || code) { toast.error(mensagemDeErro(code)); return; }
      const d = data as ResultadoAdicionar;
      onDone({ email: d.email, inviteLink: d.inviteLink, crmStatus: d.crmStatus });
      onOpenChange(false);
      setTimeout(reset, 200);
    } catch (err) {
      console.error("[manager-add-client] failed:", err);
      toast.error("Falha ao chamar o servidor.");
    } finally { setEnviando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {passo === "carteira" ? "Escolher da carteira" : passo === "revisar" ? "Confira o acesso" : "Adicionar cliente"}
          </DialogTitle>
          <DialogDescription className="font-body text-sm">
            {passo === "carteira"
              ? "Clientes seus que ainda não têm conta do Cria."
              : passo === "revisar"
                ? "É com esses dados que o cliente vai entrar. Dá pra ajustar antes de enviar."
                : "Cria o acesso de criadora coberto pelo seu plano de agência. O cliente não paga nada."}
          </DialogDescription>
        </DialogHeader>

        {/* ── PASSO 1: de onde vem esse cliente ── */}
        {passo === "como" && (
          <div className="space-y-2.5 mt-2">
            <button
              type="button"
              onClick={() => setPasso("carteira")}
              disabled={disponiveis.length === 0}
              className={cn(
                "w-full text-left rounded-2xl border-2 p-4 transition-all flex items-start gap-3",
                disponiveis.length === 0
                  ? "border-border bg-muted/40 opacity-60 cursor-not-allowed"
                  : "border-primary/30 bg-primary/[0.04] hover:border-primary")}
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-display font-semibold text-foreground">Já é meu cliente</p>
                <p className="text-xs font-body text-muted-foreground mt-0.5">
                  {isLoading
                    ? "Carregando sua carteira..."
                    : disponiveis.length === 0
                      ? "Todos os clientes da sua carteira já têm conta do Cria."
                      : `Escolha entre ${disponiveis.length} da sua carteira. Aproveita o nome e o e-mail que já estão na ficha, sem criar cadastro repetido.`}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => { setEscolhido(null); setNome(""); setEmail(""); setPasso("novo"); }}
              className="w-full text-left rounded-2xl border-2 border-border bg-card p-4 transition-all hover:border-primary/30 flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-display font-semibold text-foreground">É cliente novo</p>
                <p className="text-xs font-body text-muted-foreground mt-0.5">
                  Cadastra do zero. A ficha dele entra na sua carteira automaticamente, já ligada à conta.
                </p>
              </div>
            </button>
          </div>
        )}

        {/* ── PASSO 2a: lista da carteira ── */}
        {passo === "carteira" && (
          <div className="mt-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(ev) => setBusca(ev.target.value)}
                placeholder="Buscar pelo nome, e-mail ou @"
                className="rounded-xl pl-9"
              />
            </div>
            <div className="mt-3 space-y-1.5 max-h-[46vh] overflow-y-auto pr-0.5">
              {filtrados.length === 0 && (
                <p className="text-sm font-body text-muted-foreground py-6 text-center">
                  Nenhum cliente com esse termo.
                </p>
              )}
              {filtrados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => escolher(c)}
                  className="w-full text-left rounded-xl border border-border bg-card px-3 py-2.5 hover:border-primary/40 hover:bg-primary/[0.03] transition-all flex items-center gap-3"
                >
                  <div
                    className="w-8 h-8 rounded-lg bg-muted shrink-0 overflow-hidden flex items-center justify-center"
                    style={c.color ? { backgroundColor: `${c.color}22` } : undefined}
                  >
                    {c.logo
                      ? <img src={c.logo} alt="" className="w-full h-full object-cover" />
                      : <span className="text-xs font-display font-bold text-muted-foreground">{nomeDe(c).slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-body font-medium text-foreground truncate">{nomeDe(c)}</p>
                    <p className="text-[11px] font-body text-muted-foreground truncate">
                      {c.email?.trim() || "sem e-mail na ficha, você informa no próximo passo"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-start mt-4">
              <Button variant="ghost" size="sm" onClick={() => setPasso("como")}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar
              </Button>
            </div>
          </div>
        )}

        {/* ── PASSO 2b: cliente novo ── */}
        {passo === "novo" && (
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="font-body text-xs">Nome do cliente</Label>
              <Input value={nome} onChange={(ev) => setNome(ev.target.value)} placeholder="Nome da marca ou da pessoa" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs">E-mail do cliente</Label>
              <Input type="email" inputMode="email" value={email} onChange={(ev) => setEmail(ev.target.value)} placeholder="cliente@email.com" className="rounded-xl" />
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setPasso("como")}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar
              </Button>
              <Button onClick={() => setPasso("revisar")} disabled={!nome.trim() || !email.trim()}>Continuar</Button>
            </div>
          </div>
        )}

        {/* ── PASSO 3: revisão ── */}
        {passo === "revisar" && (
          <div className="space-y-4 mt-2">
            {escolhido && (
              <div className="rounded-xl border border-primary/20 bg-primary/[0.05] px-3 py-2.5 flex items-start gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs font-body text-foreground/80">
                  Vai ficar ligado à ficha de <strong>{nomeDe(escolhido)}</strong> que você já tem. Nada de cadastro repetido:
                  o histórico, o financeiro e a agenda continuam no mesmo lugar.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="font-body text-xs">Nome que ele vê no Cria</Label>
              <Input value={nome} onChange={(ev) => setNome(ev.target.value)} disabled={enviando} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs">E-mail de acesso</Label>
              <Input type="email" inputMode="email" value={email} onChange={(ev) => setEmail(ev.target.value)} disabled={enviando} className="rounded-xl" />
              <p className="text-[11px] font-body text-muted-foreground">
                É pra esse endereço que o convite vai, e é com ele que o cliente faz login. Confira antes de enviar.
              </p>
              {!!email.trim() && !isValidEmail(email.trim()) && (
                <p className="text-[11px] font-body text-destructive">Esse e-mail parece incompleto.</p>
              )}
            </div>

            <div className="rounded-xl bg-muted/50 border border-border p-3">
              <p className="text-[11px] font-body font-semibold text-foreground/70 uppercase tracking-wider mb-1.5">Depois de adicionar</p>
              <ol className="space-y-1 text-[12px] font-body text-foreground/80 list-decimal list-inside">
                <li>O cliente recebe um e-mail pra criar a senha (conta Studio completa, grátis pra ele).</li>
                <li>A ficha dele em <strong>Clientes</strong> passa a mostrar o brandbook e as métricas do Cria.</li>
                <li>Ele aprova o conteúdo por link ou dentro do Cria.</li>
              </ol>
            </div>

            <div className="flex justify-between gap-2 pt-1">
              <Button variant="ghost" size="sm" disabled={enviando} onClick={() => setPasso(escolhido ? "carteira" : "novo")}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar
              </Button>
              <Button onClick={criar} disabled={enviando || !nome.trim() || !isValidEmail(email.trim())}>
                {enviando && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Criar acesso
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
