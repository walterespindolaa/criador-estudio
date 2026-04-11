import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, LogOut, Camera, Lock, AlertTriangle, GripVertical, Sparkles, Bell, Shield, CreditCard, Paintbrush, Moon, Sun, Monitor, HardDrive, ExternalLink, Unplug, User, LayoutGrid, Plug, BookMarked } from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useTheme } from "@/contexts/ThemeContext";

import { useGoogleDriveConnection } from "@/hooks/useGoogleDriveConnection";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { SettingsVisual } from "@/components/settings/SettingsVisual";
import { InfoTooltip } from "@/components/shared/InfoTooltip";

interface Pillar { id: string; name: string; color: string; }
interface Habit { id: string; name: string; position: number; }
interface BrandItem { id: string; type: string; name: string; value: string | null; }

const PILLAR_COLORS = ["#C4622D", "#5C7A6B", "#8B6F4E", "#A4785C", "#6B8E7B", "#D4956A"];
const NICHE_OPTIONS = ["Lifestyle", "Moda", "Beleza", "Fitness", "Culinária", "Educação", "Negócios", "Entretenimento", "Saúde", "Tecnologia"];
const HABIT_SUGGESTIONS = ["Filmei hoje?", "Postei?", "Respondi comentários?", "Estudei algo?", "Planejei amanhã?"];

