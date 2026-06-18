import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Camera, Lock, AlertTriangle, Shield, Paintbrush, HardDrive, ExternalLink, Unplug, User, Users, LayoutGrid, Plug, Settings, Pencil, CreditCard } from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePillars } from "@/hooks/usePillars";
import { useHabits } from "@/hooks/useHabits";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateUpload } from "@/lib/upload-validation";
import { storageBytesForPlan, formatStorage } from "@/lib/plans";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

import { useGoogleDriveConnection } from "@/hooks/useGoogleDriveConnection";
import { useManageSubscription } from "@/hooks/useManageSubscription";
import { useActiveAccount } from "@/contexts/AccountContext";
import { SettingsVisual } from "@/components/settings/SettingsVisual";
import { SettingsEquipe } from "@/components/settings/SettingsEquipe";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { sanitizeText, sanitizeUrl } from "@/lib/sanitize";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { cn } from "@/lib/utils";

const PILLAR_COLORS = [
  "#7C3AED", // Roxo vibrante
  "#2563EB", // Azul elétrico
  "#059669", // Verde esmeralda
  "#DC2626", // Vermelho coral
  "#D97706", // Amarelo âmbar
  "#DB2777", // Rosa magenta
  "#0891B2", // Ciano profundo
];
const NICHE_OPTIONS = ["Lifestyle", "Moda", "Beleza", "Fitness", "Culinária", "Educação", "Negócios", "Entretenimento", "Saúde", "Tecnologia"];
const EDITORIAL_DAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"] as const;

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
});

type ProfileFormData = z.infer<typeof profileSchema>;

