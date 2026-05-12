import { useMemo } from "react";
import { differenceInDays, endOfWeek, startOfWeek } from "date-fns";
import { usePosts } from "./usePosts";
import { useIdeas } from "./useIdeas";
import { usePillars } from "./usePillars";
import { useProfile } from "./useProfile";

export type SmartNotification = {
  id: string;
  type: "warning" | "tip" | "achievement" | "reminder";
  icon: string;
  title: string;
  message: string;
  action?: { label: string; url: string };
  priority: number;
};

const DAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function parsePostDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  try {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function useSmartNotifications() {
  const { posts } = usePosts();
  const { ideas } = useIdeas();
  const { pillars } = usePillars();
  const { profile } = useProfile();

  const notifications = useMemo<SmartNotification[]>(() => {
    const notifs: SmartNotification[] = [];
    const today = new Date();
    const weekGoal = profile?.weekly_goal ?? 3;

    const publishedPosts = posts.filter((p) => p.status === "publicado");

    const lastPublished = [...publishedPosts].sort((a, b) => {
      const aDate = parsePostDate(a.published_at ?? a.updated_at)?.getTime() ?? 0;
      const bDate = parsePostDate(b.published_at ?? b.updated_at)?.getTime() ?? 0;
      return bDate - aDate;
    })[0];

    const lastPublishedDate = lastPublished ? parsePostDate(lastPublished.published_at ?? lastPublished.updated_at) : null;
    const daysSinceLastPost = lastPublishedDate ? differenceInDays(today, lastPublishedDate) : 999;

    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    const postsThisWeek = publishedPosts.filter((p) => {
      const d = parsePostDate(p.published_at ?? p.updated_at);
      return d !== null && d >= weekStart && d <= weekEnd;
    }).length;

    const postsInProgress = posts.filter((p) =>
      ["ideia", "roteiro", "gravando", "editando"].includes(p.status ?? "")
    ).length;

    // 1) Sem postar há muito tempo
    if (lastPublishedDate && daysSinceLastPost >= 7) {
      notifs.push({
        id: "no-post-7d",
        type: "warning",
        icon: "⚠️",
        title: `Faz ${daysSinceLastPost} dias sem publicar`,
        message: "Consistência é tudo! Que tal pegar uma ideia do banco e transformar em post?",
        action: { label: "Ver ideias", url: "/app/ideias" },
        priority: 5,
      });
    } else if (lastPublishedDate && daysSinceLastPost >= 3) {
      notifs.push({
        id: "no-post-3d",
        type: "reminder",
        icon: "📅",
        title: `${daysSinceLastPost} dias sem publicar`,
        message: "Bora manter o ritmo? Você tem posts em criação esperando.",
        action: { label: "Ver pipeline", url: "/app/criando" },
        priority: 3,
      });
    }

    // 2) Meta semanal
    if (postsThisWeek >= weekGoal) {
      notifs.push({
        id: "goal-reached",
        type: "achievement",
        icon: "🎉",
        title: "Meta da semana batida!",
        message: `Você publicou ${postsThisWeek}/${weekGoal} posts. Parabéns pela consistência!`,
        priority: 1,
      });
    } else {
      const remaining = weekGoal - postsThisWeek;
      const dayOfWeek = today.getDay();
      if (dayOfWeek >= 4 && remaining > 0) {
        notifs.push({
          id: "goal-behind",
          type: "warning",
          icon: "🎯",
          title: `Faltam ${remaining} posts pra meta`,
          message: `Já é ${DAY_LABELS[dayOfWeek]} e falta${remaining > 1 ? "m" : ""} ${remaining} post${remaining > 1 ? "s" : ""}.`,
          action: { label: "Criar post", url: "/app/criando" },
          priority: 4,
        });
      }
    }

    // 3) Pilar abandonado
    if (pillars.length > 1) {
      const pillarCounts = pillars.map((p) => ({
        name: p.name,
        count: publishedPosts.filter((post) => post.pillar_id === p.id).length,
      }));
      const abandoned = pillarCounts.filter((p) => p.count === 0);
      if (abandoned.length > 0) {
        notifs.push({
          id: "pillar-abandoned",
          type: "tip",
          icon: "📊",
          title: `Pilar "${abandoned[0].name}" sem posts`,
          message: "Tente equilibrar seus pilares de conteúdo pra alcançar públicos diferentes.",
          action: { label: "Criar ideia", url: "/app/ideias" },
          priority: 2,
        });
      }
    }

    // 4) Muitas ideias paradas
    if (ideas.length >= 10) {
      const notPromoted = ideas.filter((i) => !i.promoted_to_post_id).length;
      if (notPromoted >= 8) {
        notifs.push({
          id: "ideas-piling",
          type: "tip",
          icon: "💡",
          title: `${notPromoted} ideias esperando`,
          message: "Seu banco de ideias está cheio! Transforme as melhores em posts.",
          action: { label: "Ver ideias", url: "/app/ideias" },
          priority: 2,
        });
      }
    }

    // 5) Pipeline cheio
    if (postsInProgress >= 5) {
      notifs.push({
        id: "pipeline-stuck",
        type: "reminder",
        icon: "🔄",
        title: `${postsInProgress} posts em andamento`,
        message: "Muitos posts no pipeline sem publicar. Foque em finalizar antes de criar novos.",
        action: { label: "Ver pipeline", url: "/app/criando" },
        priority: 3,
      });
    }

    // 6) Perfil incompleto
    if (!profile?.bio || !profile?.avatar_url || !profile?.instagram_handle) {
      notifs.push({
        id: "profile-incomplete",
        type: "tip",
        icon: "👤",
        title: "Perfil incompleto",
        message: "Complete seu perfil pra IA gerar sugestões mais personalizadas.",
        action: { label: "Configurações", url: "/app/configuracoes" },
        priority: 1,
      });
    }

    return notifs.sort((a, b) => b.priority - a.priority);
  }, [posts, ideas, pillars, profile]);

  return { notifications };
}