const Configuracoes = () => {
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [niche, setNiche] = useState("");
  const [weeklyGoal, setWeeklyGoal] = useState(3);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [igHandle, setIgHandle] = useState("");
  const [ttHandle, setTtHandle] = useState("");
  const [ytHandle, setYtHandle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newPillarName, setNewPillarName] = useState("");
  const [newPillarColor, setNewPillarColor] = useState(PILLAR_COLORS[0]);
  const [newHabitName, setNewHabitName] = useState("");

  // Dialogs
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  // Notification prefs
  const [notifApp, setNotifApp] = useState(true);
  const [notifDailyReminder, setNotifDailyReminder] = useState(false);
  const [notifWeeklyGoal, setNotifWeeklyGoal] = useState(true);
  const [notifWeeklyTip, setNotifWeeklyTip] = useState(true);


  // Google Drive
  const { connection: driveConnection, loading: driveLoading, connect: driveConnect, disconnect: driveDisconnect } = useGoogleDriveConnection();
  const { pickAndSave } = useGoogleDrive();
  const [connectingDrive, setConnectingDrive] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setBio(profile.bio || "");
      setNiche(profile.niche || "");
      setWeeklyGoal(profile.weekly_goal || 3);
      setPlatforms(profile.platforms || []);
      setIgHandle(profile.instagram_handle || "");
      setTtHandle(profile.tiktok_handle || "");
      setYtHandle(profile.youtube_handle || "");
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("pillars").select("*").eq("user_id", user.id).order("position"),
      supabase.from("habits").select("*").eq("user_id", user.id).order("position"),
    ]).then(([pillarsRes, habitsRes]) => {
      setPillars(pillarsRes.data || []);
      setHabits(habitsRes.data || []);
    });
  }, [user]);

  const saveProfile = async () => {
    await updateProfile({ name, niche, weekly_goal: weeklyGoal, platforms, bio, instagram_handle: igHandle, tiktok_handle: ttHandle, youtube_handle: ytHandle, avatar_url: avatarUrl } as any);
    toast.success("Perfil atualizado!");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro ao enviar imagem."); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(urlData.publicUrl + "?t=" + Date.now());
    toast.success("Avatar atualizado!");
  };

  const togglePlatform = (p: string) => setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const addPillar = async () => {
    if (!newPillarName.trim() || !user || pillars.length >= 5) return;
    await supabase.from("pillars").insert({ user_id: user.id, name: newPillarName.trim(), color: newPillarColor, position: pillars.length });
    setNewPillarName("");
    const { data } = await supabase.from("pillars").select("*").eq("user_id", user.id).order("position");
    setPillars(data || []);
    toast.success("Pilar adicionado!");
  };

  const deletePillar = async (id: string) => { await supabase.from("pillars").delete().eq("id", id); setPillars(prev => prev.filter(p => p.id !== id)); };

  const addHabit = async (habitName?: string) => {
    const n = habitName || newHabitName.trim();
    if (!n || !user) return;
    await supabase.from("habits").insert({ user_id: user.id, name: n, position: habits.length });
    setNewHabitName("");
    const { data } = await supabase.from("habits").select("*").eq("user_id", user.id).order("position");
    setHabits(data || []);
    toast.success("Hábito adicionado!");
  };

  const deleteHabit = async (id: string) => { await supabase.from("habits").delete().eq("id", id); setHabits(prev => prev.filter(h => h.id !== id)); };




  const handleChangePassword = async () => {
    if (newPassword.length < 8) { toast.error("Mínimo 8 caracteres."); return; }
    if (!/[A-Z]/.test(newPassword)) { toast.error("Inclua pelo menos uma maiúscula."); return; }
    if (!/[0-9]/.test(newPassword)) { toast.error("Inclua pelo menos um número."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error("Erro ao alterar senha."); return; }
    toast.success("Senha alterada!");
    setPasswordOpen(false); setNewPassword("");
  };

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "EXCLUIR") { toast.error("Digite EXCLUIR para confirmar."); return; }
    await signOut(); navigate("/");
    toast.success("Conta desconectada. Entre em contato para exclusão completa.");
  };

  const handleDriveConnect = async () => {
    setConnectingDrive(true);
    try {
      // Load Google scripts and get token
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
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Configurações</h1>
        <p className="text-muted-foreground font-body mb-6">Gerencie sua conta e preferências.</p>

        <Tabs defaultValue="perfil" className="w-full">
          <div className="overflow-x-auto mb-6 -mx-4 px-4 scrollbar-none">
            <TabsList className="inline-flex h-auto bg-card border border-border rounded-2xl p-1.5 gap-1 min-w-max">
              <TabsTrigger value="perfil" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><User className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Perfil</span></TabsTrigger>
              <TabsTrigger value="pilares" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><LayoutGrid className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Pilares & Hábitos</span></TabsTrigger>
              <TabsTrigger value="visual" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><Paintbrush className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Visual</span></TabsTrigger>
              <TabsTrigger value="notificacoes" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><Bell className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Notificações</span></TabsTrigger>
              <TabsTrigger value="seguranca" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><Shield className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Segurança</span></TabsTrigger>
              <TabsTrigger value="integracoes" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><Plug className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Integrações</span></TabsTrigger>
              <TabsTrigger value="assinatura" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap"><CreditCard className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Assinatura</span></TabsTrigger>
            </TabsList>
          </div>

            <div className="w-full">
              {/* PERFIL — only profile info, no pillars/habits */}
              <TabsContent value="perfil">
                <div className="max-w-2xl space-y-6">
                  {/* ... contents of Perfil ... */}
                </div>
              </TabsContent>
              
              {/* PILARES & HÁBITOS — separate tab */}
              <TabsContent value="pilares">
                <div className="max-w-2xl space-y-6">
                  {/* ... contents of Pilares ... */}
                </div>
              </TabsContent>

              {/* VISUAL */}
              <TabsContent value="visual">
                <SettingsVisual />
              </TabsContent>

              {/* ... other tabs ... */}
            </div>
        </Tabs>
      </motion.div>

      {/* Dialogs */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="font-display">Alterar senha</DialogTitle><DialogDescription className="font-body">Mínimo 8 caracteres, 1 maiúscula, 1 número.</DialogDescription></DialogHeader>
          <div className="space-y-4"><Input type="password" placeholder="Nova senha" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-xl" /><Button variant="hero" className="w-full" onClick={handleChangePassword}>Salvar nova senha</Button></div>
        </DialogContent>
      </Dialog>
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="font-display">Sair da conta</DialogTitle><DialogDescription className="font-body">Tem certeza que deseja sair?</DialogDescription></DialogHeader>
          <div className="flex gap-3 justify-end"><Button variant="outline" onClick={() => setLogoutOpen(false)}>Cancelar</Button><Button variant="hero" onClick={handleSignOut}>Sair</Button></div>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="font-display text-destructive">Excluir conta</DialogTitle><DialogDescription className="font-body">Esta ação é irreversível. Digite <span className="font-semibold">EXCLUIR</span> para confirmar.</DialogDescription></DialogHeader>
          <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="EXCLUIR" className="rounded-xl" />
          <Button variant="destructive" className="w-full" onClick={handleDeleteAccount} disabled={deleteConfirm !== "EXCLUIR"}>Excluir minha conta permanentemente</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Configuracoes;
