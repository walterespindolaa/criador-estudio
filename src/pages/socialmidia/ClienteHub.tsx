import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Link2, Loader2, Plus, Settings2, Trash2, Wallet, Send, Check, Pencil, LogIn } from "lucide-react";
import { toast } from "sonner";
import { useCrmClient, useUpdateCrmClient, useUploadCrmAsset } from "@/hooks/useCrm";
import { Camera } from "lucide-react";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useExternalClients } from "@/hooks/useCriaPost";
import {
  useFinRecords, useCreateFinRecord, useUpdateFinRecord, useDeleteFinRecord,
  useFinRecurring, useCreateFinRecurring, type FinType, type FinRecord,
} from "@/hooks/useFinance";
import { ClienteIdeias } from "@/components/accounts/ClienteIdeias";
import { ClientePortalTab } from "@/components/accounts/ClientePortalTab";
import { ModuleUpsell, ModuleUpsellDialog } from "@/components/accounts/ModuleUpsell";
import { useHasModule } from "@/hooks/useModules";
import { ClientDetail } from "@/components/accounts/CriaPostBoard";
import { ExternalClientDialog } from "@/components/accounts/ExternalClientDialog";
import { saveLastClient } from "@/components/accounts/ClientSwitcher";
import { CriativoTab } from "@/components/hubcria/CriativoTab";
import { useHasHubCria } from "@/hooks/useHubCria";
import { useCriaClientProfiles } from "@/hooks/useManagerClientCria";
import { ClienteInstagramCria } from "@/components/accounts/ClienteInstagramCria";
import { ClienteBrandbookCria } from "@/components/accounts/ClienteBrandbookCria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ── ABAS DO CLIENTE ──
// A aba "Criativo" misturava três coisas diferentes: o Brandbook do cliente,
// as ideias e a pesquisa do Apify. Virou uma sopa. Agora cada coisa tem o seu lugar:
//   Brandbook → quem é a marca         (leitura, vem da conta CRIA dele)
//   Ideias    → o que postar           (dele + do HUB + suas)
//   Pesquisa  → analisar concorrente   (Apify, só quem tem o HUB liberado)
//   Portal    → o que o cliente vê     (era o popup "Personalizar", espremido)
// ═══════════════════════════════════════════════════════════════════════════
// AS ABAS DO CLIENTE — cada uma com a cor do MÓDULO a que ela pertence.
//
// A ficha do cliente é onde os módulos do CRIA se encontram: Posts é o Cria Post,
// Financeiro é o Cria Caixa, Pesquisa é o Cria Radar. Só que nada dizia isso — as
// abas eram todas cinzas, e a pessoa não percebia que estava usando um produto
// pago dentro da ficha. A cor faz o módulo aparecer e lembra do valor que ele
// está entregando ali.
// ═══════════════════════════════════════════════════════════════════════════
type TabDef = { key: string; label: string; hub?: boolean; modulo?: CriaColor; moduloNome?: string };

const TABS: TabDef[] = [
  { key: "visao-geral", label: "Visão geral" },
  { key: "brandbook", label: "Brandbook", modulo: "rosa", moduloNome: "Cria Gestão" },
  { key: "ideias", label: "Ideias", modulo: "lilas", moduloNome: "Cria Radar" },
  { key: "cronograma", label: "Cronograma", modulo: "laranja", moduloNome: "Cria Post" },
  { key: "posts", label: "Posts", modulo: "laranja", moduloNome: "Cria Post" },
  { key: "relatorio", label: "Relatório", modulo: "laranja", moduloNome: "Cria Post" },
  { key: "instagram", label: "Instagram" },
  { key: "financeiro", label: "Financeiro", modulo: "azul", moduloNome: "Cria Caixa" },
  { key: "pesquisa", label: "Pesquisa", hub: true, modulo: "lilas", moduloNome: "Cria Radar" },
  { key: "portal", label: "Portal", modulo: "laranja", moduloNome: "Cria Post" },
];
const OPERACIONAIS = new Set(["posts", "cronograma", "relatorio", "instagram"]);
const WORKFLOW = new Set(["ideias", "posts", "cronograma", "relatorio"]);
type FlowStep = { key: string; n: number; label: string; gated?: boolean };
const FLOW_STEPS: FlowStep[] = [
  { key: "ideias", n: 1, label: "Ideias" },
  { key: "cronograma", n: 2, label: "Calendário do mês" },
  { key: "posts", n: 3, label: "Posts prontos" },
  { key: "relatorio", n: 4, label: "Resultado" },
];
const FLOW_EXPLAIN: Record<string, string> = {
  ideias: "O banco de ideias deste cliente: o que ele mesmo anotou, o que ele salvou, o que a IA tirou dos concorrentes e o que você guardou. Marque as boas como “Usar” e clique em “Criar posts”.",
  posts: "De onde vem: as ideias que você aprovou (ou posts criados na mão). Aqui você monta cada post e manda o cliente aprovar por link: Aguardando cliente → Ajuste solicitado → Aprovado.",
  cronograma: "É o calendário do mês pro cliente: datas comemorativas + link público com a visão geral do que vai sair. A aprovação post a post acontece na aba Posts.",
  relatorio: "O relatório white-label com o resultado do que foi publicado no mês.",
};
const initial = (n?: string | null) => (n ? n.trim().charAt(0).toUpperCase() : "?");
import { CRIA_HEX, type CriaColor } from "@/lib/moduleTheme";
import { formatBRL } from "@/lib/money";
import { hojeBR, parseDateOnly } from "@/lib/date-br";
import { confirmar } from "@/components/shared/Confirm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { useManagerProfile } from "@/hooks/useModules";
import { isPctRegime } from "@/lib/finance";
// Dinheiro nesta tela é sempre em REAIS (fin_records.amount e crm_clients.monthly_value).
// formatBRL cuida da formatação, nada de dividir/multiplicar por 100 aqui.

