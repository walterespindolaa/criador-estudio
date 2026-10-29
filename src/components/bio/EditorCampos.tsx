import { useRef, useState } from "react";
import { ChevronDown, ImagePlus, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ICONES_BLOCO, iconeLucide } from "@/lib/bioIcones";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { validateUpload } from "@/lib/upload-validation";
import { cn } from "@/lib/utils";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { FORMAS_DA_FOTO, formaValida, type FormaDaFoto } from "@/lib/bioFoto";

/* Peças comuns dos formulários de bloco. Moram aqui, e não no EditorBlocos,
   pra que os formulários de outros arquivos usem as mesmas sem import
   circular. */

export function LinhaCampo({ label, ajuda, children }: { label: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="font-body text-xs">{label}</Label>
      {children}
      {ajuda && <p className="text-[11px] font-body text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

/** Sobe imagem pro bucket público. A pasta é a de quem está logado porque a
 *  policy do bucket compara com auth.uid(). */
export function useUploadBio() {
  const { user } = useAuth();
  const [subindo, setSubindo] = useState(false);
  const enviar = async (file: File, prefixo: string): Promise<string | null> => {
    const v = validateUpload(file, "bioMedia");
    if (!v.ok) { toast.error(v.reason); return null; }
    setSubindo(true);
    try {
      const caminho = `${user?.id}/${prefixo}-${Date.now()}.${file.name.split(".").pop() ?? "jpg"}`;
      const { error } = await supabase.storage.from("bio-media")
        .upload(caminho, file, { upsert: true, contentType: file.type || "image/jpeg" });
      if (error) { toast.error("Não consegui enviar a imagem."); return null; }
      return supabase.storage.from("bio-media").getPublicUrl(caminho).data.publicUrl;
    } finally { setSubindo(false); }
  };
  return { enviar, subindo };
}

/* ── A FORMA DA FOTO (Walter, 20/09/2026) ──────────────────────────────────
   "não faz sentido eu não conseguir colocar uma imagem horizontal num lugar
   que é pra imagem ficar horizontal".

   Ele estava certo, e o problema era pior do que faltar a opção: o recorte
   aqui era fixo em 3:4 (em pé) e a página pública desenhava o mesmo bloco em
   16:9 (deitado). A foto era cortada duas vezes, em direções opostas: primeiro
   viravam as laterais em pé, depois o miolo dessa tira era esticado deitado.
   Daí a sensação de "fica tudo zoado", que não era sensação.

   Agora a forma é UMA decisão, tomada aqui, e a página obedece. A escolha fica
   guardada no bloco, junto da foto, porque é dela: dois blocos de texto podem
   querer formas diferentes na mesma página. */

export function BotaoImagem({ valor, onTroca, rotulo, forma, onForma, aspecto }: {
  valor: string;
  /** Proporção do recorte quando o bloco tem formato próprio (ex.: galeria). */
  aspecto?: number;
  onTroca: (url: string) => void;
  rotulo: string;
  /** Vazio = bloco antigo, que nasceu antes desta escolha existir. */
  forma?: string;
  onForma?: (f: FormaDaFoto) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const { enviar, subindo } = useUploadBio();
  /* ENQUADRAR ANTES DE SUBIR. A foto sai do celular em qualquer proporção e o
     `object-cover` cortava por conta própria, quase sempre pela cabeça. Aqui a
     pessoa escolhe o pedaço que importa, com zoom, e o que sobe já é o
     recorte: a página nunca mais decide isso sozinha. */
  const [paraCortar, setParaCortar] = useState<string | null>(null);
  const [formaAtual, setFormaAtual] = useState<FormaDaFoto>(formaValida(forma ?? ""));

  const subirRecorte = async (blob: Blob) => {
    const arquivo = new File([blob], "imagem.jpg", { type: blob.type || "image/jpeg" });
    const url = await enviar(arquivo, "bloco");
    if (url) { onTroca(url); onForma?.(formaAtual); }
    setParaCortar(null);
  };

  /* Trocar a forma com foto no ar reabre o recorte na hora: o arquivo tem que
     nascer na proporção nova, senão a página mostra a antiga esticada. */
  const escolherForma = (f: FormaDaFoto) => {
    setFormaAtual(f);
    if (valor) setParaCortar(valor);
    else onForma?.(f);
  };

  return (
    <div className="space-y-2">
      {onForma && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-body text-muted-foreground">Formato:</span>
          {(Object.keys(FORMAS_DA_FOTO) as FormaDaFoto[]).map((f) => (
            <button key={f} type="button" onClick={() => escolherForma(f)}
              className={cn("rounded-lg border px-2.5 py-1 text-[11px] font-body font-semibold transition-colors min-h-[28px]",
                formaAtual === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {FORMAS_DA_FOTO[f].rotulo}
            </button>
          ))}
        </div>
      )}
    <div className="flex items-center gap-2.5">
      <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0 grid place-items-center border border-border">
        {valor ? <img src={valor} alt="" className="w-full h-full object-cover" />
          : <ImagePlus className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            setParaCortar(URL.createObjectURL(f));
          }} />
        <Button type="button" size="sm" variant="outline" disabled={subindo} onClick={() => ref.current?.click()}>
          {subindo && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}{valor ? "Trocar" : rotulo}
        </Button>
        {valor && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setParaCortar(valor)}>Enquadrar</Button>
        )}
        {valor && <Button type="button" size="sm" variant="ghost" onClick={() => onTroca("")}>Remover</Button>}
      </div>

      {paraCortar && (
        <ImageCropModal
          open
          onOpenChange={(v) => { if (!v) setParaCortar(null); }}
          imageSrc={paraCortar}
          cropShape="rect"
          aspectRatio={aspecto ?? FORMAS_DA_FOTO[formaAtual].ratio}
          onCropComplete={(blob) => void subirRecorte(blob)} />
      )}
    </div>
    </div>
  );
}


/** Fundo da seção. Página inteira branca cansa e some: a alternância é o que
 *  dá ritmo à rolagem. */
export function EscolherFundo({ valor, onTroca }: { valor: string; onTroca: (v: string) => void }) {
  const opcoes: { v: string; r: string; amostra: string }[] = [
    { v: "claro", r: "Branco", amostra: "#FFFFFF" },
    { v: "creme", r: "Creme", amostra: "#F7F5EF" },
    { v: "escuro", r: "Escuro", amostra: "#101014" },
    { v: "marca", r: "Cor da marca", amostra: "" },
  ];
  return (
    <LinhaCampo label="Fundo da seção" ajuda="Alterne entre as seções pra a página não virar uma parede só.">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {opcoes.map((o) => (
          <button key={o.v} type="button" onClick={() => onTroca(o.v)}
            className={cn("rounded-xl border-2 px-2.5 py-2 flex items-center gap-2 text-left transition-all",
              valor === o.v ? "border-primary bg-primary/5" : "border-border hover:border-primary/30")}>
            <span className="w-5 h-5 rounded-md border border-border shrink-0"
              style={o.amostra ? { backgroundColor: o.amostra } : { background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/.6))" }} />
            <span className="text-[12px] font-body font-medium truncate">{o.r}</span>
          </button>
        ))}
      </div>
    </LinhaCampo>
  );
}

/* ── ESCOLHA DO ÍCONE DO BOTÃO ──
   Grade fechada de ícones (pedido do Walter, 01/09): o campo de emoji livre
   deixava cada botão de um jeito. Tocar escolhe, tocar de novo tira, e o
   "Sem ícone" também tira. Emoji antigo continua valendo até a pessoa trocar. */
export function SeletorIcone({ valor, onTroca }: { valor: string; onTroca: (v: string) => void }) {
  /* Fechado por padrão (pedido do Walter, 01/09): 26 ícones abertos ocupavam
     duas linhas do formulário por uma escolha que se faz uma vez. Agora é um
     campo só que mostra o escolhido; a grade abre por cima quando quer trocar. */
  const [aberto, setAberto] = useState(false);
  const IconeAtual = iconeLucide(valor);
  const nomeAtual = valor.startsWith("lucide:")
    ? ICONES_BLOCO.find((i) => `lucide:${i.id}` === valor)?.nome ?? "Ícone"
    : "";
  const ehEmojiAntigo = !!valor && !valor.startsWith("lucide:");
  const escolher = (v: string) => { onTroca(v); setAberto(false); };
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button type="button"
          className="w-full sm:w-64 h-10 flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-left text-sm hover:border-primary/40 transition-colors">
          <span className="flex items-center gap-2 min-w-0 text-foreground">
            {IconeAtual && <IconeAtual className="h-4 w-4 shrink-0 text-primary" />}
            {ehEmojiAntigo && <span aria-hidden className="text-base leading-none">{valor}</span>}
            <span className={cn("truncate", !valor && "text-muted-foreground")}>
              {IconeAtual ? nomeAtual : ehEmojiAntigo ? "Emoji atual" : "Sem ícone"}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(320px,calc(100vw-2rem))] p-2 rounded-2xl">
        <button type="button" onClick={() => escolher("")}
          className={cn(
            "w-full h-9 mb-1.5 rounded-lg border text-[12px] font-body font-semibold transition-colors",
            !valor ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}>
          Sem ícone
        </button>
        <div className="grid grid-cols-7 gap-1.5">
          {ICONES_BLOCO.map((i) => {
            const ativo = valor === `lucide:${i.id}`;
            return (
              <button key={i.id} type="button" title={i.nome} aria-label={i.nome}
                onClick={() => escolher(ativo ? "" : `lucide:${i.id}`)}
                className={cn(
                  "w-9 h-9 grid place-items-center rounded-lg border transition-colors",
                  ativo ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40",
                )}>
                <i.Icone className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
