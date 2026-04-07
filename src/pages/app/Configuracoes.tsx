import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, LogOut, Camera, Lock, AlertTriangle, GripVertical, Sparkles } from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Pillar {
  id: string;
  name: string;
  color: string;
}

interface Habit {
  id: string;
  name: string;
  position: number;
}

const PILLAR_COLORS = ["#C4622D", "#5C7A6B", "#8B6F4E", "#A4785C", "#6B8E7B", "#D4956A"];
const NICHE_OPTIONS = ["Lifestyle", "Moda", "Beleza", "Fitness", "Culinária", "Educação", "Negócios", "Entretenimento", "Saúde", "Tecnologia"];
const HABIT_SUGGESTIONS = ["Filmei hoje?", "Postei?", "Respondi comentários?", "Estudei algo?", "Planejei amanhã?"];

const Configuracoes = () => {
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
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

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setBio((profile as any).bio || "");
      setNiche(profile.niche || "");
      setWeeklyGoal(profile.weekly_goal || 3);
      setPlatforms(profile.platforms || []);
      setIgHandle((profile as any).instagram_handle || "");
      setTtHandle((profile as any).tiktok_handle || "");
      setYtHandle((profile as any).youtube_handle || "");
      setAvatarUrl((profile as any).avatar_url || null);
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
    await updateProfile({
      name, niche, weekly_goal: weeklyGoal, platforms,
      ...(({ bio, instagram_handle: igHandle, tiktok_handle: ttHandle, youtube_handle: ytHandle, avatar_url: avatarUrl }) as any),
    } as any);
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
    await supabase.from("pillars").insert({
      user_id: user.id, name: newPillarName.trim(), color: newPillarColor, position: pillars.length,
    });
    setNewPillarName("");
    const { data } = await supabase.from("pillars").select("*").eq("user_id", user.id).order("position");
    setPillars(data || []);
    toast.success("Pilar adicionado!");
  };

  const deletePillar = async (id: string) => {
    await supabase.from("pillars").delete().eq("id", id);
    setPillars(prev => prev.filter(p => p.id !== id));
  };

  const addHabit = async (habitName?: string) => {
    const n = habitName || newHabitName.trim();
    if (!n || !user) return;
    await supabase.from("habits").insert({ user_id: user.id, name: n, position: habits.length });
    setNewHabitName("");
    const { data } = await supabase.from("habits").select("*").eq("user_id", user.id).order("position");
    setHabits(data || []);
    toast.success("Hábito adicionado!");
  };

  const deleteHabit = async (id: string) => {
    await supabase.from("habits").delete().eq("id", id);
    setHabits(prev => prev.filter(h => h.id !== id));
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("Mínimo 6 caracteres."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error("Erro ao alterar senha."); return; }
    toast.success("Senha alterada!");
    setPasswordOpen(false);
    setNewPassword("");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "EXCLUIR") { toast.error("Digite EXCLUIR para confirmar."); return; }
    // Note: full account deletion requires a server-side function
    await signOut();
    navigate("/");
    toast.success("Conta desconectada. Entre em contato para exclusão completa.");
  };

  return (
    <div className="max-w-2xl pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Configurações</h1>
        <p className="text-muted-foreground font-body mb-8">Gerencie sua conta e preferências.</p>

        <div className="space-y-6">
          {/* Profile */}
          <div className="bg-card rounded-2xl p-6 shadow-warm border border-border space-y-5">
            <h3 className="font-display font-semibold text-foreground">Meu Perfil</h3>

            {/* Avatar */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border hover:border-primary transition-colors group"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                )}
                <div className="absolute inset-0 bg-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="h-5 w-5 text-primary-foreground" />
                </div>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <div>
                <p className="font-body text-sm font-medium text-foreground">Foto de perfil</p>
                <p className="font-body text-xs text-muted-foreground">Clique para alterar</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-body text-sm">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label className="font-body text-sm">Bio <span className="text-muted-foreground">({bio.length}/160)</span></Label>
              <Textarea
                value={bio}
                onChange={(e) => e.target.value.length <= 160 && setBio(e.target.value)}
                placeholder="Conte um pouco sobre você..."
                className="rounded-xl min-h-[60px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-body text-sm">Nicho</Label>
              <div className="flex flex-wrap gap-2">
                {NICHE_OPTIONS.map(n => (
                  <button
                    key={n}
                    onClick={() => setNiche(n)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${
                      niche === n ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-body text-sm">Plataformas</Label>
              <div className="flex gap-3">
                {([
                  { id: "instagram", label: "Instagram" },
                  { id: "tiktok", label: "TikTok" },
                  { id: "youtube", label: "YouTube" },
                ] as const).map(p => (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={`px-4 py-2 rounded-xl border text-sm font-body transition-colors flex items-center gap-2 ${
                      platforms.includes(p.id) ? "bg-primary/10 border-primary" : "bg-background border-border"
                    }`}
                  >
                    <PlatformIcon platform={p.id} size="sm" />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-body text-sm">Meta semanal: {weeklyGoal} posts</Label>
              <input
                type="range" min={1} max={7} value={weeklyGoal}
                onChange={(e) => setWeeklyGoal(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            {/* Handles */}
            <div className="space-y-3">
              <Label className="font-body text-sm">Handles</Label>
              <div className="flex items-center gap-2">
                <PlatformIcon platform="instagram" size="sm" />
                <Input placeholder="@seuinstagram" value={igHandle} onChange={(e) => setIgHandle(e.target.value)} className="rounded-xl" />
              </div>
              <div className="flex items-center gap-2">
                <PlatformIcon platform="tiktok" size="sm" />
                <Input placeholder="@seutiktok" value={ttHandle} onChange={(e) => setTtHandle(e.target.value)} className="rounded-xl" />
              </div>
              <div className="flex items-center gap-2">
                <PlatformIcon platform="youtube" size="sm" />
                <Input placeholder="@seuyoutube" value={ytHandle} onChange={(e) => setYtHandle(e.target.value)} className="rounded-xl" />
              </div>
            </div>

            <Button onClick={saveProfile} variant="hero">Salvar perfil</Button>
          </div>

          {/* Pillars */}
          <div className="bg-card rounded-2xl p-6 shadow-warm border border-border space-y-4">
            <h3 className="font-display font-semibold text-foreground">Pilares de Conteúdo</h3>
            <p className="text-xs text-muted-foreground font-body">Máximo 5 pilares</p>
            {pillars.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="font-body text-sm text-foreground flex-1">{p.name}</span>
                <button onClick={() => deletePillar(p.id)} className="p-1 hover:bg-destructive/10 rounded">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            ))}
            {pillars.length < 5 && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input placeholder="Novo pilar..." value={newPillarName} onChange={(e) => setNewPillarName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addPillar()} className="rounded-xl text-sm" />
                  <Button variant="outline" size="sm" onClick={addPillar}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="flex gap-2">
                  {PILLAR_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewPillarColor(c)}
                      className={`w-6 h-6 rounded-full transition-all ${newPillarColor === c ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Habits */}
          <div className="bg-card rounded-2xl p-6 shadow-warm border border-border space-y-4">
            <h3 className="font-display font-semibold text-foreground">Meus Hábitos</h3>
            {habits.map(h => (
              <div key={h.id} className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                <span className="font-body text-sm text-foreground flex-1">{h.name}</span>
                <button onClick={() => deleteHabit(h.id)} className="p-1 hover:bg-destructive/10 rounded">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input placeholder="Novo hábito..." value={newHabitName} onChange={(e) => setNewHabitName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addHabit()} className="rounded-xl text-sm" />
              <Button variant="outline" size="sm" onClick={() => addHabit()}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {HABIT_SUGGESTIONS.filter(s => !habits.find(h => h.name === s)).map(s => (
                <button key={s} onClick={() => addHabit(s)} className="px-3 py-1 rounded-xl text-xs font-body bg-muted border border-border hover:bg-accent transition-colors">
                  + {s}
                </button>
              ))}
            </div>
          </div>

          {/* Subscription */}
          <div className="bg-card rounded-2xl p-6 shadow-warm border border-border space-y-4">
            <h3 className="font-display font-semibold text-foreground">Assinatura</h3>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-body font-semibold ${
                profile?.plan === "pro" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {profile?.plan === "pro" ? "Pro" : "Free"}
              </span>
            </div>
            {profile?.plan !== "pro" ? (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                <p className="font-body text-sm font-semibold text-foreground">Benefícios do Pro ✨</p>
                <ul className="text-sm font-body text-muted-foreground space-y-1">
                  <li>• Posts e ideias ilimitados</li>
                  <li>• Histórico completo</li>
                  <li>• Biblioteca de mídia (2GB)</li>
                  <li>• Acesso a todos os cursos</li>
                </ul>
                <Button variant="hero">Assinar o Pro</Button>
              </div>
            ) : (
              <Button variant="outline">Gerenciar assinatura</Button>
            )}
          </div>

          {/* Account */}
          <div className="bg-card rounded-2xl p-6 shadow-warm border border-border space-y-4">
            <h3 className="font-display font-semibold text-foreground">Conta</h3>
            <div className="space-y-2">
              <Label className="font-body text-sm">E-mail</Label>
              <Input value={user?.email || ""} readOnly className="rounded-xl bg-muted" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setPasswordOpen(true)}>
                <Lock className="h-4 w-4 mr-2" /> Alterar senha
              </Button>
              <Button variant="outline" onClick={() => setLogoutOpen(true)}>
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </Button>
              <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setDeleteOpen(true)}>
                <AlertTriangle className="h-4 w-4 mr-2" /> Excluir conta
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Password Dialog */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Alterar senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input type="password" placeholder="Nova senha (mín. 6 caracteres)" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} className="rounded-xl" />
            <Button variant="hero" className="w-full" onClick={handleChangePassword}>Salvar nova senha</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Logout Dialog */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Sair da conta</DialogTitle>
            <DialogDescription className="font-body">Tem certeza que deseja sair?</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setLogoutOpen(false)}>Cancelar</Button>
            <Button variant="hero" onClick={handleSignOut}>Sair</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-destructive">Excluir conta</DialogTitle>
            <DialogDescription className="font-body">
              Esta ação é irreversível. Digite <span className="font-semibold">EXCLUIR</span> para confirmar.
            </DialogDescription>
          </DialogHeader>
          <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="EXCLUIR" className="rounded-xl" />
          <Button variant="destructive" className="w-full" onClick={handleDeleteAccount} disabled={deleteConfirm !== "EXCLUIR"}>
            Excluir minha conta permanentemente
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Configuracoes;
