import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, Camera, Check, Instagram, Loader2, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shared/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useCrmClients, useCreateCrmClient } from "@/hooks/useCrm";
import { connectInstagram } from "@/hooks/useSocialInsights";
import { validateUpload } from "@/lib/upload-validation";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   ONBOARDING DA SOCIAL MÍDIA / AGÊNCIA (v2 · pente fino 23/09/2026)

   Não existia. A conta nascia como gestora pelo gatilho do banco e a pessoa
   caía numa home vazia que dizia "bora colocar a sua operação de pé" sem
   nenhum botão. O tour apontava pra números zerados.

   Quatro passos, um por tela, botão fixo embaixo, tudo pulável:
     1. Sua agência (nome e logo: é o white-label das páginas que o cliente vê)
     2. Seu primeiro cliente (nome e @; o resto vem depois, na ficha)
     3. Instagram do cliente (conecta e volta pra cá; ou "o cliente conecta")
     4. Pronto: o que fazer agora, com o primeiro post pra aprovação como aha

   Marca `onboarding_completed` no fim. A conta de gestora nunca marcava isso,
   e a métrica de ativação do admin ficava errada pra sempre.
   ═══════════════════════════════════════════════════════════════════════════ */

const TOTAL = 4;

export default function OnboardingAgencia() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, isLoading, updateProfile } = useProfile();
  const { data: clients = [], isLoading: clientesCarregando } = useCrmClients();
  const qc = useQueryClient();
  const criarCliente = useCreateCrmClient();
  const [searchParams] = useSearchParams();

  const stepDaUrl = Number(searchParams.get("step") ?? 0);
  const [step, setStep] = useState(stepDaUrl >= 1 && stepDaUrl <= TOTAL ? stepDaUrl : 1);
  const [nomeAgencia, setNomeAgencia] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [subindoLogo, setSubindoLogo] = useState(false);
  const [nomeCliente, setNomeCliente] = useState("");
  const [igCliente, setIgCliente] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(searchParams.get("cliente"));
  const [salvando, setSalvando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const voltouDoInstagram = searchParams.get("ig") === "connected";

  useEffect(() => {
    if (isLoading || !profile) return;
    if (!nomeAgencia && profile.name) setNomeAgencia(profile.name);
    if (!logoUrl && profile.brand_logo_url) setLogoUrl(profile.brand_logo_url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, profile?.id]);

  // Quem chega aqui pediu conta de agência no cadastro (account_intent) ou
  // clicou "Sou social mídia" no onboarding de criador. A conta vira gestora
  // no primeiro "Próximo", pela RPC security definer (account_type é campo de
  // privilégio, travado pra UPDATE direto, inclusive pelo trigger novo).
  const garantirConta = async (): Promise<boolean> => {
    if (profile?.account_type === "manager" || (profile?.seat_limit ?? 0) > 0) return true;
    const { error } = await (supabase.rpc as unknown as (fn: string) => Promise<{ error: unknown }>)("tornar_conta_manager");
    if (error) {
      console.error("[onboarding-agencia] tornar_conta_manager:", error);
      toast.error("Não consegui abrir sua conta de agência agora. Tenta de novo.");
      return false;
    }
    await qc.invalidateQueries({ queryKey: ["profile"] });
    return true;
  };

  // Já tem cliente e chegou aqui sem ?step: pula direto pro passo 3 com ele.
  useEffect(() => {
    if (clientesCarregando || stepDaUrl) return;
    if (clients.length > 0 && !clienteId) { setClienteId(clients[0].id); setNomeCliente(clients[0].name); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientesCarregando]);

  useEffect(() => {
    if (voltouDoInstagram) toast.success("Instagram do cliente conectado.");
    else if (searchParams.get("ig") === "error") toast.error("O Instagram não conectou. Dá pra tentar de novo pela ficha do cliente.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subirLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    const v = validateUpload(file, "managerAvatar");
    if (!v.ok) { toast.error(v.reason); return; }
    setSubindoLogo(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/brand-logo.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setLogoUrl(`${data.publicUrl}?t=${Date.now()}`);
    } catch { toast.error("Não consegui enviar a logo. Dá pra fazer depois em Configurações."); }
    finally { setSubindoLogo(false); }
  };

  const salvarAgencia = async () => {
    setSalvando(true);
    try {
      if (!(await garantirConta())) return;
      await updateProfile.mutateAsync({
        ...(nomeAgencia.trim() ? { name: nomeAgencia.trim() } : {}),
        ...(logoUrl ? { brand_logo_url: logoUrl } : {}),
      });
      setStep(2);
    } catch { toast.error("Não consegui salvar. Tenta de novo?"); }
    finally { setSalvando(false); }
  };

  const salvarCliente = async () => {
    if (clienteId) { setStep(3); return; }
    if (!nomeCliente.trim()) { toast.error("Só o nome do cliente já basta."); return; }
    setSalvando(true);
    try {
      const c = await criarCliente.mutateAsync({
        name: nomeCliente.trim(),
        instagram: igCliente.trim().replace(/^@/, "") || null,
      });
      setClienteId(c.id);
      setStep(3);
    } catch { /* o hook já mostra o toast (inclusive o limite da carteira) */ }
    finally { setSalvando(false); }
  };

  const conectarIgDoCliente = () => {
    if (!clienteId) return;
    void connectInstagram(clienteId, `/comecar-agencia?step=3&cliente=${clienteId}`);
  };

  const concluir = async (destino: string) => {
    try { await updateProfile.mutateAsync({ onboarding_completed: true }); } catch { /* segue */ }
    try { sessionStorage.setItem("cria.tour-adiado", "1"); } catch { /* ok */ }
    navigate(destino, { replace: true });
  };

  // Pular o passo 1 também abre a conta de agência: sem isso a pessoa criava
  // cliente e caía no app como criadora.
  const pular = async () => {
    if (step >= TOTAL) return;
    if (step === 1 && !(await garantirConta())) return;
    setStep(step + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="sticky top-0 z-20 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Logo className="h-6 w-auto" />
          <div className="flex-1 flex items-center gap-1.5 ml-4">
            {Array.from({ length: TOTAL }).map((_, i) => (
              <div key={i} className={cn("h-1.5 rounded-full transition-all duration-300",
                i + 1 === step ? "flex-1 bg-primary" : i + 1 < step ? "w-6 bg-primary" : "w-6 bg-muted")} />
            ))}
          </div>
          <span className="text-xs font-body text-muted-foreground tabular-nums">{step}/{TOTAL}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 pb-32">
        <motion.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-6">

          {step === 1 && (
            <>
              <header className="space-y-2">
                <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Sua agência</h1>
                <p className="text-muted-foreground font-body">
                  O nome e a logo aparecem nas páginas que o seu cliente abre: aprovação, cronograma, relatório. É a sua marca na frente dele.
                </p>
              </header>
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={subindoLogo}
                  className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-border bg-card grid place-items-center overflow-hidden hover:border-primary/50 transition-colors">
                  {logoUrl
                    ? <img src={logoUrl} alt="" className="w-full h-full object-contain" />
                    : subindoLogo ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Camera className="h-6 w-6 text-muted-foreground" />}
                </button>
                <div className="text-sm font-body text-muted-foreground">
                  <p className="font-semibold text-foreground">Logo (opcional)</p>
                  <p className="text-xs">PNG com fundo transparente fica melhor.</p>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={subirLogo} />
              </div>
              <div className="space-y-2">
                <Label className="font-body text-sm">Nome da agência ou o seu nome profissional</Label>
                <Input value={nomeAgencia} onChange={(e) => setNomeAgencia(e.target.value)} placeholder="Ex.: Gabi Kawikioni · Social Media" className="rounded-xl h-12" maxLength={80} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <header className="space-y-2">
                <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Seu primeiro cliente</h1>
                <p className="text-muted-foreground font-body">
                  Só o nome e o @ por enquanto. Contrato, mensalidade, brandbook e tudo o mais fica na ficha dele, pra você preencher quando quiser.
                </p>
              </header>
              {clienteId ? (
                <div className="rounded-2xl border border-[hsl(var(--cria-verde)/0.35)] bg-[hsl(var(--cria-verde)/0.08)] p-4 flex items-center gap-3">
                  <Check className="h-5 w-5 text-[hsl(var(--cria-verde))]" />
                  <p className="text-sm font-body text-foreground"><strong>{nomeCliente || "Cliente"}</strong> já está na sua carteira.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Nome do cliente</Label>
                    <Input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} placeholder="Ex.: Bruder Bistrô" className="rounded-xl h-12" maxLength={100} autoFocus />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Instagram (opcional)</Label>
                    <Input value={igCliente} onChange={(e) => setIgCliente(e.target.value)} placeholder="@bruderbistro" className="rounded-xl h-12" maxLength={60} />
                  </div>
                </>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <header className="space-y-2">
                <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Instagram do cliente</h1>
                <p className="text-muted-foreground font-body">
                  Conectando, os números dele entram no relatório e a IA escreve com base no que já funciona no perfil. Precisa ser conta profissional e você precisa ter acesso.
                </p>
              </header>
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] grid place-items-center shrink-0">
                    <Instagram className="h-5 w-5 text-white" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-display font-bold text-foreground">{voltouDoInstagram ? "Conectado" : nomeCliente || "Seu cliente"}</p>
                    <p className="text-xs text-muted-foreground font-body">{voltouDoInstagram ? "Os números vão aparecer na ficha em alguns minutos." : "Abre o Instagram, você autoriza e volta pra cá."}</p>
                  </div>
                  {voltouDoInstagram
                    ? <Check className="h-5 w-5 text-[hsl(var(--cria-verde))]" />
                    : <Button size="sm" onClick={conectarIgDoCliente} disabled={!clienteId} className="rounded-xl">Conectar</Button>}
                </div>
                {!voltouDoInstagram && (
                  <p className="text-xs font-body text-muted-foreground">
                    Não tem o acesso agora? Pula. Na ficha do cliente tem um link de cadastro pra ele mesmo conectar depois.
                  </p>
                )}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <header className="space-y-2">
                <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Pronto. Agora o trabalho de verdade.</h1>
                <p className="text-muted-foreground font-body">
                  O Cria brilha na hora de mandar um post pro cliente aprovar: ele recebe um link, abre no celular, aprova ou pede ajuste. Sem print no WhatsApp.
                </p>
              </header>
              <div className="grid gap-3">
                {[
                  { icon: Send, t: "Criar o primeiro post pra aprovação", d: "Monte o post na ficha do cliente e mande o link.", to: clienteId ? `/socialmidia/clientes/${clienteId}/posts` : "/socialmidia/clientes", primario: true },
                  { icon: Users, t: "Ver a ficha do cliente", d: "Brandbook, contrato, links úteis, tudo dele num lugar.", to: clienteId ? `/socialmidia/clientes/${clienteId}` : "/socialmidia/clientes" },
                  { icon: Building2, t: "Ir pro painel", d: "A visão geral da sua operação.", to: "/socialmidia/dashboard" },
                ].map(({ icon: Icon, t, d, to, primario }) => (
                  <button key={t} type="button" onClick={() => void concluir(to)}
                    className={cn("text-left rounded-2xl border p-4 flex items-center gap-3 transition-colors",
                      primario ? "border-primary bg-primary/5 hover:bg-primary/10" : "border-border bg-card hover:border-primary/40")}>
                    <span className={cn("w-10 h-10 rounded-xl grid place-items-center shrink-0", primario ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-display font-bold text-foreground">{t}</span>
                      <span className="block text-xs font-body text-muted-foreground">{d}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {step < TOTAL && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur px-4 sm:px-6 py-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              {step > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => void pular()} className="text-muted-foreground">Pular</Button>
            </div>
            <Button variant="hero" size="lg" className="min-h-[48px]" disabled={salvando}
              onClick={() => { if (step === 1) void salvarAgencia(); else if (step === 2) void salvarCliente(); else setStep(4); }}>
              {salvando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              {step === 3 ? "Continuar" : "Próximo"} <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
