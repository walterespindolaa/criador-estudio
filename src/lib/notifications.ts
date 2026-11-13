import { supabase } from "@/integrations/supabase/client";
import { toISODateBR } from "@/lib/date-br";

const TIPS = [
  { t: "Gancho do dia", d: "Abra o vídeo com: \"O erro que quase todo mundo comete sem perceber...\"" },
  { t: "Dica de conteúdo", d: "Transforme uma dúvida frequente do seu cliente num carrossel." },
  { t: "Ideia rápida", d: "Mostre os bastidores de algo que você fez hoje, gera conexão." },
  { t: "Gancho do dia", d: "\"3 coisas que eu faria diferente se começasse hoje.\"" },
  { t: "Dica de alcance", d: "Poste nos horários de pico do seu público (veja em Insights)." },
  { t: "Ideia rápida", d: "Pegue um comentário recente e responda em vídeo." },
  { t: "Gancho do dia", d: "\"Pare de [hábito comum] se você quer [resultado].\"" },
];

// O sininho é montado 2x (cabeçalho desktop + mobile) e o StrictMode duplica
// o efeito em dev, sem isso, duas execuções simultâneas furam a checagem de
// duplicata e geram notificações repetidas. Colapsa tudo numa só execução e
// limita a 1x a cada 5 min por carregamento.
let inFlight: Promise<void> | null = null;
let lastRun = 0;
const THROTTLE_MS = 5 * 60 * 1000;

// Estas notificações são de CONTEÚDO DO CRIADOR (gancho do dia, lembretes de
// postar, posts em andamento, meta semanal). Conta GESTOR/agência não trabalha
// no próprio conteúdo, então passamos `isManager` pra pular a geração pra ela.
// O gestor continua recebendo as notificações do trabalho dele (leads,
// aprovações de cliente, aniversário de cliente, etc.), que vêm de outros
// fluxos (edge functions / triggers), não daqui.
export async function generateNotifications(userId: string, opts?: { isManager?: boolean }): Promise<void> {
  if (opts?.isManager) return;
  if (inFlight) return inFlight;
  if (Date.now() - lastRun < THROTTLE_MS) return;
  inFlight = runGenerate(userId).finally(() => {
    lastRun = Date.now();
    inFlight = null;
  });
  return inFlight;
}

