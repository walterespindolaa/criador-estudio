import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Camera, ExternalLink, FileText, HardDrive, Image as ImageIcon, Loader2, Lock, Unplug, Users } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProfile } from "@/hooks/useProfile";
import { useGoogleDriveConnection } from "@/hooks/useGoogleDriveConnection";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { validateUpload } from "@/lib/upload-validation";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { sanitizeText } from "@/lib/sanitize";
import { ManagerCompanyDialog } from "@/components/accounts/ManagerCompanyDialog";
import { SettingsVisual } from "@/components/settings/SettingsVisual";
import { NotificationToggle } from "@/components/NotificationToggle";
import { useManagerProfile } from "@/hooks/useModules";
import { useManagerOutlet } from "@/components/accounts/managerOutlet";
import { THEME_PRESETS } from "@/lib/themes";
import { isPushEnabled } from "@/lib/push";
import { ConfigShell, CartaoResumo, CartaoSair, Selo, type ItemConfig } from "@/components/settings/ConfigShell";

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIGURAÇÕES DA SOCIAL MÍDIA (Walter, 06/11/2026, mockup aprovado)

   Era uma janela por cima da tela, com 4 abas (Conta, Tema, Integrações,
   Clientes). Agora é uma página, na mesma casca do criador: resumo com o
   estado de cada coisa, menu em grupos, busca e, no celular, a lista no
   jeito dos ajustes do iPhone. As seções são as mesmas que a janela tinha.
   Endereço: /socialmidia/configuracoes (?aba=visual abre direto na seção).
   ═══════════════════════════════════════════════════════════════════════════ */

const SectionHeader = ({ title, desc }: { title: string; desc: string }) => (
  <div className="mb-5">
    <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
    <p className="text-sm text-muted-foreground font-body mt-0.5">{desc}</p>
  </div>
);
const CAIXA = "bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-3";