const Configuracoes = () => {
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { openPortal, isLoading: portalLoading } = useManageSubscription();
  const { isManaging, managedAccounts, activeAccountId, setActiveAccount } = useActiveAccount();
  const managedName = managedAccounts.find((m) => m.owner_id === activeAccountId)?.name;
  const { pillars, createPillar, updatePillar: updatePillarMutation, deletePillar: deletePillarMutation } = usePillars();
  const { habits, createHabit, deleteHabit: deleteHabitMutation } = useHabits();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const avatarUrl = watch("avatar_url");
  const bio = watch("bio") || "";
  const platforms = watch("platforms") || [];
  const weeklyGoal = watch("weekly_goal");

  const [newPillarName, setNewPillarName] = useState("");
  const [newPillarColor, setNewPillarColor] = useState(PILLAR_COLORS[0]);
  const [editingPillarId, setEditingPillarId] = useState<string | null>(null);
  const [editingPillarName, setEditingPillarName] = useState("");
  const [newHabitName, setNewHabitName] = useState("");
  const [editorialLine, setEditorialLine] = useState<Record<string, string>>({});
  const [savingEditorialLine, setSavingEditorialLine] = useState(false);
  const editorialLineHydratedRef = useRef(false);
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [customNiche, setCustomNiche] = useState("");

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
      });
      const list = (profile.niche || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      setSelectedNiches(list);
      if (!editorialLineHydratedRef.current) {
        setEditorialLine(profile.editorial_line ?? {});
        editorialLineHydratedRef.current = true;
      }
    }
  }, [profile, reset]);

  const saveEditorialLine = async () => {
    if (savingEditorialLine) return;
    setSavingEditorialLine(true);
    try {
      await updateProfile.mutateAsync({ editorial_line: editorialLine });
      toast.success("Linha editorial salva!");
    } catch {
      toast.error("Erro ao salvar linha editorial.");
    } finally {
      setSavingEditorialLine(false);
    }
  };

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

  const onSubmit = async (data: ProfileFormData) => {
    try {
      const nicheString = selectedNiches.map((n) => n.trim()).filter(Boolean).join(", ");
      await updateProfile.mutateAsync({
        name: sanitizeText(data.name),
        bio: data.bio ? sanitizeText(data.bio) : null,
        niche: nicheString ? sanitizeText(nicheString) : null,
        weekly_goal: data.weekly_goal,
        platforms: data.platforms,
        instagram_handle: data.instagram_handle ? sanitizeText(data.instagram_handle) : null,
        pix_key: data.pix_key ? sanitizeText(data.pix_key) : null,
        tiktok_handle: data.tiktok_handle ? sanitizeText(data.tiktok_handle) : null,
        youtube_handle: data.youtube_handle ? sanitizeText(data.youtube_handle) : null,
        avatar_url: data.avatar_url ? sanitizeUrl(data.avatar_url) : null,
      });
      toast.success("Perfil atualizado!");
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
      const path = `${user.id}/avatar.jpg`;
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
    setValue("platforms", current.includes(p) ? current.filter(x => x !== p) : [...current, p]);
  };

  const addPillar = async () => {
    const sanitized = sanitizeText(newPillarName);
    if (!sanitized || pillars.length >= 7) return;
    try {
      await createPillar.mutateAsync({ name: sanitized, color: newPillarColor });
      setNewPillarName("");
      toast.success("Pilar adicionado!");
    } catch {
      toast.error("Erro ao adicionar pilar.");
    }
  };

  const handleDeletePillar = async (id: string) => {
    try {
      await deletePillarMutation.mutateAsync(id);
    } catch {
      toast.error("Erro ao remover pilar.");
    }
  };

  const handleSavePillarEdit = async (id: string) => {
    const sanitized = sanitizeText(editingPillarName).trim();
    if (!sanitized) return;
    try {
      await updatePillarMutation.mutateAsync({ id, name: sanitized });
      setEditingPillarId(null);
      setEditingPillarName("");
    } catch {
      toast.error("Erro ao editar pilar.");
    }
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

        {isManaging && (
          <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm font-body text-foreground">
              Editando o conteúdo da conta de <b>{managedName}</b>. Suas configurações pessoais (perfil, Drive, segurança) ficam em <b>Minha conta</b>.
            </p>
            <button onClick={() => setActiveAccount(null)} className="text-sm font-semibold text-primary hover:underline shrink-0 whitespace-nowrap">
              Ir para Minha conta
            </button>
          </div>
        )}

        <Tabs defaultValue={isManaging ? "pilares" : "perfil"} className="w-full">
          <div className="overflow-x-auto mb-6 -mx-4 px-4 scrollbar-none flex justify-center sm:justify-start">
            <TabsList className="inline-flex h-auto bg-card border border-border rounded-2xl p-1.5 gap-1 min-w-max">
              {!isManaging && <TabsTrigger value="perfil" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><User className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Perfil</span></TabsTrigger>}
              <TabsTrigger value="pilares" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><LayoutGrid className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Pilares & Hábitos</span></TabsTrigger>
              {!isManaging && <TabsTrigger value="visual" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><Paintbrush className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Visual</span></TabsTrigger>}
              {!isManaging && <TabsTrigger value="integracoes" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><Plug className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Integrações</span></TabsTrigger>}
              {!isManaging && <TabsTrigger value="equipe" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><Users className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Equipe</span></TabsTrigger>}
              {!isManaging && <TabsTrigger value="seguranca" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><Shield className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Segurança</span></TabsTrigger>}
            </TabsList>
          </div>

          <div className="w-full">
            {!isManaging && (
            <TabsContent value="perfil">
              <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
                <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-5">
                  <h3 className="font-display font-semibold text-foreground">Meu Perfil</h3>
                  <div className="flex items-center gap-4">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="relative w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border hover:border-primary transition-colors group">
                      {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <Camera className="h-6 w-6 text-muted-foreground group-hover:text-primary" />}
                      <div className="absolute inset-0 bg-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Camera className="h-5 w-5 text-primary-foreground" /></div>
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
                    <div>
                      <p className="font-body text-sm font-medium text-foreground">Foto de perfil</p>
                      <p className="font-body text-xs text-muted-foreground">
                        {uploadingAvatar ? "Enviando..." : "Clique para alterar"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Nome</Label>
                    <Input {...register("name")} className="rounded-xl" />
                    {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Bio <span className="text-muted-foreground">({bio.length}/160)</span></Label>
                    <Textarea {...register("bio")} placeholder="Conte um pouco sobre você..." className="rounded-xl min-h-[60px]" />
                    {errors.bio && <p className="text-xs text-destructive mt-1">{errors.bio.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Nicho</Label>
                    <p className="text-[11px] text-muted-foreground font-body">
                      Selecione um ou mais. Adicione um nicho personalizado se preferir.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {NICHE_OPTIONS.map((n) => {
                        const active = selectedNiches.includes(n);
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => toggleNiche(n)}
                            className={`px-3 py-1.5 rounded-full text-sm font-body transition-colors ${
                              active
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground hover:bg-muted/80"
                            }`}
                          >
                            {n}
                          </button>
                        );
                      })}
                      {selectedNiches
                        .filter((n) => !NICHE_OPTIONS.includes(n))
                        .map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => toggleNiche(n)}
                            className="px-3 py-1.5 rounded-full text-sm font-body bg-primary text-primary-foreground hover:opacity-90"
                          >
                            {n}
                            <span className="ml-1.5 opacity-70">×</span>
                          </button>
                        ))}
                    </div>
                    <div className="flex gap-2 pt-1">
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
                    {errors.niche && <p className="text-xs text-destructive mt-1">{errors.niche.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Plataformas</Label>
                    <div className="flex flex-wrap gap-2">
                      {(["instagram", "tiktok", "youtube"] as const).map(p => (
                        <button key={p} type="button" onClick={() => togglePlatform(p)} className={`shrink-0 px-3 sm:px-4 py-2 rounded-xl border text-sm font-body transition-colors flex items-center gap-2 ${platforms.includes(p) ? "bg-primary/10 border-primary" : "bg-background border-border"}`}>
                          <PlatformIcon platform={p} size="sm" />
                          {p === "instagram" ? "Instagram" : p === "tiktok" ? "TikTok" : "YouTube"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Meta semanal: {weeklyGoal} posts <InfoTooltip text="Quantos posts você quer publicar por semana." /></Label>
                    <input type="range" min={1} max={7} value={weeklyGoal} onChange={(e) => setValue("weekly_goal", parseInt(e.target.value))} className="w-full accent-[hsl(var(--primary))]" />
                  </div>
                  <div className="space-y-3">
                    <Label className="font-body text-sm">Handles</Label>
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform="instagram" size="sm" />
                      <Input placeholder="@seuinstagram" {...register("instagram_handle")} className="rounded-xl" />
                    </div>
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform="tiktok" size="sm" />
                      <Input placeholder="@seutiktok" {...register("tiktok_handle")} className="rounded-xl" />
                    </div>
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform="youtube" size="sm" />
                      <Input placeholder="@seuyoutube" {...register("youtube_handle")} className="rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Chave Pix</Label>
                    <Input placeholder="CPF, e-mail, telefone ou chave aleatória" {...register("pix_key")} className="rounded-xl" />
                    <p className="text-[11px] text-muted-foreground font-body">Aparece nas suas propostas pra marca te pagar direto.</p>
                    {errors.pix_key && <p className="text-xs text-destructive mt-1">{errors.pix_key.message}</p>}
                  </div>
                  <Button type="submit" variant="hero">Salvar perfil</Button>
                </div>
              </form>
            </TabsContent>
            )}

            <TabsContent value="pilares">
              <div className="max-w-2xl space-y-6">
                <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
                  <h3 className="font-display font-semibold text-foreground">Pilares de Conteúdo</h3>
                  <p className="text-xs text-muted-foreground font-body">Máximo 7 pilares</p>
                  {pillars.map(p => (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      {editingPillarId === p.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            autoFocus
                            value={editingPillarName}
                            onChange={(e) => setEditingPillarName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSavePillarEdit(p.id);
                              if (e.key === "Escape") setEditingPillarId(null);
                            }}
                            className="flex-1 h-7 px-2 rounded-lg border border-primary/40 bg-card text-sm font-body focus:outline-none focus:ring-1 focus:ring-primary/40"
                          />
                          <button
                            type="button"
                            onClick={() => handleSavePillarEdit(p.id)}
                            className="text-xs text-primary font-body font-medium hover:underline"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPillarId(null)}
                            className="text-xs text-muted-foreground font-body hover:underline"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1 group">
                          <span className="flex-1 text-sm font-body">{p.name}</span>
                          <button
                            type="button"
                            onClick={() => { setEditingPillarId(p.id); setEditingPillarName(p.name); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                            aria-label="Editar pilar"
                          >
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                      )}
                      <button type="button" onClick={() => handleDeletePillar(p.id)} className="p-1 hover:bg-destructive/10 rounded"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                    </div>
                  ))}
                  {pillars.length < 7 && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input placeholder="Novo pilar..." value={newPillarName} onChange={(e) => setNewPillarName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPillar()} className="rounded-xl text-sm" />
                        <Button variant="outline" size="sm" type="button" onClick={addPillar}><Plus className="h-4 w-4" /></Button>
                      </div>
                      <div className="flex gap-2">
                        {PILLAR_COLORS.map(c => (
                          <button key={c} type="button" onClick={() => setNewPillarColor(c)} className={`w-6 h-6 rounded-full transition-all ${newPillarColor === c ? "ring-2 ring-offset-2 ring-primary" : ""}`} style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
                  <div>
                    <h3 className="font-display font-semibold text-foreground">Linha Editorial da Semana</h3>
                    <p className="text-xs text-muted-foreground font-body mt-0.5">Escolha qual pilar trabalhar em cada dia da semana.</p>
                  </div>
                  {pillars.length === 0 ? (
                    <p className="text-xs text-muted-foreground font-body">
                      Cadastre pelo menos um pilar acima para montar a linha editorial.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-7 gap-2">
                        {EDITORIAL_DAYS.map((day) => (
                          <div key={day} className="flex flex-col gap-1">
                            <label className="text-[10px] font-body font-semibold uppercase tracking-wider text-muted-foreground">
                              {day}
                            </label>
                            <select
                              value={editorialLine[day] ?? ""}
                              onChange={(e) => setEditorialLine(prev => ({ ...prev, [day]: e.target.value }))}
                              className="rounded-lg border border-border bg-card text-xs font-body p-1.5"
                            >
                              <option value="">—</option>
                              {pillars.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          onClick={saveEditorialLine}
                          disabled={savingEditorialLine}
                        >
                          {savingEditorialLine ? "Salvando..." : "Salvar"}
                        </Button>
                      </div>
                    </>
                  )}
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

            {!isManaging && (
            <TabsContent value="visual">
              <SettingsVisual />
            </TabsContent>
            )}

            {!isManaging && (
            <TabsContent value="integracoes">
              <div className="max-w-2xl space-y-6">
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
                        <h3 className="text-sm font-display font-semibold text-foreground">Armazenamento</h3>

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
                            Tempo de retenção de uploads
                          </label>
                          <p className="text-xs text-muted-foreground font-body">
                            Arquivos enviados da galeria são deletados automaticamente após esse período.
                            Arquivos do Google Drive nunca expiram.
                          </p>
                          <div className="flex gap-2">
                            {[15, 30].map((days) => (
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
                                {days} dias
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
                <SettingsEquipe />
              </div>
            </TabsContent>
            )}

            {!isManaging && (
            <TabsContent value="seguranca">
              <div className="max-w-2xl space-y-6">
                <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
                  <h3 className="font-display font-semibold text-foreground">Segurança da Conta</h3>
                  <div className="space-y-4">
                    <Button variant="outline" onClick={() => setPasswordOpen(true)} className="w-full sm:w-auto"><Lock className="h-4 w-4 mr-2" /> Alterar Senha</Button>
                  </div>
                </div>
                {profile?.stripe_customer_id && (
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
                <div className="bg-card border-destructive/20 rounded-2xl p-6 shadow-[var(--shadow-warm)] border space-y-4">
                  <h3 className="font-display font-semibold text-destructive flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Zona de Perigo</h3>
                  <Button variant="outline" onClick={() => setLogoutOpen(true)} className="text-destructive hover:bg-destructive/10 border-destructive/20">Sair da conta</Button>
                  <div className="pt-4 border-t border-destructive/10">
                    <p className="text-sm text-muted-foreground font-body mb-3">
                      Esta ação é permanente. Todos os seus dados — posts, ideias, brandbook, hábitos, arquivos — serão apagados e não podem ser recuperados.
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

                {/* Disclaimer de exclusão de dados — compliance Meta/Google */}
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
          <DialogContent className="sm:max-w-sm">
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
