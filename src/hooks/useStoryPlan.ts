import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";
import { storyDaIA, type StoryIA, type TipoStory } from "@/lib/storyRoteiro";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type StorySlot = {
  id: string;
  user_id: string;
  slot_date: string; // YYYY-MM-DD
  slot_time: string | null;
  title: string;
  script: string | null;
  format: string | null;
  status: "pendente" | "feito";
  sort_order: number;
  source: string;
  notify_title?: string | null;
  notify_body?: string | null;
  notified_at?: string | null;
  created_at: string;
  /** Post de formato Story ligado (28/10/2026): é ele que anda pelo Criando,
   *  Prompter e publicação. */
  post_id?: string | null;
};

/* ── O post por trás de cada story (28/10/2026) ──────────────────────────────
   Estado de produção e publicação, quantas mídias tem e, depois de publicado,
   os números do story (social_stories, pela id da mídia no Instagram). */
export type StoryPost = {
  id: string; status: string | null; publish_status: string | null; publish_error: string | null;
  auto_publish: boolean | null; publicar_em: string | null; ig_media_id: string | null; ig_permalink: string | null;
  ig_opcoes: Record<string, unknown> | null; deleted_at: string | null; title: string | null; script: string | null;
  midias: number; numeros: Record<string, number> | null;
};

export function useStoryPosts(postIds: string[]) {
  const chave = [...postIds].sort().join(",");
  return useQuery<Record<string, StoryPost>>({
    queryKey: ["story-posts", chave],
    enabled: postIds.length > 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data: ps, error } = await sbFrom("posts")
        .select("id,status,publish_status,publish_error,auto_publish,publicar_em,ig_media_id,ig_permalink,ig_opcoes,deleted_at,title,script")
        .in("id", postIds);
      if (error) throw error;
      const lista = (ps as unknown as Omit<StoryPost, "midias" | "numeros">[]) ?? [];
      const { data: ms } = await sbFrom("external_media_refs").select("post_id")
        .in("post_id", postIds).or("substituida.is.null,substituida.eq.false");
      const conta: Record<string, number> = {};
      for (const m of (ms as unknown as Array<{ post_id: string }>) ?? []) conta[m.post_id] = (conta[m.post_id] ?? 0) + 1;
      const igIds = lista.map((p) => p.ig_media_id).filter(Boolean) as string[];
      const nums: Record<string, Record<string, number>> = {};
      if (igIds.length) {
        const { data: ss } = await sbFrom("social_stories").select("external_story_id,metrics").in("external_story_id", igIds);
        for (const r of (ss as unknown as Array<{ external_story_id: string; metrics: Record<string, number> | null }>) ?? []) {
          if (r.metrics) nums[r.external_story_id] = r.metrics;
        }
      }
      const out: Record<string, StoryPost> = {};
      for (const p of lista) out[p.id] = { ...p, midias: conta[p.id] ?? 0, numeros: p.ig_media_id ? nums[p.ig_media_id] ?? null : null };
      return out;
    },
  });
}

/** "Já postei pelo celular": o story fica feito (o post vai pra Publicado). */
export function useMarcarStoryPostado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await sbFrom("posts").update({ status: "publicado", published_at: new Date().toISOString() } as never).eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      for (const k of ["story-posts", "story-slots", "posts"]) qc.invalidateQueries({ queryKey: [k] });
      toast.success("Marcado como postado.");
    },
    onError: () => toast.error("Não consegui marcar."),
  });
}

export type ScheduledPostLite = {
  id: string;
  title: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string | null;
  platform: string | null;
};

function isoAddDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Slots do plano no intervalo [fromDate, toDate].
export function useStorySlots(fromDate: string, toDate: string) {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  return useQuery<StorySlot[]>({
    queryKey: ["story-slots", userId, fromDate, toDate],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await sbFrom("story_slots")
        .select("*")
        .eq("user_id", userId!)
        .gte("slot_date", fromDate)
        .lte("slot_date", toDate)
        .order("slot_date", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as StorySlot[];
    },
  });
}

// Posts já agendados no mesmo intervalo (pra aparecer junto na aba semanal).
export function useScheduledPostsInRange(fromDate: string, toDate: string) {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  return useQuery<ScheduledPostLite[]>({
    queryKey: ["scheduled-posts-range", userId, fromDate, toDate],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id,title,scheduled_date,scheduled_time,status,platform")
        .eq("user_id", userId!)
        .is("deleted_at", null)
        .gte("scheduled_date", fromDate)
        .lte("scheduled_date", toDate)
        .order("scheduled_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ScheduledPostLite[];
    },
  });
}

