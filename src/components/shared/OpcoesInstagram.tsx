import { useEffect, useState } from "react";
import { Loader2, Music, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ehStory, useCotaIg, useSalvarOpcoesIg, type OpcoesIg } from "@/hooks/usePublicarInstagram";

/* ═══════════════════════════════════════════════════════════════════════════
   OPÇÕES DO INSTAGRAM DO POST (Walter, 28/10/2026)

   Tudo opcional. Cada formato só mostra o que a Meta aceita pra ele
   (documentação IG User Media, 10/2026):
     - collab (até 3 perfis): foto, Reels e carrossel; story não;
     - marcar pessoas: foto, carrossel (1ª imagem), Reels e story;
     - texto alternativo: só imagem (foto e 1ª imagem do carrossel);
     - Reels de teste: só Reels (mostra antes pra quem não segue);
     - mostrar na grade do perfil: só Reels;
     - música da biblioteca do Instagram não sai pela API: o post vira
       "pelo celular" e o Cria não publica sozinho.
   Localização ficou de fora: a Meta só aceita o ID de uma página do Facebook
   com endereço, e a busca dessas páginas exige o login do Facebook.
   ═══════════════════════════════════════════════════════════════════════════ */

const HANDLE = /^[A-Za-z0-9._]{1,30}$/;
const limpar = (s: string) => s.trim().replace(/^@/, "").toLowerCase();

