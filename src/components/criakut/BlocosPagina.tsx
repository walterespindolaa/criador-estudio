import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flag, Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  useApagarRecado, useBaseCriakut, useDestaqueStripe, useEscreverRecado, useMeuDestaque, useMinhasVisitas, useRecados, useSalvarPerfilCriakut,
} from "@/hooks/useCriakut";
import { PRECO_DESTAQUE, nomeFuncao, quandoFoi, type PaginaCriakutDados } from "@/lib/criakut";
import { Avatar, DenunciarDialog, SeloDestaque } from "./Pecas";

/* BLOCOS DA PÁGINA (Fase 3, mockup aprovado em 14/10/2026):
   Recados (centro), Quem visitou, Comunidades e o cartão do Destaque
   (direita). Recado é público como no Orkut, mas sem virar classificado:
   o banco troca telefone, e-mail e link por "••••". */

const card = "rounded-[22px] border border-border bg-card p-[18px]";
const titulo = "mb-3 flex items-center justify-between text-[11.5px] font-bold uppercase tracking-[0.08em] text-primary";

export function Recados({ dados, modoDono }: { dados: PaginaCriakutDados; modoDono: boolean }) {
  const navigate = useNavigate();
  const base = useBaseCriakut();
  const [todos, setTodos] = useState(false);
  const q = useRecados(dados.slug, todos ? 50 : 5);
  const escrever = useEscreverRecado();
  const apagar = useApagarRecado();
  const [texto, setTexto] = useState("");
  const [denuncia, setDenuncia] = useState<{ tipo: "recado"; id: string } | null>(null);
  const primeiro = dados.nome.trim().split(/\s+/)[0];
  const total = q.data?.total ?? 0;

  const mandar = () => {
    if (!texto.trim()) return;
    escrever.mutate({ dono: dados.user_id, texto: texto.trim() }, { onSuccess: () => { setTexto(""); toast.success("Recado deixado!"); } });
  };

  return (
    <div className={card} id="recados">
      <p className={titulo}>Recados {total > 0 && <span className="normal-case tracking-normal font-semibold text-muted-foreground">{total}</span>}</p>
      {!dados.eh_meu && (
        <div className="mb-3 flex items-start gap-2">
          <Textarea rows={2} maxLength={500} value={texto} placeholder={`Deixe um recado pra ${primeiro} (aparece na página)`}
            className="min-h-[44px] resize-none" onChange={(e) => setTexto(e.target.value)} />
          <Button size="sm" className="h-[44px] rounded-xl" disabled={escrever.isPending || !texto.trim()} onClick={mandar}>
            {escrever.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mandar"}
          </Button>
        </div>
      )}
      {q.isLoading ? <Loader2 className="mx-auto my-4 h-4 w-4 animate-spin text-muted-foreground" />
        : total === 0 ? <p className="text-[13px] text-muted-foreground">{dados.eh_meu ? "Quando alguém deixar recado, aparece aqui." : `Seja a primeira pessoa a deixar recado pra ${primeiro}.`}</p>
        : <div>
            {(q.data?.itens ?? []).map((r) => (
              <div key={r.id} className="grid grid-cols-[auto_1fr] gap-2.5 border-t border-dashed border-border py-2.5 first:border-0">
                <button type="button" onClick={() => r.autor && navigate(`${base}/${r.autor.slug}`)}>
                  <Avatar nome={r.autor?.nome ?? "?"} foto={r.autor?.foto_url} className="h-9 w-9 text-[12px]" />
                </button>
                <div className="min-w-0">
                  <p className="text-[12px]">
                    <button type="button" className="text-[13px] font-bold hover:underline" onClick={() => r.autor && navigate(`${base}/${r.autor.slug}`)}>{r.autor?.nome}</button>
                    {r.autor?.destaque && <SeloDestaque curto className="ml-1" />}
                    <span className="text-muted-foreground"> · {nomeFuncao(r.autor?.funcao).toLowerCase()} · {quandoFoi(r.criado_em)}</span>
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">{r.texto}</p>
                  <div className="mt-1 flex gap-3 text-[11.5px] text-muted-foreground">
                    {r.posso_apagar && !(modoDono === false && dados.eh_meu) && (
                      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" disabled={apagar.isPending}
                        onClick={() => { if (window.confirm("Apagar esse recado?")) apagar.mutate(r.id); }}><Trash2 className="h-3 w-3" /> apagar</button>
                    )}
                    {!r.meu && <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setDenuncia({ tipo: "recado", id: r.id })}><Flag className="h-3 w-3" /> denunciar</button>}
                  </div>
                </div>
              </div>
            ))}
            {total > 5 && <button type="button" className="mt-1 w-full text-center text-[12.5px] font-semibold" onClick={() => setTodos((v) => !v)}>{todos ? "ver menos" : `ver todos os ${total}`}</button>}
          </div>}
      <DenunciarDialog alvo={denuncia} onClose={() => setDenuncia(null)} />
    </div>
  );
}

