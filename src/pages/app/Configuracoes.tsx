import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Settings, Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const PILLAR_COLORS = ["#C4622D", "#5C7A6B", "#8B6F4E", "#A4785C", "#6B8E7B", "#D4956A", "#9B7653", "#4A7C5F"];
const NICHE_OPTIONS = ["Lifestyle", "Moda", "Beleza", "Fitness", "Culinária", "Educação", "Negócios", "Entretenimento", "Saúde", "Tecnologia"];

const Configuracoes = () => {
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const navigate = useNavigate();
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [weeklyGoal, setWeeklyGoal] = useState(3);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [newPillarName, setNewPillarName] = useState("");
  const [newHabitName, setNewHabitName] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setNiche(profile.niche || "");
      setWeeklyGoal(profile.weekly_goal || 3);
      setPlatforms(profile.platforms || []);
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
    await updateProfile({ name, niche, weekly_goal: weeklyGoal, platforms });
    toast.success("Perfil atualizado!");
  };

  const togglePlatform = (p: string) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const addPillar = async () => {
    if (!newPillarName.trim() || !user) return;
    await supabase.from("pillars").insert({
      user_id: user.id,
      name: newPillarName.trim(),
      color: PILLAR_COLORS[pillars.length % PILLAR_COLORS.length],
      position: pillars.length,
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

  const addHabit = async () => {
    if (!newHabitName.trim() || !user) return;
    await supabase.from("habits").insert({
      user_id: user.id,
      name: newHabitName.trim(),
      position: habits.length,
    });
    setNewHabitName("");
    const { data } = await supabase.from("habits").select("*").eq("user_id", user.id).order("position");
    setHabits(data || []);
    toast.success("Hábito adicionado!");
  };

  const deleteHabit = async (id: string) => {
    await supabase.from("habits").delete().eq("id", id);
    setHabits(prev => prev.filter(h => h.id !== id));
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Configurações</h1>
        <p className="text-muted-foreground font-body mb-8">Gerencie sua conta e preferências.</p>

        <div className="space-y-6">
          {/* Profile */}
          <div className="bg-card rounded-2xl p-6 shadow-warm border border-border space-y-4">
            <h3 className="font-display font-semibold text-foreground">Meu Perfil</h3>
            <div className="space-y-2">
              <Label className="font-body text-sm">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
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
                {[
                  { id: "instagram", label: "📸 Instagram" },
                  { id: "tiktok", label: "🎵 TikTok" },
                  { id: "youtube", label: "🎬 YouTube" },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={`px-4 py-2 rounded-xl border text-sm font-body transition-colors ${
                      platforms.includes(p.id) ? "bg-primary/10 border-primary" : "bg-background border-border"
                    }`}
                  >
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
            <Button onClick={saveProfile}>Salvar perfil</Button>
          </div>

          {/* Pillars */}
          <div className="bg-card rounded-2xl p-6 shadow-warm border border-border space-y-4">
            <h3 className="font-display font-semibold text-foreground">Pilares de Conteúdo</h3>
            {pillars.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="font-body text-sm text-foreground flex-1">{p.name}</span>
                <button onClick={() => deletePillar(p.id)} className="p-1 hover:bg-destructive/10 rounded">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input placeholder="Novo pilar..." value={newPillarName} onChange={(e) => setNewPillarName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPillar()} className="rounded-xl text-sm" />
              <Button variant="outline" size="sm" onClick={addPillar}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Habits */}
          <div className="bg-card rounded-2xl p-6 shadow-warm border border-border space-y-4">
            <h3 className="font-display font-semibold text-foreground">Meus Hábitos</h3>
            {habits.map(h => (
              <div key={h.id} className="flex items-center gap-3">
                <span className="font-body text-sm text-foreground flex-1">{h.name}</span>
                <button onClick={() => deleteHabit(h.id)} className="p-1 hover:bg-destructive/10 rounded">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input placeholder="Novo hábito..." value={newHabitName} onChange={(e) => setNewHabitName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addHabit()} className="rounded-xl text-sm" />
              <Button variant="outline" size="sm" onClick={addHabit}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Subscription */}
          <div className="bg-card rounded-2xl p-6 shadow-warm border border-border space-y-4">
            <h3 className="font-display font-semibold text-foreground">Assinatura</h3>
            <p className="text-sm text-muted-foreground font-body">
              Plano atual: <span className="font-semibold text-foreground capitalize">{profile?.plan || "free"}</span>
            </p>
            {profile?.plan !== "pro" && (
              <Button variant="hero">Assinar o Pro ✨</Button>
            )}
          </div>

          {/* Logout */}
          <div className="border-t border-border pt-6">
            <Button variant="outline" onClick={handleSignOut}>Sair da conta</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Configuracoes;
