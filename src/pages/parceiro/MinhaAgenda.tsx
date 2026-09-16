import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Loader2, Video, Package, CalendarClock, ListTodo, Trash2, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErroAoCarregar } from "@/components/shared/ErroAoCarregar";
import { cn } from "@/lib/utils";
import { hojeBR } from "@/lib/date-br";
import { confirmar } from "@/components/shared/Confirm";
import { useFilaDoParceiro, useMinhasAgencias } from "@/hooks/useParceiro";
import { CardAbertoDialog } from "@/pages/app/MinhasDemandas";
import {
  useItensDaAgenda, useMinhasGravacoes, useTitulosDasPecas, useAcoesDaAgenda,
  ROTULO_PRIORIDADE, type ItemDaAgenda, type TipoDeItem,
} from "@/hooks/useAgendaParceiro";

/* ═══════════════════════════════════════════════════════════════════════════
   MINHA AGENDA (circuito 11, 16/09/2026) · pedido do Walter

   A social mídia tem Agenda de criação. O parceiro tinha só a fila, e fila não
   organiza dia: ela diz o que entra, não o que cabe. Quem é designer ou
   filmmaker atende três agências ao mesmo tempo e precisa ver o dia inteiro num
   lugar só, senão abre o Cria pra consultar e outro app pra viver.

   O DIA É A UNIDADE, não o mês. Foi a mesma virada do Dia de Gravação
   (circuito 8): a grade de 7 colunas é bonita no monitor e inútil no celular,
   que é onde ela abre isso entre uma coisa e outra. Então a tela é uma LISTA DE
   DIAS, e o calendário compacto existe só de `sm` pra cima, como mapa.

   Quatro coisas cabem num dia:
     ENTREGA  (prazo de peça delegada, vem da fila)
     GRAVAÇÃO (dia em que a social mídia escalou ela)
     TAREFA   (dela, com prioridade, pode não ter dia)
     COMPROMISSO (dela, com hora)
   ═══════════════════════════════════════════════════════════════════════════ */

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const pad = (n: number) => String(n).padStart(2, "0");
const isoDe = (a: number, m: number, d: number) => `${a}-${pad(m)}-${pad(d)}`;

function rotuloDoDia(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" });
}

/* As cores dizem o TIPO, e são as mesmas em todas as vistas da tela: no ponto
   do calendário, na barra do card e na legenda. Cor que muda de significado
   entre dois lugares da mesma tela não ensina nada. */
const COR: Record<string, string> = {
  entrega: "#EA4918",      // laranja CRIA
  gravacao: "#0061EE",     // azul CRIA
  tarefa: "#01A652",       // verde CRIA
  compromisso: "#7C90F0",  // lilás CRIA
};

type LinhaDoDia =
  | { kind: "entrega"; id: string; titulo: string; sub: string; postId: string }
  | { kind: "gravacao"; id: string; titulo: string; sub: string; hora: string | null }
  | { kind: "tarefa" | "compromisso"; id: string; titulo: string; sub: string; item: ItemDaAgenda };

