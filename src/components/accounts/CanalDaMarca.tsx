import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, ExternalLink, Eye, Folder, Loader2, Megaphone, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useCrmClient, useCrmClients, useUpdateCrmClient } from "@/hooks/useCrm";
import { useExternalClients, type ExternalClient } from "@/hooks/useCriaPost";
import { usePecasComParceiros, useMeusParceiros } from "@/hooks/useParceiro";
import { clienteInativo } from "@/lib/cliente-status";
import { nomeExibidoCliente } from "@/lib/cliente-nome";
import { LinksUteis, type LinkUtil } from "@/components/accounts/LinksUteisEditor";
import { hrefSeguro } from "@/lib/href-seguro";

/* ═══════════════════════════════════════════════════════════════════════════
   CANAL DA MARCA (Walter, 28/09/2026)

   "Um canal direto entre as informações que a social media quer deixar sempre
   disponível pra designer: links úteis, link do drive, informações de dentro
   do cliente. Hoje acho que deve ter isso, mas procurei um monte e não achei."

   Tinha metade (os Links úteis), escondida numa aba da ficha do cliente. Aqui
   fica tudo o que o parceiro recebe de um cliente, num lugar pensado PRA ele:

     Recado fixo    a regra que ela repetia peça por peça no WhatsApp
     Pasta geral    fotos, logos, vídeos brutos: vale pra toda peça
     Links úteis    os mesmos da ficha (é o mesmo campo, não uma cópia)
     A marca        o que o parceiro já vê do brandbook, só leitura

   Tudo aparece no topo de todo card do cliente e na ficha da marca do
   parceiro. Salva sozinho ao sair do campo.
   ═══════════════════════════════════════════════════════════════════════════ */

type CrmComCanal = {
  id: string;
  name: string;
  display_name?: string | null;
  color?: string | null;
  logo?: string | null;
  useful_links?: LinkUtil[] | null;
  pasta_parceiros?: string | null;
  recado_parceiros?: string | null;
  brand_core?: Record<string, unknown> | null;
};

