import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Camera, Lock, AlertTriangle, Shield, Paintbrush, HardDrive, ExternalLink, Unplug, User, LayoutGrid, Plug, Settings } from "lucide-react";
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
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { useGoogleDriveConnection } from "@/hooks/useGoogleDriveConnection";
import { SettingsVisual } from "@/components/settings/SettingsVisual";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { sanitizeText, sanitizeUrl } from "@/lib/sanitize";

const PILLAR_COLORS = ["#C4622D", "#5C7A6B", "#8B6F4E", "#A4785C", "#6B8E7B", "#D4956A"];
const NICHE_OPTIONS = ["Lifestyle", "Moda", "Beleza", "Fitness", "Culinária", "Educação", "Negócios", "Entretenimento", "Saúde", "Tecnologia"];

const profileSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Máximo 100 caracteres").trim(),
  bio: z.string().max(160, "Máximo 160 caracteres").optional().or(z.literal("")),
  niche: z.string().min(1, "Nicho é obrigatório").max(100, "Máximo 100 caracteres").trim(),
  weekly_goal: z.number().min(1).max(7),
  platforms: z.array(z.string()),
  instagram_handle: z.string().max(100).optional().or(z.literal("")),
  tiktok_handle: z.string().max(100).optional().or(z.literal("")),
  youtube_handle: z.string().max(100).optional().or(z.literal("")),
  avatar_url: z.string().optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const Configuracoes = () => {
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { pillars, createPillar, deletePillar: deletePillarMutation } = usePillars();
  const { habits, createHabit, deleteHabit: deleteHabitMutation } = useHabits();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const avatarUrl = watch("avatar_url");
  const niche = watch("niche");
  const bio = watch("bio") || "";
  const platforms = watch("platforms") || [];
  const weeklyGoal = watch("weekly_goal");

  const [newPillarName, setNewPillarName] = useState("");
  const [newPillarColor, setNewPillarColor] = useState(PILLAR_COLORS[0]);
  const [newHabitName, setNewHabitName] = useState("");

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);

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
        tiktok_handle: profile.tiktok_handle || "",
        youtube_handle: profile.youtube_handle || "",
        avatar_url: profile.avatar_url || "",
      });
    }
  }, [profile, reset]);

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateProfile.mutateAsync({
        name: sanitizeText(data.name),
        bio: data.bio ? sanitizeText(data.bio) : null,
        niche: sanitizeText(data.niche),
        weekly_goal: data.weekly_goal,
        platforms: data.platforms,
        instagram_handle: data.instagram_handle ? sanitizeText(data.instagram_handle) : null,
        tiktok_handle: data.tiktok_handle ? sanitizeText(data.tiktok_handle) : null,
        youtube_handle: data.youtube_handle ? sanitizeText(data.youtube_handle) : null,
        avatar_url: data.avatar_url ? sanitizeUrl(data.avatar_url) : null,
      });
      toast.success("Perfil atualizado!");
    } catch {
      toast.error("Erro ao atualizar perfil.");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro ao enviar imagem."); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    setValue("avatar_url", urlData.publicUrl + "?t=" + Date.now());
    toast.success("Avatar atualizado!");
  };

  const togglePlatform = (p: string) => {
    const current = watch("platforms") || [];
    setValue("platforms", current.includes(p) ? current.filter(x => x !== p) : [...current, p]);
  };

  const addPillar = async () => {
    const sanitized = sanitizeText(newPillarName);
    if (!sanitized || pillars.length >= 5) return;
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
          scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
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
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center shadow-sm shrink-0">
            <Settings className="h-5 w-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Configurações</h1>
            <p className="text-muted-foreground font-body mt-0.5 text-sm">Gerencie sua conta e preferências.</p>
          </div>
        </div>

        <Tabs defaultValue="perfil" className="w-full">
          <div className="overflow-x-auto mb-6 -mx-4 px-4 scrollbar-none">
            <TabsList className="inline-flex h-auto bg-card border border-border rounded-2xl p-1.5 gap-1 min-w-max">
              <TabsTrigger value="perfil" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><User className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Perfil</span></TabsTrigger>
              <TabsTrigger value="pilares" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><LayoutGrid className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Pilares & Hábitos</span></TabsTrigger>
              <TabsTrigger value="visual" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><Paintbrush className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Visual</span></TabsTrigger>
              <TabsTrigger value="integracoes" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><Plug className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Integrações</span></TabsTrigger>
              <TabsTrigger value="seguranca" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><Shield className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Segurança</span></TabsTrigger>
            </TabsList>
          </div>

          <div className="w-full">
            <TabsContent value="perfil">
              <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
                <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-5">
                  <h3 className="font-display font-semibold text-foreground">Meu Perfil</h3>
                  <div className="flex items-center gap-4">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="relative w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border hover:border-primary transition-colors group">
                      {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <Camera className="h-6 w-6 text-muted-foreground group-hover:text-primary" />}
                      <div className="absolute inset-0 bg-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Camera className="h-5 w-5 text-primary-foreground" /></div>
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    <div><p className="font-body text-sm font-medium text-foreground">Foto de perfil</p><p className="font-body text-xs text-muted-foreground">Clique para alterar</p></div>
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
                    <div className="flex flex-wrap gap-2">
                      {NICHE_OPTIONS.map(n => (
                        <button key={n} type="button" onClick={() => setValue("niche", n)} className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${niche === n ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                    {errors.niche && <p className="text-xs text-destructive mt-1">{errors.niche.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Plataformas</Label>
                    <div className="flex gap-3">
                      {(["instagram", "tiktok", "youtube"] as const).map(p => (
                        <button key={p} type="button" onClick={() => togglePlatform(p)} className={`px-4 py-2 rounded-xl border text-sm font-body transition-colors flex items-center gap-2 ${platforms.includes(p) ? "bg-primary/10 border-primary" : "bg-background border-border"}`}>
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
                  <Button type="submit" variant="hero">Salvar perfil</Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="pilares">
              <div className="max-w-2xl space-y-6">
                <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
                  <h3 className="font-display font-semibold text-foreground">Pilares de Conteúdo</h3>
                  <p className="text-xs text-muted-foreground font-body">Máximo 5 pilares</p>
                  {pillars.map(p => (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="font-body text-sm text-foreground flex-1">{p.name}</span>
                      <button type="button" onClick={() => handleDeletePillar(p.id)} className="p-1 hover:bg-destructive/10 rounded"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                    </div>
                  ))}
                  {pillars.length < 5 && (
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
                  <h3 className="font-display font-semibold text-foreground">Meus Hábitos</h3>
                  {habits.map(h => (
                    <div key={h.id} className="flex items-center gap-3">
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

            <TabsContent value="visual">
              <SettingsVisual />
            </TabsContent>

            <TabsContent value="integracoes">
              <div className="max-w-2xl space-y-6">
                <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
                  <h3 className="font-display font-semibold text-foreground flex items-center gap-2"><HardDrive className="h-5 w-5 text-primary" /> Google Drive</h3>
                  <p className="text-sm text-muted-foreground font-body leading-relaxed">Conecte seu Google Drive para buscar imagens e vídeos diretamente para o moodboard e brandbook.</p>
                  {driveConnection ? (
                    <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">G</div>
                        <div>
                          <p className="text-sm font-body font-semibold text-foreground">{driveConnection.google_email || "Conectado"}</p>
                          <p className="text-xs font-body text-muted-foreground">Acesso apenas leitura</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleDriveDisconnect}><Unplug className="h-4 w-4 mr-2" /> Desconectar</Button>
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

            <TabsContent value="seguranca">
              <div className="max-w-2xl space-y-6">
                <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
                  <h3 className="font-display font-semibold text-foreground">Segurança da Conta</h3>
                  <div className="space-y-4">
                    <Button variant="outline" onClick={() => setPasswordOpen(true)} className="w-full sm:w-auto"><Lock className="h-4 w-4 mr-2" /> Alterar Senha</Button>
                  </div>
                </div>
                <div className="bg-card border-destructive/20 rounded-2xl p-6 shadow-[var(--shadow-warm)] border space-y-4">
                  <h3 className="font-display font-semibold text-destructive flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Zona de Perigo</h3>
                  <Button variant="outline" onClick={() => setLogoutOpen(true)} className="text-destructive hover:bg-destructive/10 border-destructive/20">Sair da conta</Button>
                </div>
              </div>
            </TabsContent>
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
      </motion.div>
    </div>
  );
};

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);

export default Configuracoes;
