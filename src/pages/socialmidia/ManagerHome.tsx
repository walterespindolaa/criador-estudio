import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Camera, ArrowRight, Ticket, Settings, Users, Sparkles, Check, Gift, Wallet, Send, CalendarDays, Eye, EyeOff, Heart, Clock } from "lucide-react";
import { useOperationSignals, DOMAIN_HEX, type OpDomain, type OpUrgency, type HealthLevel } from "@/hooks/useOperationSignals";
import { OrganicBlobs } from "@/components/brand/OrganicBlobs";
import { CRIA_HEX, type CriaColor } from "@/lib/moduleTheme";
import { formatBRL } from "@/lib/money";
import { useManagerApprovalOverview } from "@/hooks/useApprovals";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePartner } from "@/hooks/usePartner";
import { useModules } from "@/hooks/useModules";
import { supabase } from "@/integrations/supabase/client";
import { validateUpload } from "@/lib/upload-validation";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { ApprovalTracker } from "@/components/accounts/ApprovalTracker";
import { CopyButton } from "@/components/shared/CopyButton";
import { useManagerOutlet } from "@/components/accounts/ManagerLayout";
import { readLastClient } from "@/components/accounts/ClientSwitcher";
import { useCrmClients } from "@/hooks/useCrm";

// Card do painel. A cor é a do módulo pra onde ele leva: a pessoa aprende
// a cor uma vez e depois navega no automático, sem ler.
function Painel({ color, icon: Icon, valor, label, to, destaque, masked }: {
  color: CriaColor; icon: typeof Users; valor: string; label: string; to: string; destaque?: boolean; masked?: boolean;
}) {
  const hex = CRIA_HEX[color];
  return (
    <Link to={to}
      className="group relative rounded-2xl border border-border bg-background/70 backdrop-blur-sm p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderLeftWidth: 3, borderLeftColor: hex, ...(destaque ? { background: `${hex}0f` } : {}) }}>
      <span className="grid h-9 w-9 place-items-center rounded-xl mb-2" style={{ background: `${hex}1f`, color: hex }}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-xl font-display font-extrabold text-foreground leading-none tabular-nums">{masked ? "••••" : valor}</p>
      <p className="text-[11px] font-body text-muted-foreground mt-1 leading-tight">{label}</p>
    </Link>
  );
}

function initial(name?: string | null) { return name ? name.trim().charAt(0).toUpperCase() : "?"; }
const DOMAIN_ICON: Record<OpDomain, typeof Users> = { conteudo: Send, financeiro: Wallet, relacionamento: Heart, prazo: Clock };
const URG: Record<OpUrgency, { label: string; cls: string }> = {
  hi: { label: "Urgente", cls: "bg-red-100 text-red-700" },
  mid: { label: "Atenção", cls: "bg-amber-100 text-amber-700" },
  ok: { label: "No radar", cls: "bg-emerald-100 text-emerald-700" },
};
const HEALTH_HEX: Record<HealthLevel, string> = { g: "#01A652", y: "#e0a500", r: "#d64545" };
function greeting(name?: string | null) {
  const first = (name ?? "").trim().split(/\s+/)[0] || "social media";
  const h = new Date().getHours();
  const part = h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
  return `${part}, ${first}!`;
}

