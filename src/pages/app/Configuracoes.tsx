import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Camera, Eye, EyeOff, RefreshCw, Check, Lock, AlertTriangle, Shield, Paintbrush, HardDrive, ExternalLink, Unplug, User, Users, LayoutGrid, Plug, Settings, Pencil, CreditCard, Instagram, Bell } from "lucide-react";
import { NotificationToggle } from "@/components/NotificationToggle";
import { useSocialConnection, connectInstagram, useDisconnectInstagram, estadoConexaoIg } from "@/hooks/useSocialInsights";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useActiveProfile, useAtualizarPerfilAtivo, caminhoAvatar } from "@/hooks/useActiveProfile";
import { useHabits } from "@/hooks/useHabits";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateUpload } from "@/lib/upload-validation";
import { storageBytesForPlan, formatStorage } from "@/lib/plans";
import { useNavigate } from "react-router-dom";
import { rotuloPlanoMeuPerfil } from "@/hooks/useMeuPerfil";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

import { useGoogleDriveConnection } from "@/hooks/useGoogleDriveConnection";
import { useManageSubscription } from "@/hooks/useManageSubscription";
import { useActiveAccount } from "@/contexts/AccountContext";
import { SettingsVisual } from "@/components/settings/SettingsVisual";
import { SettingsEquipe } from "@/components/settings/SettingsEquipe";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { AiUsageCard } from "@/components/shared/AiUsageCard";
import { sanitizeText, sanitizeUrl } from "@/lib/sanitize";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { cn } from "@/lib/utils";

const NICHE_OPTIONS = ["Lifestyle", "Moda", "Beleza", "Fitness", "Culinária", "Educação", "Negócios", "Entretenimento", "Saúde", "Tecnologia"];

const profileSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Máximo 100 caracteres").trim(),
  bio: z.string().max(160, "Máximo 160 caracteres").optional().or(z.literal("")),
  niche: z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
  weekly_goal: z.number().min(1).max(7),
  platforms: z.array(z.string()),
  instagram_handle: z.string().max(100).optional().or(z.literal("")),
  pix_key: z.string().max(140, "Máximo 140 caracteres").optional().or(z.literal("")),
  tiktok_handle: z.string().max(100).optional().or(z.literal("")),
  youtube_handle: z.string().max(100).optional().or(z.literal("")),
  avatar_url: z.string().optional().or(z.literal("")),
  bio_origem: z.enum(["instagram", "manual"]),
});

type ProfileFormData = z.infer<typeof profileSchema>;

/* Pílulas de navegação: rótulo sempre visível (ícone sozinho não orienta ninguém)
   e alvo de toque confortável no celular (min-h 44px). */
// Celular: pílula com borda, a ativa escura. Computador: item do menu à esquerda,
// o ativo com fundo da cor de destaque bem clarinho.
const TAB_PILL = [
  "flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card px-3.5 py-2 min-h-[40px] text-[13px] font-body font-bold text-muted-foreground shadow-none",
  "data-[state=active]:border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none",
  "md:w-full md:justify-start md:rounded-xl md:border-0 md:bg-transparent md:px-3 md:py-2.5 md:min-h-[42px] md:text-sm md:font-medium md:text-foreground/80",
  "md:data-[state=active]:bg-primary/10 md:data-[state=active]:text-primary md:data-[state=active]:font-bold md:hover:bg-muted",
].join(" ");
const ICONE_ABA = "h-4 w-4 shrink-0";
const SEPARADOR_ABA = "hidden md:block my-1.5 mx-2 h-px bg-border";

