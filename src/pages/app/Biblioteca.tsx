import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Pencil, Trash2, Star, X, SlidersHorizontal, Copy, Check, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { usePosts } from "@/hooks/usePosts";
import { POST_TEMPLATES, TEMPLATE_CATEGORIES, type PostTemplate } from "@/lib/post-templates";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { confirmar } from "@/components/shared/Confirm";
import { useReferenceLibrary, useUserLibrary, type LibraryUserTable } from "@/hooks/useLibrary";
import { useBibliotecaExtra, type FavTipo, type UsoTipo } from "@/hooks/useBiblioteca";

/* ═══════════════════════════════════════════════════════════════════════════
   BIBLIOTECA EM FICHÁRIO (Walter, 07/11/2026: "poderia ser mais bonita e útil
   pra pesquisar"; mockup aprovado)

   Antes: 5 abas com cartões iguais, sem busca, Curados e Meus separados,
   favorito só no que a pessoa criou e nenhum jeito de mandar o hook pro post.
   Agora:
     · uma busca grande que procura em tudo de uma vez, e busca por objetivo;
     · abas viram divisórias de fichário, com a contagem do que sobrou no
       filtro. "Ideias Virais" era a mesma tabela de hooks: virou tipo dentro
       de Hooks;
     · cada ficha mostra exemplo, rede, quantas vezes você usou, e o hook vai
       direto pro campo Hook de um post (ou de um rascunho novo);
     · curados e meus na mesma lista, com selo "Meu".
   ═══════════════════════════════════════════════════════════════════════════ */

type Aba = "hooks" | "formatos" | "prompts" | "templates" | "favoritos";
type SheetType = "hook" | "format" | "prompt";
type Mostrar = "todos" | "meus" | "nunca";

type FormData = {
  hook_text?: string; category?: string; platforms?: string[] | null;
  name?: string; platform?: string; structure?: string; tips?: string;
  title?: string; prompt_text?: string; tip?: string; is_favorite?: boolean;
};

const HOOK_CATEGORIES = ["curiosidade", "identificação", "contraste", "dor", "promessa", "polêmica", "storytelling", "problema", "revelação", "desafio", "como fazer", "motivação", "autoridade", "resultado", "ação"];

/* Busca por objetivo: agrupa os tipos que já existem. */
const OBJETIVOS: { key: string; label: string; cor: string; hooks: string[]; templates: string[] }[] = [
  { key: "atencao", label: "Prender atenção", cor: "#FFCF03", hooks: ["curiosidade", "revelação", "desafio", "ação", "polêmica"], templates: ["tip"] },
  { key: "identificacao", label: "Gerar identificação", cor: "#BFE3FF", hooks: ["identificação", "dor", "storytelling", "problema", "motivação"], templates: ["story", "behindscenes"] },
  { key: "vender", label: "Vender", cor: "#FF77B9", hooks: ["promessa", "resultado", "autoridade"], templates: ["cta"] },
  { key: "ensinar", label: "Ensinar", cor: "#BFE8C6", hooks: ["como fazer", "contraste"], templates: ["howto", "list", "tip"] },
  { key: "comentario", label: "Gerar comentário", cor: "#FFD6C2", hooks: ["polêmica", "desafio", "identificação"], templates: ["question", "opinion"] },
];

const ABAS: { key: Aba; label: string; cor: string; texto: string }[] = [
  { key: "hooks", label: "Hooks", cor: "#EB4918", texto: "#fff" },
  { key: "formatos", label: "Formatos", cor: "#0061EE", texto: "#fff" },
  { key: "prompts", label: "Prompts", cor: "#00A652", texto: "#fff" },
  { key: "templates", label: "Templates", cor: "#FF77B9", texto: "#111" },
  { key: "favoritos", label: "Favoritos", cor: "#FFCF03", texto: "#111" },
];

const COR_TIPO = ["#FFCF03", "#FF77B9", "#BFE8C6", "#C8D2FF", "#FFD6C2", "#BFE3FF"];
const corDoTipo = (t: string) => COR_TIPO[[...t].reduce((a, c) => a + c.charCodeAt(0), 0) % COR_TIPO.length];

const REDE: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };
const FORMATO: Record<string, string> = { reels: "Reels", carrossel: "Carrossel", story: "Story", estatico: "Estático", foto: "Foto", video: "Vídeo", shorts: "Shorts" };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Ficha = {
  chave: string;
  aba: Exclude<Aba, "favoritos">;
  favTipo: FavTipo;
  usoTipo: UsoTipo | null;
  id: string;
  meu: boolean;
  tag: string;
  titulo?: string;
  texto: string;
  exemplo?: string | null;
  dica?: string | null;
  redes: string[];
  formato?: string | null;
  /** Favorito que mora na própria linha (hook e prompt da pessoa). */
  favNativo?: boolean;
  objetivos: string[];
  template?: PostTemplate;
  editar?: { tipo: SheetType; dados: FormData & { id: string } };
};

