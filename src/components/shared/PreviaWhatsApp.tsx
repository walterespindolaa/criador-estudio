import { useState } from "react";
import { Eye, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { lerRota, montarPrevia, previaGenerica, type DadosPrevia, type Previa } from "@/lib/previa-link";

/* ═══ VER COMO CHEGA NO WHATSAPP (Walter, 19/10/2026) ═══
   A social mídia confere a prévia exata de um link de cliente antes de mandar.
   Usa a MESMA função (montarPrevia) e a MESMA RPC (link_previa) que o
   middleware entrega pro WhatsApp, e a imagem vem do próprio /api/og de
   produção. Ou seja: o que aparece aqui é o que o cliente vai ver. */

const ORIGEM_OG = "https://app.criasocialclub.com.br";

type Resultado = { url: string; previa: Previa; imagem: string; invalido: boolean };

async function carregar(url: string): Promise<Resultado | null> {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const rota = lerRota(u.pathname);
  if (!rota) return null;
  let dados: DadosPrevia = null;
  if (rota.token && rota.tipo !== "signup") {
    const { data } = await (supabase.rpc as unknown as (
      fn: string, args: Record<string, unknown>,
    ) => Promise<{ data: unknown }>)("link_previa", { _tipo: rota.tipo, _token: rota.token });
    dados = (data ?? null) as DadosPrevia;
  }
  const invalido = rota.tipo !== "signup" && !dados;
  const previa = invalido ? previaGenerica(rota.tipo) : montarPrevia(rota.tipo, dados);
  const params = new URLSearchParams({ t: rota.tipo });
  if (rota.token) params.set("k", rota.token);
  params.set("v", String(Date.now()));
  return { url, previa, imagem: `${ORIGEM_OG}/api/og?${params.toString()}`, invalido };
}

export function PreviaWhatsApp({ url, obterUrl, className, rotulo = "Ver prévia" }: {
  /** Link pronto. */
  url?: string | null;
  /** Ou: função que gera/busca o link na hora de abrir (ex.: link de aprovação). */
  obterUrl?: () => Promise<string | undefined | null>;
  className?: string;
  rotulo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [erro, setErro] = useState(false);
  const [imgOk, setImgOk] = useState(true);

  const abrir = async () => {
    setAberto(true); setCarregando(true); setErro(false); setRes(null); setImgOk(true);
    try {
      const link = url ?? (obterUrl ? await obterUrl() : null);
      const r = link ? await carregar(link) : null;
      if (!r) setErro(true); else setRes(r);
    } catch { setErro(true); } finally { setCarregando(false); }
  };

  const desabilitado = !url && !obterUrl;
  let dominio = "";
  try { dominio = res ? new URL(res.url).host : ""; } catch { /* ignore */ }

  return (
    <>
      <button type="button" onClick={() => void abrir()} disabled={desabilitado}
        className={cn("inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 h-8 text-[12px] font-body font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50", className)}
        title="Ver como o link chega no WhatsApp">
        <Eye className="h-3.5 w-3.5" /> {rotulo}
      </button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-md rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Como chega no WhatsApp</DialogTitle>
          </DialogHeader>
          {carregando ? (
            <div className="grid place-items-center py-14"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : erro || !res ? (
            <p className="text-sm font-body text-muted-foreground py-6">Não consegui montar a prévia deste link agora. Tenta de novo em instantes.</p>
          ) : (
            <div className="space-y-3">
              {res.invalido && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
                  <p className="text-[12.5px] font-body text-amber-900 leading-snug">
                    Este link está inválido ou vencido. O cliente veria só a prévia padrão do CRIA. Gere um link novo antes de mandar.
                  </p>
                </div>
              )}
              <div className="rounded-2xl bg-[#EFE7DE] p-3">
                <div className="ml-auto max-w-[340px] rounded-xl bg-[#D9FDD3] p-1 shadow-sm">
                  <div className="overflow-hidden rounded-lg bg-[#C9EFC1]">
                    <div className="aspect-[1.91/1] w-full bg-[#F4EFE6]">
                      {imgOk ? (
                        <img src={res.imagem} alt="" className="h-full w-full object-cover" onError={() => setImgOk(false)} />
                      ) : (
                        <div className="grid h-full place-items-center text-[12px] font-body text-muted-foreground">A imagem não carregou</div>
                      )}
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="text-[13.5px] font-body font-bold leading-snug text-[#111B21]">{res.previa.titulo}</p>
                      <p className="mt-0.5 text-[12px] font-body leading-snug text-[#3B4A54]">{res.previa.descricao}</p>
                      <p className="mt-1 text-[11.5px] font-body text-[#3B4A54]">{dominio}</p>
                    </div>
                  </div>
                  <p className="px-2 pb-1 pt-1.5 text-[13px] font-body text-[#027EB5] break-all">{res.url}</p>
                </div>
              </div>
              <p className="text-[11.5px] font-body text-muted-foreground leading-relaxed">
                É a mesma prévia que o WhatsApp monta. Se o link já foi mandado antes, o WhatsApp pode mostrar a versão guardada dele.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
