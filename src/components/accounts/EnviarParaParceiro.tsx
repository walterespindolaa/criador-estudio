import { useState } from "react";
import { Check, Loader2, MessageCircle, RotateCcw, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ROTULO_PAPEL, useConversaDoCard, useDelegarPost, useMeusParceiros, usePedirAjuste } from "@/hooks/useParceiro";

/* ═══════════════════════════════════════════════════════════════════════════
   ENVIAR PARA (Cria Parceiros)

   O botão que tira o "manda a arte pra Ágatha" do WhatsApp. A social mídia
   escolhe o parceiro, põe a data que as duas combinaram, e o card aparece na
   fila da pessoa com aviso na hora. Um responsável por card, decisão de
   produto: peça que precisa de duas pessoas vira dois cards.

   Só aparece quando a agência TEM parceiro acoplado: botão que abre uma lista
   vazia é convite pra frustração, não pra descoberta.
   ═══════════════════════════════════════════════════════════════════════════ */

export function EnviarParaParceiro({ postId, assigneeId, producaoStatus, prazo, cache }: {
  postId: string;
  assigneeId: string | null;
  producaoStatus: string | null;
  prazo: string | null;
  /** Cachê combinado (R$). Vira despesa no Caixa quando o parceiro entregar. */
  cache?: number | null;
}) {
  const { data: parceiros = [] } = useMeusParceiros();
  const delegar = useDelegarPost();
  const [aberto, setAberto] = useState(false);
  const [escolhido, setEscolhido] = useState<string | null>(assigneeId);
  const [dataEntrega, setDataEntrega] = useState(prazo ?? "");
  const [valorCache, setValorCache] = useState(cache != null ? String(cache) : "");
  const [pedindoAjuste, setPedindoAjuste] = useState(false);
  const [motivoAjuste, setMotivoAjuste] = useState("");
  const [mensagem, setMensagem] = useState("");
  const pedirAjuste = usePedirAjuste();
  const conversa = useConversaDoCard(assigneeId ? postId : null);

  if (parceiros.length === 0) return null;
  const atual = parceiros.find((p) => p.member_id === assigneeId);

  const enviar = async () => {
    if (!escolhido) return;
    const nome = parceiros.find((p) => p.member_id === escolhido)?.nome;
    const cacheNum = valorCache.trim() ? Number(valorCache.replace(",", ".")) : null;
    await delegar.mutateAsync({
      postId, assigneeId: escolhido, prazo: dataEntrega || null, nomeParceiro: nome,
      cache: cacheNum != null && !Number.isNaN(cacheNum) && cacheNum > 0 ? cacheNum : null,
    });
    setAberto(false);
  };

  const remover = async () => {
    await delegar.mutateAsync({ postId, assigneeId: null, prazo: null });
    setAberto(false);
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn(atual && "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100")}>
          <Send className="h-3.5 w-3.5 mr-1.5" />
          {atual
            ? `Com ${atual.nome.split(" ")[0]}${producaoStatus === "entregue" ? " · entregue" : ""}`
            : "Enviar para"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 rounded-2xl">
        <p className="font-display font-bold text-sm mb-2.5">Enviar pra produção</p>
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {parceiros.map((p) => (
            <button key={p.member_id} type="button" onClick={() => setEscolhido(p.member_id)}
              className={cn("w-full flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors",
                escolhido === p.member_id ? "border-violet-400 bg-violet-50" : "border-border hover:border-violet-200")}>
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-violet-700 text-white grid place-items-center text-[11px] font-bold shrink-0">
                {p.nome.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-body font-bold text-foreground truncate">{p.nome}</span>
                <span className="block text-[11px] font-body text-muted-foreground">{ROTULO_PAPEL[p.role] ?? p.role}</span>
              </span>
              {escolhido === p.member_id && <Check className="h-4 w-4 text-violet-600 shrink-0" />}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Entregar até</Label>
            <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} className="rounded-xl h-10 mt-1" />
          </div>
          <div>
            <Label className="text-xs">Cachê (R$)</Label>
            <Input inputMode="decimal" placeholder="Ex.: 150" value={valorCache} onChange={(e) => setValorCache(e.target.value)} className="rounded-xl h-10 mt-1" />
          </div>
        </div>
        <p className="text-[11px] font-body text-muted-foreground mt-1 leading-relaxed">
          Data e valor combinados. O cachê vira despesa no Caixa quando a entrega for marcada. Vazio = a combinar.
        </p>

        <div className="flex gap-2 mt-3">
          {atual && (
            <Button variant="ghost" size="sm" onClick={() => void remover()} disabled={delegar.isPending}
              className="rounded-xl text-destructive hover:text-destructive">
              <X className="h-3.5 w-3.5 mr-1" /> Remover
            </Button>
          )}
          <Button size="sm" onClick={() => void enviar()} disabled={!escolhido || delegar.isPending} className="rounded-xl flex-1">
            {delegar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : atual ? "Atualizar" : "Enviar"}
          </Button>
        </div>

        {/* PEDIR AJUSTE: só quando o parceiro entregou. A pesquisa é unânime:
            revisão sem feedback consolidado vira pingado de áudio e o
            freelancer perde a conta. Motivo obrigatório, num texto só, que
            entra na conversa do card. */}
        {atual && producaoStatus === "entregue" && (
          !pedindoAjuste ? (
            <Button variant="outline" size="sm" className="w-full rounded-xl mt-2 border-orange-300 text-orange-700 hover:bg-orange-50"
              onClick={() => setPedindoAjuste(true)}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Pedir ajuste
            </Button>
          ) : (
            <div className="mt-2 rounded-xl border border-orange-200 bg-orange-50/60 p-2.5 space-y-2">
              <p className="text-[11px] font-body font-bold text-orange-900">
                O que precisa mudar? Junte TUDO num texto só: é uma rodada, não um pingado.
              </p>
              <Textarea value={motivoAjuste} onChange={(e) => setMotivoAjuste(e.target.value)} rows={3}
                placeholder="Ex.: trocar a foto do slide 2, aumentar o logo e ajustar a cor do fundo pro tom do brandbook"
                className="rounded-lg resize-none text-[12.5px] bg-background" />
              <Button size="sm" className="w-full rounded-xl bg-orange-600 hover:bg-orange-700"
                disabled={!motivoAjuste.trim() || pedirAjuste.isPending}
                onClick={async () => {
                  await pedirAjuste.mutateAsync({ postId, motivo: motivoAjuste });
                  setMotivoAjuste(""); setPedindoAjuste(false); setAberto(false);
                }}>
                {pedirAjuste.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Devolver pro parceiro com o motivo"}
              </Button>
            </div>
          )
        )}

        {/* CONVERSA NO CARD (fase 3): a thread que o parceiro já vê no card
            dele, agora também do lado de cá. Cada mensagem avisa o outro lado. */}
        {atual && (
          <div className="mt-3 border-t border-border pt-2.5">
            <p className="text-[11px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-1.5 inline-flex items-center gap-1">
              <MessageCircle className="h-3 w-3" /> Conversa com {atual.nome.split(" ")[0]}
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {conversa.mensagens.length === 0 && (
                <p className="text-[11px] font-body text-muted-foreground">Nada ainda. O que você mandar aqui chega no card dele.</p>
              )}
              {conversa.mensagens.map((m) => (
                <div key={m.id} className={cn("rounded-lg px-2.5 py-1.5 text-[12px] font-body leading-snug",
                  m.author_role === "social_media" ? "bg-violet-50 text-violet-950 ml-6" : "bg-muted text-foreground mr-6")}>
                  <span className="block text-[10px] text-muted-foreground mb-0.5">
                    {m.author_role === "social_media" ? "Você" : atual.nome.split(" ")[0]} · {new Date(m.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </span>
                  {m.content}
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 mt-2">
              <Input value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Escrever pro parceiro..."
                className="rounded-xl h-9 text-[12.5px]"
                onKeyDown={(e) => { if (e.key === "Enter" && mensagem.trim()) { void conversa.enviar.mutateAsync(mensagem).then(() => setMensagem("")); } }} />
              <Button size="sm" className="rounded-xl h-9 px-3" disabled={!mensagem.trim() || conversa.enviar.isPending}
                onClick={() => void conversa.enviar.mutateAsync(mensagem).then(() => setMensagem(""))}>
                {conversa.enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