const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function EditorDoCanal({ clienteId, pecasAbertas }: { clienteId: string; pecasAbertas: number }) {
  const { data, isLoading } = useCrmClient(clienteId);
  const c = data as unknown as CrmComCanal | null;
  const update = useUpdateCrmClient();
  const [recado, setRecado] = useState("");
  const [pasta, setPasta] = useState("");
  const [salvo, setSalvo] = useState<string | null>(null);

  // Adota o servidor quando troca de cliente (ou quando a gravação volta).
  useEffect(() => {
    setRecado(c?.recado_parceiros ?? "");
    setPasta(c?.pasta_parceiros ?? "");
  }, [c?.id, c?.recado_parceiros, c?.pasta_parceiros]);

  const gravar = (campo: "recado_parceiros" | "pasta_parceiros", valor: string) => {
    const limpo = valor.trim();
    const atual = (campo === "recado_parceiros" ? c?.recado_parceiros : c?.pasta_parceiros) ?? "";
    if (limpo === atual.trim()) return;
    if (campo === "pasta_parceiros" && limpo && !/^https?:\/\//i.test(limpo)) {
      toast.error("O link da pasta precisa começar com http:// ou https://");
      return;
    }
    update.mutate({ id: clienteId, [campo]: limpo || null } as never, {
      onSuccess: () => { setSalvo(campo); window.setTimeout(() => setSalvo(null), 1800); },
    });
  };

  if (isLoading || !c) {
    return <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const bc = (c.brand_core ?? {}) as Record<string, unknown>;
  const marca = [
    { r: "Cores", v: txt(bc.colorPalette) },
    { r: "Fontes", v: txt(bc.typography) },
    { r: "Expressão visual", v: txt(bc.visualExpression) },
    { r: "Tom de voz", v: txt(bc.toneOfVoice) },
    { r: "O que evitar", v: txt(bc.avoid) },
  ].filter((x) => x.v);
  const cor = c.color || "#7C90F0";
  const nome = nomeExibidoCliente(c as never);

  const Salvo = ({ campo }: { campo: string }) => salvo === campo
    ? <span className="inline-flex items-center gap-1 text-[11px] font-body font-bold text-green-700"><Check className="h-3 w-3" /> salvo</span>
    : null;

  return (
    <div className="space-y-4">
      {/* Quem é e quantas peças estão com parceiros agora. */}
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-full border border-border overflow-hidden grid place-items-center shrink-0"
          style={{ background: c.logo ? "#fff" : cor }}>
          {c.logo
            ? <img src={c.logo} alt="" className="w-full h-full object-contain" loading="lazy" />
            : <span className="text-white font-display font-bold">{nome.charAt(0).toUpperCase()}</span>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-extrabold text-lg leading-tight truncate">{nome}</p>
          <p className="text-[12px] font-body text-muted-foreground">
            {pecasAbertas > 0 ? `${pecasAbertas} peça${pecasAbertas === 1 ? "" : "s"} com parceiros agora` : "Nenhuma peça com parceiros agora"}
            {" · "}tudo aqui aparece no topo de todo card deste cliente
          </p>
        </div>
      </div>

      {/* 1. RECADO FIXO */}
      <Card className="rounded-2xl p-4 border-amber-200 bg-amber-50/40">
        <div className="flex items-center gap-2 mb-1">
          <Megaphone className="h-4 w-4 text-amber-700" />
          <p className="text-[13px] font-display font-bold flex-1">Recado fixo pro parceiro</p>
          <Salvo campo="recado_parceiros" />
        </div>
        <p className="text-[12px] font-body text-muted-foreground mb-2 leading-snug">
          A regra que vale pra toda peça deste cliente. O parceiro lê isso antes de começar, em todo card.
        </p>
        <Textarea value={recado} onChange={(e) => setRecado(e.target.value)} onBlur={() => gravar("recado_parceiros", recado)}
          rows={4} maxLength={1500}
          placeholder={"Ex.: Logo sempre branca em fundo escuro.\nNunca usar vermelho (é da concorrente).\nFotos novas de produto na pasta Junho."}
          className="rounded-xl bg-card text-[13.5px]" />
      </Card>

      {/* 2. PASTA GERAL */}
      <Card className="rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Folder className="h-4 w-4 text-primary" />
          <p className="text-[13px] font-display font-bold flex-1">Pasta geral do cliente</p>
          <Salvo campo="pasta_parceiros" />
        </div>
        <p className="text-[12px] font-body text-muted-foreground mb-2 leading-snug">
          Onde ficam logos, fotos e vídeos brutos. Diferente da "pasta desta peça", que você coloca no post.
          Confira se o link está liberado pra quem tem o link.
        </p>
        <div className="flex gap-2">
          <Input value={pasta} onChange={(e) => setPasta(e.target.value)} onBlur={() => gravar("pasta_parceiros", pasta)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            inputMode="url" placeholder="https://drive.google.com/drive/folders/..." className="rounded-xl h-10 flex-1 min-w-0" />
          {c.pasta_parceiros && (
            <a href={hrefSeguro(c.pasta_parceiros)} target="_blank" rel="noopener noreferrer" aria-label="Abrir pasta"
              className="w-10 h-10 rounded-xl border border-border grid place-items-center text-muted-foreground hover:text-primary shrink-0">
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </Card>

      {/* 3. LINKS ÚTEIS: o MESMO editor da ficha do cliente. */}
      <div>
        <LinksUteis clientId={c.id} links={c.useful_links ?? null} />
        <p className="text-[11.5px] font-body text-muted-foreground mt-1.5 px-1">
          São os mesmos Links úteis da ficha do cliente: mudar aqui muda lá.
        </p>
      </div>

      {/* 4. A MARCA, COMO O PARCEIRO VÊ */}
      <Card className="rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <p className="text-[13px] font-display font-bold flex-1">O que o parceiro vê da marca</p>
          <Link to={`/socialmidia/clientes/${c.id}/brandbook`} className="text-[12px] font-body font-bold text-primary hover:underline">
            Editar brandbook
          </Link>
        </div>
        {marca.length === 0 ? (
          <p className="text-[12.5px] font-body text-muted-foreground leading-relaxed">
            O brandbook deste cliente ainda está vazio. Cores, fontes e o que evitar são o que o designer mais consulta:
            vale preencher.
          </p>
        ) : (
          <dl className="grid gap-2">
            {marca.map((m) => (
              <div key={m.r} className="grid grid-cols-[110px_1fr] gap-2 text-[12.5px] font-body">
                <dt className="text-muted-foreground font-semibold">{m.r}</dt>
                <dd className="text-foreground whitespace-pre-line line-clamp-3">{m.v}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="text-[11px] font-body text-muted-foreground mt-2.5 flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> As anotações internas do cliente continuam só com você.
        </p>
      </Card>
    </div>
  );
}

export function CanalDaMarca() {
  const [params, setParams] = useSearchParams();
  const { data: crm = [], isLoading } = useCrmClients();
  const { clients } = useExternalClients();
  const { data: parceiros = [] } = useMeusParceiros();
  const { data: pecas = [] } = usePecasComParceiros(parceiros.length > 0);
  const [busca, setBusca] = useState("");

  /* Peças abertas com parceiro por cliente do CRM: quem tem trabalho rolando
     vem primeiro na lista, que é onde o recado faz diferença hoje. */
  const abertasPorCrm = useMemo(() => {
    const ecParaCrm = new Map<string, string>();
    for (const e of clients as ExternalClient[]) if (e.crm_client_id) ecParaCrm.set(e.id, e.crm_client_id);
    const m = new Map<string, number>();
    for (const p of pecas) {
      if (p.producao_status === "entregue" || !p.external_client_id) continue;
      const crmId = ecParaCrm.get(p.external_client_id);
      if (crmId) m.set(crmId, (m.get(crmId) ?? 0) + 1);
    }
    return m;
  }, [clients, pecas]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (crm as unknown as (CrmComCanal & { status?: string | null; active?: boolean | null; contract_end_date?: string | null })[])
      .filter((c) => !clienteInativo(c as never))
      .filter((c) => !q || nomeExibidoCliente(c as never).toLowerCase().includes(q))
      .sort((a, b) => (abertasPorCrm.get(b.id) ?? 0) - (abertasPorCrm.get(a.id) ?? 0)
        || nomeExibidoCliente(a as never).localeCompare(nomeExibidoCliente(b as never)));
  }, [crm, busca, abertasPorCrm]);

  const selecionado = params.get("cliente") ?? lista[0]?.id ?? null;
  const escolher = (id: string) => { const n = new URLSearchParams(params); n.set("cliente", id); setParams(n, { replace: true }); };

  if (isLoading) return <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (crm.length === 0) {
    return (
      <Card className="p-10 rounded-2xl border-dashed text-center">
        <p className="text-sm font-body font-medium">Nenhum cliente cadastrado ainda</p>
        <p className="text-xs text-muted-foreground font-body mt-1">Cadastre em Clientes e volte aqui pra deixar o material fixo de cada um.</p>
      </Card>
    );
  }

  const preenchido = (c: CrmComCanal) =>
    !!(c.recado_parceiros?.trim() || c.pasta_parceiros?.trim() || (c.useful_links ?? []).length);

  return (
    <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">
      {/* A lista de clientes. No celular vira uma tira que rola de lado. */}
      <div className="lg:sticky lg:top-4 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente"
            className="w-full h-9 rounded-xl border border-border bg-card pl-8 pr-3 text-[13px] font-body" />
        </div>
        <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible lg:max-h-[calc(100dvh-300px)] lg:overflow-y-auto -mx-1 px-1 pb-1 scrollbar-none">
          {lista.map((c) => {
            const ativo = c.id === selecionado;
            const abertas = abertasPorCrm.get(c.id) ?? 0;
            return (
              <button key={c.id} type="button" onClick={() => escolher(c.id)}
                className={cn("shrink-0 lg:w-full flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors",
                  ativo ? "border-primary bg-primary/[0.06]" : "border-border bg-card hover:border-primary/40")}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color || "#9ca3af" }} />
                <span className="min-w-0 flex-1 text-[13px] font-body font-semibold truncate max-w-[160px] lg:max-w-none">{nomeExibidoCliente(c as never)}</span>
                {abertas > 0 && <span className="text-[10.5px] font-bold tabular-nums rounded-full px-1.5 py-0.5 bg-violet-100 text-violet-700">{abertas}</span>}
                {preenchido(c)
                  ? <Check className="h-3.5 w-3.5 text-green-600 shrink-0" aria-label="Canal preenchido" />
                  : <span className="text-[10px] font-body text-muted-foreground shrink-0 hidden lg:inline">vazio</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-w-0">
        {selecionado
          ? <EditorDoCanal key={selecionado} clienteId={selecionado} pecasAbertas={abertasPorCrm.get(selecionado) ?? 0} />
          : <p className="text-sm font-body text-muted-foreground">Escolha um cliente.</p>}
      </div>
    </div>
  );
}
