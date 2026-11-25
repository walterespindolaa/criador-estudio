import { useRef, useState, type KeyboardEvent } from "react";
import { ImagePlus, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { capFullImage } from "@/lib/image-compress";
import {
  YT_CATEGORIAS, YT_IDIOMAS, YT_TAGS_MAX, YT_TITULO_MAX, YT_TITULO_VISIVEL,
  contarTags, hashtagsDaDescricao, problemasDosCapitulos, separarTags, type Capitulo, type YoutubeDoPost,
} from "@/lib/youtube";

/* ═══════════════════════════════════════════════════════════════════════════
   CAMPOS DO POST DE YOUTUBE NO EDITOR (Walter, 25/11/2026, mockup aprovado:
   "ja adaptado para o youtube com tags, hashtags, etc?" e "MOBILE FIRST").

   Título do vídeo separado do nome do post, tags com o contador de 500 do
   YouTube, miniatura, categoria e idioma. A descrição continua sendo a
   legenda do post; os capítulos saem do roteiro (minuto de cada bloco).
   ═══════════════════════════════════════════════════════════════════════════ */

const ROTULO = "text-[11px] font-body font-extrabold uppercase tracking-[0.06em] text-muted-foreground";
const CARTAO = "rounded-[22px] border border-border bg-card p-3.5 space-y-2.5";
const BOTAO_IA = "inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary/10 text-primary text-[12.5px] font-body font-extrabold hover:bg-primary/15 disabled:opacity-60";
const TOM_TAG = ["bg-[#ffe4f1]", "bg-[#e3edff]", "bg-[#fff6cc]"];

type Contexto = { userId: string; formato: string; nicho?: string | null; pilar?: string | null; descricao: string; roteiro: string };

async function pedirIA(pede: "titulos" | "tags", titulo: string, c: Contexto): Promise<string[]> {
  const r = await callAIContextBuilder({
    userId: c.userId,
    operation: "youtube-meta",
    data: { pede, titulo, formato: c.formato, nicho: c.nicho, pilar: c.pilar, descricao: c.descricao, roteiro: c.roteiro },
  });
  const bruto = typeof r === "string" ? r : JSON.stringify(r ?? "");
  const m = bruto.replace(/```json?|```/g, "").match(/\[[\s\S]*\]/);
  try {
    const arr = JSON.parse(m ? m[0] : bruto);
    if (Array.isArray(arr)) return arr.map(String).map((s) => s.replace(/[<>]/g, "").trim()).filter(Boolean);
  } catch { /* cai na separação por linha */ }
  return bruto.split(/\n+/).map((s) => s.replace(/^[-\d.)\s"]+|"$/g, "").trim()).filter(Boolean);
}

/** Título do vídeo, com a régua dos ~70 caracteres que aparecem no celular. */
export function TituloYouTube({ valor, onChange, tituloPost, ctx }: {
  valor: string; onChange: (v: string) => void; tituloPost: string; ctx: Contexto;
}) {
  const [carregando, setCarregando] = useState(false);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const n = valor.length;
  const visivel = Math.min(n, YT_TITULO_VISIVEL) / YT_TITULO_MAX * 100;
  const passou = Math.max(0, n - YT_TITULO_VISIVEL) / YT_TITULO_MAX * 100;
  const sugerir = async () => {
    setCarregando(true);
    try { setSugestoes((await pedirIA("titulos", valor || tituloPost, ctx)).slice(0, 3).map((t) => t.slice(0, YT_TITULO_MAX))); }
    catch { toast.error("A Cria IA não respondeu agora. Tenta de novo."); }
    finally { setCarregando(false); }
  };
  return (
    <div className={CARTAO}>
      <div className="flex items-center gap-2">
        <p className={ROTULO}>Título do vídeo</p>
        <span className={cn("ml-auto text-[12px] font-body font-bold tabular-nums", n > YT_TITULO_VISIVEL ? "text-amber-700" : "text-emerald-700")}>{n}/{YT_TITULO_MAX}</span>
      </div>
      <textarea
        value={valor}
        maxLength={YT_TITULO_MAX}
        rows={3}
        onChange={(e) => onChange(e.target.value.replace(/[<>\n]/g, ""))}
        placeholder={tituloPost || "O título que vai aparecer no YouTube"}
        className="w-full resize-none bg-transparent font-display text-[18px] font-bold leading-snug text-foreground placeholder:text-muted-foreground/40 outline-none"
      />
      <div className="flex h-[7px] overflow-hidden rounded-full bg-muted">
        <i className="block bg-emerald-600" style={{ width: `${visivel}%` }} />
        <i className="block bg-amber-500" style={{ width: `${passou}%` }} />
      </div>
      <p className="text-[11.5px] font-body font-semibold text-muted-foreground">
        {n > YT_TITULO_VISIVEL
          ? `No celular aparecem uns ${YT_TITULO_VISIVEL} caracteres: o fim vira "...".`
          : "Aparece inteiro na busca do celular. A palavra que a pessoa procura vai no começo."}
      </p>
      <button type="button" className={BOTAO_IA} disabled={carregando} onClick={() => void sugerir()}>
        {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}3 títulos que buscam bem
      </button>
      {sugestoes.length > 0 && (
        <div className="space-y-1.5">
          {sugestoes.map((s) => (
            <button key={s} type="button" onClick={() => { onChange(s); setSugestoes([]); }}
              className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-left text-[13.5px] font-body leading-snug hover:border-primary/50">
              {s} <span className="text-[11px] text-muted-foreground">({s.length})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tags (contador de 500 do YouTube), miniatura, categoria e idioma. */
export function ExtrasYouTube({ yt, onChange, ctx, tituloAtual, categoriaPadrao }: {
  yt: YoutubeDoPost; onChange: (patch: Partial<YoutubeDoPost>) => void; ctx: Contexto; tituloAtual: string; categoriaPadrao: string;
}) {
  const tags = yt.tags ?? [];
  const usados = contarTags(tags);
  const [rascunho, setRascunho] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [subindo, setSubindo] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  const somar = (novas: string[]) => {
    const junto = separarTags([...tags, ...novas].join(","));
    const cabem: string[] = [];
    for (const t of junto) if (contarTags([...cabem, t]) <= YT_TAGS_MAX) cabem.push(t);
    if (cabem.length < junto.length) toast("Algumas tags ficaram de fora: o YouTube aceita 500 caracteres somando tudo.");
    onChange({ tags: cabem });
  };
  const teclar = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && rascunho.trim()) { e.preventDefault(); somar([rascunho]); setRascunho(""); }
    if (e.key === "Backspace" && !rascunho && tags.length) onChange({ tags: tags.slice(0, -1) });
  };
  const sugerir = async () => {
    setCarregando(true);
    try { somar(await pedirIA("tags", tituloAtual, ctx)); }
    catch { toast.error("A Cria IA não respondeu agora. Tenta de novo."); }
    finally { setCarregando(false); }
  };

  /* Miniatura: JPEG de até 1280px (o tamanho que o YouTube recomenda), no
     Storage da conta. Atalho assumido: fica fora da cota de armazenamento
     porque passa de 2 MB nunca (o YouTube recusa acima disso). */
  const subir = async (f: File) => {
    if (!f.type.startsWith("image/")) { toast.error("Escolha uma imagem (JPG ou PNG)."); return; }
    setSubindo(true);
    try {
      const pronto = await capFullImage(f, 1280, 0.88);
      if (pronto.size > 2 * 1024 * 1024) { toast.error("A miniatura passou de 2 MB. Use uma imagem menor."); return; }
      const path = `${ctx.userId}/yt-miniatura-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("media").upload(path, pronto, { upsert: true, contentType: pronto.type || "image/jpeg" });
      if (error) throw error;
      const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      if (yt.miniatura_path) void supabase.storage.from("media").remove([yt.miniatura_path]);
      onChange({ miniatura_url: url, miniatura_path: path });
    } catch (e) {
      toast.error(`Não deu pra subir a miniatura: ${(e as Error).message}`);
    } finally {
      setSubindo(false);
    }
  };
  const tirar = () => {
    if (yt.miniatura_path) void supabase.storage.from("media").remove([yt.miniatura_path]);
    onChange({ miniatura_url: null, miniatura_path: null });
  };

  const pct = Math.min(1, usados / YT_TAGS_MAX);
  const C = 2 * Math.PI * 17;
  return (
    <div className="space-y-3">
      <div className={CARTAO}>
        <p className={ROTULO}>Tags</p>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t, i) => (
            <span key={t} className={cn("inline-flex items-center gap-1 rounded-full pl-2.5 pr-1 py-1 text-[12.5px] font-body font-bold text-foreground", TOM_TAG[i % 3])}>
              {t}
              <button type="button" aria-label={`Tirar ${t}`} onClick={() => onChange({ tags: tags.filter((x) => x !== t) })}
                className="grid h-5 w-5 place-items-center rounded-full hover:bg-black/10"><X className="h-3 w-3" /></button>
            </span>
          ))}
          <input value={rascunho} onChange={(e) => setRascunho(e.target.value)} onKeyDown={teclar}
            onBlur={() => { if (rascunho.trim()) { somar([rascunho]); setRascunho(""); } }}
            placeholder={tags.length ? "mais uma" : "digite e aperte vírgula"}
            className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-[13px] font-body outline-none placeholder:text-muted-foreground/50" />
        </div>
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 42 42" className="h-10 w-10 shrink-0" aria-hidden>
            <circle cx="21" cy="21" r="17" fill="none" className="stroke-muted" strokeWidth="5" />
            <circle cx="21" cy="21" r="17" fill="none" stroke={pct > 0.9 ? "#d97706" : "#00A652"} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 21 21)" />
          </svg>
          <p className="text-[12px] font-body leading-snug text-muted-foreground">
            <b className="text-[13px] text-foreground tabular-nums">{usados} de {YT_TAGS_MAX}</b><br />caracteres somando tudo (vírgula e aspas contam)
          </p>
        </div>
        <button type="button" className={BOTAO_IA} disabled={carregando} onClick={() => void sugerir()}>
          {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Sugerir tags
        </button>
      </div>

      <div className={cn(CARTAO, "relative")}>
        <span className="absolute -top-3 left-3 -rotate-6 rounded-full border-[2.5px] border-background bg-[#FFCF03] px-2.5 py-1 font-display text-[12px] font-extrabold leading-none text-foreground shadow-[2px_3px_0_rgba(10,10,10,.12)]">vale pra Short</span>
        <p className={cn(ROTULO, "pt-1")}>Miniatura</p>
        {yt.miniatura_url ? (
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-muted">
            <img src={yt.miniatura_url} alt="Miniatura do vídeo" className="h-full w-full object-cover" />
          </div>
        ) : (
          <button type="button" onClick={() => arquivo.current?.click()} disabled={subindo}
            className="grid aspect-video w-full place-items-center rounded-2xl border-2 border-dashed border-primary/35 bg-primary/5 text-primary">
            <span className="flex flex-col items-center gap-1.5 text-[13px] font-body font-bold">
              {subindo ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
              {subindo ? "Subindo..." : "Escolher a capa do vídeo"}
            </span>
          </button>
        )}
        <input ref={arquivo} type="file" accept="image/jpeg,image/png" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void subir(f); }} />
        {yt.miniatura_url && (
          <div className="flex gap-2">
            <button type="button" onClick={() => arquivo.current?.click()} disabled={subindo}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-card text-[12.5px] font-body font-extrabold">
              {subindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}Trocar
            </button>
            <button type="button" onClick={tirar}
              className="flex h-10 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 text-[12.5px] font-body font-extrabold text-muted-foreground">
              <Trash2 className="h-4 w-4" />Tirar
            </button>
          </div>
        )}
        <p className="text-[11.5px] font-body leading-snug text-muted-foreground">
          1280 x 720, até 2 MB. Sobe depois que o YouTube processa o vídeo. Se o canal ainda não puder usar capa própria, o Cria avisa e fica a automática.
        </p>
      </div>

      <div className={CARTAO}>
        <p className={ROTULO}>Categoria e idioma</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="rounded-2xl border border-border bg-background px-2.5 py-1.5">
            <span className="block text-[10.5px] font-body font-extrabold uppercase tracking-[0.05em] text-muted-foreground">Categoria</span>
            <select value={yt.categoria ?? categoriaPadrao} onChange={(e) => onChange({ categoria: e.target.value })}
              className="w-full bg-transparent text-[13.5px] font-body font-bold outline-none">
              {YT_CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label className="rounded-2xl border border-border bg-background px-2.5 py-1.5">
            <span className="block text-[10.5px] font-body font-extrabold uppercase tracking-[0.05em] text-muted-foreground">Idioma</span>
            <select value={yt.idioma ?? "pt-BR"} onChange={(e) => onChange({ idioma: e.target.value })}
              className="w-full bg-transparent text-[13.5px] font-body font-bold outline-none">
              {YT_IDIOMAS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
        </div>
        <p className="text-[11.5px] font-body text-muted-foreground">Lista do YouTube pro Brasil. Começa pelo nicho do seu perfil.</p>
      </div>
    </div>
  );
}

/** Embaixo da descrição: hashtags, capítulos e o botão que põe os capítulos no texto. */
export function ChecagemYouTube({ texto, capitulos, ehVideo, onPorCapitulos }: {
  texto: string; capitulos: Capitulo[]; ehVideo: boolean; onPorCapitulos: () => void;
}) {
  const hs = hashtagsDaDescricao(texto);
  const problemas = problemasDosCapitulos(capitulos);
  const ok = "text-emerald-700 font-bold";
  const av = "text-amber-700 font-bold";
  return (
    <div className="space-y-2">
      <div className="space-y-0.5 text-[12px] font-body leading-snug">
        {hs.length === 0 && <p className="text-muted-foreground">• Sem hashtag. As 3 primeiras aparecem em cima do título.</p>}
        {hs.length > 0 && hs.length <= 60 && (
          <p className={ok}>✓ Em cima do título vão {hs.slice(0, 3).join(" ")}</p>
        )}
        {hs.length > 60 && <p className={av}>• {hs.length} hashtags: com mais de 60 o YouTube ignora todas.</p>}
        {ehVideo && capitulos.length > 0 && (problemas.length
          ? problemas.map((p) => <p key={p} className={av}>• {p}</p>)
          : <p className={ok}>✓ {capitulos.length} capítulos prontos pro YouTube</p>)}
        {ehVideo && capitulos.length === 0 && (
          <p className="text-muted-foreground">• Pra ter capítulos, ponha o minuto em cada bloco do roteiro (o primeiro em 00:00).</p>
        )}
      </div>
      {ehVideo && capitulos.length > 0 && problemas.length === 0 && (
        <button type="button" onClick={onPorCapitulos} className={BOTAO_IA}>
          <Sparkles className="h-3.5 w-3.5" />{/^Capítulos$/m.test(texto) ? "Atualizar capítulos na descrição" : "Pôr capítulos na descrição"}
        </button>
      )}
    </div>
  );
}
