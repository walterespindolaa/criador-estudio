/* ═══════════════════════════════════════════════════════════════════════════
   DOSSIÊ DA CONTA  (Walter, 09/11/2026: "a IA sai genérica")

   Diagnóstico provado antes desta peça:
   - A sugestão de ideia via só brandbook + resumo de desempenho. Salvos,
     Biblioteca, legendas reais e o que já foi postado nunca chegavam.
   - Sem dado real e com o prompt pedindo "cena, número, exemplo", a IA
     inventava: "O erro de R$ 50 mil com IA", "toquei a 3 mil km de casa".
   - Cada operação montava um contexto diferente; 15 telas não mandavam o
     brandbook e o servidor caía num resumo pobre (1 persona, pilar sem
     descrição, só o primeiro tom).

   Agora toda IA que cria texto recebe o MESMO dossiê, montado aqui a partir
   do banco da conta ativa: quem é, brandbook inteiro, como a pessoa escreve
   (legendas reais que performaram), o que já foi postado, referências salvas
   que conversam com o pedido, a Biblioteca e as tendências do nicho dela.
   ═══════════════════════════════════════════════════════════════════════════ */

// deno-lint-ignore no-explicit-any
type Sb = any;

/** "Lifestyle, Moda e Beleza" -> ["lifestyle", "moda", "beleza"]. A mesma regra
 *  roda no front (src/lib/nichos.ts) pra filtrar a tela de Tendências. */
export function nichosDe(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const sem = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const partes = sem.split(/,|;|\/|\be\b|&|\+/).map((p) => p.trim().replace(/\s+/g, " ")).filter((p) => p.length >= 3 && p.length <= 40);
  return [...new Set(partes)];
}

const ROTULO_ITEM: Record<string, string> = {
  tom: "Tom de voz", expressao: "Expressões que usa", evitar: "Evita (palavras e abordagens)",
  objetivo: "Objetivos com o conteúdo", value: "Valores", arquetipo: "Arquétipo",
  cor: "Cores", fonte: "Fontes",
};
const ROTULO_SECAO: Record<string, string> = {
  "moodboard-identidade": "Identidade", "moodboard-visual": "Visual", "moodboard-contexto": "Contexto e propósito",
  "moodboard-inspiracoes": "Inspirações", "visao-de-mundo": "Visão de mundo", "sobre-voce": "Sobre a pessoa",
  "linha-editorial": "Linha editorial", "tom-de-voz": "Tom de voz", "persona-brand": "Persona da marca",
};

const corta = (s: unknown, n: number) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const palavras = (s: string) => new Set(
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4),
);

export type Dossie = { texto: string; nichos: string[]; tipoConta: string; nome: string };