export function OpcoesInstagram({
  postId, formato, inicial, open, onOpenChange,
}: {
  postId: string;
  formato: string | null | undefined;
  inicial: OpcoesIg | null | undefined;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const f = (formato ?? "").toLowerCase();
  const story = ehStory(f);
  const reels = f === "reels" || f === "video";
  const imagem = f === "foto" || f === "carrossel";
  const salvar = useSalvarOpcoesIg(postId);
  const { data: cota } = useCotaIg(postId, open);

  const [collab, setCollab] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [alt, setAlt] = useState("");
  const [trial, setTrial] = useState<OpcoesIg["trial"] | null>(null);
  const [feed, setFeed] = useState(true);
  const [musica, setMusica] = useState(false);
  const [figurinha, setFigurinha] = useState(false);
  const [novoCollab, setNovoCollab] = useState("");
  const [novaTag, setNovaTag] = useState("");

  useEffect(() => {
    if (!open) return;
    const o = inicial ?? {};
    setCollab(o.collaborators ?? []);
    setTags((o.user_tags ?? []).map((t) => t.username));
    setAlt(o.alt_text ?? "");
    setTrial(o.trial ?? null);
    setFeed(o.share_to_feed !== false);
    setMusica(!!o.musica_celular);
    setFigurinha(!!o.pelo_celular);
    setNovoCollab(""); setNovaTag("");
  }, [open, inicial]);

  const addCollab = () => {
    const h = limpar(novoCollab);
    if (!HANDLE.test(h) || collab.includes(h) || collab.length >= 3) return;
    setCollab([...collab, h]); setNovoCollab("");
  };
  const addTag = () => {
    const h = limpar(novaTag);
    if (!HANDLE.test(h) || tags.includes(h) || tags.length >= 20) return;
    setTags([...tags, h]); setNovaTag("");
  };

  const gravar = () => {
    const o: OpcoesIg = {
      collaborators: story ? [] : collab,
      // Sem tela de posição ainda: a marcação vai no centro da imagem.
      user_tags: tags.map((u) => ({ username: u, x: 0.5, y: 0.5 })),
    };
    if (imagem && alt.trim()) o.alt_text = alt.trim();
    if (reels && trial) o.trial = trial;
    if (reels) o.share_to_feed = feed;
    if (reels || story) o.musica_celular = musica;
    if (story) o.pelo_celular = figurinha;
    salvar.mutate(o, { onSuccess: () => onOpenChange(false) });
  };

  const chip = (txt: string, tirar: () => void) => (
    <span key={txt} className="inline-flex items-center gap-1 h-8 pl-3 pr-1 rounded-full bg-violet-100 text-violet-900 text-xs font-semibold">
      @{txt}
      <button type="button" aria-label={`Tirar @${txt}`} onClick={tirar} className="w-6 h-6 rounded-full grid place-items-center hover:bg-violet-200">
        <X className="h-3 w-3" />
      </button>
    </span>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] max-h-[92vh] overflow-y-auto rounded-3xl">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display">Opções do Instagram</DialogTitle>
          <DialogDescription className="text-xs">Tudo aqui é opcional. Só aparece o que o Instagram aceita neste formato.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {cota && cota.total > 0 && (
            <div className="rounded-xl bg-muted/60 px-3 py-2">
              <div className="flex justify-between text-xs"><span className="font-semibold">Cota da conta nas últimas 24 h</span><span className="text-muted-foreground">{cota.usado} de {cota.total} usadas</span></div>
              <div className="mt-1.5 h-1.5 rounded-full bg-border overflow-hidden">
                <div className={cn("h-full rounded-full", cota.usado / cota.total > 0.8 ? "bg-amber-500" : "bg-green-600")} style={{ width: `${Math.max(3, Math.min(100, (cota.usado / cota.total) * 100))}%` }} />
              </div>
            </div>
          )}

          {!story && (
            <section>
              <div className="flex justify-between items-baseline"><p className="text-sm font-bold">Convidar pra collab</p><span className="text-xs text-muted-foreground">{collab.length} de 3</span></div>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">O post aparece nos dois perfis depois que a pessoa aceitar o convite no app dela.</p>
              <div className="flex flex-wrap gap-1.5">{collab.map((c) => chip(c, () => setCollab(collab.filter((x) => x !== c))))}</div>
              {collab.length < 3 && (
                <div className="mt-2 flex gap-2">
                  <Input value={novoCollab} onChange={(e) => setNovoCollab(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCollab(); } }}
                    placeholder="@perfil" className="h-10 rounded-xl" aria-label="Perfil pra collab" />
                  <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={addCollab} disabled={!HANDLE.test(limpar(novoCollab))}>Adicionar</Button>
                </div>
              )}
            </section>
          )}

          <section>
            <p className="text-sm font-bold">Marcar pessoas</p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">
              {f === "carrossel" ? "A marcação vai na primeira imagem." : reels ? "Aparece na lista de pessoas do Reels." : "Só perfis públicos."}
            </p>
            <div className="flex flex-wrap gap-1.5">{tags.map((t) => chip(t, () => setTags(tags.filter((x) => x !== t))))}</div>
            <div className="mt-2 flex gap-2">
              <Input value={novaTag} onChange={(e) => setNovaTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="@perfil" className="h-10 rounded-xl" aria-label="Perfil pra marcar" />
              <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={addTag} disabled={!HANDLE.test(limpar(novaTag))}>Marcar</Button>
            </div>
          </section>

          {imagem && (
            <section>
              <label className="block">
                <span className="text-sm font-bold">Texto alternativo <span className="font-normal text-muted-foreground">(acessibilidade)</span></span>
                <Textarea value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={1000} rows={3} className="mt-2 rounded-xl text-sm"
                  placeholder="Descreva a imagem pra quem usa leitor de tela." />
              </label>
              {f === "carrossel" && <p className="text-xs text-muted-foreground mt-1">Vai na primeira imagem do carrossel.</p>}
            </section>
          )}

          {reels && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-sm font-bold">Reels de teste</p><p className="text-xs text-muted-foreground">Mostra primeiro só pra quem não segue. Não aparece no perfil até ir pro feed.</p></div>
                <Switch checked={!!trial} onCheckedChange={(v) => setTrial(v ? "SS_PERFORMANCE" : null)} aria-label="Reels de teste" />
              </div>
              {trial && (
                <div role="radiogroup" aria-label="Quando vai pro perfil" className="space-y-1.5">
                  {([["SS_PERFORMANCE", "Automático pelo desempenho", "Se for bem com quem não segue, o Instagram leva pro perfil sozinho."],
                    ["MANUAL", "Eu decido depois", "Fica em teste; você leva pro perfil pelo app do Instagram."]] as const).map(([k, nome, desc]) => (
                    <button key={k} type="button" role="radio" aria-checked={trial === k} onClick={() => setTrial(k)}
                      className={cn("w-full text-left flex gap-2.5 rounded-xl border px-3 py-2.5", trial === k ? "border-foreground bg-muted/50" : "border-border")}>
                      <span className={cn("mt-0.5 w-4 h-4 rounded-full shrink-0 border-2", trial === k ? "border-[5px] border-foreground" : "border-muted-foreground/50")} />
                      <span><span className="block text-[13px] font-semibold">{nome}</span><span className="block text-xs text-muted-foreground">{desc}</span></span>
                    </button>
                  ))}
                </div>
              )}
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-[13px]">Também mostrar na grade do perfil</span>
                <Switch checked={feed} onCheckedChange={setFeed} aria-label="Mostrar na grade do perfil" />
              </label>
            </section>
          )}

          {story && (
            <section>
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-sm font-bold">Vai ter figurinha?</p><p className="text-xs text-muted-foreground">Enquete, caixinha, quiz, link ou contagem não saem pela API.</p></div>
                <Switch checked={figurinha} onCheckedChange={setFigurinha} aria-label="Story com figurinha" />
              </div>
              {figurinha && (
                <p className="mt-2 text-xs rounded-xl bg-sky-50 border border-sky-200 text-sky-900 px-3 py-2">
                  Então este story sai pelo celular: baixe a mídia no post, publique pelo app do Instagram e coloque a figurinha lá. No Cria Stories, marque "Já postei".
                </p>
              )}
            </section>
          )}

          {(reels || story) && (
            <section>
              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-2">
                  <Music className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div><p className="text-sm font-bold">Vai usar música do Instagram?</p><p className="text-xs text-muted-foreground">Pela API só sai o áudio que já está no vídeo.</p></div>
                </div>
                <Switch checked={musica} onCheckedChange={setMusica} aria-label="Vai usar música do Instagram" />
              </div>
              {musica && (
                <p className="mt-2 text-xs rounded-xl bg-sky-50 border border-sky-200 text-sky-900 px-3 py-2">
                  Então este post sai pelo celular: o Cria não publica sozinho. Baixe a mídia e a legenda no post e publique pelo app com a música.
                </p>
              )}
            </section>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1 h-11 rounded-full" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" className="flex-1 h-11 rounded-full" onClick={gravar} disabled={salvar.isPending}>
            {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar opções"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
