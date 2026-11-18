/* ═══════════════════════════════════════════════════════════════════════════
   ROBÔ DO WHATSAPP DO CRIA (Walter, 18/11/2026)

   O WhatsApp do Cria roda na Evolution API (servidor na Oracle, túnel
   wa.criasocialclub.com.br), conectada como "aparelho conectado" do WhatsApp
   Business do iPhone. Esta função faz três coisas:

     { acao: "fila" }        cron a cada minuto (x-internal-secret): manda a
                             boas-vindas de quem se cadastrou e aceitou.
     webhook ?k=<token>      a Evolution avisa cada mensagem. Resposta da pessoa:
                             o robô conversa até max_respostas_robo e passa pra
                             equipe. Mensagem da equipe pelo iPhone/computador:
                             o robô para naquela conversa na hora.
     { acao: "configurar" }  (x-internal-secret) cria a instância "cria" na
                             Evolution, se faltar, e liga o webhook.

   Regras de segurança (número novo, conexão não oficial): só manda pra quem
   marcou o aceite, nunca em massa (max_por_hora), "digitando..." antes de cada
   mensagem, nada de link na primeira mensagem, e o botão robo_ligado em
   wa_config desliga tudo na hora. O robô não diz que é pessoa; se perguntarem,
   fala que é o assistente do Cria e que a Gabi e o Walter estão por perto.
   ═══════════════════════════════════════════════════════════════════════════ */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { iaFetch, IA_URL, definirContextoIA } from "../_shared/ia.ts";
import { humanizar } from "../_shared/voz-cria.ts";
import { montarSistemaWa } from "../_shared/wa-roteiro.ts";
import { registrarErro, mensagemDe } from "../_shared/log.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const EVO = () => (Deno.env.get("EVOLUTION_URL") ?? "").replace(/\/+$/, "");
const EVO_KEY = () => Deno.env.get("EVOLUTION_API_KEY") ?? "";
const INSTANCIA = () => Deno.env.get("EVOLUTION_INSTANCIA") ?? "cria";
const APP = () => Deno.env.get("APP_URL") ?? "https://app.criasocialclub.com.br";

type Config = { robo_ligado: boolean; comunidade_url: string | null; max_por_hora: number; max_respostas_robo: number; avisar_ids: string[] };
type Conversa = {
  id: string; user_id: string | null; telefone: string; perfil: "criador" | "social_midia"; estado: string;
  respostas_robo: number; jid: string | null; enviada_em: string | null;
};