export default function ManagerHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { partner, isPartner } = usePartner();
  const { modules } = useModules();
  const { openModule, openSettings } = useManagerOutlet();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  // Modo privacidade: um olho oculta TODOS os números dos cards (útil pra gravar
  // tela ou mostrar pra alguém sem expor faturamento/pendências).
  const [masked, setMasked] = useState(false);
  const hasAgency = (profile?.seat_limit ?? 0) > 0;

  // Atalho "Continuar em {cliente}": retoma o último cliente visitado no hub.
  // Só aparece se o cliente ainda existe (valida contra o cadastro central).
  const { data: crmClients = [] } = useCrmClients();
  const last = readLastClient();
  const lastClient = last ? crmClients.find((c) => c.id === last.id) ?? null : null;

  // O resumo do dia. Antes a frase prometia um resumo e nada aparecia.
  const ativos = crmClients.filter((c) => (c.status ?? "ativo") === "ativo").length;
  const mrr = crmClients
    .filter((c) => (c.status ?? "ativo") !== "inativo")
    .reduce((s, c) => s + (Number(c.monthly_value) || 0), 0);
  const { overview } = useManagerApprovalOverview();
  const pendentes = overview.reduce((s, r) => s + (r.pendentes ?? 0), 0);
  // Motor de sinais: alimenta o feed "Sua operação hoje" e a saúde dos clientes.
  const { signals, health, counts } = useOperationSignals();

  // Módulos: só os ativos viram card. O resto vira upsell discreto — e o "pacote
  // extra" some se o módulo-base já está ativo (era o "Cria Radar" duplicado).
  const activeMods = modules.filter((m) => m.status === "active" || m.status === "past_due");
  const upsellMods = modules.filter((m) =>
    m.status !== "active" && m.status !== "past_due" && !m.coming_soon &&
    !activeMods.some((a) => m.name.startsWith(a.name)),
  );
  // Clientes do CRM (todos, não só os que usam o Cria), pro grid da home.
  const clientesHome = crmClients.filter((c) => (c.status ?? "ativo") !== "inativo").slice(0, 6);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    const v = validateUpload(file, "managerAvatar");
    if (!v.ok) { toast.error(v.reason); return; }
    const reader = new FileReader();
    reader.onload = () => { setRawImageSrc(reader.result as string); setCropOpen(true); };
    reader.readAsDataURL(file);
  };
  const handleAvatarCropped = async (blob: Blob) => {
    if (!user) return;
    try {
      const path = `${user.id}/avatar.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateProfile.mutateAsync({ avatar_url: `${urlData.publicUrl}?t=${Date.now()}` });
      toast.success("Foto atualizada!");
    } catch { toast.error("Erro ao enviar a foto."); }
    finally { setCropOpen(false); setRawImageSrc(null); }
  };

  return (
    <div>
      {/* ═══ PAINEL DE ABERTURA ═══
          Era saudação + "Aqui está o resumo do seu dia" e nenhum resumo aparecia.
          Agora o resumo existe de verdade: quanto você fatura, quantos clientes,
          o que está travado esperando aprovação. E os atalhos na cor de cada módulo. */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-7 mb-6">
        <OrganicBlobs color="laranja" />

        <div className="relative flex items-center gap-4 flex-wrap">
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="relative w-[72px] h-[72px] rounded-3xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[3px] shrink-0 hover:scale-[1.02] transition-transform" aria-label="Trocar foto">
            <div className="w-full h-full rounded-3xl bg-card overflow-hidden flex items-center justify-center">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                : <span className="text-3xl font-display font-extrabold text-primary">{initial(profile?.name)}</span>}
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary border-2 border-background flex items-center justify-center shadow-sm"><Camera className="h-3.5 w-3.5 text-primary-foreground" /></div>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">{greeting(profile?.name)}</h1>
            <p className="text-sm text-muted-foreground font-body mt-1">
              {counts.total > 0
                ? <><strong className="text-foreground">{counts.total}</strong> {counts.total === 1 ? "coisa precisa" : "coisas precisam"} de você hoje{counts.red > 0 ? <> · <strong className="text-red-600">{counts.red} urgente{counts.red > 1 ? "s" : ""}</strong></> : null}. Comece pelo topo da lista.</>
                : ativos > 0
                  ? <>Tudo em dia. Bom momento pra adiantar a semana.</>
                  : <>Bora colocar a sua operação de pé.</>}
            </p>
          </div>

          {lastClient && (
            <button type="button" onClick={() => navigate(`/socialmidia/clientes/${lastClient.id}/visao-geral`)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-background/70 backdrop-blur-sm px-4 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md w-full justify-between sm:w-auto sm:justify-start sm:shrink-0">
              <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full font-display font-bold text-white text-sm" style={{ background: "linear-gradient(135deg,#0F6E56,#1d9e75)" }}>
                {initial(lastClient.name)}
                {lastClient.logo && <img src={lastClient.logo} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-body font-semibold uppercase tracking-wider text-muted-foreground">Continuar de onde parou</span>
                <span className="block truncate text-[13px] font-display font-bold text-foreground max-w-[160px]">{lastClient.name}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
            </button>
          )}

          {/* A engrenagem que ficava aqui virou duplicata: agora existe uma no
              header mobile, que é onde a pessoa espera encontrar. */}
        </div>

        {/* Os números que importam. Antes o dashboard não mostrava NENHUM. */}
        <div data-tour="gh-numeros" className="relative mt-6">
          {/* Olho único: oculta TODOS os números dos cards de uma vez. */}
          <button type="button" onClick={() => setMasked((v) => !v)}
            className="absolute -top-6 right-0 flex items-center gap-1.5 text-[11px] font-body font-semibold text-muted-foreground hover:text-foreground transition-colors"
            aria-label={masked ? "Mostrar números" : "Ocultar números"}>
            {masked ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {masked ? "Mostrar" : "Ocultar"}
          </button>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <Painel color="rosa" icon={Users} valor={String(ativos)} label={ativos === 1 ? "cliente ativo" : "clientes ativos"} to="/socialmidia/clientes" masked={masked} />
            <Painel color="azul" icon={Wallet} valor={formatBRL(mrr)} label="por mês na carteira" to="/socialmidia/criacaixa/empresa/visao" masked={masked} />
            <Painel color="laranja" icon={Send} valor={String(pendentes)} label={pendentes === 1 ? "post esperando o cliente" : "posts esperando o cliente"} to="/socialmidia/criapost/aprovacoes" destaque={pendentes > 0} masked={masked} />
            <Painel color="amarelo" icon={CalendarDays} valor="Agenda" label="a sua semana" to="/socialmidia/agenda" />
          </div>
        </div>
      </section>

      {/* ═══ SUA OPERAÇÃO HOJE ═══
          Feed único e priorizado: junta conteúdo, financeiro, relacionamento e
          prazo, ordenado por urgência. A cor fica só no ícone da categoria. */}
      {signals.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider">Sua operação hoje</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-foreground text-background">{signals.length}</span>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {signals.slice(0, 8).map((s) => {
              const Icon = DOMAIN_ICON[s.domain];
              const urg = URG[s.urgency];
              return (
                <button key={s.id} type="button" onClick={() => navigate(s.to)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 text-left transition-colors hover:bg-muted/40">
                  <span className="grid h-10 w-10 place-items-center rounded-xl text-white shrink-0" style={{ background: DOMAIN_HEX[s.domain] }}><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-body font-bold text-foreground leading-tight">{s.title}</span>
                    <span className="block text-[12.5px] font-body text-muted-foreground truncate mt-0.5">
                      <span className="font-bold text-foreground">{s.clientName}</span> · {s.sub}
                    </span>
                  </span>
                  <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full shrink-0 ${urg.cls}`}>{urg.label}</span>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[12px] font-bold text-foreground shrink-0">{s.actionLabel}<ArrowRight className="h-3.5 w-3.5" /></span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ SAÚDE DOS CLIENTES ═══ radar de retenção */}
      {health.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider mb-3">Saúde dos clientes</h2>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
            {health.map((h) => (
              <button key={h.clientId} type="button" onClick={() => navigate(`/socialmidia/clientes/${h.clientId}/visao-geral`)}
                className="flex-none w-[190px] rounded-2xl border border-border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-2">
                  <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full text-white text-xs font-display font-bold" style={{ background: h.color || "#0F6E56" }}>
                    {initial(h.name)}
                    {h.logo && <img src={h.logo} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" />}
                  </span>
                  <span className="text-[13.5px] font-display font-bold text-foreground truncate flex-1">{h.name}</span>
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: HEALTH_HEX[h.level] }} />
                </div>
                <p className="text-[11.5px] font-body text-muted-foreground mt-2 leading-snug line-clamp-2">{h.reason}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider mb-3">Seus módulos</h2>
      <div data-tour="gh-modulos" className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {activeMods.map((m) => (
          <button key={m.code} type="button" onClick={() => openModule(m)}
            className="text-left bg-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-display font-bold text-foreground text-sm">{m.name}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Ativo</span>
            </div>
            <p className="text-xs text-muted-foreground font-body">Toque para abrir</p>
          </button>
        ))}
      </div>
      {/* Upsell discreto, em UMA linha, sem card duplicado no meio dos ativos. */}
      {upsellMods.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3 mb-8">
          <span className="text-xs font-body font-bold text-foreground">Amplie seu plano:</span>
          {upsellMods.map((m) => (
            <button key={m.code} type="button" onClick={() => openModule(m)}
              className="text-xs font-body font-semibold rounded-full border border-border bg-card px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
              {m.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider">Aprovações recentes</h2>
        <button onClick={() => navigate("/socialmidia/aprovacoes")} className="text-primary font-body font-bold text-xs flex items-center gap-1 hover:underline">Ver todas <ArrowRight className="h-3 w-3" /></button>
      </div>
      <div data-tour="gh-aprovacoes" className="mb-8"><ApprovalTracker hideHeader limit={5} /></div>

      {isPartner && partner?.coupon_code && (
        <>
          <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider mb-3">Seu cupom de parceira</h2>
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-card px-4 py-3 flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"><Ticket className="h-5 w-5 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Seu cupom</p>
              <p className="text-lg font-display font-extrabold text-foreground tracking-wider truncate">{partner.coupon_code}</p>
            </div>
            <CopyButton text={partner.coupon_code} />
          </div>
        </>
      )}

      {/* Indique e ganhe: quem ainda não é parceira vê o convite direto no dashboard. */}
      {!isPartner && (
        <button type="button" onClick={() => navigate("/socialmidia/parceria")}
          className="w-full mb-8 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card px-4 py-3 flex items-center gap-3 text-left hover:border-primary/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-primary/15 grid place-items-center shrink-0"><Gift className="h-5 w-5 text-primary" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-bold text-foreground">Indique o CRIA e ganhe comissão recorrente</p>
            <p className="text-xs text-muted-foreground font-body mt-0.5">Vire parceira, compartilhe seu cupom e receba todo mês enquanto a indicação for assinante.</p>
          </div>
          <ArrowRight className="h-4 w-4 text-primary shrink-0" />
        </button>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider">Seus clientes</h2>
        <button onClick={() => navigate("/socialmidia/clientes")} className="text-primary font-body font-bold text-xs flex items-center gap-1 hover:underline">Ver todos <ArrowRight className="h-3 w-3" /></button>
      </div>
      <div data-tour="gh-clientes" className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {clientesHome.map((c) => {
          const cor = (c as { color?: string | null }).color || "#0F6E56";
          return (
            <button key={c.id} type="button" onClick={() => navigate(`/socialmidia/clientes/${c.id}/visao-geral`)}
              className="relative overflow-hidden text-left bg-card border border-border rounded-2xl p-4 pt-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <span aria-hidden className="absolute top-0 inset-x-0 h-1.5" style={{ background: cor }} />
              <div className="flex items-center gap-2.5">
                <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full text-white text-sm font-display font-bold" style={{ background: cor }}>
                  {initial(c.name)}
                  {c.logo && <img src={c.logo} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-display font-bold text-foreground truncate">{c.name || "Sem nome"}</span>
                  {c.instagram && <span className="block text-[11px] font-body text-muted-foreground truncate">@{c.instagram.replace(/^@/, "")}</span>}
                </span>
              </div>
              <div className="flex gap-1.5 mt-2.5 flex-wrap">
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${c.cria_owner_id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{c.cria_owner_id ? "Usa o Cria" : "Aprova por link"}</span>
              </div>
            </button>
          );
        })}
      </div>

      {!hasAgency && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-pink-400 text-white p-5 sm:p-6 mt-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-lg bg-white/15 grid place-items-center"><Users className="h-4 w-4" /></span>
            <h3 className="font-display font-extrabold text-lg">Vire uma agência no CRIA</h3>
          </div>
          <p className="text-sm font-body text-white/90 max-w-2xl leading-relaxed">
            Você gerencia todos os clientes num painel só e cobra quanto quiser deles. Paga só pelos assentos (a partir de <strong>R$ 36,90</strong> vs R$ 49,90 avulso), e cada cliente entra com a conta <strong>Studio completa</strong>, sem custo pra ele.
          </p>

          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 mt-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/70 mb-2">O que muda pra você</p>
              <div className="space-y-1.5">
                {[
                  "Todos os clientes num painel só",
                  "Posts, cronograma e aprovação de cada um",
                  "Relatórios e acesso com a sua cara (white-label)",
                  "Cliente cancelou? Pausa no inventário e libera o assento",
                  "Adiciona cliente na hora, sem depender de ninguém",
                ].map((b) => (
                  <div key={b} className="flex items-start gap-2 text-[13px] font-body text-white/95"><Check className="h-4 w-4 shrink-0 mt-0.5" /> {b}</div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/70 mb-2">O que cada cliente recebe</p>
              <div className="space-y-1.5">
                {[
                  "Cria Plano: a IA monta o mês de conteúdo",
                  "Cria IA: ideias, legendas e score de post",
                  "Media Kit automático pra fechar publi",
                  "Calendário + melhor horário pra postar",
                  "Link na bio, Brandbook e insights do Instagram",
                ].map((b) => (
                  <div key={b} className="flex items-start gap-2 text-[13px] font-body text-white/95"><Check className="h-4 w-4 shrink-0 mt-0.5" /> {b}</div>
                ))}
              </div>
            </div>
          </div>

          <button onClick={() => navigate("/socialmidia/contas")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-primary hover:opacity-90 transition">
            <Sparkles className="h-4 w-4" /> Conhecer o Plano de Agência
          </button>
        </div>
      )}

      {rawImageSrc && (
        <ImageCropModal open={cropOpen} onOpenChange={(o) => { setCropOpen(o); if (!o) setRawImageSrc(null); }}
          imageSrc={rawImageSrc} onCropComplete={handleAvatarCropped} aspectRatio={1} cropShape="round" />
      )}
    </div>
  );
}