export default function ClienteHub() {
  const { id, tab } = useParams<{ id: string; tab?: string }>();
  const navigate = useNavigate();
  const { allowed: hasHubCria } = useHasHubCria();
  const { allowed: hasCaixa } = useHasModule("financeiro");
  const { allowed: hasPost } = useHasModule("aprovapost_externo");
  const { data: client, isLoading } = useCrmClient(id);
  const { setActiveAccount } = useActiveAccount();
  // A aba Pesquisa (Apify) só aparece pra quem tem o HUB liberado, se não tem,
  // a aba nem existe (não adianta mostrar porta trancada).
  const visibleTabs = useMemo(
    () => TABS.filter((t) => !("hub" in t && t.hub) || hasHubCria),
    [hasHubCria],
  );
  const activeTab = tab && visibleTabs.some((t) => t.key === tab) ? tab : "visao-geral";
  // Foto da conta CRIA do cliente sempre atual (não depende do sync manual do CRM).
  const { data: criaProfiles } = useCriaClientProfiles();
  const criaAvatar = client?.cria_owner_id ? (criaProfiles?.[client.cria_owner_id]?.avatar_url ?? null) : null;
  const avatarUrl = criaAvatar ?? client?.logo ?? null;
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const uploadAsset = useUploadCrmAsset();
  const updateClient = useUpdateCrmClient();
  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !client) return;
    try {
      const url = await uploadAsset.mutateAsync({ clientId: client.id, file, kind: "avatar" });
      await updateClient.mutateAsync({ id: client.id, logo: url });
      toast.success("Foto atualizada!");
    } catch { /* hook já avisa */ }
  };
  const { clients: ext, create: createExt, pending, copyLink } = useExternalClients();
  const extClient = useMemo(() => ext.find((e) => e.crm_client_id === id) ?? null, [ext, id]);
  const pendCount = extClient ? (pending[extClient.id] ?? 0) : 0;

  // Ações do cabeçalho: copiar o link de aprovação (toast no hook) e abrir o portal em nova aba.
  const [copying, setCopying] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const doCopyLink = async () => {
    if (!extClient) return;
    setCopying(true);
    await copyLink(extClient.id);
    setCopying(false);
  };
  const openPortal = async () => {
    if (!extClient) return;
    const url = await copyLink(extClient.id);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const goTab = (t: string) => navigate(`/socialmidia/clientes/${id}/${t}`);

  // Último cliente visitado: alimenta o seletor global e o "Continuar em {cliente}" do dashboard.
  useEffect(() => {
    if (client) saveLastClient(client.id, client.name);
  }, [client]);

  // Ativar o Cria Post num cliente exige o MÓDULO Cria Post.
  // Antes o botão simplesmente tentava e falhava (ou o gate genérico dizia
  // "módulo inativo"). Agora, sem o módulo, abre a vitrine: o que ela ganha,
  // com o nome do cliente na chamada.
  const [upsell, setUpsell] = useState<string | null>(null);
  const enableCriaPost = async () => {
    if (!client) return;
    if (!hasPost) { setUpsell("aprovapost_externo"); return; }
    // Já ativado? Não cria outra linha (evita "2 Anna"). O create também deduplica,
    // mas guardamos aqui pra nem disparar mutation à toa.
    if (extClient) { toast.success("Cliente já está ativo no Cria Post."); return; }
    if (createExt.isPending) return;
    await createExt.mutateAsync({ name: client.name, crm_client_id: id, instagram_handle: client.instagram });
    toast.success("Cliente ativado no Cria Post!");
  };

  if (isLoading) return <div className="py-20 text-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" /></div>;
  if (!client) return (
    <div className="py-20 text-center">
      <p className="text-sm font-body text-muted-foreground">Cliente não encontrado.</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate("/socialmidia/clientes")}>Voltar</Button>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      <button onClick={() => navigate("/socialmidia/clientes")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-body mb-4"><ArrowLeft className="h-4 w-4" /> Clientes</button>

      {/* Cabeçalho no padrão vitrine: logo grande, badges de status e ações sempre visíveis. */}
      <div className="mb-4 rounded-3xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => avatarInputRef.current?.click()} aria-label="Trocar foto do cliente"
            className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full grid place-items-center text-white text-xl font-display font-bold shrink-0 overflow-hidden ring-2 ring-border/60 hover:ring-primary/40 transition-all group/av" style={{ background: "linear-gradient(135deg,#0F6E56,#1d9e75)" }}>
            {initial(client.name)}
            {/* Avatar do CRIA do cliente → logo manual → inicial. */}
            {avatarUrl && <img src={avatarUrl} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 w-full h-full object-cover" />}
            <span className="absolute inset-0 bg-black/40 opacity-0 group-hover/av:opacity-100 transition-opacity grid place-items-center"><Camera className="h-4 w-4 text-white" /></span>
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight truncate">{client.name}</h1>
            <p className="text-sm text-muted-foreground font-body truncate">
              {client.instagram ? `@${client.instagram.replace(/^@/, "")}` : "sem @"}{client.cria_owner_id ? " · usa o Cria" : " · aprova por link"}
            </p>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {extClient
                ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-600 font-body font-semibold">Link de aprovação ativo</span>
                : <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-body">Cria Post não ativado</span>}
              {pendCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-body font-semibold">{pendCount} pendente{pendCount > 1 ? "s" : ""}</span>}
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            {/* ENTRAR NO CRIA DO CLIENTE.
                O caminho existia (é o seletor de contas lá em cima), mas de
                DENTRO do cliente não havia porta nenhuma: ela estava olhando a
                ficha dele e, pra abrir o quadro dele, tinha que sair, achar o
                seletor e escolher o nome na lista. O atalho tem que estar onde
                a pessoa está. */}
            {client?.cria_owner_id && (
              <Button
                variant="outline"
                onClick={() => {
                  setActiveAccount(client.cria_owner_id!);
                  navigate("/app");
                  toast.success(`Você está no Cria de ${client.name}.`);
                }}
              >
                <LogIn className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Entrar no Cria dele</span>
              </Button>
            )}
          </div>
          {extClient && (
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" className="px-3" onClick={openPortal} title="Abrir portal do cliente em nova aba" aria-label="Abrir portal do cliente em nova aba">
                <ExternalLink className="h-4 w-4" />
              </Button>
              {/* O botão "Personalizar" SAIU daqui.
                  Ele abria um popup com exatamente o mesmo conteúdo da aba
                  Portal, que fica dois centímetros abaixo. Dois caminhos pra
                  mesma coisa não é conveniência, é dúvida: a pessoa não sabe
                  qual é o certo, e o popup (que é apertado) ganhava por estar
                  mais perto do dedo. Ficou UM lugar: a aba Portal. */}
            </div>
          )}
        </div>
      </div>
      <ExternalClientDialog open={editOpen} onOpenChange={setEditOpen} client={extClient} />

      {/* Abas por URL, em pílula (o padrão do CRIA).
          A sublinha de 2px era fria e, no celular, a aba ativa quase não se
          distinguia das outras. A pílula deixa a ativa sólida e engorda o alvo
          do dedo. A cor continua sendo a do MÓDULO, que é o que ensina a pessoa
          a reconhecer o produto dentro da ficha. */}
      <div className="flex gap-1 mb-5 overflow-x-auto rounded-full border border-border bg-muted/50 p-1 w-fit max-w-full">
        {visibleTabs.map((t) => {
          const on = activeTab === t.key;
          const hex = t.modulo ? CRIA_HEX[t.modulo] : null;
          return (
            <button
              key={t.key}
              onClick={() => goTab(t.key)}
              title={t.moduloNome ? `${t.label} · ${t.moduloNome}` : t.label}
              className={`group flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-body font-semibold whitespace-nowrap transition-colors ${
                on ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              style={on ? { color: hex ?? "hsl(var(--primary))" } : undefined}
            >
              {/* O pontinho na cor do módulo: laranja = Cria Post, azul = Cria Caixa,
                  rosa = Cria Gestão, lilás = Cria Radar. A pessoa aprende a cor uma
                  vez e passa a ver o produto dentro da ficha do cliente. */}
              {hex && (
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full shrink-0 transition-opacity ${on ? "opacity-100" : "opacity-50 group-hover:opacity-100"}`}
                  style={{ background: hex }}
                />
              )}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Régua de fluxo (Criativo → Posts → Cronograma → Relatório) */}
      {WORKFLOW.has(activeTab) && (
        <div className="mb-5 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {FLOW_STEPS.filter((s) => !s.gated || hasHubCria).map((s, idx, arr) => {
              const on = activeTab === s.key;
              return (
                <div key={s.key} className="flex items-center shrink-0">
                  <button onClick={() => goTab(s.key)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-1.5 transition-colors ${on ? "bg-primary/10" : "hover:bg-muted/50"}`}>
                    <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s.n}</span>
                    <span className={`text-xs font-body font-semibold whitespace-nowrap ${on ? "text-primary" : "text-muted-foreground"}`}>{s.label}</span>
                  </button>
                  {idx < arr.length - 1 && <span className="mx-0.5 text-muted-foreground/50">›</span>}
                </div>
              );
            })}
          </div>
          {FLOW_EXPLAIN[activeTab] && (
            <p className="text-[12px] font-body text-muted-foreground leading-relaxed mt-1.5 px-1">{FLOW_EXPLAIN[activeTab]}</p>
          )}
        </div>
      )}

      {/* Conteúdo */}
      {activeTab === "visao-geral" && (
        <div className="space-y-4">
          {/* Os cards eram só LEITURA e mostravam "-". A pessoa abria o cliente,
              via quatro traços e não tinha como preencher nada dali: tinha que
              descobrir sozinha que precisava ir na "ficha completa" do CRM.
              Agora cada card é editável no lugar: toca, digita, salva sozinho. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <CampoCliente clientId={client.id} label="Segmento" tipo="texto"
              valor={client.segment} placeholder="Ex.: Nutrição, Odonto…"
              campo="segment" />
            <CampoCliente clientId={client.id} label="WhatsApp" tipo="texto"
              valor={client.whatsapp || client.phone} placeholder="(DDD) 90000-0000"
              campo={client.whatsapp || !client.phone ? "whatsapp" : "phone"} />
            {/* monthly_value é em REAIS (não centavos). */}
            <CampoCliente clientId={client.id} label="Mensalidade" tipo="dinheiro"
              valor={client.monthly_value} campo="monthly_value"
              rodape={client.payment_day ? `vence dia ${client.payment_day}` : "defina o dia de pagamento"} />
            <CampoCliente clientId={client.id} label="Renovação" tipo="data"
              valor={client.renewal_date} campo="renewal_date" />
          </div>

          {/* Dia de pagamento: é o que faz a mensalidade nascer no Cria Caixa. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <CampoCliente clientId={client.id} label="Dia de pagamento" tipo="dia"
              valor={client.payment_day} campo="payment_day"
              rodape="a mensalidade nasce nesse dia, no Caixa" />
            <CampoCliente clientId={client.id} label="E-mail" tipo="texto"
              valor={client.email} placeholder="cliente@email.com" campo="email" />
            <CampoCliente clientId={client.id} label="Cliente desde" tipo="data"
              valor={client.contract_date} campo="contract_date" />
            <CampoCliente clientId={client.id} label="Plano" tipo="texto"
              valor={client.plan_name} placeholder="Ex.: Gestão completa" campo="plan_name" />
          </div>
          {/* Anotações: saíram do "Personalizar" (onde ninguém achava) e viraram um campo
              editável aqui, que é onde a pessoa procura por elas. */}
          <NotasCliente clientId={client.id} notes={client.notes} />
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => goTab("posts")}><Send className="h-4 w-4 mr-1.5" /> Ver posts</Button>
            <Button variant="outline" onClick={() => goTab("relatorio")}>Relatório</Button>
            <Button variant="outline" asChild><Link to={`/socialmidia/criacrm/${id}`}><ExternalLink className="h-4 w-4 mr-1.5" /> Ficha completa (CRM)</Link></Button>
          </div>
        </div>
      )}

      {/* Instagram de cliente que USA O CRIA: dados reais sincronizados pelo próprio
          cliente (independe do Cria Post estar ativado). Os demais casos seguem no ClientDetail. */}
      {activeTab === "instagram" && client.cria_owner_id ? (
        <ClienteInstagramCria criaOwnerId={client.cria_owner_id} clientName={client.name} />
      ) : OPERACIONAIS.has(activeTab) && (
        extClient ? (
          <ClientDetail client={extClient} embedded activeTab={activeTab} onTabChange={goTab} />
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-3"><Send className="h-5 w-5 text-primary" /></div>
            <p className="text-sm font-body text-foreground font-medium">Ative o Cria Post pra este cliente</p>
            <p className="text-xs text-muted-foreground font-body mt-1 mb-4 max-w-sm mx-auto">Cria a área de posts, cronograma, relatório e aprovação por link deste cliente.</p>
            <Button onClick={enableCriaPost} disabled={createExt.isPending}>{createExt.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Ativar agora</Button>
          </div>
        )
      )}

      {/* BRANDBOOK, quem é a marca. Leitura, vem da conta CRIA do cliente. */}
      {activeTab === "brandbook" && (
        client.cria_owner_id ? (
          <ClienteBrandbookCria criaOwnerId={client.cria_owner_id} />
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-sm font-body text-foreground font-medium">Este cliente não usa o Cria</p>
              <p className="text-xs text-muted-foreground font-body mt-1 mb-4 max-w-md mx-auto">
                O Brandbook (paleta, tom de voz, personas, moodboard) é preenchido pelo cliente na conta dele.
                Sem conta Cria, preencha na mão pela ficha completa do CRM.
              </p>
              <Button variant="outline" asChild>
                <Link to={`/socialmidia/criacrm/${id}`}><ExternalLink className="h-4 w-4 mr-1.5" /> Preencher no CRM</Link>
              </Button>
            </div>
          </div>
        )
      )}

      {/* IDEIAS, o banco de ideias do cliente (4 origens). */}
      {activeTab === "ideias" && <ClienteIdeias clientId={id!} criaOwnerId={client.cria_owner_id} />}

      {/* PESQUISA. Apify. A aba só existe pra quem tem o HUB liberado. */}
      {activeTab === "pesquisa" && hasHubCria && <CriativoTab clientId={id!} clientName={client.name} />}

      {/* PORTAL, o que era o popup "Personalizar", agora com espaço pra respirar. */}
      {activeTab === "portal" && (
        extClient ? (
          <ClientePortalTab client={extClient} onCopyLink={doCopyLink} onOpenPortal={openPortal} copying={copying} />
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm font-body text-foreground font-medium">Cria Post não está ativo pra este cliente</p>
            <p className="text-xs text-muted-foreground font-body mt-1 mb-4">Ative pra gerar o link de aprovação e personalizar o que ele vê.</p>
            <Button onClick={enableCriaPost} disabled={createExt.isPending}>Ativar agora</Button>
          </div>
        )
      )}

      {/* FINANCEIRO, exclusivo de quem assina o Cria Caixa. */}
      {activeTab === "financeiro" && (
        hasCaixa
          ? <FinanceTab clientId={id!} clientName={client.name} monthlyValue={client.monthly_value} />
          : <ModuleUpsell code="financeiro" clientName={client.name} />
      )}
      {/* Vitrine em popup: aparece quando a pessoa CLICA numa ação que exige
          um módulo que ela não assina (ex.: ativar o Cria Post num cliente). */}
      <ModuleUpsellDialog
        open={!!upsell}
        onOpenChange={(o) => !o && setUpsell(null)}
        code={upsell ?? "aprovapost_externo"}
        clientName={client.name}
      />
    </motion.div>
  );
}

// Anotações do cliente, salva ~0,8s depois da última tecla (mesmo padrão da ficha do CRM).
function NotasCliente({ clientId, notes }: { clientId: string; notes: string | null }) {
  const update = useUpdateCrmClient();
  const [txt, setTxt] = useState(notes ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const serverRef = useRef(notes ?? "");

  // Adota o servidor só quando não há edição pendente (não atropela quem digita).
  useEffect(() => {
    const srv = notes ?? "";
    setTxt((cur) => (cur === serverRef.current ? srv : cur));
    serverRef.current = srv;
  }, [notes]);

  useEffect(() => {
    if (txt === serverRef.current) return;
    setState("saving");
    const t = setTimeout(() => {
      update.mutate({ id: clientId, notes: txt || null }, {
        onSuccess: () => { setState("saved"); setTimeout(() => setState("idle"), 1500); },
        onError: () => setState("idle"),
      });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txt, clientId]);

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-body text-muted-foreground">Anotações</p>
        <span className={`text-[11px] font-body ${state === "saved" ? "text-emerald-600" : "text-muted-foreground"}`}>
          {state === "saving" ? "Salvando…" : state === "saved" ? "Salvo ✓" : "Salva automático"}
        </span>
      </div>
      <Textarea rows={3} value={txt} onChange={(e) => setTxt(e.target.value)}
        placeholder="Contexto, combinados, senhas de acesso, o que o cliente odeia…"
        className="rounded-xl text-sm" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CAMPO EDITÁVEL DO CLIENTE
//
// Antes era um card de leitura com "-". Agora: toca no card, ele vira campo,
// e sai do campo → salva. Sem botão, sem modal, sem ir pra outra tela.
// O lápis aparece no hover pra deixar claro que dá pra editar.
// ═══════════════════════════════════════════════════════════════════════
function CampoCliente({ clientId, label, valor, campo, tipo, placeholder, rodape }: {
  clientId: string;
  label: string;
  valor: string | number | null | undefined;
  campo: string;
  tipo: "texto" | "dinheiro" | "data" | "dia";
  placeholder?: string;
  rodape?: string;
}) {
  const update = useUpdateCrmClient();
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<string | number | null>(valor ?? null);

  useEffect(() => { if (!editando) setRascunho(valor ?? null); }, [valor, editando]);

  const salvar = async (v: string | number | null) => {
    setEditando(false);
    if ((v ?? null) === (valor ?? null)) return;   // nada mudou, não bate no banco
    await update.mutateAsync({ id: clientId, [campo]: v } as never);
  };

  const vazio = valor === null || valor === undefined || valor === "" || valor === 0;
  const exibicao =
    tipo === "dinheiro" ? (vazio ? null : formatBRL(Number(valor)))
    : tipo === "data" ? (vazio ? null : new Date(String(valor) + "T00:00:00").toLocaleDateString("pt-BR"))
    : tipo === "dia" ? (vazio ? null : `todo dia ${valor}`)
    : (vazio ? null : String(valor));

  return (
    <div className="group bg-card border border-border rounded-2xl p-4 transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-body text-muted-foreground uppercase tracking-wide">{label}</p>
        {!editando && (
          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors" />
        )}
      </div>

      {editando ? (
        <div className="mt-1.5">
          {tipo === "dinheiro" ? (
            <MoneyInput
              value={typeof rascunho === "number" ? rascunho : null}
              onChange={(v) => setRascunho(v)}
            />
          ) : (
            <Input
              autoFocus
              type={tipo === "data" ? "date" : tipo === "dia" ? "number" : "text"}
              min={tipo === "dia" ? 1 : undefined}
              max={tipo === "dia" ? 31 : undefined}
              value={rascunho === null || rascunho === undefined ? "" : String(rascunho)}
              placeholder={placeholder}
              onChange={(e) => {
                const v = e.target.value;
                setRascunho(tipo === "dia" ? (v === "" ? null : Math.max(1, Math.min(31, Number(v)))) : (v || null));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") salvar(rascunho);
                if (e.key === "Escape") { setRascunho(valor ?? null); setEditando(false); }
              }}
              className="rounded-xl h-9"
            />
          )}
          <div className="flex items-center gap-1.5 mt-2">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={() => salvar(rascunho)} disabled={update.isPending}>Salvar</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setRascunho(valor ?? null); setEditando(false); }}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setEditando(true)} className="w-full text-left">
          {exibicao ? (
            <p className="text-sm font-body font-semibold text-foreground mt-1 truncate">{exibicao}</p>
          ) : (
            <p className="text-sm font-body text-primary mt-1 inline-flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> adicionar
            </p>
          )}
          {rodape && <p className="text-[10.5px] font-body text-muted-foreground mt-0.5 truncate">{rodape}</p>}
        </button>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-[11px] font-body text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-body text-foreground mt-1 truncate">{value}</p>
    </div>
  );
}

// Categorias de custo que a agência de fato tem por cliente. É isso que responde
// "quanto eu gasto com o Fulano, e COM O QUÊ".
const CUSTO_CATS = ["Design", "Copy", "Edição de vídeo", "Tráfego pago", "Ferramentas", "Freelancer", "Outros"] as const;
const ENTRADA_CATS = ["Mensalidade", "Projeto avulso", "Tráfego reembolsado", "Outras receitas"] as const;

// ── MÊS DE COMPETÊNCIA ──
// Custo de dezembro pago em janeiro tem que cair em DEZEMBRO, senão a margem
// dos dois meses mente. O lançamento carrega o mês escolhido no `date`
// (dia de hoje se for o mês corrente, dia 1º se for outro mês).
const MESES_BR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const labelMesBR = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${MESES_BR[(m ?? 1) - 1]} ${y}`; };
// Do mês que vem até 11 meses atrás (13 opções). Datas construídas por número, nunca por string.
function mesesCompet(mesAtual: string): string[] {
  const [y, m] = mesAtual.split("-").map(Number);
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(y, m - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

function FinanceTab({ clientId, clientName, monthlyValue }: { clientId: string; clientName: string; monthlyValue: number | null }) {
  const { data: all = [], isLoading } = useFinRecords();
  const { profile } = useManagerProfile();
  const create = useCreateFinRecord();

  const records = useMemo(() => all.filter((r) => r.crm_client_id === clientId), [all, clientId]);

  // Recorte de tempo: o mês diz a saúde atual, o total diz a história do cliente.
  // O mês agora é NAVEGÁVEL (setas): dá pra conferir a margem de qualquer competência.
  const [range, setRange] = useState<"mes" | "tudo">("mes");
  const hojeStr = hojeBR();
  const mesAtual = hojeStr.slice(0, 7);            // YYYY-MM de hoje, no fuso BR
  const [ymPrefix, setYmPrefix] = useState(mesAtual);
  const shiftMes = (delta: number) => setYmPrefix((p) => {
    const [y, m] = p.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const rows = useMemo(
    () => (range === "mes" ? records.filter((r) => r.date.startsWith(ymPrefix)) : records),
    [records, range, ymPrefix],
  );

  // fin_records.amount é em REAIS (mesma unidade do Cria Caixa).
  // Antes esta aba gravava *100 e lia /100, um custo de R$ 400 virava R$ 40.000 no Caixa.
  const recebido = rows.filter((r) => r.type === "entrada" && r.status === "pago").reduce((s, r) => s + Number(r.amount), 0);
  const aReceber = rows.filter((r) => r.type === "entrada" && r.status !== "pago").reduce((s, r) => s + Number(r.amount), 0);
  const receita = recebido + aReceber;
  const custo = rows.filter((r) => r.type === "despesa").reduce((s, r) => s + Number(r.amount), 0);

  const fin = profile?.fin_settings ?? null;
  // No rateio do MEI usamos a receita deste cliente sobre ela mesma → sem base pra ratear.
  // Aqui o honesto é: regime %, calcula; MEI, mostra "DAS fixo" e não finge precisão.
  const imposto = isPctRegime(fin?.regime) ? receita * (Number(fin?.taxPct) || 0) / 100 : 0;
  const margem = receita - custo - imposto;
  const margemPct = receita > 0 ? (margem / receita) * 100 : 0;

  // Onde o dinheiro vai: agrupa a despesa por categoria (e cai na subcategoria quando existe).
  const porCategoria = useMemo(() => {
    const map = new Map<string, number>();
    rows.filter((r) => r.type === "despesa").forEach((r) => {
      const k = r.category?.trim() || "Sem categoria";
      map.set(k, (map.get(k) ?? 0) + Number(r.amount));
    });
    return [...map.entries()].map(([k, v]) => ({ cat: k, v, pct: custo > 0 ? (v / custo) * 100 : 0 })).sort((a, b) => b.v - a.v);
  }, [rows, custo]);

  const [type, setType] = useState<FinType>("despesa");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState<string>("Design");
  const [valor, setValor] = useState<number | null>(null);
  const [repetir, setRepetir] = useState(false);   // vira entrada/saída fixa deste cliente
  const [compet, setCompet] = useState(mesAtual);  // mês de competência do lançamento
  // O formulário acompanha o mês que está sendo visto no resumo.
  useEffect(() => { if (range === "mes") setCompet(ymPrefix); }, [range, ymPrefix]);
  const competOpts = useMemo(() => mesesCompet(mesAtual), [mesAtual]);
  const competList = competOpts.includes(compet) ? competOpts : [compet, ...competOpts];

  const cats = type === "despesa" ? CUSTO_CATS : ENTRADA_CATS;

  const upd = useUpdateFinRecord();
  const del = useDeleteFinRecord();
  const [editRec, setEditRec] = useState<FinRecord | null>(null);
  const createRecurring = useCreateFinRecurring();
  const { data: allRecurring = [] } = useFinRecurring();
  const fixos = useMemo(
    () => allRecurring.filter((t) => t.crm_client_id === clientId && (t.context ?? "pj") === "pj"),
    [allRecurring, clientId],
  );

  const add = async () => {
    if (!desc.trim() || !valor || valor <= 0) { toast.error("Preencha descrição e valor."); return; }
    // Competência: mês corrente entra com a data de hoje; outro mês, no dia 1º.
    const dataLanc = compet === mesAtual ? hojeStr : `${compet}-01`;
    await create.mutateAsync({
      crm_client_id: clientId, context: "pj", type, description: desc.trim(),
      category: cat, amount: valor, status: type === "despesa" ? "pago" : "pendente",
      date: dataLanc,
    });
    if (repetir) {
      await createRecurring.mutateAsync({
        context: "pj", type, description: desc.trim(), category: cat,
        amount: valor, due_day: Math.min(28, Number(hojeStr.slice(8, 10))), crm_client_id: clientId,
        active: true, start_date: hojeStr,
      });
      toast.success("Vai repetir todo mês. Aparece previsto no Cria Caixa.");
    } else {
      toast.success("Lançado. Já aparece no Cria Caixa.");
    }
    setDesc(""); setValor(null); setRepetir(false);
  };

  return (
    <div className="space-y-4">
      {/* Recorte, com navegação de mês (competência). */}
      <div className="flex items-center gap-2 flex-wrap">
        {([["mes", "Por mês"], ["tudo", "Desde o início"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setRange(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-body font-bold border ${range === k ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground"}`}>{l}</button>
        ))}
        {range === "mes" && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => shiftMes(-1)} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-xs font-display font-bold text-foreground min-w-[72px] text-center">{labelMesBR(ymPrefix)}</span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => shiftMes(1)} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        )}
        {monthlyValue ? (
          <span className="text-[11px] font-body text-muted-foreground ml-auto">Mensalidade contratada: <strong className="text-foreground">{formatBRL(monthlyValue)}</strong></span>
        ) : null}
      </div>

      {/* O quadro do cliente: entra, sai, imposto, sobra. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <FinBox label="Receita" value={formatBRL(receita)} tone="green" hint={aReceber > 0 ? `${formatBRL(recebido)} pago + ${formatBRL(aReceber)} a receber` : "tudo recebido"} />
        <FinBox label="Custo com o cliente" value={formatBRL(custo)} tone="red" hint={porCategoria.length ? `${porCategoria.length} categoria(s)` : "nada lançado"} />
        <FinBox label="Imposto" value={isPctRegime(fin?.regime) ? formatBRL(imposto) : "-"} tone="muted"
          hint={isPctRegime(fin?.regime) ? `${fin?.taxPct ?? 0}% da receita` : "MEI: DAS é fixo, não rateia aqui"} />
        <FinBox label="Margem" value={formatBRL(margem)} tone={margem >= 0 ? "green" : "red"} hint={receita > 0 ? `${margemPct.toFixed(0)}% da receita` : "sem receita no período"} />
      </div>

      {/* ONDE O DINHEIRO VAI, era isso que faltava. */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-sm font-display font-bold text-foreground">Onde vai o dinheiro deste cliente</p>
          <span className="text-[11px] font-body text-muted-foreground">custo total {formatBRL(custo)}</span>
        </div>
        {porCategoria.length === 0 ? (
          <p className="text-[12px] font-body text-muted-foreground py-2">
            Nenhum custo lançado {range === "mes" ? `em ${labelMesBR(ymPrefix)}` : "ainda"}. Lance abaixo escolhendo a categoria (Design, Copy, Tráfego…), é assim que você descobre se o cliente dá lucro de verdade.
          </p>
        ) : (
          <div className="space-y-2">
            {porCategoria.map((c) => (
              <div key={c.cat}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[12.5px] font-body font-medium text-foreground truncate">{c.cat}</span>
                  <span className="text-[12.5px] font-body text-muted-foreground shrink-0">
                    <strong className="text-foreground">{formatBRL(c.v)}</strong> · {c.pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-destructive/70" style={{ width: `${Math.max(2, c.pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lançamento rápido, agora com categoria. */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-sm font-display font-semibold text-foreground mb-3">Novo lançamento de {clientName}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
            {(["despesa", "entrada"] as const).map((t) => (
              <button key={t} onClick={() => { setType(t); setCat(t === "despesa" ? "Design" : "Mensalidade"); }}
                className={`text-xs px-3 py-2 ${type === t ? (t === "entrada" ? "bg-green-600 text-white" : "bg-red-500 text-white") : "text-muted-foreground"}`}>
                {t === "entrada" ? "Entrada" : "Custo"}
              </button>
            ))}
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm shrink-0">
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {/* Mês de competência: em qual mês esse valor pesa na margem. */}
          <select value={compet} onChange={(e) => setCompet(e.target.value)} title="Mês de competência"
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm shrink-0">
            {competList.map((m) => <option key={m} value={m}>{labelMesBR(m)}</option>)}
          </select>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição (ex.: 4 artes do mês)" className="rounded-lg flex-1" />
          <div className="w-full sm:w-36 shrink-0"><MoneyInput value={valor} onChange={setValor} /></div>
          <Button onClick={add} disabled={create.isPending || createRecurring.isPending} className="shrink-0">
            {create.isPending || createRecurring.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        {/* Repetir todo mês, sem precisar sair pro Cria Caixa. */}
        <button type="button" onClick={() => setRepetir((r) => !r)}
          className={`mt-2 w-full flex items-start gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
            repetir ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
          <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${
            repetir ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
            {repetir && <Check className="h-3 w-3" strokeWidth={3} />}
          </span>
          <span className="min-w-0">
            <span className="block text-[12.5px] font-body font-semibold text-foreground">Repetir todo mês</span>
            <span className="block text-[11px] font-body text-muted-foreground leading-tight">
              Vira {type === "entrada" ? "uma entrada fixa" : "um custo fixo"} deste cliente. Aparece previsto no calendário do Caixa.
            </span>
          </span>
        </button>

        <p className="text-[11px] text-muted-foreground font-body mt-2 flex items-center gap-1"><Wallet className="h-3 w-3" /> Vinculado a este cliente e unificado no Cria Caixa.</p>
      </div>

      {/* ENTRADAS E SAÍDAS FIXAS deste cliente */}
      {fixos.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-sm font-display font-bold text-foreground mb-1">Fixos deste cliente</p>
          <p className="text-[11.5px] font-body text-muted-foreground mb-3">Se repetem todo mês. Gerencie no Cria Caixa → Recorrentes.</p>
          <div className="space-y-1.5">
            {fixos.map((t) => (
              <div key={t.id} className={`flex items-center gap-3 rounded-xl border border-border px-3 py-2 ${!t.active ? "opacity-55" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-body font-medium text-foreground truncate">{t.description}</p>
                  <p className="text-[11px] font-body text-muted-foreground">
                    todo dia {t.due_day}{t.category ? ` · ${t.category}` : ""}{!t.active ? " · pausado" : ""}
                  </p>
                </div>
                <span className={`text-sm font-display font-bold shrink-0 ${t.type === "entrada" ? "text-green-600" : "text-red-500"}`}>
                  {t.type === "entrada" ? "+" : "−"}{formatBRL(Number(t.amount))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="h-16 rounded-2xl bg-muted animate-pulse" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground font-body text-center py-8">Nenhum lançamento {range === "mes" ? `em ${labelMesBR(ymPrefix)}` : "deste cliente ainda"}.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const pago = r.status === "pago";
            return (
              <div key={r.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                {/* Check de pago, muda aqui, muda no Cria Caixa (é o mesmo lançamento). */}
                <button
                  onClick={() => upd.mutate({ id: r.id, status: pago ? "pendente" : "pago" })}
                  title={pago ? "Marcar como pendente" : "Marcar como pago"}
                  aria-label={pago ? "Marcar como pendente" : "Marcar como pago"}
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition-colors ${
                    pago ? "bg-green-600 border-green-600 text-white" : "border-border text-muted-foreground hover:border-green-600 hover:text-green-600"}`}>
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-body text-foreground truncate ${pago ? "" : "font-medium"}`}>{r.description}</p>
                  <p className="text-[11px] text-muted-foreground font-body truncate">
                    {parseDateOnly(r.date).toLocaleDateString("pt-BR")} · {pago ? "pago" : r.status}{r.category ? ` · ${r.category}` : ""}
                  </p>
                </div>
                <span className={`text-sm font-display font-bold shrink-0 ${r.type === "entrada" ? "text-green-600" : "text-red-500"}`}>
                  {r.type === "entrada" ? "+" : "−"}{formatBRL(Number(r.amount))}
                </span>
                {/* Editar e excluir sem sair da ficha (antes só dava pelo Cria Caixa). */}
                <button onClick={() => setEditRec(r)} title="Editar lançamento" aria-label="Editar lançamento"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={async () => {
                    if (await confirmar({ titulo: "Excluir este lançamento?", descricao: "Some daqui e do Cria Caixa.", acao: "Excluir", destrutivo: true })) del.mutate(r.id);
                  }}
                  title="Excluir lançamento" aria-label="Excluir lançamento"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <EditarLancamento rec={editRec} onClose={() => setEditRec(null)} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// EDITAR LANÇAMENTO DO CLIENTE
// Valor, categoria, descrição e mês de competência, sem sair da ficha.
// É o mesmo fin_record do Cria Caixa: mudou aqui, mudou lá.
// ═══════════════════════════════════════════════════════════════════════
function EditarLancamento({ rec, onClose }: { rec: FinRecord | null; onClose: () => void }) {
  const upd = useUpdateFinRecord();
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("");
  const [valor, setValor] = useState<number | null>(null);
  const [compet, setCompet] = useState("");

  useEffect(() => {
    if (rec) {
      setDesc(rec.description);
      setCat(rec.category ?? "");
      setValor(Number(rec.amount));
      setCompet(rec.date.slice(0, 7));
    }
  }, [rec]);

  const cats: readonly string[] = rec?.type === "entrada" ? ENTRADA_CATS : CUSTO_CATS;
  const catList = cat && !cats.includes(cat) ? [cat, ...cats] : [...cats];
  const opts = mesesCompet(hojeBR().slice(0, 7));
  const competList = compet && !opts.includes(compet) ? [compet, ...opts] : opts;

  const salvar = async () => {
    if (!rec) return;
    if (!desc.trim() || !valor || valor <= 0) { toast.error("Preencha descrição e valor."); return; }
    // Se o mês não mudou, preserva o dia original; se mudou, cai no dia 1º.
    const date = compet === rec.date.slice(0, 7) ? rec.date : `${compet}-01`;
    await upd.mutateAsync({ id: rec.id, description: desc.trim(), category: cat || null, amount: valor, date });
    toast.success("Lançamento atualizado.");
    onClose();
  };

  return (
    <Dialog open={!!rec} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Editar {rec?.type === "entrada" ? "entrada" : "custo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-body">Descrição</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: 4 artes do mês" className="rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-body">Categoria</Label>
              <select value={cat} onChange={(e) => setCat(e.target.value)} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm">
                {catList.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-body">Mês de competência</Label>
              <select value={compet} onChange={(e) => setCompet(e.target.value)} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm">
                {competList.map((m) => <option key={m} value={m}>{labelMesBR(m)}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-body">Valor</Label>
            <MoneyInput value={valor} onChange={setValor} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={upd.isPending}>
            {upd.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FinBox({ label, value, tone, hint }: { label: string; value: string; tone: "green" | "red" | "muted"; hint?: string }) {
  const c = tone === "green" ? "text-green-600" : tone === "red" ? "text-red-500" : "text-foreground";
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-[11px] font-body text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-display font-extrabold mt-1 ${c}`}>{value}</p>
      {hint && <p className="text-[10.5px] font-body text-muted-foreground mt-0.5 leading-tight">{hint}</p>}
    </div>
  );
}
