import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Link2, Loader2, Plus, Settings2, Trash2, Wallet, Send, Check, Pencil, LogIn, Home, Layers, CalendarDays, BarChart3, BookOpen, Lightbulb, Search, Compass, Instagram, ArrowRight, Lock, FolderOpen, Package, File as FileIcon, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useCrmClient, useUpdateCrmClient, useUploadCrmAsset, CLIENT_STATUSES, CLIENT_STATUS_META, type ClientStatus } from "@/hooks/useCrm";
import { Camera } from "lucide-react";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { BrandColorPicker } from "@/components/accounts/BrandColorPicker";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useExternalClients, useExternalPosts } from "@/hooks/useCriaPost";
import { datasPara, segmentoDoTexto, DATAS_COMEMORATIVAS } from "@/lib/datasComemorativas";
import {
  useFinRecords, useCreateFinRecord, useUpdateFinRecord, useDeleteFinRecord,
  useFinRecurring, useCreateFinRecurring, type FinType, type FinRecord,
} from "@/hooks/useFinance";
import { ClienteIdeias } from "@/components/accounts/ClienteIdeias";
import { ClientePortalTab } from "@/components/accounts/ClientePortalTab";
import { ModuleUpsell, ModuleUpsellDialog } from "@/components/accounts/ModuleUpsell";
import { useHasModule } from "@/hooks/useModules";
import { ClientDetail } from "@/components/accounts/CriaPostBoard";
import { MateriaisBoard } from "@/components/accounts/MateriaisBoard";
import { ExternalClientDialog } from "@/components/accounts/ExternalClientDialog";
import { saveLastClient } from "@/components/accounts/ClientSwitcher";
import { CriativoTab } from "@/components/hubcria/CriativoTab";
import { useHasHubCria } from "@/hooks/useHubCria";
import { useCriaClientProfiles } from "@/hooks/useManagerClientCria";
import { useDriveFolder, type DriveItem } from "@/hooks/useDriveFolder";
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
  { key: "materiais", label: "Materiais", modulo: "laranja", moduloNome: "Cria Post" },
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