const Biblioteca = () => {
  const navigate = useNavigate();
  const { posts, createPost, updatePost } = usePosts();
  const { referenceHooks, referenceFormats, referencePrompts } = useReferenceLibrary();
  const {
    userHooks, userFormats, userPrompts,
    saveUserHook, saveUserFormat, saveUserPrompt, deleteLibraryItem, toggleFavorite,
  } = useUserLibrary();
  const { favoritos, favDisponivel, usos, alternarFavorito, registrarUso } = useBibliotecaExtra();

  const [aba, setAba] = useState<Aba>("hooks");
  const [busca, setBusca] = useState("");
  const [objetivo, setObjetivo] = useState<string | null>(null);
  const [rede, setRede] = useState<string | null>(null);
  const [formato, setFormato] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState<Mostrar>("todos");
  const [tipoHook, setTipoHook] = useState<string | null>(null);
  const [filtrosCelular, setFiltrosCelular] = useState(false);
  const [usarHook, setUsarHook] = useState<Ficha | null>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetType, setSheetType] = useState<SheetType>("hook");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({});

  const usoPorItem = useMemo(() => {
    const m: Record<string, number> = {};
    for (const u of usos) m[`${u.item_type}:${u.item_id}`] = u.vezes ?? 1;
    return m;
  }, [usos]);

  /* TODAS AS FICHAS NUMA LISTA SÓ */
  const fichas = useMemo<Ficha[]>(() => {
    const out: Ficha[] = [];
    const vistos = new Set<string>();
    for (const h of referenceHooks) {
      const k = `${h.category}|${norm(h.hook_text)}`;
      if (vistos.has(k)) continue; // a base curada tinha hook repetido
      vistos.add(k);
      out.push({
        chave: `rh:${h.id}`, aba: "hooks", favTipo: "hook", usoTipo: "hook", id: h.id, meu: false,
        tag: h.category, texto: h.hook_text, exemplo: (h as { example?: string | null }).example ?? null,
        redes: h.platforms ?? [], objetivos: OBJETIVOS.filter((o) => o.hooks.includes(h.category)).map((o) => o.key),
      });
    }
    for (const h of userHooks) {
      out.push({
        chave: `uh:${h.id}`, aba: "hooks", favTipo: "hook", usoTipo: "hook", id: h.id, meu: true,
        tag: h.category, texto: h.hook_text, redes: h.platforms ?? [], favNativo: !!h.is_favorite,
        objetivos: OBJETIVOS.filter((o) => o.hooks.includes(h.category)).map((o) => o.key),
        editar: { tipo: "hook", dados: { id: h.id, hook_text: h.hook_text, category: h.category, platforms: h.platforms } },
      });
    }
    for (const f of referenceFormats) {
      out.push({
        chave: `rf:${f.id}`, aba: "formatos", favTipo: "format", usoTipo: "format", id: f.id, meu: false,
        tag: FORMATO[f.format_type] ?? f.format_type, titulo: f.name, texto: f.structure, dica: f.tips,
        redes: [f.platform], formato: f.format_type, objetivos: [],
      });
    }
    for (const f of userFormats) {
      out.push({
        chave: `uf:${f.id}`, aba: "formatos", favTipo: "format", usoTipo: "format", id: f.id, meu: true,
        tag: REDE[f.platform] ?? f.platform, titulo: f.name, texto: f.structure, dica: f.tips,
        redes: [f.platform], objetivos: [],
        editar: { tipo: "format", dados: { id: f.id, name: f.name, platform: f.platform, structure: f.structure, tips: f.tips ?? "" } },
      });
    }
    for (const p of referencePrompts) {
      out.push({
        chave: `rp:${p.id}`, aba: "prompts", favTipo: "prompt", usoTipo: "prompt", id: p.id, meu: false,
        tag: p.category, titulo: p.title, texto: p.prompt_text, dica: p.tip, redes: p.platforms ?? [], objetivos: [],
      });
    }
    for (const p of userPrompts) {
      out.push({
        chave: `up:${p.id}`, aba: "prompts", favTipo: "prompt", usoTipo: "prompt", id: p.id, meu: true,
        tag: p.category, titulo: p.title, texto: p.prompt_text, dica: p.tip, redes: [], favNativo: !!p.is_favorite, objetivos: [],
        editar: { tipo: "prompt", dados: { id: p.id, title: p.title, category: p.category, prompt_text: p.prompt_text, tip: p.tip ?? "" } },
      });
    }
    for (const t of POST_TEMPLATES) {
      out.push({
        chave: `t:${t.id}`, aba: "templates", favTipo: "template", usoTipo: null, id: t.id, meu: false,
        tag: TEMPLATE_CATEGORIES.find((c) => c.key === t.category)?.label ?? t.category,
        titulo: t.title, texto: t.caption, dica: t.description, redes: ["instagram"], formato: t.format,
        objetivos: OBJETIVOS.filter((o) => o.templates.includes(t.category)).map((o) => o.key), template: t,
      });
    }
    return out;
  }, [referenceHooks, userHooks, referenceFormats, userFormats, referencePrompts, userPrompts]);

  const ehFavorito = (f: Ficha) => (f.favNativo ?? false) || favoritos.has(`${f.favTipo}:${f.id}`);
  const vezes = (f: Ficha) => (f.usoTipo ? usoPorItem[`${f.usoTipo}:${f.id}`] ?? 0 : 0);

  /* O FILTRO, menos a aba: a contagem de cada divisória sai daqui. */
  const filtradas = useMemo(() => {
    const t = norm(busca.trim());
    const obj = objetivo ? OBJETIVOS.find((o) => o.key === objetivo) : null;
    return fichas.filter((f) => {
      if (t) {
        const alvo = norm(`${f.titulo ?? ""} ${f.texto} ${f.exemplo ?? ""} ${f.tag} ${f.dica ?? ""}`);
        if (!t.split(/\s+/).every((p) => alvo.includes(p))) return false;
      }
      if (obj && (f.aba === "hooks" || f.aba === "templates") && !f.objetivos.includes(obj.key)) return false;
      if (rede && f.redes.length > 0 && !f.redes.includes(rede)) return false;
      if (formato && (f.aba === "formatos" || f.aba === "templates") && f.formato !== formato) return false;
      if (mostrar === "meus" && !f.meu) return false;
      if (mostrar === "nunca" && (f.usoTipo === null || vezes(f) > 0)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichas, busca, objetivo, rede, formato, mostrar, usoPorItem]);

  const contagem = useMemo(() => {
    const c: Record<Aba, number> = { hooks: 0, formatos: 0, prompts: 0, templates: 0, favoritos: 0 };
    for (const f of filtradas) { c[f.aba]++; if (ehFavorito(f)) c.favoritos++; }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtradas, favoritos]);

  const daAba = useMemo(() => {
    let l = aba === "favoritos" ? filtradas.filter(ehFavorito) : filtradas.filter((f) => f.aba === aba);
    if (aba === "hooks" && tipoHook) l = l.filter((f) => f.tag === tipoHook);
    // Os seus primeiro, depois favoritos, depois o resto na ordem da base.
    return [...l].sort((a, b) => (Number(b.meu) - Number(a.meu)) || (Number(ehFavorito(b)) - Number(ehFavorito(a))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtradas, aba, tipoHook, favoritos]);

  const tiposDeHook = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of filtradas) if (f.aba === "hooks") m[f.tag] = (m[f.tag] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filtradas]);
  const [verTodosTipos, setVerTodosTipos] = useState(false);

  /* O QUE VOCÊ MAIS USA: soma os usos de hook por tipo e sugere um tipo que você nunca usou. */
  const maisUsa = useMemo(() => {
    const porTipo: Record<string, number> = {};
    for (const f of fichas) {
      if (f.aba !== "hooks") continue;
      const v = vezes(f);
      if (v) porTipo[f.tag] = (porTipo[f.tag] ?? 0) + v;
    }
    const ordem = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);
    if (!ordem.length) return null;
    const nunca = ["contraste", "identificação", "polêmica", "promessa", "curiosidade", "dor"].find((t) => !porTipo[t]);
    return { top: ordem[0][0], nunca };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichas, usoPorItem]);

  const outrasAbasComResultado = busca.trim() && daAba.length === 0
    ? ABAS.filter((a) => a.key !== aba && contagem[a.key] > 0)
    : [];

  /* AÇÕES */
  const copiar = async (f: Ficha) => {
    try { await navigator.clipboard.writeText(f.texto); toast.success("Copiado."); } catch { toast.error("Não consegui copiar."); return; }
    if (f.usoTipo) registrarUso.mutate({ tipo: f.usoTipo, id: f.id, meu: f.meu });
  };

  const favoritar = async (f: Ficha) => {
    try {
      if (f.meu && (f.favTipo === "hook" || f.favTipo === "prompt")) {
        await toggleFavorite.mutateAsync({ table: f.favTipo === "hook" ? "user_hooks" : "user_prompts", id: f.id, is_favorite: !f.favNativo });
      } else {
        await alternarFavorito.mutateAsync({ tipo: f.favTipo, id: f.id, ligado: ehFavorito(f) });
      }
    } catch { toast.error("Não consegui favoritar."); }
  };
  const podeFavoritar = (f: Ficha) => (f.meu && (f.favTipo === "hook" || f.favTipo === "prompt")) || favDisponivel;

  const usarTemplate = async (t: PostTemplate) => {
    try {
      await createPost.mutateAsync({ title: t.title, caption: t.caption, format: t.format, platform: "instagram", status: "ideia" });
      toast.success("Post criado com o template.");
      navigate("/app/criando");
    } catch { toast.error("Erro ao criar post."); }
  };

  const openSheet = (type: SheetType, item?: FormData & { id?: string }) => {
    setSheetType(type);
    setEditingId(item?.id || null);
    setFormData(item ? { ...item } : {});
    setSheetOpen(true);
  };

  const saveItem = async () => {
    try {
      if (sheetType === "hook") {
        if (!formData.hook_text?.trim() || !formData.category) { toast.error("Preencha os campos."); return; }
        const values = { hook_text: formData.hook_text, category: formData.category, platforms: formData.platforms ?? null };
        await saveUserHook.mutateAsync(editingId ? { mode: "update", id: editingId, values } : { mode: "create", values });
      } else if (sheetType === "format") {
        if (!formData.name?.trim() || !formData.platform || !formData.structure?.trim()) { toast.error("Preencha os campos."); return; }
        const values = { name: formData.name, platform: formData.platform, structure: formData.structure, tips: formData.tips || null };
        await saveUserFormat.mutateAsync(editingId ? { mode: "update", id: editingId, values } : { mode: "create", values });
      } else {
        if (!formData.title?.trim() || !formData.prompt_text?.trim() || !formData.category) { toast.error("Preencha os campos."); return; }
        const values = { title: formData.title, category: formData.category, prompt_text: formData.prompt_text, tip: formData.tip || null };
        await saveUserPrompt.mutateAsync(editingId ? { mode: "update", id: editingId, values } : { mode: "create", values });
      }
      toast.success(editingId ? "Atualizado." : "Guardado na sua biblioteca.");
      setSheetOpen(false);
    } catch { toast.error("Erro ao salvar."); }
  };

  const deleteItem = async (type: SheetType, id: string) => {
    if (!(await confirmar({ titulo: "Excluir da biblioteca?", acao: "Excluir", destrutivo: true }))) return;
    const table: LibraryUserTable = type === "hook" ? "user_hooks" : type === "format" ? "user_formats" : "user_prompts";
    try { await deleteLibraryItem.mutateAsync({ table, id }); toast.success("Removido."); } catch { toast.error("Erro ao remover."); }
  };

  const limparFiltros = () => { setBusca(""); setObjetivo(null); setRede(null); setFormato(null); setMostrar("todos"); setTipoHook(null); };
  const temFiltro = !!(busca || objetivo || rede || formato || mostrar !== "todos" || tipoHook);

  const chip = (on: boolean) => cn("rounded-full border px-3 py-1 text-xs font-body font-semibold transition-colors whitespace-nowrap",
    on ? "bg-foreground text-background border-foreground" : "border-border bg-background text-foreground/80 hover:border-foreground/40");

  const novoMeu = aba === "formatos" ? { tipo: "format" as const, label: "Guardar um formato meu" }
    : aba === "prompts" ? { tipo: "prompt" as const, label: "Guardar um prompt meu" }
    : aba === "hooks" ? { tipo: "hook" as const, label: "Guardar um hook meu" } : null;

  const painelFiltros = (
    <div className="space-y-3">
      <div className="rounded-[18px] border-2 border-foreground bg-card p-4 shadow-[3px_3px_0_hsl(var(--foreground))]">
        <div className="flex items-center justify-between">
          <p className="font-display font-extrabold text-[15px]">Filtrar</p>
          {temFiltro && <button type="button" onClick={limparFiltros} className="text-[11.5px] font-body font-semibold text-muted-foreground underline">limpar</button>}
        </div>
        {(aba === "formatos" || aba === "templates") && (
          <>
            <p className="text-[11.5px] font-body text-muted-foreground mt-3 mb-1.5">Formato</p>
            <div className="flex flex-wrap gap-1.5">
              {["reels", "carrossel", "story", "estatico"].map((f) => (
                <button key={f} type="button" className={chip(formato === f)} onClick={() => setFormato(formato === f ? null : f)}>{FORMATO[f]}</button>
              ))}
            </div>
          </>
        )}
        <p className="text-[11.5px] font-body text-muted-foreground mt-3 mb-1.5">Rede</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(REDE).map(([k, v]) => (
            <button key={k} type="button" className={chip(rede === k)} onClick={() => setRede(rede === k ? null : k)}>{v}</button>
          ))}
        </div>
        <p className="text-[11.5px] font-body text-muted-foreground mt-3 mb-1.5">Mostrar</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={chip(mostrar === "todos")} onClick={() => setMostrar("todos")}>Curados e meus</button>
          <button type="button" className={chip(mostrar === "meus")} onClick={() => setMostrar("meus")}>Só os meus</button>
          <button type="button" className={chip(mostrar === "nunca")} onClick={() => setMostrar("nunca")}>Nunca usei</button>
        </div>
      </div>

      {aba === "hooks" && tiposDeHook.length > 0 && (
        <div className="rounded-[18px] border-2 border-foreground bg-card p-4 shadow-[3px_3px_0_hsl(var(--foreground))]">
          <p className="font-display font-extrabold text-[15px] mb-2">Tipos de hook</p>
          {(verTodosTipos ? tiposDeHook : tiposDeHook.slice(0, 5)).map(([t, n]) => (
            <button key={t} type="button" onClick={() => setTipoHook(tipoHook === t ? null : t)}
              className={cn("w-full flex items-center justify-between py-1.5 border-b border-dashed border-border last:border-0 text-[13px] font-body capitalize",
                tipoHook === t ? "font-extrabold text-foreground" : "text-foreground/85")}>
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: corDoTipo(t) }} />{t}</span>
              <span className="font-bold tabular-nums">{n}</span>
            </button>
          ))}
          {tiposDeHook.length > 5 && (
            <button type="button" onClick={() => setVerTodosTipos((v) => !v)} className="mt-1 text-[12px] font-body font-semibold text-muted-foreground">
              {verTodosTipos ? "mostrar menos" : `+ ${tiposDeHook.length - 5} tipos`}
            </button>
          )}
        </div>
      )}

      <div className="rounded-[18px] border-2 border-foreground bg-[#FFCF03] text-[#1D1B18] p-4 shadow-[3px_3px_0_hsl(var(--foreground))]">
        <p className="font-display font-extrabold text-[15px]">O que você mais usa</p>
        <p className="text-[12.5px] font-body mt-1 leading-snug">
          {maisUsa
            ? <>Hook de <b className="capitalize">{maisUsa.top}</b>.{maisUsa.nunca && <> Que tal testar um de <b className="capitalize">{maisUsa.nunca}</b> no próximo post?</>}</>
            : "Ainda nada. Toque em Usar no post ou Copiar numa ficha e eu conto aqui."}
        </p>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl pb-24 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="md:hidden text-3xl font-display font-extrabold text-foreground tracking-tight mb-4">Biblioteca</h1>

        {/* BUSCA */}
        <div className="relative">
          <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          <input ref={buscaRef} value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Procure por palavra: segredo, erro, antes e depois..."
            className="w-full h-12 sm:h-14 rounded-full border-2 border-foreground bg-card pl-11 sm:pl-14 pr-12 sm:pr-32 text-[15px] sm:text-base font-body outline-none shadow-[0_4px_0_hsl(var(--foreground))] focus:shadow-[0_2px_0_hsl(var(--foreground))] focus:translate-y-[2px] transition-all" />
          {busca ? (
            <button type="button" onClick={() => { setBusca(""); buscaRef.current?.focus(); }} aria-label="Limpar busca"
              className="absolute right-3 sm:right-28 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          ) : null}
          <button type="button" onClick={() => buscaRef.current?.focus()}
            className="hidden sm:block absolute right-2 top-1/2 -translate-y-1/2 h-10 px-6 rounded-full bg-[#EB4918] text-white font-body font-extrabold text-sm">Buscar</button>
        </div>

        {/* OBJETIVO */}
        <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap pb-1">
          {OBJETIVOS.map((o) => (
            <button key={o.key} type="button" onClick={() => setObjetivo(objetivo === o.key ? null : o.key)}
              className={cn("shrink-0 rounded-full border-2 border-foreground px-3.5 sm:px-4 py-1.5 sm:py-2 text-[12.5px] sm:text-[13px] font-body font-extrabold transition-all",
                objetivo === o.key ? "shadow-[0_3px_0_hsl(var(--foreground))] -translate-y-0.5" : "bg-card")}
              style={objetivo === o.key ? { background: o.cor, color: "#1D1B18" } : undefined}>{o.label}</button>
          ))}
          <button type="button" onClick={() => setFiltrosCelular((v) => !v)}
            className={cn("order-first lg:hidden shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 border-foreground px-3.5 py-1.5 text-[12.5px] font-body font-extrabold",
              filtrosCelular || (temFiltro && !busca && !objetivo) ? "bg-foreground text-background" : "bg-card")}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
          </button>
        </div>

        {filtrosCelular && <div className="lg:hidden mt-3">{painelFiltros}</div>}

        <div className="mt-5 grid lg:grid-cols-[minmax(0,1fr)_260px] gap-5 items-start">
          <div className="min-w-0">
            {/* DIVISÓRIAS DO FICHÁRIO */}
            <div data-tour="biblioteca-abas" className="flex gap-1 sm:gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:pl-4 sm:pr-0">
              {ABAS.map((a) => {
                const on = aba === a.key;
                return (
                  <button key={a.key} type="button" onClick={() => { setAba(a.key); setTipoHook(null); }}
                    className={cn("shrink-0 rounded-t-[14px] border-2 border-b-0 border-foreground px-3.5 sm:px-4 font-display font-extrabold text-[13px] sm:text-sm transition-all",
                      on ? "pt-2.5 pb-2.5 relative z-10 -mb-[2px]" : "pt-2 pb-1.5 mt-1 opacity-90 hover:opacity-100")}
                    style={{ background: a.cor, color: a.texto }}>
                    {a.label} <span className="ml-0.5 text-[11px] font-body font-bold opacity-80 tabular-nums">{contagem[a.key]}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative rounded-[18px] sm:rounded-tl-[18px] border-2 border-foreground bg-[#FFFCF3] dark:bg-card p-3 sm:p-5 min-h-[320px]"
              style={{ backgroundImage: "repeating-linear-gradient(transparent 0 31px, rgba(201,182,150,.22) 31px 32px)" }}>
              {daAba.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="font-display font-extrabold text-lg">Nada por aqui{busca.trim() ? ` com "${busca.trim()}"` : ""}</p>
                  {aba === "favoritos" && !busca && (
                    <p className="text-[13px] font-body text-muted-foreground mt-1">Toque na estrela de uma ficha pra ela aparecer aqui.</p>
                  )}
                  {outrasAbasComResultado.length > 0 && (
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <span className="text-[13px] font-body text-muted-foreground self-center">Achei em:</span>
                      {outrasAbasComResultado.map((a) => (
                        <button key={a.key} type="button" onClick={() => setAba(a.key)} className="rounded-full border-2 border-foreground px-3 py-1 text-xs font-body font-extrabold"
                          style={{ background: a.cor, color: a.texto }}>{a.label} ({contagem[a.key]})</button>
                      ))}
                    </div>
                  )}
                  {temFiltro && <button type="button" onClick={limparFiltros} className="mt-3 text-[13px] font-body font-semibold underline">Limpar filtros</button>}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-6 pt-2">
                  {daAba.map((f) => (
                    <FichaCard key={f.chave} f={f} vezes={vezes(f)} favorito={ehFavorito(f)} podeFavoritar={podeFavoritar(f)}
                      onCopiar={() => void copiar(f)} onFavoritar={() => void favoritar(f)}
                      onUsar={f.aba === "hooks" ? () => setUsarHook(f) : f.template ? () => void usarTemplate(f.template!) : undefined}
                      onEditar={f.editar ? () => openSheet(f.editar!.tipo, f.editar!.dados) : undefined}
                      onExcluir={f.editar ? () => void deleteItem(f.editar!.tipo, f.id) : undefined} />
                  ))}
                  {novoMeu && !busca && (
                    <button type="button" onClick={() => openSheet(novoMeu.tipo)}
                      className="min-h-[150px] rounded-[18px] border-2 border-dashed border-foreground/40 text-[13.5px] font-body font-bold text-muted-foreground hover:text-foreground hover:border-foreground inline-flex items-center justify-center gap-1.5">
                      <Plus className="h-4 w-4" /> {novoMeu.label}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <aside className="hidden lg:block lg:sticky lg:top-4">{painelFiltros}</aside>
        </div>
      </motion.div>

      {/* USAR NO POST */}
      <UsarNoPost
        ficha={usarHook}
        posts={posts.filter((p) => p.status !== "publicado")}
        onFechar={() => setUsarHook(null)}
        onEscolher={async (postId, titulo) => {
          if (!usarHook) return;
          try {
            await updatePost.mutateAsync({ id: postId, updates: { hook: usarHook.texto } });
            registrarUso.mutate({ tipo: "hook", id: usarHook.id, meu: usarHook.meu });
            toast.success(`O hook entrou em "${titulo}".`, { action: { label: "Abrir o Criando", onClick: () => navigate("/app/criando") } });
            setUsarHook(null);
          } catch { toast.error("Não consegui pôr o hook no post."); }
        }}
        onRascunho={async () => {
          if (!usarHook) return;
          try {
            const titulo = usarHook.texto.replace(/["“”]/g, "").slice(0, 80);
            await createPost.mutateAsync({ title: titulo, hook: usarHook.texto, status: "ideia", platform: "instagram", format: "reels" });
            registrarUso.mutate({ tipo: "hook", id: usarHook.id, meu: usarHook.meu });
            toast.success("Rascunho criado no Criando com esse hook.", { action: { label: "Abrir", onClick: () => navigate("/app/criando") } });
            setUsarHook(null);
          } catch { toast.error("Erro ao criar o rascunho."); }
        }}
      />

      {/* CRIAR/EDITAR O QUE É MEU */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="bg-background">
          <SheetHeader>
            <SheetTitle className="font-display">
              {editingId ? "Editar" : "Guardar"} {sheetType === "hook" ? "hook" : sheetType === "format" ? "formato" : "prompt"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {sheetType === "hook" && (
              <>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Tipo</Label>
                  <Select value={formData.category || ""} onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{HOOK_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Texto do hook</Label>
                  <Textarea value={formData.hook_text || ""} onChange={(e) => setFormData((p) => ({ ...p, hook_text: e.target.value }))} placeholder="Ex: Eu errei isso por 2 anos" className="rounded-xl" />
                </div>
              </>
            )}
            {sheetType === "format" && (
              <>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Nome</Label>
                  <Input value={formData.name || ""} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: Carrossel educativo" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Rede</Label>
                  <Select value={formData.platform || ""} onValueChange={(v) => setFormData((p) => ({ ...p, platform: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Estrutura</Label>
                  <Textarea value={formData.structure || ""} onChange={(e) => setFormData((p) => ({ ...p, structure: e.target.value }))} placeholder="Descreva a estrutura..." className="rounded-xl min-h-[100px]" />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Dica (opcional)</Label>
                  <Input value={formData.tips || ""} onChange={(e) => setFormData((p) => ({ ...p, tips: e.target.value }))} className="rounded-xl" />
                </div>
              </>
            )}
            {sheetType === "prompt" && (
              <>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Tipo</Label>
                  <Select value={formData.category || ""} onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {["ideia", "legenda", "roteiro", "reels", "carrossel", "storytelling", "geral"].map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Título</Label>
                  <Input value={formData.title || ""} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Texto do prompt</Label>
                  <Textarea value={formData.prompt_text || ""} onChange={(e) => setFormData((p) => ({ ...p, prompt_text: e.target.value }))} placeholder="Use [COLCHETES] para o que muda..." className="rounded-xl min-h-[120px]" />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Dica (opcional)</Label>
                  <Input value={formData.tip || ""} onChange={(e) => setFormData((p) => ({ ...p, tip: e.target.value }))} className="rounded-xl" />
                </div>
              </>
            )}
            <Button variant="hero" className="w-full" onClick={saveItem}>{editingId ? "Salvar" : "Guardar"}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

/* UMA FICHA DO FICHÁRIO */
function FichaCard({ f, vezes, favorito, podeFavoritar, onCopiar, onFavoritar, onUsar, onEditar, onExcluir }: {
  f: Ficha; vezes: number; favorito: boolean; podeFavoritar: boolean;
  onCopiar: () => void; onFavoritar: () => void; onUsar?: () => void; onEditar?: () => void; onExcluir?: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const longo = f.aba !== "hooks";
  const meta = [
    ...f.redes.map((r) => REDE[r] ?? r),
    f.formato && f.aba === "templates" ? FORMATO[f.formato] ?? f.formato : null,
    f.usoTipo ? (vezes ? `usado ${vezes}x` : "nunca usado") : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="relative flex flex-col rounded-[18px] border-2 border-foreground bg-card p-4 pt-5 shadow-[4px_4px_0_hsl(var(--foreground))]">
      <span className="absolute -top-3 left-4 rounded-full border-2 border-foreground px-2.5 py-0.5 text-[10px] font-body font-extrabold uppercase tracking-wider text-[#1D1B18]"
        style={{ background: f.meu ? "#fff" : corDoTipo(f.tag) }}>
        {f.meu ? `Meu · ${f.tag}` : f.tag}
      </span>

      {f.titulo && <p className="font-display font-extrabold text-[15px] leading-tight mb-1.5">{f.titulo}</p>}
      {f.aba === "hooks" ? (
        <p className="font-body font-bold text-[15.5px] leading-snug text-foreground">“{f.texto}”</p>
      ) : f.aba === "prompts" ? (
        <p className={cn("text-[13px] font-body text-foreground/85 leading-relaxed whitespace-pre-line", !aberto && "line-clamp-5")}>
          {f.texto.split(/(\[[^\]]+\])/).map((part, j) => part.startsWith("[") ? <span key={j} className="text-[#EB4918] font-bold">{part}</span> : <span key={j}>{part}</span>)}
        </p>
      ) : (
        <p className={cn("text-[13px] font-body text-foreground/85 leading-relaxed whitespace-pre-line rounded-lg bg-muted/50 px-3 py-2", !aberto && "line-clamp-5")}>{f.texto}</p>
      )}
      {longo && f.texto.length > 180 && (
        <button type="button" onClick={() => setAberto((v) => !v)} className="self-start mt-1 text-[11.5px] font-body font-semibold text-muted-foreground underline">
          {aberto ? "ver menos" : "ver tudo"}
        </button>
      )}

      {f.exemplo && (
        <div className="mt-2.5 rounded-lg border-l-4 border-[#FFCF03] bg-[#FFF8DC] dark:bg-amber-950/30 px-3 py-2 text-[12.5px] font-body leading-snug text-foreground/85">
          <b>Exemplo:</b> “{f.exemplo}”
        </div>
      )}
      {f.dica && f.aba !== "hooks" && (
        <p className="mt-2 text-[12px] font-body text-muted-foreground leading-snug">{f.dica}</p>
      )}

      <p className="mt-2.5 text-[11.5px] font-body text-muted-foreground">{meta}</p>

      <div className="mt-auto pt-3 flex flex-wrap items-center gap-1.5">
        {onUsar && (
          <button type="button" onClick={onUsar} className="h-8 rounded-full bg-foreground text-background px-3.5 text-xs font-body font-extrabold">
            {f.template ? "Usar template" : "Usar no post"}
          </button>
        )}
        <button type="button" onClick={() => { onCopiar(); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}
          className="h-8 rounded-full border border-border bg-background px-3 text-xs font-body font-bold inline-flex items-center gap-1">
          {copiado ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copiado ? "Copiado" : "Copiar"}
        </button>
        {onEditar && (
          <button type="button" onClick={onEditar} className="h-8 rounded-full border border-border bg-background px-3 text-xs font-body font-bold inline-flex items-center gap-1">
            <Pencil className="h-3 w-3" /> Editar
          </button>
        )}
        <span className="ml-auto flex items-center gap-1">
          {onExcluir && (
            <button type="button" onClick={onExcluir} aria-label="Excluir" className="h-8 w-8 grid place-items-center rounded-full text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {podeFavoritar && (
            <button type="button" onClick={onFavoritar} aria-label={favorito ? "Tirar dos favoritos" : "Favoritar"}
              className={cn("h-8 w-8 grid place-items-center rounded-full border", favorito ? "border-[#E0A800] bg-[#FFF3B0]" : "border-border bg-background")}>
              <Star className={cn("h-3.5 w-3.5", favorito ? "fill-[#E0A800] text-[#E0A800]" : "text-muted-foreground")} />
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

/* ESCOLHER O POST QUE RECEBE O HOOK */
function UsarNoPost({ ficha, posts, onFechar, onEscolher, onRascunho }: {
  ficha: Ficha | null;
  posts: { id: string; title: string | null; status: string | null; hook?: string | null; scheduled_date?: string | null }[];
  onFechar: () => void;
  onEscolher: (id: string, titulo: string) => Promise<void>;
  onRascunho: () => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const lista = useMemo(() => {
    const t = norm(q.trim());
    return posts.filter((p) => !t || norm(p.title ?? "").includes(t)).slice(0, 40);
  }, [posts, q]);
  const STATUS: Record<string, string> = { ideia: "Ideia", roteiro: "Roteiro", gravando: "Produzindo", editando: "Editando", agendado: "Agendado" };

  return (
    <Dialog open={!!ficha} onOpenChange={(o) => { if (!o) { setQ(""); onFechar(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="font-display text-lg pr-8">Usar este hook num post</DialogTitle>
        {ficha && <p className="-mt-2 rounded-xl bg-[#FFF8DC] px-3 py-2 text-[13.5px] font-body font-bold">“{ficha.texto}”</p>}
        <button type="button" disabled={ocupado} onClick={async () => { setOcupado(true); try { await onRascunho(); } finally { setOcupado(false); } }}
          className="w-full h-11 rounded-full bg-foreground text-background font-body font-extrabold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
          <Plus className="h-4 w-4" /> Criar um rascunho novo com ele
        </button>
        <div>
          <p className="text-[12px] font-body font-bold uppercase tracking-wide text-muted-foreground mb-2">Ou pôr num post que já está na produção</p>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar post pelo título" className="rounded-full mb-2" />
          <div className="max-h-[40vh] overflow-y-auto space-y-1.5 pr-1">
            {lista.length === 0 ? (
              <p className="text-[13px] font-body text-muted-foreground py-4 text-center">Nenhum post em produção{q ? " com esse título" : ""}.</p>
            ) : lista.map((p) => (
              <button key={p.id} type="button" disabled={ocupado}
                onClick={async () => { setOcupado(true); try { await onEscolher(p.id, p.title || "Sem título"); } finally { setOcupado(false); } }}
                className="w-full text-left flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 hover:border-foreground/40 disabled:opacity-60">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-body font-semibold truncate">{p.title || "Sem título"}</span>
                  <span className="block text-[11.5px] font-body text-muted-foreground truncate">
                    {STATUS[p.status ?? ""] ?? p.status}{p.hook ? " · já tem hook, vai trocar" : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default Biblioteca;
