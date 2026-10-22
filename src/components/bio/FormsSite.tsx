import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { lista, mascaraTelefone, txt, type DadosBloco } from "@/lib/bioBlocks";
import { validateUpload } from "@/lib/upload-validation";
import { CORES_BOTAO, REDES, pdfDoKit, type Rede } from "@/lib/bioCriadora";
import { BotaoImagem, EscolherFundo, LinhaCampo, SeletorIcone } from "@/components/bio/EditorCampos";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   FORMULÁRIOS DOS MODELOS CONSULTORIA E CRIADORA (22/10/2026)

   Mesmo jeito dos outros: um campo por coisa, lista com "adicionar" embaixo,
   e o que a pessoa digita salva sozinho (o FormBloco cuida do rascunho).
   ═══════════════════════════════════════════════════════════════════════════ */

type P = (patch: DadosBloco) => void;

const novoId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

/** Linha de lista com subir, descer e tirar. */
function Controles({ i, total, mover, tirar, rotulo }: {
  i: number; total: number; mover: (de: number, para: number) => void; tirar: (i: number) => void; rotulo: string;
}) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0} aria-label={`Subir ${rotulo}`} onClick={() => mover(i, i - 1)}>
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={i === total - 1} aria-label={`Descer ${rotulo}`} onClick={() => mover(i, i + 1)}>
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={`Tirar ${rotulo}`} onClick={() => tirar(i)}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/** Ajudante de lista dentro do bloco: trocar, mover, tirar, adicionar. */
function useLista<T extends Record<string, unknown>>(d: DadosBloco, p: P, chave: string) {
  const itens = lista<T>(d, chave);
  return {
    itens,
    trocar: (i: number, patch: Partial<T>) => p({ [chave]: itens.map((x, n) => (n === i ? { ...x, ...patch } : x)) }),
    mover: (de: number, para: number) => {
      if (para < 0 || para >= itens.length) return;
      const nova = [...itens]; const [x] = nova.splice(de, 1); nova.splice(para, 0, x);
      p({ [chave]: nova });
    },
    tirar: (i: number) => p({ [chave]: itens.filter((_, n) => n !== i) }),
    adicionar: (novo: T) => p({ [chave]: [...itens, novo] }),
  };
}

const caixa = "rounded-xl border border-border p-3 space-y-2 bg-muted/30";
const titulinho = "text-[11px] font-body font-semibold text-muted-foreground";