// ── NAVEGAÇÃO EM DOIS NÍVEIS (cockpit do cliente) ──
// Nível 1 (topo): a Visão geral + cada Cria (Post, Gestão, Caixa, Radar) + Instagram.
// Nível 2: dentro de um Cria com mais de um assunto, abre uma landing com cards
// (e uma barra de sub-abas pra trocar). Cada sub-página tem URL própria, então o
// F5 mantém a pessoa exatamente onde estava, sem refazer o caminho.
type SubMeta = { label: string; desc: string; icon: LucideIcon };
const SUB_META: Record<string, SubMeta> = {
  posts: { label: "Produção", desc: "Monte cada post e mande aprovar por link: aguardando cliente, ajuste, aprovado.", icon: Layers },
  cronograma: { label: "Cronograma", desc: "O calendário do mês do cliente, com as datas e o link público.", icon: CalendarDays },
  relatorio: { label: "Relatório", desc: "O resultado white-label do mês pra enviar pro cliente.", icon: BarChart3 },
  portal: { label: "Portal", desc: "O que o cliente vê no link de aprovação. Personalize aqui.", icon: Link2 },
  materiais: { label: "Materiais", desc: "Demandas de material fora dos posts. O cliente pede pelo portal, você gerencia no kanban.", icon: Package },
  brandbook: { label: "Brandbook", desc: "Paleta, tom de voz, personas e moodboard da marca.", icon: BookOpen },
  ideias: { label: "Ideias", desc: "O banco de ideias do cliente pra virar post.", icon: Lightbulb },
  pesquisa: { label: "Pesquisa", desc: "Concorrência e tendências do nicho.", icon: Search },
  financeiro: { label: "Financeiro", desc: "Mensalidade, custo e rentabilidade só deste cliente.", icon: Wallet },
  instagram: { label: "Instagram", desc: "Insights dos posts publicados.", icon: Instagram },
};
type Grp = { key: string; label: string; modulo?: CriaColor2; icon: LucideIcon; landing?: boolean; subs: string[] };
const GROUPS: Grp[] = [
  { key: "visao-geral", label: "Visão geral", icon: Home, subs: [] },
  { key: "cria-post", label: "Cria Post", modulo: "laranja", icon: Layers, landing: true, subs: ["posts", "cronograma", "relatorio", "materiais", "portal"] },
  { key: "cria-gestao", label: "Cria Gestão", modulo: "rosa", icon: BookOpen, subs: ["brandbook"] },
  { key: "cria-caixa", label: "Cria Caixa", modulo: "azul", icon: Wallet, subs: ["financeiro"] },
  { key: "cria-radar", label: "Cria Radar", modulo: "lilas", icon: Search, landing: true, subs: ["ideias", "pesquisa"] },
  { key: "instagram", label: "Instagram", icon: Instagram, subs: ["instagram"] },
  // Links úteis vira aba de topo própria: o editor de rótulo+URL + as pastas do
  // Drive de cada link salvo. Antes o editor morava na Visão geral e o Drive era
  // uma sub-aba do Cria Post. Agora é um lugar só.
  { key: "links-uteis", label: "Links úteis", icon: Link2, subs: ["links-uteis"] },
];
import { CRIA_HEX, type CriaColor } from "@/lib/moduleTheme";
type CriaColor2 = CriaColor;
// Paleta de cor do cliente (as 6 da marca + roxo e grafite). Pinta o card na
// lista, a logo e o link público do cronograma.
// Paleta ampliada (12 famílias x 5 tons) vem do BrandColorPicker.
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
  // A sub-página Pesquisa (Apify) só existe pra quem tem o HUB liberado.
  const subVisible = (sub: string) => (sub === "pesquisa" ? hasHubCria : true);
  const allTabKeys = useMemo(() => {
    const s = new Set<string>();
    GROUPS.forEach((g) => { s.add(g.key); g.subs.forEach((x) => { if (x !== "pesquisa" || hasHubCria) s.add(x); }); });
    return s;
  }, [hasHubCria]);
  // A URL manda: /clientes/:id/:tab. Se o tab é válido, é ele; senão, Visão geral.
  // É isso que faz o F5 preservar a sub-página em que a pessoa estava.
  const activeTab = tab && allTabKeys.has(tab) ? tab : "visao-geral";
  const activeGroup = GROUPS.find((g) => g.key === activeTab || g.subs.includes(activeTab)) ?? GROUPS[0];
  const onLanding = activeTab === activeGroup.key && activeGroup.landing === true;
  const groupLocked = (g: Grp) => (g.key === "cria-post" && !hasPost) || (g.key === "cria-caixa" && !hasCaixa);
  // Foto da conta CRIA do cliente sempre atual (não depende do sync manual do CRM).
  const { data: criaProfiles } = useCriaClientProfiles();
  const criaAvatar = client?.cria_owner_id ? (criaProfiles?.[client.cria_owner_id]?.avatar_url ?? null) : null;
  const avatarUrl = criaAvatar ?? client?.logo ?? null;
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const uploadAsset = useUploadCrmAsset();
  const updateClient = useUpdateCrmClient();
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !client) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem."); return; }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.onerror = () => toast.error("Erro ao ler a imagem.");
    reader.readAsDataURL(file);
  };
  const onCroppedAvatar = async (blob: Blob) => {
    if (!client) return;
    setCropSrc(null);
    try {
      const file = new File([blob], "logo.jpg", { type: "image/jpeg" });
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
  const [colorOpen, setColorOpen] = useState(false);
  const setColor = async (hex: string | null) => {
    if (!client) return;
    setColorOpen(false);
    await updateClient.mutateAsync({ id: client.id, color: hex } as never);
    toast.success(hex ? "Cor do cliente atualizada!" : "Cor removida.");
  };
  // Ativar/pausar/inativar direto da ficha. Usa o mesmo campo `status` da lista
  // do Cria Gestão, então a lista e o Caixa/Home refletem na hora.
  const setStatus = async (s: ClientStatus) => {
    if (!client) return;
    await updateClient.mutateAsync({ id: client.id, status: s } as never);
    toast.success(s === "inativo" ? "Cliente inativado." : s === "pausado" ? "Cliente pausado." : "Cliente reativado.");
  };
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
  // Clicar num Cria no topo: 0 sub = Visão geral; com landing = abre a landing de
  // cards; 1 sub só = vai direto na ferramenta (landing de 1 card seria bobo).
  const openGroup = (g: Grp) => {
    if (g.subs.length === 0) return goTab("visao-geral");
    if (g.landing) return goTab(g.key);
    return goTab(g.subs[0]);
  };
  const openGroupKey = (k: string) => { const g = GROUPS.find((x) => x.key === k); if (g) openGroup(g); };

  // Último cliente visitado: alimenta o seletor global e o "Continuar em {cliente}" do dashboard.
  useEffect(() => {
    if (client) saveLastClient(client.id, client.name);
  }, [client]);

  // URL de um Cria de aba única (ex.: /cria-gestao) cai direto na ferramenta dele,
  // pra nunca abrir em branco quando a pessoa cola/salva o link.
  useEffect(() => {
    const g = GROUPS.find((x) => x.key === tab);
    if (g && !g.landing && g.subs.length > 0) {
      navigate(`/socialmidia/clientes/${id}/${g.subs[0]}`, { replace: true });
    }
  }, [tab, id, navigate]);

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
          <ImageCropModal open={!!cropSrc} onOpenChange={(o) => { if (!o) setCropSrc(null); }} imageSrc={cropSrc ?? ""} onCropComplete={onCroppedAvatar} aspectRatio={1} />
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
          <div className="relative flex gap-2 shrink-0 flex-wrap">
            {/* LINKS ÚTEIS — atalho fixo pros links do cliente (Drive, Captação…).
                Rótulo sempre "Links úteis"; aparece mesmo sem nenhum link. */}
            <LinksUteisHeaderButton links={(client as { useful_links?: { label: string; url: string }[] | null }).useful_links ?? null} />
            {/* STATUS — ativar/pausar/inativar sem sair da ficha. Mesmo campo da lista. */}
            <select
              value={(client as { status?: ClientStatus }).status ?? "ativo"}
              onChange={(e) => setStatus(e.target.value as ClientStatus)}
              title="Situação do cliente"
              aria-label="Situação do cliente"
              className={`h-9 rounded-xl border px-3 text-xs font-body font-semibold cursor-pointer outline-none ${CLIENT_STATUS_META[((client as { status?: ClientStatus }).status ?? "ativo") as ClientStatus].cls}`}
            >
              {CLIENT_STATUSES.map((s) => <option key={s} value={s}>{CLIENT_STATUS_META[s].label}</option>)}
            </select>
            {/* COR DO CLIENTE — pinta o card na lista, a logo e o link público. */}
            <Button variant="outline" className="px-3" onClick={() => setColorOpen((v) => !v)} title="Cor do cliente" aria-label="Cor do cliente">
              <span className="h-4 w-4 rounded-md ring-1 ring-border" style={{ background: (client as { color?: string | null }).color || "#cbd5e1" }} />
              <span className="hidden sm:inline ml-1.5">Cor</span>
            </Button>
            {colorOpen && (
              <div className="absolute right-0 top-12 z-30 w-[280px] max-h-[60vh] overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-xl">
                <p className="text-[11px] font-body text-muted-foreground mb-2">Cor do cliente</p>
                <BrandColorPicker value={(client as { color?: string | null }).color ?? null} onChange={(hex) => setColor(hex)} />
                <button type="button" onClick={() => setColor(null)} className="mt-2.5 text-[11px] font-body text-muted-foreground hover:text-foreground">Remover cor</button>
              </div>
            )}
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

      {/* NÍVEL 1 — os Cria. Topo enxuto: a pessoa escolhe QUAL Cria; o que tem
          dentro aparece no nível 2. Cada botão na cor do módulo, que é o que
          ensina a reconhecer o produto dentro da ficha do cliente. */}
      <div className="flex gap-1 mb-4 overflow-x-auto rounded-2xl border border-border bg-muted/50 p-1.5 w-fit max-w-full">
        {GROUPS.map((g) => {
          const on = activeGroup.key === g.key;
          const hex = g.modulo ? CRIA_HEX[g.modulo] : "hsl(var(--foreground))";
          const Icon = g.icon;
          const locked = groupLocked(g);
          return (
            <button
              key={g.key}
              onClick={() => openGroup(g)}
              title={locked ? `${g.label} · não está no seu plano` : g.label}
              className={`group flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-body font-semibold whitespace-nowrap transition-colors ${
                on ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              style={on ? { color: hex } : undefined}
            >
              <span className="grid h-5 w-5 place-items-center rounded-md shrink-0 transition-colors"
                style={{ background: on ? hex : "transparent", color: on ? "#fff" : hex }}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              {g.label}
              {locked && <Lock className="h-3 w-3 opacity-50" />}
            </button>
          );
        })}
      </div>

      {/* NÍVEL 2 — as sub-abas do Cria ativo (só quando tem mais de um assunto e
          a pessoa já entrou num deles). Na landing, os cards fazem esse papel. */}
      {activeGroup.subs.length > 1 && !onLanding && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <button onClick={() => openGroup(activeGroup)} title={`Voltar pra ${activeGroup.label}`}
            className="flex items-center gap-1 text-[12px] font-body font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> {activeGroup.label}
          </button>
          <div className="flex gap-1 overflow-x-auto rounded-full border border-border bg-muted/40 p-1 w-fit max-w-full">
            {activeGroup.subs.filter(subVisible).map((sub) => {
              const on = activeTab === sub;
              const hex = activeGroup.modulo ? CRIA_HEX[activeGroup.modulo] : "hsl(var(--primary))";
              return (
                <button key={sub} onClick={() => goTab(sub)}
                  className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-body font-semibold whitespace-nowrap transition-colors ${
                    on ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  style={on ? { color: hex } : undefined}>
                  {SUB_META[sub]?.label ?? sub}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {/* Explicação curta da sub-página (mantém a didática que a régua tinha). */}
      {!onLanding && FLOW_EXPLAIN[activeTab] && (
        <p className="text-[12px] font-body text-muted-foreground leading-relaxed mb-4 px-1">{FLOW_EXPLAIN[activeTab]}</p>
      )}

      {/* LANDING do Cria — cards dos assuntos daquele módulo. */}
      {onLanding && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
          {activeGroup.subs.filter(subVisible).map((sub) => {
            const meta = SUB_META[sub];
            const Icon = meta.icon;
            const hex = activeGroup.modulo ? CRIA_HEX[activeGroup.modulo] : "hsl(var(--primary))";
            return (
              <button key={sub} onClick={() => goTab(sub)}
                className="group text-left bg-card border border-border rounded-2xl p-4 transition-all hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl text-white shrink-0" style={{ background: hex }}><Icon className="h-4 w-4" /></span>
                  <span className="font-display font-bold text-foreground">{meta.label}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/50 ml-auto group-hover:text-foreground transition-colors" />
                </div>
                <p className="text-[12.5px] font-body text-muted-foreground mt-2.5 leading-relaxed">{meta.desc}</p>
              </button>
            );
          })}
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

          {/* Os "Links úteis" (editor + pastas do Drive) migraram pra aba de topo
              própria "Links úteis". Aqui na Visão geral não fica mais duplicado. */}

          {/* DESTAQUES — o cockpit: o resumo de cada Cria, com número de verdade.
              O detalhe continua em cada módulo lá em cima. */}
          <Destaques
            clientId={client.id}
            clientSegment={client.segment}
            clientBirthday={client.birthday}
            renewalDate={client.renewal_date}
            extClientId={extClient?.id ?? null}
            hasCaixa={hasCaixa}
            onOpen={openGroupKey}
          />

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" asChild><Link to={`/socialmidia/criacrm/${id}`}><ExternalLink className="h-4 w-4 mr-1.5" /> Ficha completa (CRM)</Link></Button>
          </div>
        </div>
      )}

      {/* Instagram de cliente que USA O CRIA: dados reais sincronizados pelo próprio
          cliente (independe do Cria Post estar ativado). Os demais casos seguem no ClientDetail. */}
      {activeTab === "instagram" && client.cria_owner_id ? (
        <ClienteInstagramCria criaOwnerId={client.cria_owner_id} clientName={client.name} extClientId={extClient?.id ?? null} />
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

      {/* MATERIAIS. Demandas fora do fluxo de posts. O cliente pede pelo portal. */}
      {activeTab === "materiais" && <MateriaisBoard clientId={id!} clientName={client.name} />}

      {/* LINKS ÚTEIS. Aba de topo: editor de rótulo+URL + as pastas do Drive de
          cada link salvo (paginadas 10 por página). */}
      {activeTab === "links-uteis" && (
        <LinksUteisTab clientId={client.id} links={(client as { useful_links?: LinkUtil[] | null }).useful_links ?? null} />
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

type LinkUtil = { label: string; url: string };

// Detecta se um link é de Drive (pelo rótulo ou pela URL), pra decidir o atalho do cabeçalho.
function isDriveLink(l: LinkUtil) {
  return /drive/i.test(l.label) || /drive\.google|docs\.google/i.test(l.url);
}

// Botão "Links úteis" do cabeçalho: rótulo FIXO (nunca pega o nome do 1º link) e
// SEMPRE visível, mesmo sem nenhum link. Ao clicar: se houver links, abre o
// dropdown listando cada um (rótulo → abre a URL em nova aba); se não houver, mostra
// um recado curto apontando pra seção "Links úteis" logo abaixo na Visão geral.
function LinksUteisHeaderButton({ links }: { links: LinkUtil[] | null }) {
  const [open, setOpen] = useState(false);
  const items = (links ?? []).filter((l) => l?.url);
  return (
    <div className="relative">
      <Button variant="outline" className="px-3" onClick={() => setOpen((v) => !v)} title="Links úteis" aria-label="Links úteis">
        <FolderOpen className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Links úteis</span>
      </Button>
      {open && (
        <div className="absolute right-0 top-12 z-30 w-[260px] rounded-2xl border border-border bg-card p-2 shadow-xl">
          {items.length > 0 ? (
            items.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-body text-foreground hover:bg-muted">
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="truncate">{l.label || l.url}</span>
              </a>
            ))
          ) : (
            <p className="px-3 py-2 text-[12px] font-body text-muted-foreground leading-relaxed">
              Nenhum link ainda. Adicione seus links logo abaixo, na seção <strong className="text-foreground">Links úteis</strong>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Formata a data de modificação do item do Drive (ISO → DD/MM/AAAA), pt-BR.
function fmtDriveDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── ABA DRIVE ──
// Lê o conteúdo (subpastas + arquivos) da pasta do Drive salva nos links úteis do
// cliente, igual o concorrente. A listagem por API key SÓ funciona com pasta
// compartilhada como "qualquer pessoa com o link pode ver" — se for privada, a
// edge devolve a mensagem amigável e a gente mostra aqui.
const DRIVE_PAGE_SIZE = 10;

function DriveTab({ links }: { links: LinkUtil[] | null }) {
  const drives = useMemo(() => (links ?? []).filter((l) => l?.url && isDriveLink(l)), [links]);
  const [sel, setSel] = useState(0);
  const [page, setPage] = useState(0);
  const activeDrive = drives[Math.min(sel, drives.length - 1)] ?? null;
  const { data, isLoading, isError, error, isFetching, refetch } = useDriveFolder(activeDrive?.url);

  // Trocar de pasta volta pra primeira página (a paginação é por pasta).
  useEffect(() => { setPage(0); }, [sel]);

  // Sem link de Drive salvo: estado vazio com instrução.
  if (drives.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground/60 mb-3" />
        <p className="text-sm font-body text-foreground font-medium">Nenhuma pasta do Drive neste cliente</p>
        <p className="text-xs text-muted-foreground font-body mt-1 max-w-md mx-auto">
          Cole um link da pasta do Google Drive no editor acima, com "Drive" no rótulo.
          A pasta precisa estar compartilhada como <strong>"qualquer pessoa com o link pode ver"</strong>.
        </p>
      </div>
    );
  }

  const items: DriveItem[] = data?.items ?? [];
  const rootUrl = data?.root_url ?? activeDrive?.url ?? "";
  // Paginação client-side: no máximo 10 itens por página. clampa a página caso a
  // lista encolha depois de um refetch.
  const totalPages = Math.max(1, Math.ceil(items.length / DRIVE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = items.slice(safePage * DRIVE_PAGE_SIZE, safePage * DRIVE_PAGE_SIZE + DRIVE_PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Barra: seletor (se houver mais de uma pasta), abrir no Drive, atualizar. */}
      <div className="flex flex-wrap items-center gap-2">
        {drives.length > 1 && (
          <select
            value={sel}
            onChange={(e) => setSel(Number(e.target.value))}
            aria-label="Escolher pasta do Drive"
            className="h-9 rounded-xl border border-border bg-card px-3 text-xs font-body font-semibold cursor-pointer outline-none"
          >
            {drives.map((d, i) => <option key={i} value={i}>{d.label || d.url}</option>)}
          </select>
        )}
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
        {rootUrl && (
          <Button size="sm" className="rounded-xl gap-1.5" onClick={() => window.open(rootUrl, "_blank", "noopener,noreferrer")}>
            <FolderOpen className="h-4 w-4" /> Abrir no Drive
          </Button>
        )}
      </div>

      {/* Loading: skeleton de linhas. */}
      {isLoading && (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-5 w-5 rounded bg-muted animate-pulse shrink-0" />
              <div className="h-4 rounded bg-muted animate-pulse flex-1 max-w-[40%]" />
              <div className="h-3 w-20 rounded bg-muted animate-pulse ml-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Erro: mensagem amigável (pasta privada, chave ausente, etc.). */}
      {!isLoading && isError && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-6 text-center">
          <p className="text-sm font-body text-amber-800 dark:text-amber-300 font-medium">
            {(error as Error)?.message || "Não foi possível listar a pasta do Drive."}
          </p>
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5 mt-3" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Tentar de novo
          </Button>
        </div>
      )}

      {/* Vazia. */}
      {!isLoading && !isError && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-body text-muted-foreground">Esta pasta está vazia.</p>
        </div>
      )}

      {/* Listagem: pastas primeiro (a API já ordena), nome clicável abre no Drive.
          Mostra no máximo 10 por página (fatia da lista que a edge devolveu). */}
      {!isLoading && !isError && items.length > 0 && (
        <>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {pageItems.map((it) => (
              <a
                key={it.id}
                href={it.webViewLink ?? rootUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
              >
                {it.isFolder
                  ? <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                  : <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />}
                <span className="text-[13px] font-body text-foreground truncate flex-1 min-w-0">{it.name}</span>
                {it.modifiedTime && (
                  <span className="text-[11px] font-body text-muted-foreground shrink-0 hidden sm:inline">{fmtDriveDate(it.modifiedTime)}</span>
                )}
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </a>
            ))}
          </div>

          {/* Paginação: só quando passa de 10 itens. Botões recuar/avançar (‹ ›). */}
          {items.length > DRIVE_PAGE_SIZE && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <Button variant="outline" size="sm" className="rounded-xl h-8 w-8 p-0" aria-label="Página anterior"
                onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-[12px] font-body text-muted-foreground tabular-nums">
                Página {safePage + 1} de {totalPages}
              </span>
              <Button variant="outline" size="sm" className="rounded-xl h-8 w-8 p-0" aria-label="Próxima página"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── ABA LINKS ÚTEIS (topo) ──
// Junta o editor de links (rótulo + URL) com as pastas do Drive de cada link
// salvo. Antes o editor ficava na Visão geral e o Drive era sub-aba do Cria Post;
// agora vivem juntos aqui.
function LinksUteisTab({ clientId, links }: { clientId: string; links: LinkUtil[] | null }) {
  return (
    <div className="space-y-5">
      <LinksUteis clientId={clientId} links={links} />
      <div>
        <div className="flex items-center gap-2 mb-2.5 px-1">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-body text-muted-foreground">Pastas do Google Drive</p>
        </div>
        <DriveTab links={links} />
      </div>
    </div>
  );
}

// Links úteis do cliente (pastas do Drive, materiais…). Grava o array inteiro no jsonb useful_links.
function LinksUteis({ clientId, links }: { clientId: string; links: LinkUtil[] | null }) {
  const update = useUpdateCrmClient();
  const [rows, setRows] = useState<LinkUtil[]>(links ?? []);
  const [novoLabel, setNovoLabel] = useState("");
  const [novoUrl, setNovoUrl] = useState("");

  // Adota o servidor quando os links mudam de fora (não pisa em edição: só salvamos no blur).
  useEffect(() => { setRows(links ?? []); }, [links]);

  const salvar = (next: LinkUtil[]) => {
    setRows(next);
    update.mutate({ id: clientId, useful_links: next } as never);
  };

  const adicionar = () => {
    const url = novoUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { toast.error("A URL precisa começar com http:// ou https://"); return; }
    salvar([...rows, { label: novoLabel.trim() || "Link", url }]);
    setNovoLabel(""); setNovoUrl("");
  };

  const remover = (i: number) => salvar(rows.filter((_, idx) => idx !== i));
  const editar = (i: number, campo: keyof LinkUtil, valor: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [campo]: valor } : r)));

  const salvarEdicao = () => {
    const bad = rows.find((r) => r.url && !/^https?:\/\//i.test(r.url));
    if (bad) { toast.error("A URL precisa começar com http:// ou https://"); return; }
    salvar(rows);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-body text-muted-foreground">Links úteis (Drive, pastas, materiais…)</p>
      </div>

      {rows.length > 0 && (
        <div className="space-y-2 mb-3">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={r.label} onChange={(e) => editar(i, "label", e.target.value)} onBlur={salvarEdicao}
                placeholder="Rótulo (ex.: Drive - Fotos)" className="rounded-xl h-9 text-sm w-32 sm:w-40 shrink-0" />
              <Input value={r.url} onChange={(e) => editar(i, "url", e.target.value)} onBlur={salvarEdicao}
                placeholder="https://…" className="rounded-xl h-9 text-sm flex-1 min-w-0" />
              <a href={r.url} target="_blank" rel="noopener noreferrer" title="Abrir link" aria-label="Abrir link" className="w-9 h-9 rounded-xl border border-border grid place-items-center text-muted-foreground hover:text-primary shrink-0"><ExternalLink className="h-4 w-4" /></a>
              <button onClick={() => remover(i)} title="Remover" aria-label="Remover" className="w-9 h-9 rounded-xl border border-border grid place-items-center text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Input value={novoLabel} onChange={(e) => setNovoLabel(e.target.value)} placeholder="Rótulo (ex.: Drive - Aprovados)" className="rounded-xl h-9 text-sm w-32 sm:w-40" />
        <Input value={novoUrl} onChange={(e) => setNovoUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && adicionar()} placeholder="https://drive.google.com/…" className="rounded-xl h-9 text-sm flex-1 min-w-[160px]" />
        <Button onClick={adicionar} disabled={!novoUrl.trim()} className="rounded-xl h-9 gap-1.5"><Plus className="h-4 w-4" /> Adicionar</Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// DESTAQUES DA VISÃO GERAL (o cockpit)
//
// O resumo de cada Cria com número de verdade: o que espera o cliente (Cria Post),
// a saúde financeira do mês (Cria Caixa) e as próximas datas (comemorativas do
// segmento + aniversário). O detalhe fica em cada módulo; aqui é o "bate o olho".
// ═══════════════════════════════════════════════════════════════════════
const STATUS_LABEL: Record<string, string> = { pendente: "Aguardando", ajuste_solicitado: "Em ajuste" };

// Próximas datas: comemorativas do segmento (dia em "DD/MM") + aniversário do cliente.
function proximasDatas(segment: string | null, birthday: string | null): { label: string; date: Date; tipo: string }[] {
  const hoje = new Date(hojeBR() + "T00:00:00");
  const y = hoje.getFullYear();
  const seg = segmentoDoTexto(segment);
  const groups = seg ? datasPara(["geral", seg]) : DATAS_COMEMORATIVAS;
  const out: { label: string; date: Date; tipo: string }[] = [];
  for (const g of groups) {
    for (const it of g.items) {
      const m = /^(\d{2})\/(\d{2})$/.exec(it.day);
      if (!m) continue; // "data móvel" e afins ficam de fora
      const d = Number(m[1]); const mon = Number(m[2]) - 1;
      let dt = new Date(y, mon, d);
      if (dt < hoje) dt = new Date(y + 1, mon, d);
      out.push({ label: it.label, date: dt, tipo: "comemorativa" });
    }
  }
  const b = birthday ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday) : null;
  if (b) {
    const mon = Number(b[2]) - 1; const d = Number(b[3]);
    let dt = new Date(y, mon, d);
    if (dt < hoje) dt = new Date(y + 1, mon, d);
    out.push({ label: "Aniversário do cliente", date: dt, tipo: "cliente" });
  }
  return out.sort((a, b2) => a.date.getTime() - b2.date.getTime()).slice(0, 4);
}

function Destaques({ clientId, clientSegment, clientBirthday, renewalDate, extClientId, hasCaixa, onOpen }: {
  clientId: string;
  clientSegment: string | null;
  clientBirthday: string | null;
  renewalDate: string | null;
  extClientId: string | null;
  hasCaixa: boolean;
  onOpen: (key: string) => void;
}) {
  const { posts } = useExternalPosts(extClientId);
  const { data: finAll = [] } = useFinRecords();

  const pendentes = posts.filter((p) => p.approval_status === "pendente" || p.approval_status === "ajuste_solicitado");

  const ym = hojeBR().slice(0, 7);
  const recs = useMemo(() => finAll.filter((r) => r.crm_client_id === clientId && r.date.startsWith(ym)), [finAll, clientId, ym]);
  const aReceber = recs.filter((r) => r.type === "entrada" && r.status !== "pago").reduce((s, r) => s + Number(r.amount), 0);
  const recebido = recs.filter((r) => r.type === "entrada" && r.status === "pago").reduce((s, r) => s + Number(r.amount), 0);
  const custo = recs.filter((r) => r.type === "despesa").reduce((s, r) => s + Number(r.amount), 0);
  const receita = recebido + aReceber;
  const margemPct = receita > 0 ? ((receita - custo) / receita) * 100 : 0;

  const datas = useMemo(() => proximasDatas(clientSegment, clientBirthday), [clientSegment, clientBirthday]);

  const laranja = CRIA_HEX.laranja; const azul = CRIA_HEX.azul;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <p className="text-[11px] font-body text-muted-foreground uppercase tracking-wide">Destaques</p>
        <span className="text-[11px] font-body text-muted-foreground/70">o resumo, o detalhe fica em cada Cria acima</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* PRECISA DE VOCÊ (Cria Post) */}
        {extClientId && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: laranja }} />
              <p className="text-sm font-display font-bold text-foreground">Precisa de você</p>
              <button onClick={() => onOpen("cria-post")} className="ml-auto flex items-center gap-1 text-[11.5px] font-body font-semibold text-muted-foreground hover:text-foreground">
                Abrir Cria Post <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {pendentes.length === 0 ? (
              <p className="text-[12.5px] font-body text-muted-foreground py-1">Tudo aprovado, nada esperando você agora.</p>
            ) : (
              <div className="space-y-2">
                {pendentes.slice(0, 3).map((p) => (
                  <button key={p.id} onClick={() => onOpen("cria-post")} className="w-full flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-3 py-2 text-left hover:border-primary/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-body font-semibold text-foreground truncate">{p.title || "Post"}</p>
                      {p.format && <p className="text-[11px] font-body text-muted-foreground truncate">{p.format}</p>}
                    </div>
                    <span className={`text-[10px] font-body font-bold px-2 py-0.5 rounded-full shrink-0 ${p.approval_status === "ajuste_solicitado" ? "bg-pink-100 text-pink-700" : "bg-amber-100 text-amber-700"}`}>
                      {STATUS_LABEL[p.approval_status ?? "pendente"]}
                    </span>
                  </button>
                ))}
                {pendentes.length > 3 && <p className="text-[11px] font-body text-muted-foreground px-1">+{pendentes.length - 3} esperando</p>}
              </div>
            )}
          </div>
        )}

        {/* CAIXA DO CLIENTE (Cria Caixa) */}
        {hasCaixa && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: azul }} />
              <p className="text-sm font-display font-bold text-foreground">Caixa deste cliente</p>
              <button onClick={() => onOpen("cria-caixa")} className="ml-auto flex items-center gap-1 text-[11.5px] font-body font-semibold text-muted-foreground hover:text-foreground">
                Abrir Cria Caixa <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniStat k="A receber" v={formatBRL(aReceber)} tone="green" />
              <MiniStat k="Custo do mês" v={formatBRL(custo)} tone="plain" />
              <MiniStat k="Rentabilidade" v={receita > 0 ? `${margemPct.toFixed(0)}%` : "-"} tone={margemPct >= 0 ? "green" : "red"} />
              <MiniStat k="Renova em" v={renewalDate ? new Date(renewalDate + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "-"} tone="plain" />
            </div>
          </div>
        )}

        {/* PRÓXIMAS DATAS */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: laranja }} />
            <p className="text-sm font-display font-bold text-foreground">Próximas datas</p>
          </div>
          <p className="text-[11px] font-body text-muted-foreground mb-2.5">Comemorativas do nicho + aniversário do cliente.</p>
          {datas.length === 0 ? (
            <p className="text-[12.5px] font-body text-muted-foreground py-1">Sem datas próximas. Preencha o segmento e o aniversário do cliente.</p>
          ) : (
            <div className="divide-y divide-dashed divide-border">
              {datas.map((d, i) => (
                <div key={i} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
                  <p className="text-[13px] font-body font-medium text-foreground truncate flex-1">{d.label}</p>
                  <span className="text-[11px] font-body text-muted-foreground shrink-0 capitalize">
                    {d.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}{d.tipo === "cliente" ? " · cliente" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function MiniStat({ k, v, tone }: { k: string; v: string; tone: "green" | "red" | "plain" }) {
  const c = tone === "green" ? "text-green-600" : tone === "red" ? "text-red-500" : "text-foreground";
  return (
    <div className="border border-border rounded-xl px-3 py-2 bg-muted/30">
      <p className="text-[11px] font-body text-muted-foreground">{k}</p>
      <p className={`text-[17px] font-display font-extrabold mt-0.5 ${c}`}>{v}</p>
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