async function evo(caminho: string, corpo: unknown, metodo = "POST") {
  const r = await fetch(`${EVO()}${caminho}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", apikey: EVO_KEY() },
    body: metodo === "GET" ? undefined : JSON.stringify(corpo),
  });
  const t = await r.text();
  let j: unknown = null;
  try { j = JSON.parse(t); } catch { j = t; }
  if (!r.ok) throw new Error(`evolution ${caminho} ${r.status}: ${t.slice(0, 200)}`);
  return j;
}

/** Manda texto com "digitando..." proporcional ao tamanho. Devolve o id da mensagem. */
async function enviarTexto(numeroOuJid: string, texto: string): Promise<string | null> {
  const delay = Math.min(1500 + texto.length * 35, 8000);
  const r = await evo(`/message/sendText/${INSTANCIA()}`, { number: numeroOuJid, text: texto, delay }) as { key?: { id?: string } };
  return r?.key?.id ?? null;
}

/* Telefone brasileiro: o jid do WhatsApp às vezes vem sem o 9 (número antigo).
   Guarda as duas formas pra achar a conversa. */
function digitos(s: string) { return (s ?? "").replace(/\D/g, ""); }

function primeiroNome(n: string | null | undefined) {
  const p = (n ?? "").trim().split(/\s+/)[0] ?? "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "";
}

function sortear<T>(lista: T[]): T { return lista[Math.floor(Math.random() * lista.length)]; }

/* Primeira mensagem: sem link, uma pergunta só, pequenas variações. */
function boasVindas(perfil: Conversa["perfil"], nome: string) {
  const oi = sortear([nome ? `Oi, ${nome}, tudo bem?` : "Oi, tudo bem?", nome ? `Oi, ${nome}! Tudo certo?` : "Oi! Tudo certo?"]);
  if (perfil === "social_midia") {
    return `${oi} Aqui é do Cria. ${sortear(["Vi que você criou sua conta agora há pouco.", "Vi que você acabou de criar sua conta."])} ` +
      sortear([
        "Me conta uma coisa: hoje você aprova os posts com seus clientes por onde, WhatsApp mesmo? Pergunto porque é a parte que mais economiza tempo no Cria, e te mostro em 2 minutos.",
        "Uma pergunta rápida: como você aprova os posts com seus clientes hoje, pelo WhatsApp? É onde o Cria mais economiza tempo, e te mostro rapidinho.",
      ]);
  }
  return `${oi} Aqui é do Cria. ${sortear(["Vi que você criou sua conta.", "Vi que você acabou de criar sua conta."])} ` +
    sortear([
      "Me conta: o que mais trava hoje no seu conteúdo, ter ideia, gravar ou manter a constância? Assim eu te mostro direto a parte do Cria que resolve isso.",
      "Uma pergunta rápida: hoje o que mais pega no seu conteúdo, ter ideia, gravar ou postar com constância? Te mostro a parte do Cria que ajuda nisso.",
    ]);
}

async function lerConfig(svc: SupabaseClient): Promise<Config> {
  const { data } = await svc.from("wa_config").select("robo_ligado, comunidade_url, max_por_hora, max_respostas_robo, avisar_ids").eq("id", 1).maybeSingle();
  return (data as Config) ?? { robo_ligado: false, comunidade_url: null, max_por_hora: 6, max_respostas_robo: 4, avisar_ids: [] };
}

async function avisarEquipe(svc: SupabaseClient, cfg: Config, c: Conversa, nome: string, motivo: string, ultima: string) {
  if (!cfg.avisar_ids?.length) return;
  const perfil = c.perfil === "social_midia" ? "social mídia" : "criador";
  await svc.from("notifications").insert(cfg.avisar_ids.map((u) => ({
    user_id: u, type: "whatsapp_equipe", read: false, link: "/admin",
    title: `WhatsApp: ${nome || "novo cadastro"} (${perfil})`,
    description: `${motivo}. Última mensagem: "${ultima.slice(0, 120)}". Responde pelo WhatsApp do Cria.`,
  })) as never);
}

// ── FILA: boas-vindas ───────────────────────────────────────────────────────
async function rodarFila(svc: SupabaseClient) {
  const cfg = await lerConfig(svc);
  if (!cfg.robo_ligado) return { ok: true, desligado: true };

  const umaHora = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await svc.from("wa_conversas").select("id", { count: "exact", head: true }).gte("enviada_em", umaHora);
  const vagas = Math.max(0, (cfg.max_por_hora ?? 6) - (count ?? 0));
  if (!vagas) return { ok: true, limite_hora: true };

  /* Cadastro de mais de 24 h (robô estava desligado): "vi que você criou a
     conta agora há pouco" ficaria falso. Essas não recebem a boas-vindas. */
  await svc.from("wa_conversas").update({ estado: "encerrada", erro: "passou de 24 h sem envio" })
    .eq("estado", "agendada").lt("criado_em", new Date(Date.now() - 86400_000).toISOString());

  const { data: fila } = await svc.from("wa_conversas").select("id, user_id, telefone, perfil, estado, respostas_robo, jid, enviada_em")
    .eq("estado", "agendada").lte("enviar_em", new Date().toISOString()).order("enviar_em").limit(1);
  /* Uma por minuto (o cron é por minuto): já dá o espaço entre um envio e
     outro, sem disparo em sequência. A linha é "pega" antes de mandar, então
     duas rodadas ao mesmo tempo nunca mandam duas vezes. */
  let enviados = 0;
  for (const c of (fila ?? []) as Conversa[]) {
    const { data: pega } = await svc.from("wa_conversas").update({ estado: "enviando" })
      .eq("id", c.id).eq("estado", "agendada").select("id");
    if (!pega?.length) continue;
    try {
      // Ainda quer? (a pessoa pode ter desmarcado depois)
      const { data: pf } = await svc.from("profiles").select("name, whatsapp_optin").eq("id", c.user_id!).maybeSingle();
      const p = pf as { name: string | null; whatsapp_optin: boolean } | null;
      if (!p?.whatsapp_optin) { await svc.from("wa_conversas").update({ estado: "saiu" }).eq("id", c.id); continue; }

      // O número tem WhatsApp? Guarda o jid certo (com ou sem o 9).
      const ver = await evo(`/chat/whatsappNumbers/${INSTANCIA()}`, { numbers: [c.telefone] }) as Array<{ exists?: boolean; jid?: string }>;
      const achado = Array.isArray(ver) ? ver[0] : null;
      if (!achado?.exists || !achado.jid) {
        await svc.from("wa_conversas").update({ estado: "sem_whatsapp" }).eq("id", c.id);
        continue;
      }
      const texto = boasVindas(c.perfil, primeiroNome(p.name));
      const msgId = await enviarTexto(achado.jid, texto);
      await svc.from("wa_mensagens").insert({ conversa_id: c.id, direcao: "saida", autor: "robo", texto, wa_msg_id: msgId });
      await svc.from("wa_conversas").update({ estado: "enviada", enviada_em: new Date().toISOString(), jid: achado.jid }).eq("id", c.id);
      enviados += 1;
    } catch (e) {
      await svc.from("wa_conversas").update({ estado: "erro", erro: mensagemDe(e).slice(0, 300) }).eq("id", c.id);
      await registrarErro(svc as never, "wa-robo", "fila: " + mensagemDe(e), { conversa: c.id });
    }
  }
  return { ok: true, enviados };
}

// ── WEBHOOK: mensagem chegou ────────────────────────────────────────────────
type Evento = {
  event?: string;
  data?: {
    key?: { remoteJid?: string; remoteJidAlt?: string; fromMe?: boolean; id?: string };
    pushName?: string;
    message?: Record<string, unknown> & { conversation?: string; extendedTextMessage?: { text?: string } };
    messageType?: string;
  };
};

function textoDe(d: NonNullable<Evento["data"]>): string | null {
  const m = d.message ?? {};
  return (m.conversation as string) ?? m.extendedTextMessage?.text ?? null;
}

async function acharConversa(svc: SupabaseClient, jids: string[]): Promise<Conversa | null> {
  const cols = "id, user_id, telefone, perfil, estado, respostas_robo, jid, enviada_em";
  for (const j of jids.filter(Boolean)) {
    const { data } = await svc.from("wa_conversas").select(cols).eq("jid", j).maybeSingle();
    if (data) return data as Conversa;
  }
  for (const j of jids.filter((x) => x && x.endsWith("@s.whatsapp.net"))) {
    const d = digitos(j.split("@")[0]);
    const { data } = await svc.from("wa_conversas").select(cols).in("telefone", [d, d.length === 12 ? d.slice(0, 4) + "9" + d.slice(4) : d]).limit(1);
    if (data?.[0]) return data[0] as Conversa;
  }
  return null;
}

async function contextoDaConta(svc: SupabaseClient, userId: string | null) {
  if (!userId) return { nome: "", texto: "Conta não encontrada." };
  const [{ data: pf }, { count: posts }, { count: clientes }, { count: ig }] = await Promise.all([
    svc.from("profiles").select("name, account_type, onboarding_completed, trial_ends_at, last_seen_at").eq("id", userId).maybeSingle(),
    svc.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    svc.from("external_clients").select("id", { count: "exact", head: true }).eq("manager_id", userId),
    svc.from("social_connections").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  const p = pf as { name: string | null; account_type: string | null; onboarding_completed: boolean | null; trial_ends_at: string | null; last_seen_at: string | null } | null;
  const ate = p?.trial_ends_at ? new Date(p.trial_ends_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) : null;
  return {
    nome: primeiroNome(p?.name),
    texto: `Uso até agora: ${posts ?? 0} posts criados, ${clientes ?? 0} clientes cadastrados, Instagram ${ig ? "conectado" : "não conectado"}, ` +
      `cadastro inicial ${p?.onboarding_completed ? "feito" : "não terminado"}${ate ? `, teste completo até ${ate}` : ""}.`,
  };
}

async function responderComIA(c: Conversa, nome: string, contaTxt: string, historico: { autor: string; texto: string | null }[], cfg: Config) {
  const sistema = montarSistemaWa({
    perfil: c.perfil, rodada: c.respostas_robo + 1, max: cfg.max_respostas_robo ?? 4,
    comunidadeUrl: cfg.comunidade_url, app: APP(),
  });
  const msgs = historico.slice(-12).map((m) => ({ role: m.autor === "pessoa" ? "user" : "assistant", content: m.texto ?? "" }));
  const r = await iaFetch(IA_URL, {
    method: "POST",
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: sistema }, { role: "system", content: `Pessoa: ${nome || "sem nome"}. ${contaTxt}` }, ...msgs],
    }),
  });
  if (!r.ok) throw new Error(`ia ${r.status}`);
  const j = await r.json();
  const o = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
  return {
    resposta: humanizar(String(o.resposta ?? "")).trim().slice(0, 600),
    passar: o.passar_pra_equipe === true,
    sair: o.sair === true,
    motivo: typeof o.motivo === "string" ? o.motivo.slice(0, 160) : "",
  };
}

async function tratarEvento(svc: SupabaseClient, ev: Evento) {
  if (!ev.data?.key || !/messages\.upsert/i.test(ev.event ?? "")) return { ok: true, ignorado: "evento" };
  const k = ev.data.key;
  const jid = k.remoteJid ?? "";
  if (jid.endsWith("@g.us") || jid.includes("broadcast") || jid.includes("newsletter")) return { ok: true, ignorado: "grupo" };

  const c = await acharConversa(svc, [jid, k.remoteJidAlt ?? ""]);
  if (!c) return { ok: true, ignorado: "fora_do_robo" }; // conversa normal do WhatsApp do Cria: não mexe

  const texto = textoDe(ev.data);

  if (k.fromMe) {
    // Saiu do nosso número. Se não foi o robô, foi a equipe: o robô para.
    await new Promise((r) => setTimeout(r, 2500));
    const { data: nossa } = await svc.from("wa_mensagens").select("id").eq("wa_msg_id", k.id ?? "-").maybeSingle();
    if (nossa) return { ok: true, robo: true };
    const umMinuto = new Date(Date.now() - 60_000).toISOString();
    const { data: igual } = await svc.from("wa_mensagens").select("id").eq("conversa_id", c.id).eq("autor", "robo")
      .eq("texto", texto ?? "").gte("criado_em", umMinuto).limit(1);
    if (igual?.length) return { ok: true, robo: true };
    await svc.from("wa_mensagens").insert({ conversa_id: c.id, direcao: "saida", autor: "equipe", texto, wa_msg_id: k.id ?? null });
    if (!["equipe", "saiu"].includes(c.estado)) {
      await svc.from("wa_conversas").update({ estado: "equipe", equipe_em: new Date().toISOString(), motivo_equipe: "a equipe respondeu" }).eq("id", c.id);
    }
    return { ok: true, equipe: true };
  }

  // Mensagem da pessoa.
  const { error: dup } = await svc.from("wa_mensagens").insert({ conversa_id: c.id, direcao: "entrada", autor: "pessoa", texto: texto ?? `[${ev.data.messageType ?? "mídia"}]`, wa_msg_id: k.id ?? null });
  if (dup) return { ok: true, repetida: true };
  await svc.from("wa_conversas").update({ ultima_entrada_em: new Date().toISOString(), jid: c.jid ?? jid }).eq("id", c.id);

  const cfg = await lerConfig(svc);
  if (!cfg.robo_ligado || !["enviada", "conversando"].includes(c.estado)) return { ok: true, robo_parado: true };

  /* A pessoa costuma mandar 2 ou 3 mensagens seguidas. Espera um pouco e só a
     última responde (lendo todas), pra não sair uma resposta por mensagem. */
  await new Promise((r) => setTimeout(r, 7000));
  const { data: ult } = await svc.from("wa_mensagens").select("wa_msg_id").eq("conversa_id", c.id).eq("autor", "pessoa")
    .order("criado_em", { ascending: false }).limit(1);
  if (ult?.[0]?.wa_msg_id && ult[0].wa_msg_id !== k.id) return { ok: true, aguardando_ultima: true };
  const { data: atual } = await svc.from("wa_conversas").select("estado, respostas_robo").eq("id", c.id).maybeSingle();
  const at = atual as { estado: string; respostas_robo: number } | null;
  if (!at || !["enviada", "conversando"].includes(at.estado)) return { ok: true, robo_parado: true };
  c.respostas_robo = at.respostas_robo;

  const conta = await contextoDaConta(svc, c.user_id);
  definirContextoIA({ funcao: "wa-robo", userId: c.user_id, contaId: c.user_id });

  // Áudio, foto, vídeo: o robô não lê. Passa pra equipe.
  if (!texto) {
    const resp = "Recebi aqui! A Gabi vai continuar a conversa com você por aqui.";
    const id = await enviarTexto(c.jid ?? jid, resp);
    await svc.from("wa_mensagens").insert({ conversa_id: c.id, direcao: "saida", autor: "robo", texto: resp, wa_msg_id: id });
    await svc.from("wa_conversas").update({ estado: "equipe", equipe_em: new Date().toISOString(), motivo_equipe: "mandou áudio ou mídia" }).eq("id", c.id);
    await avisarEquipe(svc, cfg, c, conta.nome, "Mandou áudio ou mídia", `[${ev.data.messageType ?? "mídia"}]`);
    return { ok: true, equipe: true };
  }

  const { data: hist } = await svc.from("wa_mensagens").select("autor, texto").eq("conversa_id", c.id).order("criado_em");
  const ia = await responderComIA(c, conta.nome, conta.texto, (hist ?? []) as { autor: string; texto: string | null }[], cfg);
  const ultimaDoRobo = c.respostas_robo + 1 >= (cfg.max_respostas_robo ?? 4);

  if (ia.resposta) {
    const id = await enviarTexto(c.jid ?? jid, ia.resposta);
    await svc.from("wa_mensagens").insert({ conversa_id: c.id, direcao: "saida", autor: "robo", texto: ia.resposta, wa_msg_id: id });
  }

  if (ia.sair) {
    await svc.from("wa_conversas").update({ estado: "saiu", respostas_robo: c.respostas_robo + 1 }).eq("id", c.id);
    if (c.user_id) await svc.from("profiles").update({ whatsapp_optin: false }).eq("id", c.user_id);
    return { ok: true, saiu: true };
  }
  if (ia.passar || ultimaDoRobo) {
    const motivo = ia.passar ? (ia.motivo || "Pediu atenção da equipe") : `Chegou a ${cfg.max_respostas_robo} respostas do robô`;
    await svc.from("wa_conversas").update({ estado: "equipe", equipe_em: new Date().toISOString(), motivo_equipe: motivo, respostas_robo: c.respostas_robo + 1 }).eq("id", c.id);
    await avisarEquipe(svc, cfg, c, conta.nome, motivo, texto);
    return { ok: true, equipe: true };
  }
  await svc.from("wa_conversas").update({ estado: "conversando", respostas_robo: c.respostas_robo + 1 }).eq("id", c.id);
  return { ok: true, respondeu: true };
}

// ── CONFIGURAR: instância + webhook ─────────────────────────────────────────
async function configurar() {
  const token = Deno.env.get("WA_WEBHOOK_TOKEN") ?? "";
  if (!token) throw new Error("falta o segredo WA_WEBHOOK_TOKEN");
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/wa-robo?k=${encodeURIComponent(token)}`;
  let criada = false;
  const lista = await evo(`/instance/fetchInstances?instanceName=${INSTANCIA()}`, null, "GET").catch(() => []) as unknown[];
  if (!Array.isArray(lista) || !lista.length) {
    await evo("/instance/create", { instanceName: INSTANCIA(), integration: "WHATSAPP-BAILEYS", qrcode: true });
    criada = true;
  }
  await evo(`/webhook/set/${INSTANCIA()}`, { webhook: { enabled: true, url, byEvents: false, base64: false, events: ["MESSAGES_UPSERT"] } });
  await evo(`/settings/set/${INSTANCIA()}`, {
    rejectCall: false, groupsIgnore: true, alwaysOnline: false, readMessages: false, readStatus: false, syncFullHistory: false,
  }).catch(() => null);
  return { ok: true, instancia: INSTANCIA(), criada, webhook: "ligado" };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true });
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const k = new URL(req.url).searchParams.get("k");
    const tokenWebhook = Deno.env.get("WA_WEBHOOK_TOKEN");
    if (k) {
      if (!tokenWebhook || k !== tokenWebhook) return json({ error: "unauthorized" }, 401);
      const ev = await req.json().catch(() => ({})) as Evento;
      return json(await tratarEvento(svc, ev));
    }
    const segredo = req.headers.get("x-internal-secret");
    if (!segredo || segredo !== Deno.env.get("INTERNAL_PUSH_SECRET")) return json({ error: "unauthorized" }, 401);
    const body = await req.json().catch(() => ({})) as { acao?: string };
    if (body.acao === "configurar") return json(await configurar());
    if (body.acao === "fila") return json(await rodarFila(svc));
    return json({ error: "acao desconhecida" }, 400);
  } catch (e) {
    await registrarErro(svc as never, "wa-robo", mensagemDe(e));
    return json({ ok: false, error: mensagemDe(e) }, 500);
  }
});