export async function montarDossie(
  sb: Sb, contaId: string,
  opts: { pedido?: string; formato?: string; leve?: boolean } = {},
): Promise<Dossie> {
  const leve = !!opts.leve;
  const ano = new Date(Date.now() - 3 * 3600_000).getUTCFullYear();
  const desde = new Date(Date.now() - 365 * 86400_000).toISOString();

  const [perfil, pilares, itens, personas, mood, legendas, postados, salvos, usoBib, tendencias] = await Promise.all([
    sb.from("profiles").select("name, niche, platforms, bio, cidade, account_type, instagram_handle, weekly_goal").eq("id", contaId).maybeSingle(),
    sb.from("pillars").select("name, descricao").eq("user_id", contaId).order("position"),
    sb.from("brand_items").select("type, name, value").eq("user_id", contaId).order("position"),
    sb.from("personas").select("name, age_range, gender, location, pain_points, desires, objections, interests, how_you_help, notes").eq("user_id", contaId).limit(4),
    sb.from("moodboard_entries").select("section, answer").eq("user_id", contaId),
    leve ? Promise.resolve({ data: [] }) : sb.from("social_insights")
      .select("caption, media_type, metrics, posted_at").eq("user_id", contaId).is("crm_client_id", null)
      .eq("object_type", "media").not("caption", "is", null).gte("posted_at", desde).limit(200),
    leve ? Promise.resolve({ data: [] }) : sb.from("posts").select("title, format, status")
      .eq("user_id", contaId).order("created_at", { ascending: false }).limit(25),
    leve ? Promise.resolve({ data: [] }) : sb.from("saved_refs").select("author, platform, caption, note, folder")
      .eq("user_id", contaId).order("created_at", { ascending: false }).limit(120),
    leve ? Promise.resolve({ data: [] }) : sb.from("user_library_usage").select("item_type, item_id, vezes")
      .eq("user_id", contaId).order("vezes", { ascending: false }).limit(20),
    leve ? Promise.resolve({ data: [] }) : sb.from("content_trends").select("kind, title, description, niche")
      .order("created_at", { ascending: false }).limit(80),
  ]);

  const p = perfil.data ?? {};
  const nome = String(p.name ?? "a pessoa");
  const tipoConta = String(p.account_type ?? "creator");
  const nichos = nichosDe(p.niche);
  const blocos: string[] = [];

  // ── QUEM É ────────────────────────────────────────────────────────────
  const papel = tipoConta === "manager"
    ? "social mídia / agência. O perfil dela vende o SERVIÇO dela pra donos de negócio e marcas. Ela não é influenciadora."
    : "criador(a) de conteúdo que publica no próprio perfil.";
  blocos.push([
    `QUEM É: ${nome}, ${papel}`,
    p.niche ? `Nicho: ${p.niche}` : "",
    p.platforms?.length ? `Plataformas: ${p.platforms.join(", ")}` : "",
    p.cidade ? `Cidade: ${p.cidade}` : "",
    p.instagram_handle ? `Instagram: @${String(p.instagram_handle).replace(/^@/, "")}` : "",
    p.bio ? `Bio: ${corta(p.bio, 300)}` : "",
  ].filter(Boolean).join("\n"));

  // ── BRANDBOOK ─────────────────────────────────────────────────────────
  const marca: string[] = [];
  const porTipo: Record<string, string[]> = {};
  for (const it of (itens.data ?? []) as { type: string; name: string; value: string | null }[]) {
    if (!leve && (it.type === "cor" || it.type === "fonte") && !/art|visual|brief/.test(opts.formato ?? "")) continue;
    const r = ROTULO_ITEM[it.type] ?? it.type;
    (porTipo[r] ??= []).push(it.value ? `${it.name} (${corta(it.value, 120)})` : it.name);
  }
  for (const [r, l] of Object.entries(porTipo)) marca.push(`- ${r}: ${l.join("; ")}`);
  const porSecao: Record<string, string[]> = {};
  for (const m of (mood.data ?? []) as { section: string; answer: string | null }[]) {
    const a = m.answer?.trim();
    if (!a) continue;
    (porSecao[ROTULO_SECAO[m.section] ?? m.section] ??= []).push(corta(a, 600));
  }
  for (const [r, l] of Object.entries(porSecao)) marca.push(`- ${r}: ${corta(l.join(" | "), leve ? 500 : 1200)}`);
  const pil = (pilares.data ?? []) as { name: string; descricao: string | null }[];
  if (pil.length) marca.push(`- Pilares de conteúdo:\n${pil.map((x) => `  · ${x.name}${x.descricao?.trim() ? `: ${corta(x.descricao, 220)}` : ""}`).join("\n")}`);
  for (const [i, pe] of ((personas.data ?? []) as Record<string, unknown>[]).entries()) {
    const lista = (v: unknown) => (Array.isArray(v) && v.length ? (v as string[]).join("; ") : "");
    const linha = [
      `- Persona ${i + 1}: ${[pe.name, pe.age_range, pe.gender, pe.location].filter(Boolean).join(", ")}`,
      lista(pe.pain_points) && `  Dores: ${lista(pe.pain_points)}`,
      lista(pe.desires) && `  Desejos: ${lista(pe.desires)}`,
      lista(pe.objections) && `  Objeções: ${lista(pe.objections)}`,
      lista(pe.interests) && `  Interesses: ${lista(pe.interests)}`,
      pe.how_you_help && `  Como ${nome} ajuda: ${corta(pe.how_you_help, 300)}`,
      pe.notes && `  Notas: ${corta(pe.notes, 300)}`,
    ].filter(Boolean).join("\n");
    marca.push(linha);
  }
  blocos.push(`BRANDBOOK (fonte da verdade sobre a marca):\n${marca.length ? marca.join("\n") : "(não preenchido: não invente quem é a pessoa; fique no que o pedido diz)"}`);

  if (!leve) {
    // ── COMO ELA ESCREVE ─────────────────────────────────────────────────
    type Midia = { caption: string; media_type: string; metrics: Record<string, number> | null };
    const nota = (m: Midia) => {
      const x = m.metrics ?? {};
      return Number(x.total_interactions ?? 0) + Number(x.saved ?? 0) * 3 + Number(x.shares ?? 0) * 3 + Number(x.comments ?? 0) * 2;
    };
    const top = ((legendas.data ?? []) as Midia[]).filter((m) => (m.caption ?? "").trim().length > 40)
      .sort((a, b) => nota(b) - nota(a)).slice(0, 4);
    if (top.length) {
      blocos.push(`COMO ${nome.toUpperCase()} ESCREVE (legendas reais que mais engajaram; imite ritmo, tamanho de frase e vocabulário, não copie):\n` +
        top.map((m, i) => {
          const x = m.metrics ?? {};
          return `${i + 1}. [${String(m.media_type).toLowerCase()}, alcance ${x.reach ?? "?"}, ${x.saved ?? 0} salvos, ${x.comments ?? 0} comentários] ${corta(m.caption, 420)}`;
        }).join("\n"));
    }

    // ── JÁ POSTADO ───────────────────────────────────────────────────────
    const ja = ((postados.data ?? []) as { title: string | null; format: string | null }[])
      .map((x) => x.title?.trim()).filter(Boolean) as string[];
    if (ja.length) blocos.push(`JÁ ESTÁ NO KANBAN OU FOI POSTADO (não repita o mesmo assunto com o mesmo ângulo):\n- ${ja.slice(0, 20).map((t) => corta(t, 90)).join("\n- ")}`);

    // ── REFERÊNCIAS SALVAS ───────────────────────────────────────────────
    type Salvo = { author: string | null; platform: string | null; caption: string | null; note: string | null; folder: string | null };
    const alvo = palavras(`${opts.pedido ?? ""} ${p.niche ?? ""}`);
    const pontua = (s: Salvo) => {
      let n = 0;
      for (const w of palavras(`${s.caption ?? ""} ${s.note ?? ""} ${s.folder ?? ""}`)) if (alvo.has(w)) n++;
      return n + (s.note?.trim() ? 0.5 : 0);
    };
    const refs = ((salvos.data ?? []) as Salvo[]).filter((s) => (s.caption ?? s.note ?? "").trim())
      .map((s) => ({ s, n: pontua(s) })).sort((a, b) => b.n - a.n)
      // Só o que conversa com o pedido; sem nada parecido, as 2 mais recentes.
      .filter((x, i, l) => x.n >= 1 || (l[0]?.n ?? 0) < 1 && i < 2).slice(0, 4).map((x) => x.s);
    if (refs.length) {
      blocos.push(`REFERÊNCIAS QUE ${nome.toUpperCase()} SALVOU (o gosto da pessoa; use o padrão, nunca o texto):\n` +
        refs.map((s) => `- ${s.author ? `@${String(s.author).replace(/^@/, "")}` : "referência"}${s.platform ? ` (${s.platform})` : ""}: ${corta(s.caption, 220)}${s.note?.trim() ? ` | nota: ${corta(s.note, 160)}` : ""}`).join("\n"));
    }

    // ── BIBLIOTECA ───────────────────────────────────────────────────────
    const usados = ((usoBib.data ?? []) as { item_type: string; item_id: string }[]);
    const idsHook = usados.filter((u) => /hook|gancho/.test(u.item_type)).map((u) => u.item_id).slice(0, 6);
    let ganchos = idsHook.length
      ? (await sb.from("reference_hooks").select("category, hook_text").in("id", idsHook)).data ?? []
      : [];
    if (ganchos.length < 4) {
      const todos = ((await sb.from("reference_hooks").select("category, hook_text").eq("is_active", true).limit(80)).data ?? []) as { category: string; hook_text: string }[];
      const umPorCategoria = new Map<string, string>();
      for (const h of todos.sort(() => Math.random() - 0.5)) if (!umPorCategoria.has(h.category)) umPorCategoria.set(h.category, h.hook_text);
      ganchos = [...ganchos, ...[...umPorCategoria].slice(0, 6 - ganchos.length).map(([category, hook_text]) => ({ category, hook_text }))];
    }
    const fmt = (opts.formato ?? "").toLowerCase();
    const formatos = fmt
      ? ((await sb.from("reference_formats").select("name, format_type, structure, tips").eq("is_active", true)).data ?? [])
        .filter((f: { format_type: string }) => fmt.includes(String(f.format_type).toLowerCase()) || String(f.format_type).toLowerCase().includes(fmt)).slice(0, 2)
      : [];
    const bib: string[] = [];
    if (ganchos.length) bib.push(`Modelos de gancho (estrutura, adapte ao assunto): ${(ganchos as { category: string; hook_text: string }[]).map((g) => `[${g.category}] ${corta(g.hook_text, 110)}`).join(" · ")}`);
    for (const f of formatos as { name: string; structure: unknown; tips: unknown }[]) {
      bib.push(`Estrutura de ${f.name}: ${corta(typeof f.structure === "string" ? f.structure : JSON.stringify(f.structure), 400)}${f.tips ? ` Dicas: ${corta(typeof f.tips === "string" ? f.tips : JSON.stringify(f.tips), 250)}` : ""}`);
    }
    if (bib.length) blocos.push(`BIBLIOTECA DO CRIA:\n- ${bib.join("\n- ")}`);

    // ── TENDÊNCIAS DO NICHO ──────────────────────────────────────────────
    const tr = ((tendencias.data ?? []) as { kind: string; title: string; description: string | null; niche: string | null }[]);
    const doNicho = tr.filter((t) => nichos.some((n) => nichosDe(t.niche).includes(n)));
    const gerais = tr.filter((t) => !t.niche || nichosDe(t.niche).includes("geral"));
    const escolhidas = [...doNicho.slice(0, 6), ...gerais.slice(0, Math.max(2, 8 - doNicho.length))].slice(0, 8);
    if (escolhidas.length) {
      blocos.push(`TENDÊNCIAS DESTA SEMANA (${doNicho.length ? "do nicho dela e gerais" : "gerais"}; use só se casar de verdade com o pedido e com a persona):\n` +
        escolhidas.map((t) => `- [${t.kind}${t.niche && !nichosDe(t.niche).includes("geral") ? `, ${t.niche}` : ""}] ${t.title}${t.description ? `: ${corta(t.description, 160)}` : ""}`).join("\n"));
    }
  }

  const texto = `DOSSIÊ DA CONTA (tudo que se sabe de verdade sobre quem pediu; ano atual: ${ano})\n\n${blocos.join("\n\n")}`.slice(0, leve ? 6000 : 16000);
  return { texto, nichos, tipoConta, nome };
}

/** Regras que valem acima de qualquer pedido de "ser específico". */
export function regrasDeVerdade(hoje: string): string {
  return `REGRAS DE VERDADE (valem mais que qualquer pedido de "ser específico"):
- Responda em português do Brasil.
- Hoje é ${hoje}. Datas, anos e "agora" partem daqui.
- Fato sobre a pessoa (número, valor, cliente, viagem, erro, resultado, tempo de carreira, depoimento) só entra se estiver no DOSSIÊ ou no pedido. Nunca invente vivência, número ou história.
- Se a ideia pede uma história ou um número dela que você não tem, deixe a lacuna entre colchetes pra ela preencher: [quanto tempo levou], [o que aconteceu com o cliente], [seu número aqui].
- A especificidade vem do dossiê: profissão, oferta, persona, pilares, o que ela já postou, o que ela salvou. Concreto sim, inventado nunca.
- O que está em "JÁ ESTÁ NO KANBAN" não se repete com o mesmo ângulo.
- Tendência só entra se casar de verdade com a ideia e com a persona. Forçar tendência é pior que não usar.`;
}
