import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAcaoAdminCriakut, usePainelAdminCriakut } from "@/hooks/useCriakut";
import { quandoFoi } from "@/lib/criakut";
import { cn } from "@/lib/utils";

/* CRIAKUT NO ADMIN (Walter, 14/10/2026, mockup Fase 3): números, chaves
   (abrir pra todos, vender Destaque), convite por e-mail, denúncias e o funil
   por pessoa. Tudo passa por funções que conferem is_admin() no banco.
   Comunidades se criam e editam na própria aba Comunidades do Criakut. */

const TIPO: Record<string, string> = { recado: "Recado", topico: "Tópico", resposta: "Resposta", perfil: "Página" };

export function AdminCriakut() {
  const q = usePainelAdminCriakut();
  const acao = useAcaoAdminCriakut();
  const [email, setEmail] = useState("");
  if (q.isLoading) return <Loader2 className="mx-auto my-16 h-5 w-5 animate-spin text-muted-foreground" />;
  if (q.isError || !q.data) return <p className="py-10 text-center text-muted-foreground">Não consegui abrir o painel do Criakut.</p>;
  const { painel: p, funil } = q.data;
  const taxa = p.propostas_mes ? Math.round((p.fechadas_mes / p.propostas_mes) * 100) : 0;

  const convidar = () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { toast.error("E-mail inválido."); return; }
    acao.mutate({ tipo: "convidar", email: email.trim() }, {
      onSuccess: (r) => {
        if (r === "sem_conta") toast.error("Ninguém com esse e-mail tem conta no Cria.");
        else if (r === "ja_convidado") toast("Essa pessoa já estava convidada.");
        else { toast.success("Convidada!"); setEmail(""); }
      },
    });
  };

  const kpis: [string | number, string, boolean?][] = [
    [p.paginas, `páginas publicadas (${p.paginas_total} criadas)`],
    [p.propostas_mes, "propostas em 30 dias"],
    [`${p.fechadas_mes} (${taxa}%)`, "fechadas em 30 dias"],
    [p.concluidas_mes, "concluídas em 30 dias"],
    [p.destaques, `destaques ativos · R$ ${(p.destaques * 14.9).toFixed(2).replace(".", ",")}/mês`],
    [p.paradas, "paradas há 15 dias sem entrega", p.paradas > 0],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map(([n, l, alerta]) => (
          <div key={l} className="rounded-2xl border border-border bg-card p-3 text-[12px] text-muted-foreground">
            <b className={cn("block font-display text-[24px] text-foreground", alerta && "text-red-600")}>{n}</b>{l}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border bg-card p-4 text-[13px]">
        <label className="flex items-center gap-2"><Switch checked={p.aberto} disabled={acao.isPending}
          onCheckedChange={(v) => { if (window.confirm(v ? "Abrir o Criakut pra todo mundo?" : "Voltar a ser só pra convidados?")) acao.mutate({ tipo: "config", chave: "aberto", ligar: v }); }} />
          <span><b>Criakut aberto pra todos</b><span className="block text-[11.5px] text-muted-foreground">{p.aberto ? "qualquer conta entra" : `só admin e ${p.convidados} convidados`}</span></span></label>
        <label className="flex items-center gap-2"><Switch checked={p.destaque_ativo} disabled={acao.isPending}
          onCheckedChange={(v) => { if (window.confirm(v ? "Começar a vender o Destaque (R$ 14,90/mês)?" : "Parar de vender o Destaque? Quem já pagou continua até cancelar.")) acao.mutate({ tipo: "config", chave: "destaque_ativo", ligar: v }); }} />
          <span><b>Vender Destaque</b><span className="block text-[11.5px] text-muted-foreground">{p.destaque_ativo ? "botão aparece pra prestador e social mídia" : "desligado"}</span></span></label>
        <div className="flex min-w-[260px] flex-1 items-center gap-2">
          <Input value={email} placeholder="e-mail pra convidar" onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") convidar(); }} />
          <Button variant="outline" disabled={acao.isPending} onClick={convidar}>Convidar</Button>
        </div>
        {p.pontes && <span className="text-[12px] text-muted-foreground">Pontes: {Object.entries(p.pontes).map(([k, v]) => `${k} ${v}`).join(" · ")}</span>}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 font-display text-[16px] font-bold">Denúncias abertas ({p.denuncias.length})</p>
        {p.denuncias.length === 0 ? <p className="text-[13px] text-muted-foreground">Nenhuma.</p> : (
          <div className="divide-y divide-border">
            {p.denuncias.map((d) => (
              <div key={d.tipo + d.alvo_id} className="flex flex-wrap items-start gap-3 py-3 text-[13px]">
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] text-muted-foreground">{TIPO[d.tipo]} de <b className="text-foreground">{d.autor?.nome ?? "?"}</b> · {d.quantas} {d.quantas === 1 ? "denúncia" : "denúncias"} · {quandoFoi(d.ultima)} {d.oculto && <span className="font-bold text-red-600">· OCULTO</span>}</p>
                  <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap">{d.texto ?? "(apagado)"}</p>
                  {d.motivos?.length ? <p className="mt-0.5 text-[11.5px] text-muted-foreground">Motivos: {d.motivos.join(" / ")}</p> : null}
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="destructive" disabled={acao.isPending} onClick={() => acao.mutate({ tipo: "moderar", qual: d.tipo, alvo: d.alvo_id, ocultar: true })}>{d.tipo === "perfil" ? "Esconder página" : "Esconder"}</Button>
                  <Button size="sm" variant="outline" disabled={acao.isPending} onClick={() => acao.mutate({ tipo: "moderar", qual: d.tipo, alvo: d.alvo_id, ocultar: false })}>Está ok</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-[12.5px]">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>{["Página", "Propostas", "Fechadas", "Concluídas", "Pagas", "Avaliadas", "Paradas", "Avisos de contato"].map((h, i) => <th key={h} className={cn("px-3 py-2 font-semibold", i ? "text-right" : "text-left")}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {funil.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Sem páginas ainda.</td></tr>
              : funil.map((f) => {
                  const suspeito = f.propostas >= 5 && f.concluidas === 0 && f.avisos_contato >= 3;
                  return (
                    <tr key={f.slug} className={cn("border-t border-border", suspeito && "bg-red-50 dark:bg-red-950/20")}>
                      <td className="px-3 py-2 font-semibold">{f.nome}</td>
                      {[f.propostas, f.fechadas, f.concluidas, f.pagas, f.avaliadas, f.paradas, f.avisos_contato].map((n, i) => (
                        <td key={i} className={cn("px-3 py-2 text-right tabular-nums", (i === 5 || i === 6) && n > 0 && "font-bold text-red-600")}>{n}</td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
      <p className="text-[11.5px] text-muted-foreground">Linha vermelha: muita proposta, nenhuma conclusão e vários avisos de contato. É o padrão de quem puxa o cliente pra fora do Cria.</p>
    </div>
  );
}