/** "há 2 dias" a partir de uma data ISO. */
function haQuanto(iso: string | null | undefined): string {
  if (!iso) return "";
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

/** Pix escondido: só os 2 últimos caracteres aparecem. */
function mascararPix(v: string): string {
  if (!v) return "";
  return v.length <= 2 ? "••" : `${"•".repeat(Math.min(v.length - 2, 12))}${v.slice(-2)}`;
}

const SectionHeader = ({ title, desc }: { title: string; desc: string }) => (
  <div className="mb-5">
    <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
    <p className="text-sm text-muted-foreground font-body mt-0.5">{desc}</p>
  </div>
);

const Configuracoes = () => {
  const { user, signOut } = useAuth();
  const { profile: perfilSessao, updateProfile: updateSessao } = useProfile();
  const { openPortal, isLoading: portalLoading } = useManageSubscription();
  const { isManaging, managedAccounts, activeAccountId, setActiveAccount, ehMeuPerfil, meuPerfil } = useActiveAccount();
  const managedName = managedAccounts.find((m) => m.owner_id === activeAccountId)?.name ?? (ehMeuPerfil ? meuPerfil?.name : undefined);
  // MEU PERFIL (18/10/2026): a aba Perfil aparece e grava no perfil, não na
  // sessão. Em conta de cliente continua escondida (o perfil é da cliente).
  // Fora do Meu perfil, `profile`/`updateProfile` seguem sendo os da sessão,
  // como sempre (assinatura, armazenamento, conta).
  const { profile: perfilAtivo } = useActiveProfile();
  const atualizarAtivo = useAtualizarPerfilAtivo();
  const profile = (ehMeuPerfil ? perfilAtivo : perfilSessao) as typeof perfilSessao;
  const updateProfile = (ehMeuPerfil ? atualizarAtivo : updateSessao) as typeof updateSessao;
  const verPerfil = !isManaging || ehMeuPerfil;
  const [aba, setAba] = useState<string>(verPerfil ? "perfil" : "pilares");
  // Celular: a pílula ativa sempre à vista (rola a fileira até ela).
  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 768) return;
    document.querySelector(`[data-aba="${aba}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [aba]);
  // Aba que sumiu (ex: trocou pra conta de cliente com a Marca e visual aberta): volta pra uma que existe.
  useEffect(() => {
    const existe: Record<string, boolean> = {
      perfil: verPerfil, pilares: true, visual: !isManaging || ehMeuPerfil, assinatura: !isManaging || ehMeuPerfil,
      conexoes: !isManaging, notificacoes: !isManaging, equipe: !isManaging, conta: !isManaging,
    };
    if (!existe[aba]) setAba(verPerfil ? "perfil" : "pilares");
  }, [aba, verPerfil, isManaging, ehMeuPerfil]);
  const { habits, createHabit, deleteHabit: deleteHabitMutation } = useHabits();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors, isDirty }, reset } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const avatarUrl = watch("avatar_url");
  const bio = watch("bio") || "";
  const platforms = watch("platforms") || [];
  const weeklyGoal = watch("weekly_goal");
  const bioOrigem = watch("bio_origem") ?? "manual";
  const pixKey = watch("pix_key") ?? "";
  // Decide máscara x campo pelo valor SALVO: senão, ao digitar a 1ª letra, o campo virava máscara.
  const pixSalvo = (profile as { pix_key?: string | null } | null)?.pix_key ?? "";

  // Paleta grande demais na cara assustava ("20 cores", Walter 31/08): mostra
  // as 7 primeiras e o resto abre sob demanda.
  const [newHabitName, setNewHabitName] = useState("");
  const [exportando, setExportando] = useState(false);
  const exportarDados = async () => {
    setExportando(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { toast.error("Sessão expirada. Entra de novo."); return; }
      const base = import.meta.env.VITE_SUPABASE_URL as string;
      const r = await fetch(`${base}/functions/v1/export-my-data`, {
        headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "" },
      });
      if (r.status === 429) { toast.error("Você já exportou 3 vezes hoje. Tenta amanhã."); return; }
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `meus-dados-cria-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Arquivo pronto.");
    } catch {
      toast.error("Não consegui montar o arquivo agora. Tenta de novo em um minuto.");
    } finally { setExportando(false); }
  };
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [customNiche, setCustomNiche] = useState("");
  const [nichoOpen, setNichoOpen] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const { connection: driveConnection, connect: driveConnect, disconnect: driveDisconnect } = useGoogleDriveConnection();
  const [connectingDrive, setConnectingDrive] = useState(false);

  const { data: igConnection } = useSocialConnection();
  const igDisconnect = useDisconnectInstagram();

  /* PERFIL NOVO (Walter, 19/10/2026; mockup aprovado). Bio pode vir do
     Instagram conectado; Pix fica mascarado até a pessoa pedir pra ver. */
  const qcPerfil = useQueryClient();
  const [pixAberto, setPixAberto] = useState(false);
  const [pixVisivel, setPixVisivel] = useState(false);
  const [atualizandoBio, setAtualizandoBio] = useState(false);
  const atualizarBioIg = async () => {
    setAtualizandoBio(true);
    try {
      const outra = !!activeAccountId && activeAccountId !== user?.id;
      const { data, error } = await supabase.functions.invoke("instagram-sync", {
        body: outra ? { modo: "bio", account_id: activeAccountId } : { modo: "bio" },
      });
      if (error || !(data as { ok?: boolean } | null)?.ok) throw error ?? new Error("sem bio");
      await qcPerfil.invalidateQueries({ queryKey: ["social-connection"] });
      toast.success("Bio atualizada do Instagram.");
    } catch {
      toast.error("Não consegui puxar a bio agora. Tenta de novo em um minuto.");
    } finally { setAtualizandoBio(false); }
  };

  useEffect(() => {
    if (profile) {
      reset({
        name: profile.name,
        bio: profile.bio || "",
        niche: profile.niche || "",
        weekly_goal: profile.weekly_goal || 3,
        platforms: profile.platforms || [],
        instagram_handle: profile.instagram_handle || "",
        pix_key: (profile as { pix_key?: string | null }).pix_key || "",
        tiktok_handle: profile.tiktok_handle || "",
        youtube_handle: profile.youtube_handle || "",
        avatar_url: profile.avatar_url || "",
        bio_origem: (profile as { bio_origem?: string | null }).bio_origem === "instagram" ? "instagram" : "manual",
      });
      const list = (profile.niche || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      setSelectedNiches(list);
    }
  }, [profile, reset]);

  const toggleNiche = (n: string) => {
    setSelectedNiches((prev) => {
      const next = prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n];
      setValue("niche", next.join(", "));
      return next;
    });
  };

  const addCustomNiche = () => {
    const value = customNiche.trim();
    if (!value || selectedNiches.includes(value)) return;
    setSelectedNiches((prev) => {
      const next = [...prev, value];
      setValue("niche", next.join(", "));
      return next;
    });
    setCustomNiche("");
  };

  // O "Pronto" do diálogo SALVA os nichos na hora. Antes ele só fechava o
  // diálogo e a escolha ficava pendurada no formulário: quem não clicava no
  // Salvar do perfil (a Gabriela) saía da tela achando que salvou, e a home
  // continuava mostrando o nicho antigo.
  const confirmarNichos = async () => {
    setNichoOpen(false);
    const nicheString = selectedNiches.map((n) => n.trim()).filter(Boolean).join(", ");
    if ((nicheString || null) === (profile?.niche ?? null)) return;
    try {
      await updateProfile.mutateAsync({ niche: nicheString ? sanitizeText(nicheString) : null });
      toast.success("Nichos salvos!");
    } catch {
      toast.error("Erro ao salvar os nichos.");
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    try {
      const nicheString = selectedNiches.map((n) => n.trim()).filter(Boolean).join(", ");
      // Bio do Instagram: grava a bio da conta em profiles.bio, que é o que o
      // resto do sistema lê (feed, propostas, IA).
      const usaIg = data.bio_origem === "instagram" && !!igConnection;
      // Bio do IG ainda não puxada: mantém a bio escrita, nunca apaga.
      const bioIg = (igConnection?.biography ?? "").trim();
      const bioFinal = usaIg && bioIg ? bioIg.slice(0, 160) : (data.bio ?? "");
      await updateProfile.mutateAsync({
        name: sanitizeText(data.name),
        bio: bioFinal ? sanitizeText(bioFinal) : null,
        bio_origem: usaIg ? "instagram" : "manual",
        niche: nicheString ? sanitizeText(nicheString) : null,
        weekly_goal: data.weekly_goal,
        platforms: data.platforms,
        instagram_handle: data.instagram_handle ? sanitizeText(data.instagram_handle) : null,
        pix_key: data.pix_key ? sanitizeText(data.pix_key) : null,
        tiktok_handle: data.tiktok_handle ? sanitizeText(data.tiktok_handle) : null,
        youtube_handle: data.youtube_handle ? sanitizeText(data.youtube_handle) : null,
        avatar_url: data.avatar_url ? sanitizeUrl(data.avatar_url) : null,
      } as Parameters<typeof updateProfile.mutateAsync>[0]);
      toast.success("Perfil atualizado!");
      reset({ ...data, bio: bioFinal });
      setPixAberto(false); setPixVisivel(false);
    } catch {
      toast.error("Erro ao atualizar perfil.");
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice re-fires onChange
    e.target.value = "";
    if (!file) return;

    const validation = validateUpload(file, "avatar");
    if (!validation.ok) {
      toast.error(validation.reason);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result as string);
      setCropModalOpen(true);
    };
    reader.onerror = () => toast.error("Erro ao ler imagem.");
    reader.readAsDataURL(file);
  };

  const handleAvatarCropped = async (croppedBlob: Blob) => {
    if (!user) return;
    try {
      setUploadingAvatar(true);
      const path = caminhoAvatar(user.id, profile?.id ?? user.id);
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, croppedBlob, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) {
        toast.error("Erro ao enviar imagem.");
        return;
      }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const fresh = `${urlData.publicUrl}?t=${Date.now()}`;
      setValue("avatar_url", fresh, { shouldDirty: true });
      await updateProfile.mutateAsync({ avatar_url: fresh });
      toast.success("Foto atualizada!");
    } catch {
      toast.error("Erro ao atualizar foto.");
    } finally {
      setUploadingAvatar(false);
      setRawImageSrc(null);
    }
  };

  const togglePlatform = (p: string) => {
    const current = watch("platforms") || [];
    setValue("platforms", current.includes(p) ? current.filter(x => x !== p) : [...current, p], { shouldDirty: true });
  };

  const addHabit = async (habitName?: string) => {
    const n = habitName || newHabitName.trim();
    const sanitized = sanitizeText(n);
    if (!sanitized) return;
    try {
      await createHabit.mutateAsync({ name: sanitized });
      setNewHabitName("");
      toast.success("Hábito adicionado!");
    } catch {
      toast.error("Erro ao adicionar hábito.");
    }
  };

  const handleDeleteHabit = async (id: string) => {
    try {
      await deleteHabitMutation.mutateAsync(id);
    } catch {
      toast.error("Erro ao remover hábito.");
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) { toast.error("Mínimo 8 caracteres."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error("Erro ao alterar senha."); return; }
    toast.success("Senha alterada!");
    setPasswordOpen(false); setNewPassword("");
  };

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  const handleDeleteAccount = async () => {
    if (!user?.email) return;
    if (deleteEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      toast.error("O email digitado não confere.");
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        body: { confirm_email: deleteEmail.trim().toLowerCase() },
      });

      if (error) {
        console.error("[delete-account] invoke failed:", error);
        toast.error("Não foi possível excluir a conta. Tente novamente.");
        setDeleting(false);
        return;
      }

      toast.success("Conta excluída. Até logo.");
      await signOut();
      navigate("/");
    } catch (e) {
      console.error("[delete-account] exception:", e);
      toast.error("Erro inesperado. Tente novamente.");
      setDeleting(false);
    }
  };

  const handleDriveConnect = async () => {
    setConnectingDrive(true);
    try {
      const loadScripts = (): Promise<void> => {
        return new Promise((resolve) => {
          if (window.google?.accounts) { resolve(); return; }
          const s = document.createElement("script");
          s.src = "https://accounts.google.com/gsi/client";
          s.onload = () => resolve();
          document.body.appendChild(s);
        });
      };
      await loadScripts();
      const { data: config } = await supabase.functions.invoke("get-google-config");
      if (!config?.client_id) { toast.error("GOOGLE_CLIENT_ID não configurado."); return; }

      const token: string = await new Promise((resolve, reject) => {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: config.client_id,
          scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
          callback: (resp: any) => { if (resp.error) reject(resp.error); else resolve(resp.access_token); },
        });
        client.requestAccessToken({ prompt: "consent" });
      });

      await driveConnect(token);
      toast.success("Google Drive conectado!");
    } catch (err) {
      toast.error("Erro ao conectar Google Drive.");
      console.error(err);
    } finally {
      setConnectingDrive(false);
    }
  };

  const handleDriveDisconnect = async () => {
    await driveDisconnect();
    toast.success("Google Drive desconectado.");
  };

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-6 md:hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center shadow-sm shrink-0">
            <Settings className="h-5 w-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Configurações</h1>
            <p className="text-muted-foreground font-body mt-0.5 text-sm">Gerencie sua conta e preferências.</p>
          </div>
        </div>

        {isManaging && !ehMeuPerfil && (
          <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm font-body text-foreground">
              Editando o conteúdo da conta de <b>{managedName}</b>. Suas configurações pessoais (perfil, Drive, segurança) ficam em <b>Minha conta</b>.
            </p>
            <button onClick={() => setActiveAccount(null)} className="text-sm font-semibold text-primary hover:underline shrink-0 whitespace-nowrap">
              Ir para Minha conta
            </button>
          </div>
        )}

        {/* CONFIGURAÇÕES NOVAS (Walter, 19/10/2026, mockup aprovado). Computador:
            menu à esquerda, agrupado, e o conteúdo alinhado ao lado. Celular:
            pílulas que rolam de lado, a ativa escura e sempre à vista. */}
        <Tabs value={aba} onValueChange={setAba} orientation="vertical"
          className="w-full md:grid md:grid-cols-[200px_minmax(0,1fr)] md:items-start md:gap-6">
          <div className="-mx-4 mb-5 overflow-x-auto px-4 scrollbar-none md:sticky md:top-24 md:mx-0 md:mb-0 md:overflow-visible md:px-0">
            <TabsList data-tour="config-abas"
              className="inline-flex h-auto min-w-max gap-1.5 bg-transparent p-0 md:flex md:w-full md:min-w-0 md:flex-col md:items-stretch md:gap-0.5 md:rounded-2xl md:border md:border-border md:bg-card md:p-2">
              {verPerfil && <TabsTrigger value="perfil" data-aba="perfil" className={TAB_PILL}><User className={ICONE_ABA} /><span>Perfil</span></TabsTrigger>}
              <TabsTrigger value="pilares" data-aba="pilares" className={TAB_PILL}><LayoutGrid className={ICONE_ABA} /><span>Hábitos</span></TabsTrigger>
              {(!isManaging || ehMeuPerfil) && <TabsTrigger value="visual" data-aba="visual" data-tour="config-tab-visual" className={TAB_PILL}><Paintbrush className={ICONE_ABA} /><span>Marca e visual</span></TabsTrigger>}
              {(!isManaging || ehMeuPerfil) && <span aria-hidden className={SEPARADOR_ABA} />}
              {(!isManaging || ehMeuPerfil) && <TabsTrigger value="assinatura" data-aba="assinatura" data-tour="config-tab-assinatura" className={TAB_PILL}><CreditCard className={ICONE_ABA} /><span>Assinatura</span></TabsTrigger>}
              {!isManaging && <TabsTrigger value="conexoes" data-aba="conexoes" className={TAB_PILL}><Plug className={ICONE_ABA} /><span>Conexões</span></TabsTrigger>}
              {!isManaging && <TabsTrigger value="notificacoes" data-aba="notificacoes" className={TAB_PILL}><Bell className={ICONE_ABA} /><span>Notificações</span></TabsTrigger>}
              {!isManaging && <TabsTrigger value="equipe" data-aba="equipe" className={TAB_PILL}><Users className={ICONE_ABA} /><span>Equipe</span></TabsTrigger>}
              {!isManaging && <span aria-hidden className={SEPARADOR_ABA} />}
              {!isManaging && <TabsTrigger value="conta" data-aba="conta" data-tour="config-tab-conta" className={TAB_PILL}><Shield className={ICONE_ABA} /><span>Conta</span></TabsTrigger>}
            </TabsList>
          </div>

          <div className="w-full">
            {verPerfil && (
            <TabsContent value="perfil">
              {/* Mobile: uma coluna, mesma ordem de sempre. Desktop (lg): duas colunas
                  equilibradas pra aproveitar a largura em vez de um corredor estreito. */}
              <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl lg:max-w-5xl pb-24">
                <SectionHeader title="Perfil" desc="Como você aparece no CRIA, nas propostas e pra IA que escreve com você." />
                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 items-start">
                {/* Coluna esquerda: foto, nome e bio; Pix embaixo */}
                <div className="space-y-4">
                <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
                  <div className="flex items-center gap-4">
                    <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Trocar foto"
                      className="relative h-[72px] w-[72px] sm:h-[84px] sm:w-[84px] shrink-0 rounded-full bg-muted border-[3px] border-card shadow-md">
                      <span className="block h-full w-full overflow-hidden rounded-full">
                        {avatarUrl ? <img src={avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center"><Camera className="h-6 w-6 text-muted-foreground" /></span>}
                      </span>
                      <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full border-2 border-card bg-foreground text-background">
                        {uploadingAvatar ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Label className="font-body text-xs text-muted-foreground">Nome</Label>
                      <Input {...register("name")} className="rounded-xl" />
                      {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    </div>
                  </div>

                  {/* BIO: a do Instagram conectado ou uma escrita aqui. */}
                  <div className="space-y-2">
                    <Label className="font-body text-xs text-muted-foreground">Bio</Label>
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                      {([["instagram", "Usar a do Instagram"], ["manual", "Escrever outra"]] as const).map(([v, l]) => (
                        <button key={v} type="button" onClick={() => setValue("bio_origem", v, { shouldDirty: true })}
                          className={cn("rounded-lg px-2 py-2 text-[12.5px] font-body font-bold transition-colors",
                            bioOrigem === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                          {v === "instagram" ? <><span className="sm:hidden">Do Instagram</span><span className="hidden sm:inline">{l}</span></> : l}
                        </button>
                      ))}
                    </div>
                    {bioOrigem === "instagram" ? (
                      igConnection ? (
                        <div>
                          <div className="min-h-[72px] whitespace-pre-line rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm font-body leading-relaxed text-foreground">
                            {igConnection.biography?.trim()
                              ? igConnection.biography
                              : <span className="text-muted-foreground">{igConnection.biography_em ? "Sua bio do Instagram está vazia." : "Ainda não puxamos a bio. Toque em Atualizar agora."}</span>}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between gap-3 text-[11.5px] font-body text-muted-foreground">
                            <span className="truncate">
                              {igConnection.biography_em ? `Puxada do @${igConnection.username ?? "instagram"} ${haQuanto(igConnection.biography_em)}` : `Conta @${igConnection.username ?? "instagram"}`}
                            </span>
                            <button type="button" onClick={() => void atualizarBioIg()} disabled={atualizandoBio}
                              className="inline-flex shrink-0 items-center gap-1 font-bold text-primary hover:underline disabled:opacity-60">
                              <RefreshCw className={cn("h-3 w-3", atualizandoBio && "animate-spin")} /> Atualizar agora
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border px-3 py-3 text-center">
                          <p className="text-[12.5px] font-body text-muted-foreground mb-2">Conecte o Instagram pra usar a bio de lá.</p>
                          <Button type="button" variant="hero" size="sm" onClick={() => connectInstagram()}><Instagram className="h-4 w-4 mr-1.5" /> Conectar Instagram</Button>
                        </div>
                      )
                    ) : (
                      <div>
                        <Textarea {...register("bio")} rows={4} maxLength={160} placeholder="Conte em poucas linhas quem você é e o que posta."
                          className="rounded-xl min-h-[104px] leading-relaxed resize-y" />
                        <p className="mt-1 text-right text-[11.5px] font-body text-muted-foreground">{bio.length}/160</p>
                        {errors.bio && <p className="text-xs text-destructive">{errors.bio.message}</p>}
                      </div>
                    )}
                  </div>
                </div>

                {/* PIX mascarado: aparece só com "Mostrar"; "Trocar" abre o campo. */}
                <div className="bg-card rounded-2xl p-5 border border-border space-y-2.5">
                  <div>
                    <p className="font-body text-sm font-bold text-foreground">Chave Pix <span className="font-normal text-muted-foreground">(opcional)</span></p>
                    <p className="text-[12px] font-body text-muted-foreground leading-relaxed">Pra você <strong className="text-foreground">receber</strong>: entra nas propostas de collab e publi, pra marca te pagar direto. O CRIA nunca cobra nada por Pix.</p>
                  </div>
                  {pixAberto || !pixSalvo ? (
                    <Input placeholder="CPF, e-mail, telefone ou chave aleatória" {...register("pix_key")} className="rounded-xl" autoComplete="off" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1 truncate rounded-xl border border-border bg-background px-3 py-2 text-sm font-body tracking-wider">
                        {pixVisivel ? pixKey : mascararPix(pixKey)}
                      </div>
                      <Button type="button" variant="outline" size="sm" className="rounded-xl shrink-0" onClick={() => setPixVisivel((v) => !v)}>
                        {pixVisivel ? <EyeOff className="h-4 w-4 sm:mr-1" /> : <Eye className="h-4 w-4 sm:mr-1" />}<span className="hidden sm:inline">{pixVisivel ? "Esconder" : "Mostrar"}</span>
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="rounded-xl shrink-0" onClick={() => setPixAberto(true)}>Trocar</Button>
                    </div>
                  )}
                  {errors.pix_key && <p className="text-xs text-destructive">{errors.pix_key.message}</p>}
                </div>
                </div>

                {/* Coluna direita: nicho, redes com o @, meta semanal */}
                <div className="space-y-4">
                <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
                  <div>
                    <p className="font-body text-sm font-bold text-foreground">Nicho</p>
                    <p className="text-[12px] font-body text-muted-foreground">A IA usa isso pra sugerir pauta e horário.</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNiches.map((n) => (
                      <span key={n} className="rounded-full bg-primary/10 px-3 py-1 text-[12.5px] font-body font-bold text-primary">{n}</span>
                    ))}
                    <button type="button" onClick={() => setNichoOpen(true)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-[12.5px] font-body font-bold text-muted-foreground hover:text-foreground">
                      <Plus className="h-3.5 w-3.5" /> {selectedNiches.length > 0 ? "Editar" : "Escolher nicho"}
                    </button>
                  </div>
                  {errors.niche && <p className="text-xs text-destructive">{errors.niche.message}</p>}
                </div>
                {/* Fechar por fora (X ou clique no fundo) também salva: senão
                      a pessoa escolhe os nichos, fecha, e a escolha evapora. */}
                  <Dialog open={nichoOpen} onOpenChange={(aberto) => { if (aberto) setNichoOpen(true); else void confirmarNichos(); }}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="font-display">Seu nicho</DialogTitle>
                        <DialogDescription className="font-body text-sm">
                          Escolha um ou mais. É o que faz a IA falar do assunto certo e sugerir os melhores horários pro seu público.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="flex flex-wrap gap-2 mt-1">
                        {[...NICHE_OPTIONS, ...selectedNiches.filter((n) => !NICHE_OPTIONS.includes(n))].map((n) => {
                          const active = selectedNiches.includes(n);
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => toggleNiche(n)}
                              className={`px-3 py-1.5 rounded-full text-sm font-body transition-colors ${
                                active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/80"
                              }`}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Input
                          placeholder="Outro nicho..."
                          value={customNiche}
                          onChange={(e) => setCustomNiche(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCustomNiche();
                            }
                          }}
                          maxLength={40}
                          className="rounded-xl text-sm"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={addCustomNiche}
                          disabled={!customNiche.trim() || selectedNiches.includes(customNiche.trim())}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <DialogFooter>
                        <Button type="button" onClick={() => void confirmarNichos()}>Pronto</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
                  <div>
                    <p className="font-body text-sm font-bold text-foreground">Onde você publica</p>
                    <p className="text-[12px] font-body text-muted-foreground">Marque a rede e coloque o @ dela.</p>
                  </div>
                  <div className="space-y-2">
                    {(["instagram", "tiktok", "youtube"] as const).map((p) => {
                      const on = platforms.includes(p);
                      const campo = p === "instagram" ? "instagram_handle" : p === "tiktok" ? "tiktok_handle" : "youtube_handle";
                      const nomeRede = p === "instagram" ? "Instagram" : p === "tiktok" ? "TikTok" : "YouTube";
                      const conectado = p === "instagram" && !!igConnection;
                      return (
                        <div key={p} className="grid grid-cols-1 gap-2 sm:grid-cols-[132px_minmax(0,1fr)] sm:items-center">
                          <button type="button" aria-pressed={on} onClick={() => togglePlatform(p)}
                            className={cn("flex min-h-[42px] items-center gap-2 rounded-xl border px-3 text-[13px] font-body font-bold transition-colors",
                              on ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground")}>
                            <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                              {on && <Check className="h-3 w-3" />}
                            </span>
                            <PlatformIcon platform={p} size="sm" />
                            {nomeRede}
                            {conectado && <span className="ml-auto rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-700 sm:hidden">conectado</span>}
                          </button>
                          {on ? (
                            <div className="relative">
                              <Input {...register(campo)} placeholder="@" className="rounded-xl pr-24" />
                              {conectado && <span className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10.5px] font-body font-bold text-emerald-700 sm:inline">conectado</span>}
                            </div>
                          ) : (
                            <div className="hidden min-h-[40px] items-center rounded-xl bg-muted/60 px-3 text-sm font-body text-muted-foreground sm:flex">não uso</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-card rounded-2xl p-5 border border-border space-y-2">
                  <p className="font-body text-sm font-bold text-foreground flex items-center gap-1.5">Meta semanal: {weeklyGoal} posts <InfoTooltip text="Quantos posts você quer publicar por semana." /></p>
                  <p className="text-[12px] font-body text-muted-foreground">Quanto você quer postar por semana.</p>
                  <input type="range" min={1} max={7} value={weeklyGoal} onChange={(e) => setValue("weekly_goal", parseInt(e.target.value), { shouldDirty: true })} className="w-full accent-[hsl(var(--primary))]" />
                </div>
                </div>
                </div>

                {/* Salvar fixo embaixo (no celular, acima do dock). */}
                <div className="fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom,0px))] z-30 border-y border-border bg-card/95 backdrop-blur md:sticky md:inset-x-auto md:bottom-4 md:mt-4 md:rounded-2xl md:border">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="flex-1 text-[12px] font-body text-muted-foreground">{isDirty ? "Mudanças não salvas" : "Tudo salvo"}</span>
                    <Button type="submit" variant="hero" disabled={updateProfile.isPending}>Salvar perfil</Button>
                  </div>
                </div>
              </form>

            </TabsContent>
            )}

            <TabsContent value="pilares">
              <div className="max-w-2xl space-y-6">
                <SectionHeader title="Hábitos" desc="As rotinas que sustentam a produção. Quando elas existem, o conteúdo não depende de vontade." />

                {/* OS PILARES MUDARAM DE CASA (circuito 13, 16/09/2026).
                    Eles foram pro Brandbook, junto da linha editorial: pilar é
                    estratégia, não configuração. Este aviso fica aqui porque
                    quem já usava o produto vai procurar neste lugar, e sumir
                    sem dizer pra onde é a forma mais rápida de fazer alguém
                    achar que o recurso acabou. */}
                <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4">
                  <p className="text-sm font-body text-foreground font-semibold">Os pilares saíram daqui</p>
                  <p className="text-[12.5px] font-body text-muted-foreground mt-1">
                    Agora eles moram no Brandbook, na aba Linha Editorial, junto da semana. É lá
                    também que você escreve o que entra em cada pilar.
                  </p>
                  <Button type="button" variant="outline" size="sm" className="mt-3 rounded-xl"
                    onClick={() => navigate("/app/brandbook")}>
                    Abrir o Brandbook
                  </Button>
                </div>

                <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
                  <h3 className="font-display font-semibold text-foreground">Meus Hábitos</h3>
                  {habits.map(h => (
                    <div key={h.id} className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-xl border border-border/30">
                      <span className="font-body text-sm text-foreground flex-1">{h.name}</span>
                      <button type="button" onClick={() => handleDeleteHabit(h.id)} className="p-1 hover:bg-destructive/10 rounded"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input placeholder="Novo hábito..." value={newHabitName} onChange={(e) => setNewHabitName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHabit()} className="rounded-xl text-sm" />
                    <Button variant="outline" size="sm" type="button" onClick={() => addHabit()}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {(!isManaging || ehMeuPerfil) && (
            <TabsContent value="visual">
              <SectionHeader title="Marca e visual" desc="Deixe o CRIA com a sua cara. Você vê o efeito na hora." />
              {/* Meu perfil: o tema é do perfil, não da sessão da agência. */}
              {ehMeuPerfil
                ? <SettingsVisual perfil={perfilAtivo ?? null} gravar={(patch) => atualizarAtivo.mutateAsync(patch)} />
                : <SettingsVisual />}
            </TabsContent>
            )}

            {!isManaging && (
            <TabsContent value="conexoes">
              <div className="max-w-2xl space-y-6">
                <SectionHeader title="Conexões" desc="Serviços externos ligados à sua conta. Só leitura, você desconecta quando quiser." />
                <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
                  <h3 className="font-display font-semibold text-foreground flex items-center gap-2"><Instagram className="h-5 w-5 text-primary" /> Instagram</h3>
                  <p className="text-sm text-muted-foreground font-body leading-relaxed">Conecte sua conta Business ou Creator pra ver seus insights (alcance, seguidores, desempenho) na página de Insights. Só leitura, o CRIA não publica por você.</p>
                  {igConnection ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] grid place-items-center text-white font-bold shrink-0"><Instagram className="h-5 w-5" /></div>
                        <div className="min-w-0">
                          <p className="text-sm font-body font-semibold text-foreground truncate">{igConnection.username ? `@${igConnection.username}` : "Conta conectada"}</p>
                          <p className="text-xs font-body text-muted-foreground">
                            {estadoConexaoIg(igConnection).reconectar ? "Conexão vencida" : "Conectado"}
                            {igConnection.account_type ? ` · ${igConnection.account_type}` : ""}
                            {/* Selo de teste da publicação (ciclo 2): confirma que a
                                Meta deu a permissão de publicar nesta conexão. */}
                            {estadoConexaoIg(igConnection).podePublicar ? " · Publicação pelo Cria liberada" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
                        {estadoConexaoIg(igConnection).reconectar && (
                          <Button variant="hero" size="sm" onClick={() => connectInstagram()}><Instagram className="h-4 w-4 mr-2" /> Reconectar</Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => igDisconnect.mutate()}><Unplug className="h-4 w-4 mr-2" /> Desconectar</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="hero" onClick={() => connectInstagram()} className="w-full sm:w-auto"><Instagram className="h-4 w-4 mr-2" /> Conectar Instagram</Button>
                  )}
                </div>

                <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
                  <h3 className="font-display font-semibold text-foreground flex items-center gap-2"><HardDrive className="h-5 w-5 text-primary" /> Google Drive</h3>
                  <p className="text-sm text-muted-foreground font-body leading-relaxed">Conecte seu Google Drive para buscar imagens e vídeos diretamente para o moodboard e brandbook.</p>
                  {driveConnection ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20 overflow-hidden">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">G</div>
                        <div className="min-w-0">
                          <p className="text-sm font-body font-semibold text-foreground truncate max-w-[200px] sm:max-w-none" title={driveConnection.google_email || undefined}>
                            {driveConnection.google_email || "Conectado"}
                          </p>
                          <p className="text-xs font-body text-muted-foreground">Acesso apenas leitura</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleDriveDisconnect} className="shrink-0"><Unplug className="h-4 w-4 mr-2" /> Desconectar</Button>
                    </div>
                  ) : (
                    <Button variant="hero" onClick={handleDriveConnect} disabled={connectingDrive} className="w-full sm:w-auto">
                      {connectingDrive ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                      Conectar Google Drive
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>
            )}

            {!isManaging && (
            <TabsContent value="assinatura">
              <div className="max-w-2xl space-y-6">
                <SectionHeader title="Assinatura e armazenamento" desc="Seu plano, uso de IA e espaço de arquivos, tudo num lugar só." />
                {/* MEU PERFIL (passo 6): plano do perfil e caminho pra assinar. */}
                {ehMeuPerfil && (
                  <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-3">
                    <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
                      <CreditCard className="h-5 w-5" /> Plano do seu Meu perfil
                    </h3>
                    <p className="text-sm text-muted-foreground font-body">
                      {rotuloPlanoMeuPerfil(perfilAtivo ?? null) || "sem plano"}. É separado dos módulos da sua gestão.
                    </p>
                    <Button onClick={() => navigate("/app/assinar")} className="w-full sm:w-auto">Ver planos</Button>
                  </div>
                )}
                {(profile?.stripe_customer_id || (ehMeuPerfil && perfilAtivo?.tem_assinatura_stripe)) && (
                  <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
                    <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
                      <CreditCard className="h-5 w-5" /> Assinatura
                    </h3>
                    <p className="text-sm text-muted-foreground font-body">
                      Gerencie seu método de pagamento, baixe recibos, troque de plano ou cancele a qualquer momento no portal do Stripe.
                    </p>
                    <Button
                      variant="outline"
                      onClick={openPortal}
                      disabled={portalLoading}
                      className="w-full sm:w-auto"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {portalLoading ? "Abrindo..." : "Gerenciar assinatura"}
                    </Button>
                  </div>
                )}
                <AiUsageCard />

                {(() => {
                  const storageUsed = profile?.storage_used_bytes ?? 0;
                  const storageQuota = profile?.storage_quota_bytes ?? storageBytesForPlan(profile?.plan, profile?.subscription_status === "active");
                  const retentionDays = profile?.storage_retention_days ?? 30;
                  const pct = storageQuota > 0 ? (storageUsed / storageQuota) * 100 : 0;

                  const handleUpdateRetention = async (days: number) => {
                    if (days === retentionDays) return;
                    try {
                      await updateProfile.mutateAsync({ storage_retention_days: days });
                      toast.success("Tempo de retenção atualizado.");
                    } catch {
                      toast.error("Erro ao atualizar retenção.");
                    }
                  };

                  return (
                    <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border">
                      <section className="space-y-4">
                        <h3 className="font-display font-semibold text-foreground flex items-center gap-2"><HardDrive className="h-5 w-5 text-primary" /> Armazenamento</h3>

                        <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground font-body">Espaço usado</span>
                            <span className="font-semibold font-body">{formatStorage(storageUsed)} de {formatStorage(storageQuota)}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              style={{ width: `${Math.min(pct, 100)}%` }}
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                pct >= 80 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-primary"
                              )}
                            />
                          </div>
                          {pct >= 80 && (
                            <p className="text-xs text-red-500 font-body">
                              ⚠️ Armazenamento quase cheio. Exclua arquivos ou aguarde a limpeza automática.
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-body font-semibold uppercase tracking-wider text-muted-foreground/70">
                            Tempo de retenção de mídias
                          </label>
                          <p className="text-xs text-muted-foreground font-body">
                            As MÍDIAS enviadas da galeria (fotos e vídeos de post e da aba Arquivos) são
                            removidas automaticamente após esse período pra economizar espaço.
                            Os posts, textos e legendas NÃO são apagados. Arquivos do Google Drive nunca expiram.
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            {[
                              { days: 15, label: "15 dias" },
                              { days: 30, label: "30 dias" },
                              { days: 90, label: "3 meses" },
                              { days: 180, label: "6 meses" },
                              { days: 365, label: "1 ano" },
                            ].map(({ days, label }) => (
                              <button
                                key={days}
                                type="button"
                                onClick={() => handleUpdateRetention(days)}
                                disabled={updateProfile.isPending}
                                className={cn(
                                  "px-4 py-2 rounded-xl text-sm font-body font-medium border transition-colors",
                                  retentionDays === days
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-card border-border text-foreground hover:border-primary/40"
                                )}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between bg-primary/5 border border-primary/15 rounded-xl px-4 py-3">
                          <div>
                            <p className="text-sm font-body font-semibold text-foreground">Seu armazenamento: {formatStorage(storageQuota)}</p>
                            <p className="text-xs text-muted-foreground font-body">
                              {profile?.plan === "studio" ? "Plano Studio" : profile?.plan === "pro" ? "Faça upgrade para o Studio e tenha mais espaço" : "Assine para liberar mais armazenamento"}
                            </p>
                          </div>
                          {profile?.plan !== "studio" && (
                            <Button variant="outline" size="sm" onClick={() => navigate("/app/assinar")}>
                              {profile?.plan === "pro" ? "Upgrade →" : "Ver planos →"}
                            </Button>
                          )}
                        </div>
                      </section>
                    </div>
                  );
                })()}
              </div>
            </TabsContent>
            )}

            {!isManaging && (
            <TabsContent value="equipe">
              <div className="max-w-2xl">
                <SectionHeader title="Equipe" desc="Convide colaboradores e gerencie quem tem acesso ao seu espaço." />
                <SettingsEquipe />
              </div>
            </TabsContent>
            )}

            {!isManaging && (
            <TabsContent value="notificacoes">
              <div className="max-w-2xl space-y-6">
                <SectionHeader title="Notificações" desc="Escolha como o CRIA te avisa sobre o que importa." />
                <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-3">
                  <h3 className="font-display font-semibold text-foreground flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> Notificações no aparelho</h3>
                  <p className="text-sm text-muted-foreground font-body">Receba avisos e recados no aparelho (celular/PC), mesmo com o app fechado.</p>
                  <NotificationToggle />
                </div>
              </div>
            </TabsContent>
            )}

            {!isManaging && (
            <TabsContent value="conta">
              <div className="max-w-2xl space-y-6">
                <SectionHeader title="Conta" desc="Segurança, acesso e decisões definitivas sobre a sua conta." />
                <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
                  <h3 className="font-display font-semibold text-foreground flex items-center gap-2"><Lock className="h-5 w-5 text-primary" /> Segurança da Conta</h3>
                  <div className="space-y-4">
                    <Button variant="outline" onClick={() => setPasswordOpen(true)} className="w-full sm:w-auto"><Lock className="h-4 w-4 mr-2" /> Alterar Senha</Button>
                  </div>
                </div>
                {/* SEUS DADOS (LGPD, portabilidade · pente fino 23/09/2026): um
                    arquivo JSON com tudo que é da pessoa. Até 3 por dia. */}
                <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-3">
                  <h3 className="font-display font-semibold text-foreground flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Seus dados</h3>
                  <p className="text-sm text-muted-foreground font-body">
                    Baixe uma cópia de tudo que está na sua conta (ideias, posts, brandbook, clientes, lançamentos) num arquivo que você pode guardar ou levar pra onde quiser.
                  </p>
                  <Button variant="outline" className="w-full sm:w-auto min-h-[44px]" disabled={exportando} onClick={() => void exportarDados()}>
                    {exportando ? "Preparando..." : "Baixar meus dados (.json)"}
                  </Button>
                </div>
                <div className="bg-card border-destructive/20 rounded-2xl p-6 shadow-[var(--shadow-warm)] border space-y-4">
                  <h3 className="font-display font-semibold text-destructive flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Zona de Perigo</h3>
                  <Button variant="outline" onClick={() => setLogoutOpen(true)} className="text-destructive hover:bg-destructive/10 border-destructive/20">Sair da conta</Button>
                  <div className="pt-4 border-t border-destructive/10">
                    <p className="text-sm text-muted-foreground font-body mb-3">
                      Esta ação é permanente. Todos os seus dados, posts, ideias, brandbook, hábitos, arquivos, serão apagados e não podem ser recuperados.
                    </p>
                    <Button
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        setDeleteEmail("");
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir minha conta
                    </Button>
                  </div>
                </div>

                {/* Disclaimer de exclusão de dados, compliance Meta/Google */}
                <div className="mt-4 rounded-2xl border border-border bg-card/50 p-5">
                  <h4 className="font-display text-sm font-semibold text-foreground mb-2">
                    Exclusão de dados
                  </h4>
                  <p className="text-xs text-muted-foreground font-body leading-relaxed">
                    Você pode solicitar a exclusão de todos os seus dados a qualquer momento pelo botão
                    "Excluir minha conta" acima. Isso remove permanentemente seu perfil, conteúdos, brandbook,
                    arquivos e qualquer conexão com serviços de terceiros (como Google e redes sociais)
                    que você tenha autorizado. A remoção é definitiva e não pode ser desfeita. Para detalhes
                    sobre como tratamos seus dados, consulte nossa{" "}
                    <a
                      href="/privacidade"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      Política de Privacidade
                    </a>.
                  </p>
                </div>
              </div>
            </TabsContent>
            )}
          </div>
        </Tabs>

        <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="font-display">Alterar Senha</DialogTitle><DialogDescription className="font-body">Escolha uma nova senha segura.</DialogDescription></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label className="font-body">Nova senha</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-xl" /></div>
              <Button onClick={handleChangePassword} variant="hero" className="w-full">Salvar nova senha</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="font-display text-center">Sair da conta?</DialogTitle></DialogHeader>
            <div className="flex gap-3 mt-4"><Button variant="outline" className="flex-1" onClick={() => setLogoutOpen(false)}>Cancelar</Button><Button variant="destructive" className="flex-1" onClick={handleSignOut}>Sair</Button></div>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                Excluir minha conta
              </DialogTitle>
              <DialogDescription className="font-body">
                Esta ação <strong>não pode ser desfeita</strong>. Todos os seus dados serão apagados permanentemente.
                <br /><br />
                Pra confirmar, digite seu email: <strong>{user?.email}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Input
                type="email"
                placeholder="Digite seu email"
                value={deleteEmail}
                onChange={(e) => setDeleteEmail(e.target.value)}
                disabled={deleting}
                className="rounded-xl"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteEmail.trim().toLowerCase() !== user?.email?.toLowerCase()}
              >
                {deleting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Excluindo...</>
                ) : (
                  "Sim, excluir conta"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {rawImageSrc && (
          <ImageCropModal
            open={cropModalOpen}
            onOpenChange={setCropModalOpen}
            imageSrc={rawImageSrc}
            onCropComplete={handleAvatarCropped}
          />
        )}
      </motion.div>
    </div>
  );
};

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);

export default Configuracoes;