/* ── Pra onde o botão leva: WhatsApp, parte da página ou outro endereço ── */
export function EscolherDestino({ d, p, telefonePadrao, secoes, permitirSecao = true }: {
  d: DadosBloco; p: P; telefonePadrao?: string | null; secoes: { id: string; nome: string }[]; permitirSecao?: boolean;
}) {
  const destino = txt(d, "destino", "whatsapp");
  const opcoes = [
    { v: "whatsapp", r: "WhatsApp" },
    ...(permitirSecao ? [{ v: "secao", r: "Parte da página" }] : []),
    { v: "link", r: "Outro endereço" },
  ];
  return (
    <>
      <LinhaCampo label="Leva para">
        <div className="flex flex-wrap gap-1.5">
          {opcoes.map((o) => (
            <button key={o.v} type="button" onClick={() => p({ destino: o.v })}
              className={cn("rounded-lg border px-3 py-1.5 text-xs font-body font-semibold min-h-[32px]",
                destino === o.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {o.r}
            </button>
          ))}
        </div>
      </LinhaCampo>
      {destino === "whatsapp" && (
        <>
          <LinhaCampo label="Telefone" ajuda="Vazio usa o telefone do bloco Contato.">
            <Input value={txt(d, "telefone")} placeholder={telefonePadrao || "(00) 00000-0000"}
              onChange={(e) => p({ telefone: mascaraTelefone(e.target.value) })} inputMode="tel" className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Mensagem que já vai escrita">
            <Textarea rows={2} value={txt(d, "mensagem")} onChange={(e) => p({ mensagem: e.target.value })}
              placeholder="Olá! Vim pelo seu site." className="rounded-xl resize-none" />
          </LinhaCampo>
        </>
      )}
      {destino === "secao" && (
        <LinhaCampo label="Qual parte" ajuda="A página rola até lá. Só aparecem as partes que existem nesta página.">
          {secoes.length ? (
            <select value={txt(d, "secao").replace(/^#/, "")} onChange={(e) => p({ secao: e.target.value })}
              className="h-10 w-full sm:w-72 rounded-xl border border-input bg-background px-2 text-sm font-body" aria-label="Parte da página">
              <option value="">Escolha...</option>
              {secoes.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          ) : <p className="text-[11.5px] font-body text-muted-foreground">Adicione as seções da página primeiro.</p>}
        </LinhaCampo>
      )}
      {destino === "link" && (
        <LinhaCampo label="Endereço" ajuda="Agenda online, loja, formulário. Começa com https://">
          <Input value={txt(d, "url")} onChange={(e) => p({ url: e.target.value })} placeholder="https://" inputMode="url" className="rounded-xl" />
        </LinhaCampo>
      )}
    </>
  );
}

/* ═══ CONSULTORIA ═══ */

export function FormPraQuem({ d, p }: { d: DadosBloco; p: P }) {
  const itens = lista<unknown>(d, "itens").map((i) => (typeof i === "string" ? i : ""));
  const trocar = (i: number, v: string) => p({ itens: itens.map((x, n) => (n === i ? v : x)) });
  return (
    <div className="space-y-3.5">
      <LinhaCampo label="Título">
        <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} placeholder="É pra você se..." className="rounded-xl" />
      </LinhaCampo>
      <LinhaCampo label="Situações" ajuda="Escreva do jeito que o cliente fala, não do jeito técnico.">
        <div className="space-y-2">
          {itens.map((t, i) => (
            <div key={i} className="flex gap-1.5 items-center">
              <Input value={t} onChange={(e) => trocar(i, e.target.value)} maxLength={140} className="rounded-xl"
                placeholder={["Tudo ainda passa pela sua mão", "A equipe cresceu e a rotina não acompanhou", "Você quer tirar férias sem o celular tocar"][i] ?? ""}
                aria-label={`Situação ${i + 1}`} />
              <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label={`Tirar situação ${i + 1}`}
                onClick={() => p({ itens: itens.filter((_, n) => n !== i) })}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          {itens.length < 6 && (
            <Button type="button" size="sm" variant="outline" onClick={() => p({ itens: [...itens, ""] })}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar situação
            </Button>
          )}
        </div>
      </LinhaCampo>
      <EscolherFundo valor={txt(d, "fundo", "creme")} onTroca={(v) => p({ fundo: v })} />
    </div>
  );
}

type ServicoCru = { id?: string; nome?: string; duracao?: string; resumo?: string; inclui?: string; preco?: string; destaque?: boolean };

export function FormServicos({ d, p, telefonePadrao }: { d: DadosBloco; p: P; telefonePadrao?: string | null }) {
  const l = useLista<ServicoCru>(d, p, "itens");
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <LinhaCampo label="Rótulo pequeno">
          <Input value={txt(d, "rotulo")} onChange={(e) => p({ rotulo: e.target.value })} placeholder="Serviços" className="rounded-xl" />
        </LinhaCampo>
        <LinhaCampo label="Título da seção">
          <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} placeholder="Três jeitos de trabalhar comigo" className="rounded-xl" />
        </LinhaCampo>
      </div>
      {l.itens.map((s, i) => (
        <div key={s.id ?? i} className={caixa}>
          <div className="flex items-center justify-between gap-2">
            <span className={titulinho}>Serviço {i + 1}</span>
            <Controles i={i} total={l.itens.length} mover={l.mover} tirar={l.tirar} rotulo={`serviço ${i + 1}`} />
          </div>
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <Input value={s.nome ?? ""} onChange={(e) => l.trocar(i, { nome: e.target.value })} placeholder="Nome (Diagnóstico)" maxLength={60} className="rounded-xl" aria-label="Nome do serviço" />
            <Input value={s.duracao ?? ""} onChange={(e) => l.trocar(i, { duracao: e.target.value })} placeholder="2 semanas" maxLength={30} className="rounded-xl" aria-label="Duração" />
          </div>
          <Textarea rows={2} value={s.resumo ?? ""} onChange={(e) => l.trocar(i, { resumo: e.target.value })} maxLength={240}
            placeholder="Em uma frase, o que a pessoa ganha com ele" className="rounded-xl resize-none" aria-label="Resumo" />
          <Textarea rows={3} value={s.inclui ?? ""} onChange={(e) => l.trocar(i, { inclui: e.target.value })}
            placeholder={"O que inclui, um por linha:\nEntrevista com a equipe\nMapa dos processos\nPlano de 90 dias"} className="rounded-xl resize-none" aria-label="O que inclui, um por linha" />
          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <Input value={s.preco ?? ""} onChange={(e) => l.trocar(i, { preco: e.target.value })} placeholder="Preço a partir de (vazio esconde)" maxLength={24} className="rounded-xl" aria-label="Preço" />
            <label className="flex items-center gap-2 text-[11.5px] font-body cursor-pointer">
              <Switch checked={s.destaque === true} onCheckedChange={(v) => p({ itens: l.itens.map((x, n) => ({ ...x, destaque: n === i ? v : false })) })} />
              Mais procurado
            </label>
          </div>
        </div>
      ))}
      {l.itens.length < 6 && (
        <Button type="button" size="sm" variant="outline"
          onClick={() => l.adicionar({ id: novoId(), nome: "", duracao: "", resumo: "", inclui: "", preco: "", destaque: false })}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar serviço
        </Button>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <LinhaCampo label="Texto do botão de cada serviço">
          <Input value={txt(d, "botao")} onChange={(e) => p({ botao: e.target.value })} placeholder="Quero esse" className="rounded-xl" />
        </LinhaCampo>
        <LinhaCampo label="WhatsApp" ajuda="Vazio usa o do Contato. A mensagem já vai com o nome do serviço.">
          <Input value={txt(d, "telefone")} onChange={(e) => p({ telefone: mascaraTelefone(e.target.value) })}
            placeholder={telefonePadrao || "(00) 00000-0000"} inputMode="tel" className="rounded-xl" />
        </LinhaCampo>
      </div>
      <EscolherFundo valor={txt(d, "fundo", "creme")} onTroca={(v) => p({ fundo: v })} />
    </div>
  );
}

export function FormEtapas({ d, p }: { d: DadosBloco; p: P }) {
  const l = useLista<{ titulo?: string; texto?: string }>(d, p, "itens");
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <LinhaCampo label="Rótulo pequeno">
          <Input value={txt(d, "rotulo")} onChange={(e) => p({ rotulo: e.target.value })} placeholder="Como funciona" className="rounded-xl" />
        </LinhaCampo>
        <LinhaCampo label="Título (opcional)">
          <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} className="rounded-xl" />
        </LinhaCampo>
      </div>
      {l.itens.map((e, i) => (
        <div key={i} className={caixa}>
          <div className="flex items-center justify-between gap-2">
            <span className={titulinho}>Etapa {String(i + 1).padStart(2, "0")}</span>
            <Controles i={i} total={l.itens.length} mover={l.mover} tirar={l.tirar} rotulo={`etapa ${i + 1}`} />
          </div>
          <Input value={e.titulo ?? ""} onChange={(ev) => l.trocar(i, { titulo: ev.target.value })} maxLength={70}
            placeholder={["Conversa inicial", "Proposta sob medida", "Mão na massa"][i] ?? "Título da etapa"} className="rounded-xl" aria-label="Título da etapa" />
          <Textarea rows={2} value={e.texto ?? ""} onChange={(ev) => l.trocar(i, { texto: ev.target.value })} maxLength={260}
            placeholder="O que acontece aqui e em quanto tempo" className="rounded-xl resize-none" aria-label="Texto da etapa" />
        </div>
      ))}
      {l.itens.length < 6 && (
        <Button type="button" size="sm" variant="outline" onClick={() => l.adicionar({ titulo: "", texto: "" })}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar etapa
        </Button>
      )}
      <EscolherFundo valor={txt(d, "fundo", "creme")} onTroca={(v) => p({ fundo: v })} />
    </div>
  );
}

export function FormChamada({ d, p, telefonePadrao, secoes }: { d: DadosBloco; p: P; telefonePadrao?: string | null; secoes: { id: string; nome: string }[] }) {
  return (
    <div className="space-y-3.5">
      <LinhaCampo label="Título">
        <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} placeholder="Vamos conversar sobre a sua empresa?" className="rounded-xl" />
      </LinhaCampo>
      <LinhaCampo label="Texto">
        <Textarea rows={2} value={txt(d, "texto")} onChange={(e) => p({ texto: e.target.value })}
          placeholder="Uma conversa de 30 minutos pra entender o momento do negócio." className="rounded-xl resize-none" />
      </LinhaCampo>
      <LinhaCampo label="Texto do botão">
        <Input value={txt(d, "botao")} onChange={(e) => p({ botao: e.target.value })} placeholder="Escolher um horário" className="rounded-xl" />
      </LinhaCampo>
      <EscolherDestino d={d} p={p} telefonePadrao={telefonePadrao} secoes={secoes.filter((s) => s.id !== "agendar")} />
      <LinhaCampo label="Nota embaixo do botão (opcional)">
        <Input value={txt(d, "nota")} onChange={(e) => p({ nota: e.target.value })} placeholder="Atendo online e presencial em Itajaí" className="rounded-xl" />
      </LinhaCampo>
      <EscolherFundo valor={txt(d, "fundo", "creme")} onTroca={(v) => p({ fundo: v })} />
    </div>
  );
}

/* ═══ CRIADORA ═══ */

type RedeCru = { rede?: string; numero?: string; url?: string; auto?: boolean };

export function FormPerfilCriadora({ d, p }: { d: DadosBloco; p: P }) {
  const l = useLista<RedeCru>(d, p, "redes");
  const usadas = new Set(l.itens.map((r) => r.rede));
  const livres = (Object.keys(REDES) as Rede[]).filter((r) => !usadas.has(r));
  return (
    <div className="space-y-3.5">
      <LinhaCampo label="Foto grande" ajuda="Em pé, de preferência. O nome e a frase ficam por cima, embaixo.">
        <BotaoImagem valor={txt(d, "foto")} onTroca={(u) => p({ foto: u })} rotulo="Enviar foto" />
      </LinhaCampo>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <LinhaCampo label="Nome" ajuda="Vazio usa o nome da página.">
          <Input value={txt(d, "nome")} onChange={(e) => p({ nome: e.target.value })} maxLength={40} className="rounded-xl" />
        </LinhaCampo>
        <LinhaCampo label="Cidade (opcional)">
          <Input value={txt(d, "cidade")} onChange={(e) => p({ cidade: e.target.value })} placeholder="Itajaí · SC" maxLength={30} className="rounded-xl" />
        </LinhaCampo>
      </div>
      <LinhaCampo label="Frase">
        <Input value={txt(d, "frase")} onChange={(e) => p({ frase: e.target.value })} maxLength={120}
          placeholder="Rotina, café e receitas fáceis pra quem mora sozinha." className="rounded-xl" />
      </LinhaCampo>
      <LinhaCampo label="Selo (opcional)" ajuda="Aparece no canto da foto. Vazio some.">
        <Input value={txt(d, "selo")} onChange={(e) => p({ selo: e.target.value })} placeholder="Aceito parcerias" maxLength={30} className="rounded-xl" />
      </LinhaCampo>

      <LinhaCampo label="Redes embaixo da foto" ajuda="Até 3. Rede sem número não aparece.">
        <div className="space-y-2">
          {l.itens.map((r, i) => {
            const rede = (r.rede && r.rede in REDES ? r.rede : "instagram") as Rede;
            const auto = rede === "instagram" && r.auto === true;
            return (
              <div key={i} className={caixa}>
                <div className="flex items-center justify-between gap-2">
                  <span className={titulinho}>{REDES[rede].nome}</span>
                  <Controles i={i} total={l.itens.length} mover={l.mover} tirar={l.tirar} rotulo={REDES[rede].nome} />
                </div>
                {rede === "instagram" && (
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <Switch checked={auto} onCheckedChange={(v) => l.trocar(i, { auto: v })} className="mt-0.5" />
                    <span className="text-[11.5px] font-body leading-snug">
                      <b className="block text-foreground">Puxar do Instagram conectado</b>
                      <span className="text-muted-foreground">O número de seguidores se atualiza sozinho. Sem conexão, usa o que estiver digitado.</span>
                    </span>
                  </label>
                )}
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <Input value={r.numero ?? ""} onChange={(e) => l.trocar(i, { numero: e.target.value })} placeholder="18 mil" maxLength={14}
                    className="rounded-xl" aria-label={`Seguidores no ${REDES[rede].nome}`} />
                  <Input value={r.url ?? ""} onChange={(e) => l.trocar(i, { url: e.target.value })} placeholder={`${REDES[rede].base}seuperfil`}
                    inputMode="url" className="rounded-xl" aria-label={`Link do ${REDES[rede].nome}`} />
                </div>
              </div>
            );
          })}
          {l.itens.length < 3 && livres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {livres.map((r) => (
                <Button key={r} type="button" size="sm" variant="outline"
                  onClick={() => l.adicionar({ rede: r, numero: "", url: "", auto: r === "instagram" })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> {REDES[r].nome}
                </Button>
              ))}
            </div>
          )}
        </div>
      </LinhaCampo>
    </div>
  );
}

type BotaoCru = { titulo?: string; sub?: string; url?: string; cor?: string; icone?: string };

export function FormBotoes({ d, p }: { d: DadosBloco; p: P }) {
  const l = useLista<BotaoCru>(d, p, "itens");
  return (
    <div className="space-y-3.5">
      {l.itens.map((b, i) => (
        <div key={i} className={caixa}>
          <div className="flex items-center justify-between gap-2">
            <span className={titulinho}>Botão {i + 1}</span>
            <Controles i={i} total={l.itens.length} mover={l.mover} tirar={l.tirar} rotulo={`botão ${i + 1}`} />
          </div>
          <Input value={b.titulo ?? ""} onChange={(e) => l.trocar(i, { titulo: e.target.value })} placeholder="Meus achadinhos" maxLength={60} className="rounded-xl" aria-label="Texto do botão" />
          <Input value={b.sub ?? ""} onChange={(e) => l.trocar(i, { sub: e.target.value })} placeholder="Linha de apoio (opcional)" maxLength={80} className="rounded-xl" aria-label="Linha de apoio" />
          <Input value={b.url ?? ""} onChange={(e) => l.trocar(i, { url: e.target.value })} placeholder="https://" inputMode="url" className="rounded-xl" aria-label="Endereço" />
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] font-body text-muted-foreground">Cor:</span>
            {(Object.keys(CORES_BOTAO) as (keyof typeof CORES_BOTAO)[]).map((c) => (
              <button key={c} type="button" onClick={() => l.trocar(i, { cor: c })}
                className={cn("rounded-lg border px-2.5 py-1 text-[11px] font-body font-semibold min-h-[28px]",
                  (b.cor ?? "marca") === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                {CORES_BOTAO[c].nome}
              </button>
            ))}
          </div>
          <SeletorIcone valor={b.icone ?? ""} onTroca={(v) => l.trocar(i, { icone: v })} />
        </div>
      ))}
      {l.itens.length < 8 && (
        <Button type="button" size="sm" variant="outline" onClick={() => l.adicionar({ titulo: "", sub: "", url: "", cor: "marca", icone: "" })}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar botão
        </Button>
      )}
    </div>
  );
}

type VideoCru = { foto?: string; url?: string; views?: string };

export function FormVideos({ d, p }: { d: DadosBloco; p: P }) {
  const l = useLista<VideoCru>(d, p, "itens");
  const fonte = txt(d, "fonte", "manual");
  const quantos = [3, 6, 9].includes(Number(d.quantos)) ? Number(d.quantos) : 6;
  return (
    <div className="space-y-3.5">
      <LinhaCampo label="Título">
        <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} placeholder="Últimos vídeos" className="rounded-xl" />
      </LinhaCampo>
      <LinhaCampo label="De onde vêm">
        <div className="flex gap-1.5">
          {[{ v: "instagram", r: "Do Instagram conectado" }, { v: "manual", r: "Eu escolho" }].map((o) => (
            <button key={o.v} type="button" onClick={() => p({ fonte: o.v })}
              className={cn("rounded-lg border px-3 py-1.5 text-xs font-body font-semibold min-h-[32px]",
                fonte === o.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {o.r}
            </button>
          ))}
        </div>
      </LinhaCampo>
      {fonte === "instagram" && (
        <p className="text-[11.5px] font-body text-muted-foreground leading-snug">
          Entram os posts mais recentes do Instagram conectado em Redes, com as views. Sem Instagram conectado, a seção não aparece.
        </p>
      )}
      <LinhaCampo label="Quantos mostrar">
        <div className="flex gap-1.5">
          {[3, 6, 9].map((n) => (
            <button key={n} type="button" onClick={() => p({ quantos: n })}
              className={cn("rounded-lg border px-3 py-1.5 text-xs font-body font-semibold min-h-[32px] min-w-[44px]",
                quantos === n ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{n}</button>
          ))}
        </div>
      </LinhaCampo>
      {fonte === "manual" && (
        <>
          {l.itens.map((v, i) => (
            <div key={i} className={caixa}>
              <div className="flex items-center justify-between gap-2">
                <span className={titulinho}>Vídeo {i + 1}</span>
                <Controles i={i} total={l.itens.length} mover={l.mover} tirar={l.tirar} rotulo={`vídeo ${i + 1}`} />
              </div>
              <BotaoImagem valor={v.foto ?? ""} onTroca={(u) => l.trocar(i, { foto: u })} rotulo="Capa do vídeo" />
              <div className="grid grid-cols-[1fr_96px] gap-2">
                <Input value={v.url ?? ""} onChange={(e) => l.trocar(i, { url: e.target.value })} placeholder="Link do vídeo (Instagram, TikTok, YouTube)" inputMode="url" className="rounded-xl" aria-label="Link do vídeo" />
                <Input value={v.views ?? ""} onChange={(e) => l.trocar(i, { views: e.target.value })} placeholder="12 mil" maxLength={12} className="rounded-xl" aria-label="Views" />
              </div>
            </div>
          ))}
          {l.itens.length < 9 && (
            <Button type="button" size="sm" variant="outline" onClick={() => l.adicionar({ foto: "", url: "", views: "" })}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar vídeo
            </Button>
          )}
        </>
      )}
      <LinhaCampo label="Link de &quot;ver todos&quot; (opcional)" ajuda="Do Instagram conectado, já vai pro seu perfil sozinho.">
        <Input value={txt(d, "perfil")} onChange={(e) => p({ perfil: e.target.value })} placeholder="https://www.tiktok.com/@seuperfil" inputMode="url" className="rounded-xl" />
      </LinhaCampo>
    </div>
  );
}

type CupomCru = { marca?: string; desconto?: string; codigo?: string; url?: string };

export function FormCupons({ d, p }: { d: DadosBloco; p: P }) {
  const l = useLista<CupomCru>(d, p, "itens");
  return (
    <div className="space-y-3.5">
      <LinhaCampo label="Título">
        <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} placeholder="Meus cupons" className="rounded-xl" />
      </LinhaCampo>
      {l.itens.map((c, i) => (
        <div key={i} className={caixa}>
          <div className="flex items-center justify-between gap-2">
            <span className={titulinho}>Cupom {i + 1}</span>
            <Controles i={i} total={l.itens.length} mover={l.mover} tirar={l.tirar} rotulo={`cupom ${i + 1}`} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={c.marca ?? ""} onChange={(e) => l.trocar(i, { marca: e.target.value })} placeholder="Marca" maxLength={40} className="rounded-xl" aria-label="Marca" />
            <Input value={c.desconto ?? ""} onChange={(e) => l.trocar(i, { desconto: e.target.value })} placeholder="10% off" maxLength={40} className="rounded-xl" aria-label="Desconto" />
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <Input value={c.codigo ?? ""} onChange={(e) => l.trocar(i, { codigo: e.target.value.replace(/\s+/g, "").toUpperCase() })} placeholder="BIA10" maxLength={30}
              className="rounded-xl font-mono" aria-label="Código" />
            <Input value={c.url ?? ""} onChange={(e) => l.trocar(i, { url: e.target.value })} placeholder="Link da loja (opcional)" inputMode="url" className="rounded-xl" aria-label="Link da loja" />
          </div>
        </div>
      ))}
      {l.itens.length < 8 && (
        <Button type="button" size="sm" variant="outline" onClick={() => l.adicionar({ marca: "", desconto: "", codigo: "", url: "" })}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar cupom
        </Button>
      )}
    </div>
  );
}

/** Sobe o PDF do mídia kit pro bucket da bio, na pasta de quem está logado.
 *  Confere a assinatura "%PDF-" do arquivo: extensão e tipo o navegador deduz
 *  do nome, e nome qualquer um troca. */
function BotaoPdf({ valor, onTroca }: { valor: string; onTroca: (url: string) => void }) {
  const { user } = useAuth();
  const ref = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState(false);
  const enviar = async (f: File) => {
    const v = validateUpload(f, "bioPdf");
    if (!v.ok) { toast.error(v.reason); return; }
    const cabeca = new Uint8Array(await f.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...cabeca) !== "%PDF-") { toast.error("Esse arquivo não é um PDF."); return; }
    if (!user?.id) return;
    setSubindo(true);
    try {
      const caminho = `${user.id}/midiakit-${Date.now()}.pdf`;
      const { error } = await supabase.storage.from("bio-media").upload(caminho, f, { upsert: false, contentType: "application/pdf" });
      if (error) { toast.error("Não consegui enviar o PDF."); return; }
      onTroca(supabase.storage.from("bio-media").getPublicUrl(caminho).data.publicUrl);
      toast.success("PDF no ar.");
    } finally { setSubindo(false); }
  };
  const atual = pdfDoKit(valor);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={ref} type="file" accept="application/pdf,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void enviar(f); }} />
      <Button type="button" size="sm" variant="outline" disabled={subindo} onClick={() => ref.current?.click()}>
        {subindo ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
        {atual ? "Trocar PDF" : "Enviar PDF"}
      </Button>
      {atual && (
        <>
          <a href={atual} target="_blank" rel="noopener noreferrer" className="text-[12px] font-body text-primary underline">Ver o atual</a>
          <Button type="button" size="sm" variant="ghost" onClick={() => onTroca("")}>Remover</Button>
        </>
      )}
    </div>
  );
}

type FormatoCru = { nome?: string; inclui?: string; preco?: string };

export function FormMidiaKit({ d, p }: { d: DadosBloco; p: P }) {
  const pub = useLista<{ rotulo?: string; pct?: string }>(d, p, "publico");
  const fmt = useLista<FormatoCru>(d, p, "formatos");
  const mar = useLista<{ nome?: string; logo?: string }>(d, p, "marcas");
  const auto = d.auto === true;
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <LinhaCampo label="Rótulo pequeno">
          <Input value={txt(d, "rotulo")} onChange={(e) => p({ rotulo: e.target.value })} placeholder="Pra marcas" className="rounded-xl" />
        </LinhaCampo>
        <LinhaCampo label="Título">
          <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} placeholder="Quem me assiste" className="rounded-xl" />
        </LinhaCampo>
      </div>

      <label className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 px-3 py-2.5 cursor-pointer">
        <Switch checked={auto} onCheckedChange={(v) => p({ auto: v })} className="mt-0.5 shrink-0" />
        <span className="min-w-0">
          <span className="block text-xs font-body font-semibold text-foreground">Puxar os números do Instagram conectado</span>
          <span className="block text-[11px] font-body text-muted-foreground leading-snug">
            Público (gênero, idade, estado e cidade), engajamento e alcance de 30 dias, em porcentagem. Só aparece com 100 seguidores ou mais.
            Sem conexão, usa o que você digitar abaixo.
          </span>
        </span>
      </label>

      <LinhaCampo label={auto ? "Público (reserva, se o Instagram não responder)" : "Público"} ajuda="Até 5 linhas. A barra enche até a porcentagem.">
        <div className="space-y-2">
          {pub.itens.map((x, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_auto] gap-2 items-center">
              <Input value={x.rotulo ?? ""} onChange={(e) => pub.trocar(i, { rotulo: e.target.value })} placeholder="Mulheres" maxLength={40} className="rounded-xl" aria-label="Recorte do público" />
              <Input value={x.pct ?? ""} onChange={(e) => pub.trocar(i, { pct: e.target.value.replace(/[^\d]/g, "").slice(0, 3) })} placeholder="78" inputMode="numeric" className="rounded-xl" aria-label="Porcentagem" />
              <Button type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label="Tirar" onClick={() => pub.tirar(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          {pub.itens.length < 5 && (
            <Button type="button" size="sm" variant="outline" onClick={() => pub.adicionar({ rotulo: "", pct: "" })}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar linha
            </Button>
          )}
        </div>
      </LinhaCampo>
      {!auto && (
        <div className="grid grid-cols-2 gap-3">
          <LinhaCampo label="Engajamento médio">
            <Input value={txt(d, "engajamento")} onChange={(e) => p({ engajamento: e.target.value })} placeholder="4,2%" maxLength={14} className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Alcance por mês">
            <Input value={txt(d, "alcance")} onChange={(e) => p({ alcance: e.target.value })} placeholder="80 mil" maxLength={14} className="rounded-xl" />
          </LinhaCampo>
        </div>
      )}

      <LinhaCampo label="Formatos" ajuda="Viram abas: a marca toca e vê o que inclui e o preço.">
        <div className="space-y-2">
          {fmt.itens.map((f, i) => (
            <div key={i} className={caixa}>
              <div className="flex items-center justify-between gap-2">
                <span className={titulinho}>Formato {i + 1}</span>
                <Controles i={i} total={fmt.itens.length} mover={fmt.mover} tirar={fmt.tirar} rotulo={`formato ${i + 1}`} />
              </div>
              <div className="grid grid-cols-[1fr_120px] gap-2">
                <Input value={f.nome ?? ""} onChange={(e) => fmt.trocar(i, { nome: e.target.value })} placeholder="Reels" maxLength={24} className="rounded-xl" aria-label="Nome do formato" />
                <Input value={f.preco ?? ""} onChange={(e) => fmt.trocar(i, { preco: e.target.value })} placeholder="Preço" maxLength={20} className="rounded-xl" aria-label="Preço a partir de" />
              </div>
              <Textarea rows={3} value={f.inclui ?? ""} onChange={(e) => fmt.trocar(i, { inclui: e.target.value })}
                placeholder={"O que inclui, um por linha:\n1 Reels de até 60s\nRoteiro aprovado antes\nRelatório em 7 dias"} className="rounded-xl resize-none" aria-label="O que inclui" />
            </div>
          ))}
          {fmt.itens.length < 4 && (
            <Button type="button" size="sm" variant="outline" onClick={() => fmt.adicionar({ nome: "", inclui: "", preco: "" })}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar formato
            </Button>
          )}
        </div>
      </LinhaCampo>

      <LinhaCampo label="Marcas que já trabalharam com você" ajuda="Nome ou logo. Até 9.">
        <div className="space-y-2">
          {mar.itens.map((m, i) => (
            <div key={i} className={caixa}>
              <div className="flex items-center justify-between gap-2">
                <Input value={m.nome ?? ""} onChange={(e) => mar.trocar(i, { nome: e.target.value })} placeholder="Nome da marca" maxLength={30} className="rounded-xl" aria-label="Nome da marca" />
                <Controles i={i} total={mar.itens.length} mover={mar.mover} tirar={mar.tirar} rotulo={`marca ${i + 1}`} />
              </div>
              <BotaoImagem valor={m.logo ?? ""} onTroca={(u) => mar.trocar(i, { logo: u })} rotulo="Logo (opcional)" />
            </div>
          ))}
          {mar.itens.length < 9 && (
            <Button type="button" size="sm" variant="outline" onClick={() => mar.adicionar({ nome: "", logo: "" })}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar marca
            </Button>
          )}
        </div>
      </LinhaCampo>

      <LinhaCampo label="Mídia kit em PDF (opcional)" ajuda="Até 15 MB. Sem PDF, o botão de baixar não aparece.">
        <BotaoPdf valor={txt(d, "pdf")} onTroca={(u) => p({ pdf: u })} />
      </LinhaCampo>
      {pdfDoKit(txt(d, "pdf")) && (
        <LinhaCampo label="Texto do botão do PDF">
          <Input value={txt(d, "botaoPdf")} onChange={(e) => p({ botaoPdf: e.target.value })} placeholder="Baixar mídia kit em PDF" className="rounded-xl" />
        </LinhaCampo>
      )}
    </div>
  );
}

/** Campo "leva para" de botão: endereço de fora OU uma parte desta página.
 *  As partes aparecem como atalhos embaixo, pra ninguém ter que saber o que
 *  é "#servicos". */
export function CampoLeva({ valor, onTroca, secoes, placeholder = "https://" }: {
  valor: string; onTroca: (v: string) => void; secoes: { id: string; nome: string }[]; placeholder?: string;
}) {
  const s = secoes.find((x) => `#${x.id}` === valor.trim());
  return (
    <div className="space-y-1.5">
      <Input value={s ? `Rola até: ${s.nome}` : valor} readOnly={!!s}
        onChange={(e) => onTroca(e.target.value)} onFocus={(e) => { if (s) { onTroca(""); e.currentTarget.value = ""; } }}
        placeholder={placeholder} inputMode="url" className={cn("rounded-xl", s && "text-primary font-semibold")} />
      {secoes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {secoes.filter((x) => x.id !== "topo").slice(0, 6).map((x) => (
            <button key={x.id} type="button" onClick={() => onTroca(`#${x.id}`)}
              className={cn("rounded-full border px-2 py-0.5 text-[10.5px] font-body min-h-[26px]",
                s?.id === x.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {x.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