export default function MinhaAgenda() {
  const hoje = hojeBR();
  const [h1, h2] = hoje.split("-").map(Number);
  const [ref, setRef] = useState({ ano: h1, mes: h2 });
  const [editando, setEditando] = useState<ItemDaAgenda | "novo" | null>(null);
  const [cardAberto, setCardAberto] = useState<string | null>(null);

  const de = isoDe(ref.ano, ref.mes, 1);
  const diasNoMes = new Date(ref.ano, ref.mes, 0).getDate();
  const ate = isoDe(ref.ano, ref.mes, diasNoMes);

  const fila = useFilaDoParceiro();
  /* A ação de marcar vive AQUI, não dentro da linha: um mês cheio tem dezenas
     de linhas, e um useMutation por linha seria dezenas de objetos de mutação
     pra um gesto que é sempre o mesmo. */
  const { concluir } = useAcoesDaAgenda();
  const marcar = (id: string, feito: boolean) => concluir.mutate({ id, feito });
  const itens = useItensDaAgenda(de, ate);
  const gravacoes = useMinhasGravacoes(de, ate);

  const listaItens = useMemo(() => itens.data ?? [], [itens.data]);
  const idsDePecas = useMemo(
    () => listaItens.map((i) => i.post_id).filter((x): x is string => !!x),
    [listaItens],
  );
  const { data: titulos = {} } = useTitulosDasPecas(idsDePecas);

  /* ── O MÊS MONTADO: um mapa dia -> linhas ───────────────────────────────
     Tudo que tem dia entra aqui. O que não tem dia (tarefa "quando der") sai
     num bloco próprio no fim, porque some se ficar dependendo de data. */
  const { porDia, semData } = useMemo(() => {
    const mapa = new Map<string, LinhaDoDia[]>();
    const empurrar = (dia: string, linha: LinhaDoDia) => {
      if (dia < de || dia > ate) return;
      mapa.set(dia, [...(mapa.get(dia) ?? []), linha]);
    };

    for (const c of fila.data ?? []) {
      if (!c.prazo_producao) continue;
      empurrar(c.prazo_producao, {
        kind: "entrega", id: c.post_id, postId: c.post_id,
        titulo: c.titulo || "Peça sem título",
        sub: `Entregar para ${c.cliente_nome || "cliente"}`,
      });
    }
    for (const g of gravacoes.data ?? []) {
      empurrar(g.dia, {
        kind: "gravacao", id: g.captura_id, hora: g.hora,
        titulo: `Gravação, ${g.cliente_nome}`,
        sub: [g.agencia_nome, g.local, g.roteiros > 0 ? `${g.roteiros} roteiro${g.roteiros === 1 ? "" : "s"}` : null]
          .filter(Boolean).join(" · "),
      });
    }
    const soltas: ItemDaAgenda[] = [];
    for (const i of listaItens) {
      const linha: LinhaDoDia = {
        kind: i.tipo, id: i.id, item: i,
        titulo: i.titulo,
        sub: [i.local, i.post_id ? titulos[i.post_id]?.titulo : null, i.nota].filter(Boolean).join(" · "),
      };
      if (i.data) empurrar(i.data, linha); else soltas.push(i);
    }

    for (const [, linhas] of mapa) {
      // Dentro do dia: hora primeiro (gravação e compromisso), resto depois.
      linhas.sort((a, b) => {
        const ha = a.kind === "gravacao" ? a.hora : a.kind === "compromisso" ? a.item.hora : null;
        const hb = b.kind === "gravacao" ? b.hora : b.kind === "compromisso" ? b.item.hora : null;
        if (ha && hb) return ha.localeCompare(hb);
        if (ha) return -1;
        if (hb) return 1;
        return 0;
      });
    }
    return { porDia: mapa, semData: soltas };
  }, [fila.data, gravacoes.data, listaItens, titulos, de, ate]);

  const diasComCoisa = [...porDia.keys()].sort();
  const carregando = fila.isLoading || itens.isLoading || gravacoes.isLoading;
  const deuErro = (itens.isError || gravacoes.isError) && diasComCoisa.length === 0 && semData.length === 0;

  const abertas = listaItens.filter((i) => !i.feito).length;
  const totalEntregas = [...porDia.values()].flat().filter((l) => l.kind === "entrega").length;
  const totalGravacoes = gravacoes.data?.length ?? 0;

  const mudarMes = (delta: number) => {
    const d = new Date(ref.ano, ref.mes - 1 + delta, 1);
    setRef({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
  };

  return (
    <div>
      {/* ── A FAIXA DO MÊS ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => mudarMes(-1)} aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="font-display font-extrabold text-[16px] capitalize min-w-[150px] text-center">
          {MESES[ref.mes - 1]} de {ref.ano}
        </p>
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => mudarMes(1)} aria-label="Próximo mês">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" className="h-9 rounded-xl text-[12.5px]" onClick={() => setRef({ ano: h1, mes: h2 })}>
          Hoje
        </Button>
        <Button className="h-9 rounded-xl ml-auto" onClick={() => setEditando("novo")}>
          <Plus className="h-4 w-4 mr-1.5" /> Anotar
        </Button>
      </div>

      {/* ── O MÊS EM TRÊS NÚMEROS ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { n: totalEntregas, txt: totalEntregas === 1 ? "entrega" : "entregas", cor: COR.entrega, Icone: Package },
          { n: totalGravacoes, txt: totalGravacoes === 1 ? "gravação" : "gravações", cor: COR.gravacao, Icone: Video },
          { n: abertas, txt: abertas === 1 ? "em aberto" : "em aberto", cor: COR.tarefa, Icone: ListTodo },
        ].map(({ n, txt, cor, Icone }) => (
          <Card key={txt + cor} className="rounded-2xl p-3 border-border">
            <Icone className="h-4 w-4 mb-1" style={{ color: cor }} />
            <p className="font-display font-extrabold text-[20px] leading-none" style={{ color: cor }}>{n}</p>
            <p className="text-[11px] font-body text-muted-foreground mt-0.5">{txt}</p>
          </Card>
        ))}
      </div>

      {carregando ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : deuErro ? (
        <ErroAoCarregar oQue="sua agenda" aoTentarDeNovo={() => { void itens.refetch(); void gravacoes.refetch(); }}
          tentando={itens.isFetching || gravacoes.isFetching} />
      ) : (
        <>
          {/* ── O CALENDÁRIO, SÓ DE sm PRA CIMA ────────────────────────────
              No celular ele não existe: célula de 48px com quatro tipos de
              coisa dentro não se lê nem se toca (lição do circuito 10). */}
          <div className="hidden sm:block mb-4">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                <p key={d} className="text-[9.5px] font-bold uppercase text-muted-foreground text-center">{d}</p>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: (new Date(ref.ano, ref.mes - 1, 1).getDay() + 6) % 7 }, (_, i) => (
                <div key={`v${i}`} />
              ))}
              {Array.from({ length: diasNoMes }, (_, i) => {
                const iso = isoDe(ref.ano, ref.mes, i + 1);
                const linhas = porDia.get(iso) ?? [];
                const ehHoje = iso === hoje;
                return (
                  <a key={iso} href={`#dia-${iso}`}
                    className={cn("rounded-xl border p-1.5 min-h-[62px] block transition-colors hover:border-primary/60",
                      ehHoje ? "border-primary ring-1 ring-primary/40" : "border-border")}>
                    <span className={cn("text-[11px] font-display font-bold", ehHoje ? "text-primary" : "text-muted-foreground")}>
                      {i + 1}
                    </span>
                    <span className="flex flex-wrap gap-0.5 mt-1">
                      {linhas.slice(0, 6).map((l) => (
                        <span key={l.kind + l.id} className="h-1.5 w-1.5 rounded-full" style={{ background: COR[l.kind] }} />
                      ))}
                    </span>
                  </a>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {[["entrega", "entrega"], ["gravacao", "gravação"], ["tarefa", "tarefa"], ["compromisso", "compromisso"]].map(([k, txt]) => (
                <span key={k} className="flex items-center gap-1 text-[10.5px] font-body text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: COR[k] }} /> {txt}
                </span>
              ))}
            </div>
          </div>

          {/* ── A LISTA DE DIAS ──────────────────────────────────────────── */}
          {diasComCoisa.length === 0 && semData.length === 0 ? (
            <Card className="p-10 rounded-2xl border-dashed text-center">
              <p className="text-sm font-body text-muted-foreground">
                Mês vazio. As entregas com prazo e as gravações em que te escalarem caem aqui sozinhas.
                O resto você anota no botão acima.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {diasComCoisa.map((iso) => (
                <Card key={iso} id={`dia-${iso}`}
                  className={cn("rounded-2xl overflow-hidden scroll-mt-20",
                    iso === hoje ? "border-primary ring-1 ring-primary/30" : "border-border")}>
                  <div className={cn("px-3.5 py-2 border-b border-border", iso === hoje ? "bg-primary/5" : "bg-muted/30")}>
                    <p className={cn("font-display font-bold text-[13px] capitalize", iso === hoje && "text-primary")}>
                      {iso === hoje ? "Hoje, " : ""}{rotuloDoDia(iso)}
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {(porDia.get(iso) ?? []).map((l) => (
                      <LinhaCard key={l.kind + l.id} linha={l} aoMarcar={marcar}
                        aoAbrirPeca={setCardAberto} aoEditar={(i) => setEditando(i)} />
                    ))}
                  </div>
                </Card>
              ))}

              {semData.length > 0 && (
                <Card className="rounded-2xl overflow-hidden border-dashed">
                  <div className="px-3.5 py-2 border-b border-border bg-muted/30">
                    <p className="font-display font-bold text-[13px] text-muted-foreground">
                      Quando der ({semData.length})
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {semData.map((i) => (
                      <LinhaCard key={i.id} aoMarcar={marcar}
                        linha={{ kind: i.tipo, id: i.id, item: i, titulo: i.titulo, sub: i.nota ?? "" }}
                        aoAbrirPeca={setCardAberto} aoEditar={(x) => setEditando(x)} />
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      <EditorDeItem
        aberto={editando !== null}
        item={editando === "novo" ? null : editando}
        aoFechar={() => setEditando(null)}
      />
      <CardAbertoDialog postId={cardAberto} aoFechar={() => setCardAberto(null)} />
    </div>
  );
}

/* ── UMA LINHA DO DIA ─────────────────────────────────────────────────────
   Entrega e gravação são LEITURA (quem manda nelas é a agência); tarefa e
   compromisso são dela, e por isso ganham caixa de marcar e botão de editar. */
function LinhaCard({ linha, aoAbrirPeca, aoEditar, aoMarcar }: {
  linha: LinhaDoDia;
  aoAbrirPeca: (id: string) => void;
  aoEditar: (i: ItemDaAgenda) => void;
  aoMarcar: (id: string, feito: boolean) => void;
}) {
  const item = linha.kind === "tarefa" || linha.kind === "compromisso" ? linha.item : null;
  const hora = linha.kind === "gravacao" ? linha.hora : item?.hora ?? null;

  const corpo = (
    <>
      <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: COR[linha.kind] }} />
      <span className="min-w-0 flex-1">
        <span className={cn("block font-display font-bold text-[13.5px] leading-tight",
          item?.feito ? "line-through text-muted-foreground" : "text-foreground")}>
          {hora ? <span className="text-muted-foreground font-body font-semibold">{hora.slice(0, 5)} </span> : null}
          {linha.titulo}
        </span>
        {linha.sub && (
          <span className="block text-[11.5px] font-body text-muted-foreground mt-0.5 line-clamp-1">{linha.sub}</span>
        )}
      </span>
      {item && item.tipo === "tarefa" && !item.feito && ROTULO_PRIORIDADE[item.prioridade] && (
        <span className={cn("text-[9.5px] font-bold rounded-full px-2 py-0.5 shrink-0", ROTULO_PRIORIDADE[item.prioridade].cls)}>
          {ROTULO_PRIORIDADE[item.prioridade].txt}
        </span>
      )}
    </>
  );

  if (!item) {
    // Entrega abre a peça; gravação é informativa (o dia de gravação inteiro
    // mora na Captação, que é da agência, não dela).
    if (linha.kind === "entrega") {
      return (
        <button type="button" onClick={() => aoAbrirPeca(linha.postId)}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left min-h-[52px] hover:bg-muted/40 transition-colors">
          {corpo}
        </button>
      );
    }
    return <div className="flex items-center gap-2.5 px-3.5 py-2.5 min-h-[52px]">{corpo}</div>;
  }

  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 min-h-[52px]">
      <Checkbox checked={item.feito} className="shrink-0"
        onCheckedChange={(v) => aoMarcar(item.id, v === true)}
        aria-label={item.feito ? "Reabrir" : "Marcar como feito"} />
      {corpo}
      <button type="button" onClick={() => aoEditar(item)}
        className="h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
        aria-label="Editar">
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ── O EDITOR ─────────────────────────────────────────────────────────────
   Um formulário só pros dois tipos: o que muda é o par de campos do meio
   (prioridade na tarefa, hora e local no compromisso). Dois formulários
   separados pra três campos diferentes seria mais tela pra ela decidir. */
function EditorDeItem({ aberto, item, aoFechar }: {
  aberto: boolean; item: ItemDaAgenda | null; aoFechar: () => void;
}) {
  const { criar, editar, apagar } = useAcoesDaAgenda();
  const { data: agencias = [] } = useMinhasAgencias();
  const fila = useFilaDoParceiro();

  const [tipo, setTipo] = useState<TipoDeItem>("tarefa");
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [local, setLocal] = useState("");
  const [nota, setNota] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [postId, setPostId] = useState("");
  const [agenciaId, setAgenciaId] = useState("");
  const [preenchido, setPreenchido] = useState<string | null>(null);

  /* Carrega o item UMA vez por abertura. Sem a trava, cada tecla digitada
     voltava pro valor do banco enquanto o diálogo estivesse aberto. */
  const chave = aberto ? (item?.id ?? "novo") : null;
  if (chave !== preenchido) {
    setPreenchido(chave);
    setTipo(item?.tipo ?? "tarefa");
    setTitulo(item?.titulo ?? "");
    setData(item?.data ?? "");
    setHora(item?.hora ?? "");
    setLocal(item?.local ?? "");
    setNota(item?.nota ?? "");
    setPrioridade(item?.prioridade ?? "media");
    setPostId(item?.post_id ?? "");
    setAgenciaId(item?.agencia_id ?? "");
  }

  const salvar = () => {
    const campos = {
      tipo, titulo, data: data || null, hora: hora || null, local, nota,
      prioridade, post_id: postId || null, agencia_id: agenciaId || null,
    };
    if (item) editar.mutate({ id: item.id, ...campos }, { onSuccess: aoFechar });
    else criar.mutate(campos, { onSuccess: aoFechar });
  };

  const remover = async () => {
    if (!item) return;
    const ok = await confirmar({
      titulo: "Apagar isto?",
      descricao: "Some da sua agenda e não volta.",
      acao: "Apagar",
      destrutivo: true,
    });
    if (ok) apagar.mutate(item.id, { onSuccess: aoFechar });
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) aoFechar(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display">{item ? "Editar" : "Anotar na agenda"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5 mt-1">
          <div className="grid grid-cols-2 gap-2">
            {(["tarefa", "compromisso"] as TipoDeItem[]).map((t) => (
              <button key={t} type="button" onClick={() => setTipo(t)}
                className={cn("rounded-xl border px-3 py-2.5 text-left transition-colors min-h-[44px]",
                  tipo === t ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40")}>
                <span className="flex items-center gap-1.5 font-display font-bold text-[13px]">
                  {t === "tarefa" ? <ListTodo className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
                  {t === "tarefa" ? "Tarefa" : "Compromisso"}
                </span>
                <span className="block text-[10.5px] font-body text-muted-foreground mt-0.5">
                  {t === "tarefa" ? "tem prazo, pode não ter dia" : "tem dia e hora"}
                </span>
              </button>
            ))}
          </div>

          <div>
            <Label className="text-[12px]">O que é</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={140}
              placeholder={tipo === "tarefa" ? "Exportar o carrossel da Fulana" : "Reunião de alinhamento"}
              className="rounded-xl mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[12px]">{tipo === "tarefa" ? "Prazo" : "Dia"}</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="rounded-xl mt-1" />
              {tipo === "tarefa" && (
                <p className="text-[10.5px] font-body text-muted-foreground mt-1">
                  Pode deixar vazio: vai pro "quando der".
                </p>
              )}
            </div>
            {tipo === "compromisso" ? (
              <div>
                <Label className="text-[12px]">Hora</Label>
                <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="rounded-xl mt-1" />
              </div>
            ) : (
              <div>
                <Label className="text-[12px]">Prioridade</Label>
                <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)}
                  className="w-full mt-1 h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  {Object.entries(ROTULO_PRIORIDADE).map(([k, v]) => (
                    <option key={k} value={k}>{v.txt}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {tipo === "compromisso" && (
            <div>
              <Label className="text-[12px]">Onde</Label>
              <Input value={local} onChange={(e) => setLocal(e.target.value)} maxLength={120}
                placeholder="Estúdio, online, endereço..." className="rounded-xl mt-1" />
            </div>
          )}

          {/* Amarrar numa peça e numa agência é o que faz o extrato do mês
              conseguir separar o trabalho por contratante. Os dois são
              opcionais: nem toda tarefa dela é de cliente. */}
          <div>
            <Label className="text-[12px]">Peça (opcional)</Label>
            <select value={postId} onChange={(e) => setPostId(e.target.value)}
              className="w-full mt-1 h-10 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="">Nenhuma</option>
              {(fila.data ?? []).map((c) => (
                <option key={c.post_id} value={c.post_id}>
                  {c.titulo || "Peça sem título"} · {c.cliente_nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-[12px]">Para qual agência (opcional)</Label>
            <select value={agenciaId} onChange={(e) => setAgenciaId(e.target.value)}
              className="w-full mt-1 h-10 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="">Nenhuma</option>
              {agencias.map((a) => (
                <option key={a.agencia_id} value={a.agencia_id}>{a.agencia_nome}</option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-[12px]">Anotação</Label>
            <Textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={600} rows={2}
              placeholder="Detalhe que você não quer esquecer" className="rounded-xl mt-1" />
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          {item && (
            <Button variant="outline" className="rounded-xl text-destructive hover:text-destructive" onClick={() => void remover()}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" className="rounded-xl flex-1" onClick={aoFechar}>Cancelar</Button>
          <Button className="rounded-xl flex-1" onClick={salvar} disabled={criar.isPending || editar.isPending}>
            {(criar.isPending || editar.isPending) && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