export function QuemVisitou({ dados }: { dados: PaginaCriakutDados }) {
  const navigate = useNavigate();
  const base = useBaseCriakut();
  const q = useMinhasVisitas(true);
  const salvar = useSalvarPerfilCriakut();
  const v = q.data;
  const mostrar = v?.mostrar ?? dados.mostrar_visitas ?? true;
  return (
    <div className={card}>
      <p className={titulo}>Quem visitou {v && <span className="normal-case tracking-normal font-semibold text-muted-foreground">{v.total_mes} no mês</span>}</p>
      {q.isLoading ? <Loader2 className="mx-auto my-3 h-4 w-4 animate-spin text-muted-foreground" />
        : !mostrar ? <p className="text-[12.5px] text-muted-foreground">Desligado. Ligue pra ver quem passou por aqui (e aparecer na lista dos outros).</p>
        : (v?.lista.length ?? 0) === 0 ? <p className="text-[12.5px] text-muted-foreground">Ninguém com página visível passou por aqui nos últimos 30 dias.</p>
        : <div className="grid grid-cols-3 gap-2.5">
            {v!.lista.slice(0, 9).map((p) => (
              <button key={p.slug} type="button" onClick={() => navigate(`${base}/${p.slug}`)} className="text-center text-[11.5px] font-semibold">
                <Avatar nome={p.nome} foto={p.foto_url} className="mb-1 aspect-square h-auto w-full rounded-2xl text-lg" />
                <span className="block truncate">{p.nome.split(" ")[0]}</span>
                <small className="block font-normal text-muted-foreground">{quandoFoi(p.ultima)}</small>
              </button>
            ))}
          </div>}
      <label className="mt-3 flex items-start gap-2 text-[11.5px] text-muted-foreground">
        <Switch checked={mostrar} disabled={salvar.isPending} onCheckedChange={(on) => salvar.mutate({ mostrar_visitas: on }, { onSuccess: () => void q.refetch() })} />
        <span>Mostrar minhas visitas. Se desligar, você some da lista dos outros e também não vê a sua.</span>
      </label>
    </div>
  );
}

export function ComunidadesDaPagina({ dados }: { dados: PaginaCriakutDados }) {
  const navigate = useNavigate();
  const base = useBaseCriakut();
  const lista = dados.comunidades ?? [];
  if (!lista.length && !dados.eh_meu) return null;
  return (
    <div className={card}>
      <p className={titulo}>Comunidades <span className="normal-case tracking-normal font-semibold text-muted-foreground">{lista.length}</span></p>
      {lista.length === 0
        ? <button type="button" className="text-[12.5px] text-muted-foreground hover:text-foreground" onClick={() => navigate(`${base}?aba=comunidades`)}>Você ainda não entrou em nenhuma. Ver comunidades →</button>
        : <div className="grid grid-cols-3 gap-2">
            {lista.slice(0, 9).map((c) => (
              <button key={c.slug} type="button" onClick={() => navigate(`${base}?aba=comunidades&c=${c.slug}`)} className="text-center text-[11px] font-semibold leading-tight">
                <span className="mb-1 grid aspect-square place-items-center rounded-2xl text-2xl" style={{ background: c.cor }}>{c.emoji}</span>
                {c.nome}
              </button>
            ))}
          </div>}
    </div>
  );
}

export function CartaoDestaque() {
  const q = useMeuDestaque();
  const stripe = useDestaqueStripe();
  const d = q.data;
  if (!d) return null;
  if (d.ativo) {
    return (
      <div className="rounded-[22px] bg-gradient-to-br from-foreground to-[#3a2c63] p-[18px] text-background">
        <SeloDestaque className="bg-primary" />
        <h3 className="mt-2 font-display text-[19px] font-bold">Você aparece primeiro</h3>
        <p className="mt-1 text-[12.5px] opacity-80">Topo da busca da sua especialidade e selo no nome em todo o Criakut.{d.ate ? ` Renova em ${new Date(d.ate).toLocaleDateString("pt-BR")}.` : ""}</p>
        <div className="my-3 flex gap-5 text-[12px] opacity-90">
          <span><b className="block font-display text-[18px]">{d.visitas_30d}</b>visitas em 30 dias</span>
          <span><b className="block font-display text-[18px]">{d.pedidos_30d}</b>pedidos em 30 dias</span>
        </div>
        <Button size="sm" variant="secondary" className="w-full rounded-xl" disabled={stripe.isPending} onClick={() => stripe.mutate("gerenciar")}>
          {stripe.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Gerenciar assinatura
        </Button>
      </div>
    );
  }
  if (!d.a_venda || d.motivo === "criadora") return null;
  return (
    <div className="rounded-[22px] bg-gradient-to-br from-primary to-[#c2390f] p-[18px] text-primary-foreground">
      <span className="inline-flex items-center gap-0.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-primary"><Star className="h-2.5 w-2.5 fill-current" /> DESTAQUE</span>
      <h3 className="mt-2 font-display text-[19px] font-bold leading-snug">Apareça primeiro pra quem procura o que você faz</h3>
      <ul className="my-2.5 list-disc space-y-0.5 pl-4 text-[12.5px] opacity-95">
        <li>Topo da busca da sua especialidade</li>
        <li>Selo no seu nome em todo lugar</li>
        <li>Visitas e pedidos do mês aqui no cartão</li>
      </ul>
      <p className="font-display text-[26px] font-extrabold">{PRECO_DESTAQUE}<small className="text-[13px] font-medium"> /mês</small></p>
      {d.motivo === "escondida" && <p className="mt-1 text-[11.5px] opacity-90">Deixe sua página visível na busca pra poder ativar.</p>}
      <Button size="sm" className="mt-2.5 w-full rounded-xl bg-white text-primary hover:bg-white/90" disabled={!d.pode_comprar || stripe.isPending}
        onClick={() => stripe.mutate("comprar")}>
        {stripe.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Quero destaque
      </Button>
      <p className="mt-1.5 text-[10.5px] opacity-80">Pagamento seguro no Stripe, só cartão. Cancela quando quiser.</p>
    </div>
  );
}