// Gera o plano com IA e grava os slots. replaceRange limpa o período antes.
export function useGenerateStoryPlan() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      perDia: number;
      dias: number;
      startDate: string;
      nicho?: string;
      tendencias?: string;
      replaceRange?: boolean;
    }): Promise<number> => {
      if (!userId) throw new Error("Not authenticated");
      const res = await callAIContextBuilder({
        userId,
        operation: "story-plan-generate",
        data: { perDia: params.perDia, dias: params.dias, nicho: params.nicho, tendencias: params.tendencias },
      });
      const stories: Array<Record<string, unknown>> = Array.isArray(res?.stories) ? res.stories : [];
      if (stories.length === 0) throw new Error("A Cria IA não devolveu stories. Tente de novo.");

      const rows = stories.map((s, i) => {
        const dayOffset = Math.max(0, Math.min(params.dias - 1, Number(s.dia) || 0));
        const horario = typeof s.horario === "string" && /^\d{1,2}:\d{2}/.test(s.horario) ? s.horario : null;
        return {
          user_id: userId,
          slot_date: isoAddDays(params.startDate, dayOffset),
          slot_time: horario,
          title: String(s.titulo || "Story").slice(0, 200),
          script: s.roteiro ? String(s.roteiro).slice(0, 2000) : null,
          format: s.formato ? String(s.formato).slice(0, 40) : null,
          status: "pendente",
          sort_order: i,
          source: "ia",
        };
      });

      if (params.replaceRange) {
        const end = isoAddDays(params.startDate, params.dias - 1);
        const { error: delErr } = await sbFrom("story_slots")
          .delete()
          .eq("user_id", userId)
          .gte("slot_date", params.startDate)
          .lte("slot_date", end);
        if (delErr) throw delErr;
      }

      const { error } = await sbFrom("story_slots").insert(rows as never);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["story-slots"] });
      toast.success(`Plano criado, ${n} stories.`);
    },
    onError: (e) => {
      const m = e instanceof Error ? e.message : "";
      console.error("story plan generate failed:", e);
      toast.error(m && !/non-2xx/i.test(m) ? m : "Não consegui gerar o plano agora. Tente de novo.");
    },
  });
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useUpdateStorySlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: {
      id: string;
      patch: Partial<Pick<StorySlot, "title" | "script" | "format" | "slot_time" | "slot_date" | "status">> & { notify_title?: string | null; notify_body?: string | null };
    }) => {
      const { error } = await sbFrom("story_slots")
        .update({ ...patch, updated_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["story-slots"] }),
    onError: () => toast.error("Não consegui salvar."),
  });
}

export function useDeleteStorySlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("story_slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["story-slots"] }),
    onError: () => toast.error("Não consegui excluir."),
  });
}

