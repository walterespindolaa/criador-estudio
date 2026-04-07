import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Briefcase, Mic, Focus, ChevronLeft, ChevronRight, Save } from "lucide-react";

interface Reflection {
  id: string;
  month: string;
  biz_worked: string | null;
  biz_blocked: string | null;
  biz_revenue: string | null;
  biz_clarity: string | null;
  biz_procrastination: string | null;
  content_best: string | null;
  content_connection: string | null;
  content_rhythm: string | null;
  focus_execution: string | null;
  focus_distractions: string | null;
  focus_lessons: string | null;
}

const emptyReflection: Omit<Reflection, "id" | "month"> = {
  biz_worked: "", biz_blocked: "", biz_revenue: "", biz_clarity: "", biz_procrastination: "",
  content_best: "", content_connection: "", content_rhythm: "",
  focus_execution: "", focus_distractions: "", focus_lessons: "",
};

export function MonthlyReflection({ userId }: { userId: string }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [form, setForm] = useState(emptyReflection);
  const [saving, setSaving] = useState(false);

  const getMonthDate = (offset: number) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return d.toISOString().slice(0, 10);
  };

  const monthDate = getMonthDate(monthOffset);
  const monthLabel = new Date(monthDate + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const fetchReflection = useCallback(async () => {
    const { data } = await supabase
      .from("monthly_reflections" as any)
      .select("*")
      .eq("user_id", userId)
      .eq("month", monthDate)
      .maybeSingle();
    
    if (data) {
      setReflection(data as any);
      setForm({
        biz_worked: (data as any).biz_worked || "",
        biz_blocked: (data as any).biz_blocked || "",
        biz_revenue: (data as any).biz_revenue || "",
        biz_clarity: (data as any).biz_clarity || "",
        biz_procrastination: (data as any).biz_procrastination || "",
        content_best: (data as any).content_best || "",
        content_connection: (data as any).content_connection || "",
        content_rhythm: (data as any).content_rhythm || "",
        focus_execution: (data as any).focus_execution || "",
        focus_distractions: (data as any).focus_distractions || "",
        focus_lessons: (data as any).focus_lessons || "",
      });
    } else {
      setReflection(null);
      setForm(emptyReflection);
    }
  }, [userId, monthDate]);

  useEffect(() => { fetchReflection(); }, [fetchReflection]);

  const handleSave = async () => {
    setSaving(true);
    const payload: any = { user_id: userId, month: monthDate, ...form };
    
    if (reflection) {
      await supabase.from("monthly_reflections" as any).update(payload).eq("id", (reflection as any).id);
    } else {
      await supabase.from("monthly_reflections" as any).insert(payload);
    }
    toast.success("Reflexão salva!");
    setSaving(false);
    fetchReflection();
  };

  const updateField = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const Field = ({ label, fieldKey, placeholder }: { label: string; fieldKey: string; placeholder: string }) => (
    <div className="space-y-1.5">
      <Label className="font-body text-xs text-muted-foreground">{label}</Label>
      <Textarea
        placeholder={placeholder}
        value={(form as any)[fieldKey] || ""}
        onChange={e => updateField(fieldKey, e.target.value)}
        className="rounded-xl min-h-[60px] text-sm"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-foreground text-lg">Evolução do Mês</h3>
          <p className="text-sm text-muted-foreground font-body">Reflita sobre seu progresso e aprendizados</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonthOffset(prev => prev - 1)} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-body text-sm font-medium text-foreground min-w-[140px] text-center capitalize">{monthLabel}</span>
          <button onClick={() => setMonthOffset(prev => Math.min(prev + 1, 0))} className="p-1.5 rounded-lg hover:bg-accent transition-colors" disabled={monthOffset >= 0}>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Negócio */}
        <div className="bg-card rounded-2xl p-5 shadow-warm border border-border space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="h-4 w-4 text-primary" />
            <h4 className="font-display font-semibold text-foreground text-sm">Negócio</h4>
          </div>
          <Field label="O que funcionou?" fieldKey="biz_worked" placeholder="Estratégias que deram resultado..." />
          <Field label="O que travou?" fieldKey="biz_blocked" placeholder="Obstáculos e bloqueios..." />
          <Field label="Receita / Resultado" fieldKey="biz_revenue" placeholder="Faturamento, novos clientes..." />
          <Field label="Clareza" fieldKey="biz_clarity" placeholder="Nível de clareza sobre o negócio..." />
          <Field label="Procrastinação" fieldKey="biz_procrastination" placeholder="O que foi postergado..." />
        </div>

        {/* Conteúdo */}
        <div className="bg-card rounded-2xl p-5 shadow-warm border border-border space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Mic className="h-4 w-4 text-secondary" />
            <h4 className="font-display font-semibold text-foreground text-sm">Conteúdo</h4>
          </div>
          <Field label="Melhores conteúdos" fieldKey="content_best" placeholder="Posts que mais performaram..." />
          <Field label="Conexão com público" fieldKey="content_connection" placeholder="Como foi a interação..." />
          <Field label="Ritmo de produção" fieldKey="content_rhythm" placeholder="Conseguiu manter a frequência..." />
        </div>

        {/* Foco */}
        <div className="bg-card rounded-2xl p-5 shadow-warm border border-border space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Focus className="h-4 w-4 text-accent-foreground" />
            <h4 className="font-display font-semibold text-foreground text-sm">Foco</h4>
          </div>
          <Field label="Execução" fieldKey="focus_execution" placeholder="O que executou do planejado..." />
          <Field label="Distrações" fieldKey="focus_distractions" placeholder="O que tirou o foco..." />
          <Field label="Lições aprendidas" fieldKey="focus_lessons" placeholder="Principais aprendizados..." />
        </div>
      </div>

      <Button variant="hero" onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        <Save className="h-4 w-4 mr-1.5" /> {saving ? "Salvando..." : "Salvar reflexão"}
      </Button>
    </div>
  );
}