export default function ConfiguracoesGestor() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { profile: perfilGestor } = useManagerProfile();
  const { managedAccounts } = useActiveAccount();
  const { parceiroPuro } = useManagerOutlet();
  const { connection: drive, connect: driveConnect, disconnect: driveDisconnect } = useGoogleDriveConnection();

  const [params, setParams] = useSearchParams();
  const aba = params.get("aba") || "resumo";
  const setAba = (v: string) => {
    const n = new URLSearchParams(params);
    if (v === "resumo") n.delete("aba"); else n.set("aba", v);
    setParams(n);
    window.scrollTo({ top: 0 });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [name, setName] = useState(profile?.name ?? "");
  useEffect(() => { if (profile?.name) setName(profile.name); }, [profile?.name]);
  const [savingName, setSavingName] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sairOpen, setSairOpen] = useState(false);
  const [pushLigado, setPushLigado] = useState<boolean | null>(null);
  useEffect(() => { void isPushEnabled().then(setPushLigado); }, [aba]);

  // ── Foto ─────────────────────────────────────────────────
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const v = validateUpload(file, "managerAvatar");
    if (!v.ok) { toast.error(v.reason); return; }
    const reader = new FileReader();
    reader.onload = () => { setRawImageSrc(reader.result as string); setCropOpen(true); };
    reader.readAsDataURL(file);
  };
  const handleAvatarCropped = async (croppedBlob: Blob) => {
    if (!user) return;
    try {
      const path = `${user.id}/avatar.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, croppedBlob, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateProfile.mutateAsync({ avatar_url: `${urlData.publicUrl}?t=${Date.now()}` });
      toast.success("Foto atualizada!");
    } catch {
      toast.error("Erro ao enviar a foto.");
    } finally {
      setCropOpen(false);
      setRawImageSrc(null);
    }
  };

  // ── Logo da marca ────────────────────────────────────────
  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    const v = validateUpload(file, "managerAvatar");
    if (!v.ok) { toast.error(v.reason); return; }
    setUploadingLogo(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/brand-logo.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateProfile.mutateAsync({ brand_logo_url: `${data.publicUrl}?t=${Date.now()}` });
      toast.success("Logo atualizada!");
    } catch {
      toast.error("Erro ao enviar a logo.");
    } finally {
      setUploadingLogo(false);
    }
  };
  const removeLogo = async () => {
    try { await updateProfile.mutateAsync({ brand_logo_url: null }); toast.success("Logo removida."); }
    catch { toast.error("Erro ao remover a logo."); }
  };

  // ── Nome ─────────────────────────────────────────────────
  const handleSaveName = async () => {
    const clean = sanitizeText(name).trim();
    if (!clean) { toast.error("Informe um nome"); return; }
    if (clean === profile?.name) return;
    setSavingName(true);
    try { await updateProfile.mutateAsync({ name: clean }); toast.success("Nome atualizado!"); }
    catch { toast.error("Erro ao atualizar o nome."); }
    finally { setSavingName(false); }
  };

  // ── Google Drive ─────────────────────────────────────────
  const handleDriveConnect = async () => {
    setConnecting(true);
    try {
      await new Promise<void>((resolve) => {
        if ((window as { google?: unknown }).google) { resolve(); return; }
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.onload = () => resolve();
        document.body.appendChild(s);
      });
      const { data: config } = await supabase.functions.invoke("get-google-config");
      if (!config?.client_id) { toast.error("GOOGLE_CLIENT_ID não configurado."); return; }
      const token: string = await new Promise((resolve, reject) => {
        const g = (window as { google?: { accounts: { oauth2: { initTokenClient: (opts: unknown) => { requestAccessToken: (o: unknown) => void } } } } }).google!;
        const client = g.accounts.oauth2.initTokenClient({
          client_id: config.client_id,
          scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
          callback: (resp: { error?: unknown; access_token?: string }) => {
            if (resp.error || !resp.access_token) reject(resp.error ?? "no_token");
            else resolve(resp.access_token);
          },
        });
        client.requestAccessToken({ prompt: "consent" });
      });
      await driveConnect(token);
      toast.success("Google Drive conectado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao conectar Google Drive.");
    } finally {
      setConnecting(false);
    }
  };
  const handleDriveDisconnect = async () => {
    try { await driveDisconnect(); toast.success("Google Drive desconectado."); }
    catch { toast.error("Erro ao desconectar."); }
  };

  const sair = async () => { await signOut(); navigate("/"); };

  // ── Estado de cada seção ─────────────────────────────────
  const p = profile as (typeof profile & { theme_preset?: string | null; theme_accent?: string | null; brand_logo_url?: string | null }) | null;
  const tema = THEME_PRESETS.find((t) => t.id === p?.theme_preset) ?? THEME_PRESETS[0];
  const corDestaque = p?.theme_accent || "#EA4918";
  const temLogo = !!p?.brand_logo_url;
  const doc = perfilGestor?.contract_company?.document?.trim();
  const tipoDoc = (perfilGestor?.contract_company?.personType ?? "pj") === "pf" ? "CPF" : "CNPJ";
  const clientes = managedAccounts.length;

  const itens: ItemConfig[] = [
    { id: "perfil", label: "Perfil", grupo: "voce", cor: "#EB4918", palavras: ["nome", "foto", "e-mail"] },
    { id: "visual", label: "Marca e visual", grupo: "voce", cor: "#FF77B9", estado: tema.name,
      palavras: ["logo", "tema", "cor", "cores", "destaque", "fonte", "faixa do topo", "cronograma"], tour: "config-tab-visual" },
    { id: "conexoes", label: "Conexões", grupo: "ligacoes", cor: "#0061EE", estado: drive ? "Drive ligado" : "nenhuma", tom: drive ? "ok" : "neutro",
      palavras: ["google drive", "drive", "integrações", "conectar", "desconectar"] },
    { id: "notificacoes", label: "Notificações", grupo: "ligacoes", cor: "#FFCF03",
      estado: pushLigado === null ? undefined : pushLigado ? "ligadas" : "desligadas", tom: pushLigado ? "ok" : "neutro",
      palavras: ["aviso", "avisos", "push", "notificação", "testar aviso"] },
    ...(!parceiroPuro ? [{ id: "equipe", label: "Equipe", grupo: "ligacoes", cor: "#00A652",
      palavras: ["colaborador", "convidar", "assento", "pessoas"], onAbrir: () => navigate("/socialmidia/equipe") } as ItemConfig] : []),
    { id: "empresa", label: "Dados da empresa", grupo: "dinheiro", cor: "#7C3AED",
      estado: doc ? `${tipoDoc} ok` : `falta ${tipoDoc}`, tom: doc ? "ok" : "alerta",
      palavras: ["cnpj", "cpf", "contrato", "contratada", "razão social", "endereço", "clientes"] },
    ...(!parceiroPuro ? [{ id: "contas", label: "Suas contas", grupo: "dinheiro", cor: "#EB4918",
      estado: `${clientes} ${clientes === 1 ? "cliente" : "clientes"}`,
      palavras: ["plano", "assinatura", "módulos", "assentos", "clientes", "cobrança"], onAbrir: () => navigate("/socialmidia/contas") } as ItemConfig] : []),
    { id: "conta", label: "Segurança", grupo: "dinheiro", cor: "#6F675C", palavras: ["senha", "trocar senha", "sair"], tour: "config-tab-conta" },
  ];

  const topoCelular = (
    <button type="button" onClick={() => setAba("perfil")}
      className="flex w-full items-center gap-3 rounded-2xl border-2 border-foreground bg-card p-3 text-left shadow-[3px_3px_0_hsl(var(--foreground))]">
      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-foreground bg-muted">
        {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center font-display font-extrabold">{(profile?.name || "?").charAt(0).toUpperCase()}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[16px] font-extrabold text-foreground">{profile?.name || "Seu perfil"}</span>
        <span className="block truncate text-[12px] font-body text-muted-foreground">{user?.email}</span>
      </span>
    </button>
  );

  const resumo = (
    <div>
      <h1 className="font-display text-[26px] font-extrabold leading-tight text-foreground">Resumo da sua conta</h1>
      <p className="mt-0.5 mb-5 text-sm font-body text-muted-foreground">O estado de cada configuração num olhar. Toque num cartão pra mudar.</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <CartaoResumo titulo="Perfil" acao="Editar perfil" onAcao={() => setAba("perfil")}>
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-foreground bg-muted">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-bold text-foreground">{profile?.name || "Sem nome"}</span>
              <span className="block truncate text-[12px]">{user?.email}</span>
            </span>
          </div>
        </CartaoResumo>
        <CartaoResumo titulo="Marca e visual" acao="Trocar tema" onAcao={() => setAba("visual")} tour="config-resumo-visual">
          <div className="overflow-hidden rounded-xl border-2 border-foreground" style={{ background: tema.vars.background }} aria-hidden>
            <div className="h-4" style={{ background: corDestaque }} />
            <div className="flex gap-2 p-2">
              <div className="w-1/4 rounded-md" style={{ background: tema.vars.sidebar, height: 34, border: `1px solid ${tema.vars.border}` }} />
              <div className="flex-1 space-y-1.5 rounded-md p-1.5" style={{ background: tema.vars.card, border: `1px solid ${tema.vars.border}` }}>
                <div className="h-2 w-2/3 rounded-full" style={{ background: corDestaque }} />
                <div className="h-1.5 w-1/2 rounded-full" style={{ background: tema.vars.muted }} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span>Tema {tema.name}.</span>
            <Selo tom={temLogo ? "ok" : "neutro"}>{temLogo ? "com logo" : "sem logo"}</Selo>
          </div>
        </CartaoResumo>
        <CartaoResumo titulo="Conexões" acao="Gerenciar" onAcao={() => setAba("conexoes")}>
          {drive ? <Selo>{`Google Drive ligado${drive.google_email ? ` · ${drive.google_email}` : ""}`}</Selo> : <Selo tom="neutro">Drive não ligado</Selo>}
          <p>Pra escolher mídia do Drive nos posts dos clientes.</p>
        </CartaoResumo>
        <CartaoResumo titulo="Notificações" acao={pushLigado ? "Testar aviso" : "Ligar avisos"} onAcao={() => setAba("notificacoes")}>
          {pushLigado !== null && <Selo tom={pushLigado ? "ok" : "neutro"}>{pushLigado ? "Ligadas neste aparelho" : "Desligadas neste aparelho"}</Selo>}
          <p>Avisos e recados mesmo com o app fechado.</p>
        </CartaoResumo>
        {!parceiroPuro && (
          <CartaoResumo titulo="Equipe" acao="Abrir a Equipe" onAcao={() => navigate("/socialmidia/equipe")}>
            <p>Quem trabalha com você, a produção e as conversas.</p>
          </CartaoResumo>
        )}
        {!parceiroPuro && (
          <CartaoResumo titulo="Suas contas" acao="Ver contas" onAcao={() => navigate("/socialmidia/contas")}>
            <Selo tom={clientes ? "ok" : "neutro"}>{`${clientes} ${clientes === 1 ? "cliente gerenciado" : "clientes gerenciados"}`}</Selo>
            <p>Assentos e clientes do plano.</p>
          </CartaoResumo>
        )}
        <CartaoResumo titulo="Dados da empresa" acao="Editar dados da empresa" onAcao={() => setAba("empresa")} className="xl:col-span-2">
          <p>Usados como CONTRATADA nos contratos. A logo vai no cronograma que o cliente recebe.</p>
          <div className="flex flex-wrap gap-1.5">
            <Selo tom={doc ? "ok" : "alerta"}>{doc ? `${tipoDoc} preenchido` : `falta ${tipoDoc}`}</Selo>
            <Selo tom={temLogo ? "ok" : "neutro"}>{temLogo ? "com logo" : "sem logo"}</Selo>
          </div>
        </CartaoResumo>
        <CartaoResumo titulo="Segurança" acao="Trocar senha" onAcao={() => navigate("/app/trocar-senha")}>
          <p>A senha da sua conta.</p>
        </CartaoResumo>
      </div>
      <CartaoSair onSair={() => setSairOpen(true)} />
    </div>
  );

  return (
    <div data-tour="config-drawer">
      <Tabs value={aba} onValueChange={setAba} className="w-full">
        <ConfigShell itens={itens} aba={aba} irPara={setAba} onSair={() => setSairOpen(true)} topoCelular={topoCelular}>
          <TabsContent value="resumo" className="mt-0">{resumo}</TabsContent>

          <TabsContent value="perfil" className="mt-0">
            <div className="max-w-2xl">
              <SectionHeader title="Perfil" desc="Como você aparece pros clientes e pra equipe." />
              <div className={CAIXA}>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Trocar foto"
                    className="relative h-16 w-16 shrink-0 rounded-full border-2 border-foreground bg-muted">
                    <span className="block h-full w-full overflow-hidden rounded-full">
                      {profile?.avatar_url
                        ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        : <span className="grid h-full w-full place-items-center text-2xl font-display font-extrabold text-primary">{(profile?.name || "?").charAt(0).toUpperCase()}</span>}
                    </span>
                    <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-card bg-foreground text-background">
                      <Camera className="h-3 w-3" />
                    </span>
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm font-display font-semibold text-foreground truncate">{profile?.name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground font-body truncate">{user?.email}</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-nome" className="font-body text-xs">Nome</Label>
                  <div className="flex gap-2">
                    <Input id="cfg-nome" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" placeholder="Seu nome" />
                    <Button onClick={handleSaveName} disabled={savingName || !name.trim() || name.trim() === profile?.name} size="sm" className="shrink-0">
                      {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="visual" className="mt-0">
            <SectionHeader title="Marca e visual" desc="Sua logo e as cores do app. A logo sai no cronograma que o cliente recebe." />
            <div className={`${CAIXA} mb-6 max-w-2xl`}>
              <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Logo da marca</h3>
              <p className="text-xs text-muted-foreground font-body">Aparece no cabeçalho do cronograma que o cliente recebe. Opcional: sem logo, mostramos só o nome e a cor.</p>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-xl border border-border bg-muted/30 grid place-items-center overflow-hidden shrink-0">
                  {temLogo ? <img src={p?.brand_logo_url ?? ""} alt="" className="w-full h-full object-contain" loading="lazy" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                    {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar logo"}
                  </Button>
                  {temLogo && <Button variant="ghost" size="sm" onClick={removeLogo} className="text-destructive h-7">Remover</Button>}
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
              </div>
            </div>
            <SettingsVisual embutido />
          </TabsContent>

          <TabsContent value="conexoes" className="mt-0">
            <div className="max-w-2xl">
              <SectionHeader title="Conexões" desc="Serviços externos ligados à sua conta. Você desconecta quando quiser." />
              <div className={CAIXA}>
                <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2"><HardDrive className="h-4 w-4" /> Google Drive</h3>
                <p className="text-xs text-muted-foreground font-body">Conecte seu Drive pra escolher mídia nos posts dos clientes.</p>
                {drive ? (
                  <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-body">Conectado como</p>
                      <p className="text-sm font-body text-foreground truncate">{drive.google_email}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleDriveDisconnect} className="shrink-0"><Unplug className="h-3.5 w-3.5 mr-1.5" /> Desconectar</Button>
                  </div>
                ) : (
                  <Button onClick={handleDriveConnect} disabled={connecting} className="w-full sm:w-auto">
                    {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                    Conectar Google Drive
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notificacoes" className="mt-0">
            <div className="max-w-2xl">
              <SectionHeader title="Notificações" desc="Avisos e recados no aparelho, mesmo com o app fechado." />
              <div className={CAIXA}><NotificationToggle /></div>
            </div>
          </TabsContent>

          <TabsContent value="empresa" className="mt-0">
            <div className="max-w-2xl space-y-4">
              <SectionHeader title="Dados da empresa" desc="Usados como CONTRATADA nos contratos. Configure CPF ou CNPJ e seus dados uma vez." />
              <div className={CAIXA}>
                <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2"><FileText className="h-4 w-4" /> Dados da minha empresa</h3>
                <div className="flex flex-wrap gap-1.5">
                  <Selo tom={doc ? "ok" : "alerta"}>{doc ? `${tipoDoc} preenchido` : `falta ${tipoDoc}`}</Selo>
                  {perfilGestor?.contract_company?.legalName && <Selo tom="neutro">{perfilGestor.contract_company.legalName}</Selo>}
                </div>
                <Button variant="outline" onClick={() => setCompanyOpen(true)} className="w-full sm:w-auto">Editar dados da empresa</Button>
              </div>
              <div className={CAIXA}>
                <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2"><Users className="h-4 w-4" /> Clientes</h3>
                <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-center justify-between">
                  <p className="text-sm font-body text-muted-foreground">Total que você gerencia</p>
                  <p className="text-2xl font-display font-extrabold text-primary">{clientes}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="conta" className="mt-0">
            <div className="max-w-2xl">
              <SectionHeader title="Segurança" desc="A senha da sua conta." />
              <div className={CAIXA}>
                <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2"><Lock className="h-4 w-4" /> Senha</h3>
                <p className="text-xs text-muted-foreground font-body">Atualize sua senha pra manter a conta segura.</p>
                <Button variant="outline" onClick={() => navigate("/app/trocar-senha")} className="w-full sm:w-auto">Trocar senha</Button>
              </div>
            </div>
          </TabsContent>
        </ConfigShell>
      </Tabs>

      <ManagerCompanyDialog open={companyOpen} onOpenChange={setCompanyOpen} />

      <Dialog open={sairOpen} onOpenChange={setSairOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display text-center">Sair da conta?</DialogTitle></DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setSairOpen(false)}>Cancelar</Button>
            <Button variant="destructive" className="flex-1" onClick={() => void sair()}>Sair</Button>
          </div>
        </DialogContent>
      </Dialog>

      {rawImageSrc && (
        <ImageCropModal
          open={cropOpen}
          onOpenChange={(o) => { setCropOpen(o); if (!o) setRawImageSrc(null); }}
          imageSrc={rawImageSrc}
          onCropComplete={handleAvatarCropped}
          aspectRatio={1}
          cropShape="round"
        />
      )}
    </div>
  );
}