export function useAddStorySlot() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      slot_date: string;
      title: string;
      slot_time?: string | null;
      script?: string | null;
      format?: string | null;
      notify_title?: string | null;
      notify_body?: string | null;
      weekdays?: number[];   // 0=Dom .. 6=Sáb, quando recorrente
      weeks?: number;        // repetir por N semanas
      source?: string;
    }): Promise<{ n: number; primeiro: { id: string; post_id: string | null } | null }> => {
      if (!userId) throw new Error("Not authenticated");

      // Datas: recorrência (dias da semana × N semanas) ou dia único.
      let dates: string[] = [input.slot_date];
      if (input.weekdays && input.weekdays.length) {
        const weeks = Math.max(1, Math.min(12, input.weeks || 4));
        const base = new Date(input.slot_date + "T00:00:00");
        const weekStart = new Date(base);
        weekStart.setDate(base.getDate() - base.getDay()); // domingo da semana
        const out: string[] = [];
        for (let w = 0; w < weeks; w++) {
          for (const wd of input.weekdays) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + w * 7 + wd);
            const iso = ymd(d);
            if (iso >= input.slot_date) out.push(iso); // nada no passado
          }
        }
        dates = [...new Set(out)];
      }

      const rows = dates.map((iso, i) => ({
        user_id: userId,
        slot_date: iso,
        title: input.title.slice(0, 200),
        slot_time: input.slot_time ?? null,
        script: input.script ?? null,
        format: input.format ?? null,
        notify_title: input.notify_title ?? null,
        notify_body: input.notify_body ?? null,
        status: "pendente",
        source: input.source ?? (input.weekdays?.length ? "manual-recorrente" : "manual"),
        sort_order: 99 + i,
      }));
      const { data: criados, error } = await sbFrom("story_slots").insert(rows as never).select("id");
      if (error) throw error;
      /* O post do story nasce num gatilho DEPOIS do insert (story_slot_cria_post):
         relê o primeiro pra devolver o post_id, que o "Salvar e gravar" usa. */
      const idPrimeiro = (criados as unknown as Array<{ id: string }> | null)?.[0]?.id;
      let primeiro: { id: string; post_id: string | null } | null = null;
      if (idPrimeiro) {
        const { data: lido } = await sbFrom("story_slots").select("id,post_id").eq("id", idPrimeiro).maybeSingle();
        primeiro = (lido as unknown as { id: string; post_id: string | null } | null) ?? { id: idPrimeiro, post_id: null };
      }
      return { n: rows.length, primeiro };
    },
    onSuccess: ({ n }) => {
      qc.invalidateQueries({ queryKey: ["story-slots"] });
      qc.invalidateQueries({ queryKey: ["story-posts"] });
      toast.success(n > 1 ? `${n} stories adicionados.` : "Story adicionado.");
    },
    onError: () => toast.error("Não consegui adicionar."),
  });
}

/* ── MONTAR A SEMANA COM A CRIA IA (28/10/2026, mockup aba 2) ─────────────────
   Gera primeiro uma PRÉVIA (nada é gravado): a pessoa vê como vai ficar e só
   depois coloca na semana. Não apaga o que já existe nos dias escolhidos. */
export type StoryPrevia = { date: string; slot_time: string | null; title: string; script: string; format: string; tipo: TipoStory };

export function useGerarStoriesPrevia() {
  return useMutation({
    mutationFn: async (params: {
      datas: string[]; perDia: number; nicho?: string; objetivo?: string; escolhidas?: string; tendencias?: string;
    }): Promise<StoryPrevia[]> => {
      const nomes = params.datas.map((iso) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })).join(", ");
      const res = await callAIContextBuilder({
        operation: "story-plan-generate",
        data: {
          perDia: params.perDia, dias: params.datas.length, diasNomes: nomes, nicho: params.nicho,
          objetivo: params.objetivo, escolhidas: params.escolhidas, tendencias: params.tendencias,
        },
      });
      const stories: StoryIA[] = Array.isArray(res?.stories) ? res.stories : [];
      if (stories.length === 0) throw new Error("A Cria IA não devolveu stories. Tente de novo.");
      return stories.map((st) => {
        const i = Math.max(0, Math.min(params.datas.length - 1, Number(st.dia) || 0));
        const horario = typeof st.horario === "string" && /^\d{1,2}:\d{2}/.test(st.horario) ? st.horario.slice(0, 5) : null;
        const x = storyDaIA(st);
        return { date: params.datas[i], slot_time: horario, title: x.title, script: x.script, format: x.format, tipo: x.tipo };
      }).sort((a, b) => (a.date + (a.slot_time ?? "")).localeCompare(b.date + (b.slot_time ?? "")));
    },
    onError: (e) => {
      const m = e instanceof Error ? e.message : "";
      toast.error(/upgrade/i.test(m) ? "Montar a semana com a Cria IA é do plano Studio." : m && !/non-2xx/i.test(m) ? m : "Não consegui montar agora. Tente de novo.");
    },
  });
}

export function useSalvarStoriesPrevia() {
  const { activeAccountId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lista: StoryPrevia[]): Promise<number> => {
      if (!activeAccountId) throw new Error("Not authenticated");
      const rows = lista.map((p, i) => ({
        user_id: activeAccountId, slot_date: p.date, slot_time: p.slot_time, title: p.title, script: p.script || null,
        format: p.format, status: "pendente", sort_order: i, source: "ia",
      }));
      const { error } = await sbFrom("story_slots").insert(rows as never);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["story-slots"] });
      qc.invalidateQueries({ queryKey: ["story-posts"] });
      toast.success(`${n} stories na semana.`);
    },
    onError: () => toast.error("Não consegui colocar na semana."),
  });
}
