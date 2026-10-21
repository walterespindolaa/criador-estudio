import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SalvarNoCelular } from "@/components/accounts/SalvarNoCelular";
import { podeSalvarNoCelular } from "@/lib/salvarNoCelular";
import { supabase, SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import type { MediaLike } from "@/lib/driveMedia";

/* ═══════════════════════════════════════════════════════════════════════════
   BAIXAR AS MÍDIAS DO POST (editor do criador, Walter, 13/10/2026)

   Antes, o botão de download do topo do editor gerava o PDF do ROTEIRO. No
   celular ele aparecia só com o ícone, então a criadora tocava esperando as
   fotos do carrossel e não vinha nada. Agora o botão do topo é das mídias:
     · celular: abre a gaveta "Salvar no celular" (vai direto pra Galeria);
     · computador: baixa um .zip com tudo numerado + legenda.txt.
   O PDF do roteiro foi pra perto do campo Roteiro, que é onde ele faz sentido.
   ═══════════════════════════════════════════════════════════════════════════ */

type Midia = MediaLike & { id: string; file_name: string };

/** `link`: versão compacta (texto roxo), usada no cabeçalho "Arquivos desta peça"
 *  do card da designer (Gabriela, 16/10/2026).
 *  `chip`: pílula na cor da conta, na linha "Mídia" do editor (Walter, 21/10/2026:
 *  o botão do topo ficava longe da mídia). */
export function BaixarMidiasDoPost({ postId, midias, titulo, rotulo: rotuloFixo, link, chip }: {
  postId: string; midias: Midia[]; titulo?: string; rotulo?: string; link?: boolean; chip?: boolean;
}) {
  const [celular] = useState(podeSalvarNoCelular);
  const [zipando, setZipando] = useState(false);
  if (midias.length === 0) return null;

  const rotulo = rotuloFixo ?? (midias.length === 1 ? "Baixar mídia" : `Baixar mídias (${midias.length})`);
  const linkCls = "inline-flex items-center gap-1 text-[12px] font-body font-bold text-violet-700 hover:underline disabled:opacity-60";
  const chipCls = "inline-flex items-center gap-1 h-7 rounded-full bg-primary/10 px-2.5 text-[11px] font-body font-bold text-primary hover:bg-primary/15 transition-colors disabled:opacity-60 shrink-0";
  const rotuloChip = `Baixar (${midias.length})`;

  if (celular) {
    return (
      <SalvarNoCelular
        midias={midias}
        titulo={titulo}
        gatilho={(abrir) => chip ? (
          <button type="button" className={chipCls} onClick={abrir}>
            <Download className="h-3.5 w-3.5" /> {rotuloChip}
          </button>
        ) : link ? (
          <button type="button" className={linkCls} onClick={abrir}>
            <Download className="h-3.5 w-3.5" /> {rotuloFixo ?? "Baixar todas"}
          </button>
        ) : (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={abrir}>
            <Download className="h-3.5 w-3.5" /> Mídias
          </Button>
        )}
      />
    );
  }

  // Mesmo .zip do Cria Post (criapost-download-zip já libera o dono do post).
  const baixarZip = async () => {
    setZipando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/criapost-download-zip`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ post_id: postId }),
      });
      if (!res.ok) {
        let motivo = `Erro ${res.status}`;
        try { const j = await res.json(); if (j?.error) motivo = String(j.error); } catch { /* corpo não-JSON */ }
        throw new Error(motivo);
      }
      const blob = await res.blob();
      const nome = res.headers.get("X-Zip-Filename") || "post.zip";
      const pulou = Number(res.headers.get("X-Zip-Skipped") || "0");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      if (pulou) toast.warning(`${pulou} mídia(s) não entraram (ex.: vídeo ou arquivo muito grande). Veja _avisos.txt no zip.`);
      else toast.success("Download pronto!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui gerar o zip.");
    } finally {
      setZipando(false);
    }
  };

  if (chip) {
    return (
      <button type="button" className={chipCls} onClick={() => void baixarZip()} disabled={zipando} title="Baixar as mídias (.zip com a legenda)">
        {zipando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {rotuloChip}
      </button>
    );
  }

  if (link) {
    return (
      <button type="button" className={linkCls} onClick={() => void baixarZip()} disabled={zipando}>
        {zipando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {rotulo}
      </button>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void baixarZip()} disabled={zipando}>
      {zipando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {rotulo}
    </Button>
  );
}