async function runGenerate(userId: string) {
  const today = toISODateBR();

  // Dedup diária no fuso BR: `created_at` é timestamp UTC, então entre ~21h-00h BRT
  // ele já cai no dia UTC seguinte. Comparar `created_at.startsWith(today)` (com
  // today em BR) falhava nesse intervalo e gerava dica/lembrete + push duplicados.
  // Convertemos o created_at pro dia de calendário BR ANTES de comparar.
  const isTodayBR = (createdAt?: string | null) => {
    if (!createdAt) return false;
    const d = new Date(createdAt);
    return !isNaN(d.getTime()) && toISODateBR(d) === today;
  };

  // Get current week range (dias de calendário no fuso BR)
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekStart = toISODateBR(monday);
  const weekEnd = toISODateBR(sunday);

  const [postsRes, profileRes, existingRes] = await Promise.all([
    supabase.from("posts").select("id, title, status, scheduled_date, published_at").eq("user_id", userId).is("deleted_at", null),
    supabase.from("profiles").select("weekly_goal").eq("id", userId).single(),
    supabase.from("notifications").select("type, created_at").eq("user_id", userId).gte("created_at", weekStart),
  ]);

  const posts = postsRes.data || [];
  const weeklyGoal = profileRes.data?.weekly_goal || 3;
  const existingNotifs = (existingRes.data as any[]) || [];

  // Weekly published count
  const weekPublished = posts.filter(p =>
    p.status === "publicado" && p.published_at &&
    p.published_at.split("T")[0] >= weekStart && p.published_at.split("T")[0] <= weekEnd
  ).length;

  // 1. Weekly goal met
  if (weekPublished >= weeklyGoal && !existingNotifs.find(n => n.type === "meta_batida")) {
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "meta_batida",
      title: "Meta semanal batida!",
      description: `Você publicou ${weekPublished} posts esta semana. Parabéns!`,
      link: "/app/plano",
    } as any);
  }

  // 2. No posts in 3+ days
  const publishedDates = posts
    .filter(p => p.published_at)
    .map(p => p.published_at!)
    .sort()
    .reverse();
  const lastPublished = publishedDates[0];
  // null = a pessoa nunca publicou (sem histórico). Antes virava 999 e mandava
  // "Faz 999 dias desde seu último post", que é bobo. Tratamos o caso separado.
  const daysSinceLast = lastPublished
    ? Math.floor((now.getTime() - new Date(lastPublished).getTime()) / 86400000)
    : null;

  /* LEMBRETES QUE FALAM DO QUE A PESSOA TEM (Walter, 13/11/2026: "bem zoadas,
     poderiam falar mais com o público"). Antes: "Você tem 56 posts em
     andamento. Que tal avançar com alguns hoje?", igual todo dia, contando até
     ideia solta, e o de ontem ficava empilhado com o de hoje. Agora cada
     lembrete cita o post e a data, e o de dias anteriores sai quando entra o
     de hoje. */
  const curto = (t?: string | null) => { const x = (t ?? "").trim() || "Post sem título"; return x.length > 46 ? x.slice(0, 45).trimEnd() + "…" : x; };
  const dm = (iso?: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
  const pl = (n: number, um: string, varios: string) => (n === 1 ? um : varios);
  const trocarLembrete = async (type: string, title: string, description: string) => {
    await supabase.from("notifications").delete().eq("user_id", userId).eq("type", type);
    await supabase.from("notifications").insert({ user_id: userId, type, title, description, link: "/app/criando" } as any);
  };
  const emProducao = posts.filter(p => ["roteiro", "gravando", "editando", "agendado"].includes(p.status ?? ""));
  const prontos = emProducao.filter(p => p.status === "editando" || p.status === "agendado");

  const todayReminder = existingNotifs.find(n => n.type === "lembrete_postar" && isTodayBR(n.created_at));
  if (!todayReminder) {
    if (daysSinceLast !== null && daysSinceLast >= 3) {
      await trocarLembrete("lembrete_postar", `Faz ${daysSinceLast} dias sem publicar`,
        prontos.length > 0
          ? `Você tem ${prontos.length} ${pl(prontos.length, "post pronto", "posts prontos")} esperando. O da vez é "${curto(prontos[0].title)}".`
          : "Nada pronto na fila. Pega uma ideia do banco e leva até o fim hoje.");
    } else if (daysSinceLast === null) {
      // Nunca publicou: incentiva o primeiro post em vez do "999 dias".
      await trocarLembrete("lembrete_postar", "Bora publicar seu primeiro post?", "Escolha uma ideia do banco e leve até a publicação.");
    }
  }

  // 3. Posts agendados pra hoje: SAIU daqui (pente fino 04/09). Agora quem
  //    avisa é o robô diário no servidor (daily-notifications, tipo resumo_dia),
  //    que chega no celular de manhã mesmo sem abrir o app. Aqui ele usava a
  //    MESMA chave de dedup do bloco 2 (lembrete_postar + hoje), então ora
  //    disparava os dois, ora nenhum.

  // 4. O lembrete do dia sobre os posts: um só, com o que mais importa hoje.
  const pendentesHoje = existingNotifs.find(n => n.type === "posts_pendentes" && isTodayBR(n.created_at));
  if (!pendentesHoje) {
    const porData = (a: { scheduled_date: string | null }, b: { scheduled_date: string | null }) => (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? "");
    const atrasados = emProducao.filter(p => p.scheduled_date && p.scheduled_date < today).sort(porData);
    const daSemana = emProducao.filter(p => p.scheduled_date && p.scheduled_date >= today && p.scheduled_date <= weekEnd).sort(porData);
    const semData = emProducao.filter(p => !p.scheduled_date);
    if (atrasados.length > 0) {
      const a0 = atrasados[0];
      await trocarLembrete("posts_pendentes",
        atrasados.length === 1 ? `"${curto(a0.title)}" passou da data` : `${atrasados.length} posts passaram da data`,
        atrasados.length === 1 ? `Era pra ${dm(a0.scheduled_date)}. Publica hoje ou escolhe um dia novo.` : `O mais antigo é "${curto(a0.title)}", de ${dm(a0.scheduled_date)}. Publica ou escolhe datas novas.`);
    } else if (daSemana.length > 0) {
      const ok = daSemana.filter(p => p.status === "editando" || p.status === "agendado").length;
      const falta = daSemana.length - ok;
      await trocarLembrete("posts_pendentes",
        `${daSemana.length} ${pl(daSemana.length, "post sai", "posts saem")} até domingo`,
        falta === 0 ? `${pl(ok, "Está pronto", "Estão todos prontos")}. O próximo é "${curto(daSemana[0].title)}", dia ${dm(daSemana[0].scheduled_date)}.`
          : `${ok} ${pl(ok, "pronto", "prontos")}, ${falta} ainda em produção. O próximo é "${curto(daSemana[0].title)}", dia ${dm(daSemana[0].scheduled_date)}.`);
    } else if (semData.length >= 2) {
      const adiantado = semData.find(p => p.status === "editando") ?? semData[0];
      await trocarLembrete("posts_pendentes",
        `${semData.length} posts em produção sem dia marcado`,
        `Sem data, post não sai. Que tal agendar "${curto(adiantado.title)}"?`);
    }
  }

  // 5. Dica do dia (rotativa, leva pra biblioteca)
  const tipHoje = existingNotifs.find(n => n.type === "dica_dia" && isTodayBR(n.created_at));
  if (!tipHoje) {
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
    const tip = TIPS[dayOfYear % TIPS.length];
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "dica_dia",
      title: tip.t,
      description: tip.d,
      link: "/app/biblioteca",
    } as any);
  }
}
