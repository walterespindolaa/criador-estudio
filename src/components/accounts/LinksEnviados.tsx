import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useExternalClients } from "@/hooks/useCriaPost";
import { useCrmClients } from "@/hooks/useCrm";
import { nomeExibidoCliente } from "@/lib/cliente-nome";
import { cn } from "@/lib/utils";

/* LINKS ENVIADOS (Walter, 12/11/2026; mockup aprovado). Etapa 1.
   Um lugar só com todos os links que a social mídia mandou pros clientes:
   aprovação, cronograma, roteiros e agendamento de captação. Antes não havia
   lista nenhuma, e pra cortar um link de aprovação só desativando o cliente
   inteiro no Cria Post.
   O "Desligar" funciona de verdade no link de APROVAÇÃO: a coluna `active` já
   existe e todas as funções do portal conferem ela. Nos outros três o banco
   ainda não tem essa chave (etapa 2, com SQL), então aqui eles só listam e
   copiam. Nada de botão que não faz nada. */

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;
const ORIGEM = ((import.meta.env as Record<string, string | undefined>).VITE_CRIAPOST_ORIGIN) ?? window.location.origin;

type Tipo = "aprovacao" | "cronograma" | "roteiros" | "captacao";
type Linha = {
  chave: string; tipo: Tipo; id: string; titulo: string; cliente: string; url: string;
  criado: string | null; aberto: string | null; ligado: boolean; podeDesligar: boolean;
};
const NOME_TIPO: Record<Tipo, string> = { aprovacao: "Aprovação", cronograma: "Cronograma", roteiros: "Roteiros", captacao: "Captação" };
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dia = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; };
const diaCurto = (ymd: string) => { const [, m, d] = ymd.split("-").map(Number); return `${d} ${MES[m - 1]}`; };
function haQuanto(iso: string | null): string {
  if (!iso) return "ainda não foi aberto";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return dias <= 0 ? "aberto hoje" : dias === 1 ? "aberto ontem" : `aberto há ${dias} dias`;
}

export function LinksEnviados() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  const { clients: extClients } = useExternalClients();
  const { data: crmClients = [] } = useCrmClients();
  const [filtro, setFiltro] = useState<Tipo | "todos">("todos");

  const { data: bruto, isLoading } = useQuery({
    queryKey: ["links-enviados", agencyOwnerId],
    enabled: !!agencyOwnerId,
    staleTime: 30_000,
    queryFn: async () => {
      const [ap, cr, ro, ca] = await Promise.all([
        sbFrom("approval_tokens").select("id, token, active, created_at, last_viewed_at, period_start, period_end, external_client_id").eq("manager_id", agencyOwnerId!).order("created_at", { ascending: false }).limit(300),
        sbFrom("cronogramas").select("id, token, title, client_label, status, enviado_em, ultimo_visto_em, created_at").eq("manager_id", agencyOwnerId!).eq("status", "enviado").order("created_at", { ascending: false }).limit(200),
        sbFrom("script_approvals").select("id, token, title, client_name, month, status, created_at").eq("manager_id", agencyOwnerId!).in("status", ["aberto", "enviado"]).order("created_at", { ascending: false }).limit(200),
        sbFrom("captacao_links").select("id, token, ativo, crm_client_id, created_at").eq("manager_id", agencyOwnerId!).order("created_at", { ascending: false }).limit(200),
      ]);
      // Um tipo que falhe (permissão do módulo, por exemplo) não derruba os outros.
      return {
        ap: (ap.error ? [] : ap.data ?? []) as { id: string; token: string; active: boolean; created_at: string | null; last_viewed_at: string | null; period_start: string | null; period_end: string | null; external_client_id: string | null }[],
        cr: (cr.error ? [] : cr.data ?? []) as { id: string; token: string | null; title: string | null; client_label: string | null; enviado_em: string | null; ultimo_visto_em: string | null; created_at: string | null }[],
        ro: (ro.error ? [] : ro.data ?? []) as { id: string; token: string | null; title: string | null; client_name: string | null; month: string | null; created_at: string | null }[],
        ca: (ca.error ? [] : ca.data ?? []) as { id: string; token: string; ativo: boolean; crm_client_id: string | null; created_at: string | null }[],
      };
    },
  });

  const linhas = useMemo<Linha[]>(() => {
    if (!bruto) return [];
    const ext = new Map(extClients.map((c) => [c.id, c.name]));
    const crm = new Map(crmClients.map((c) => [c.id, nomeExibidoCliente(c)]));
    const out: Linha[] = [];
    for (const a of bruto.ap) out.push({
      chave: `ap:${a.id}`, tipo: "aprovacao", id: a.id,
      titulo: a.period_start && a.period_end ? `Aprovação de ${diaCurto(a.period_start)} a ${diaCurto(a.period_end)}` : "Aprovação de todos os posts",
      cliente: (a.external_client_id && ext.get(a.external_client_id)) || "Cliente", url: `${ORIGEM}/aprovar/${a.token}`,
      criado: a.created_at, aberto: a.last_viewed_at, ligado: !!a.active, podeDesligar: true,
    });
    for (const c of bruto.cr) if (c.token) out.push({
      chave: `cr:${c.id}`, tipo: "cronograma", id: c.id, titulo: c.title || "Cronograma", cliente: c.client_label || "Cliente",
      url: `${ORIGEM}/cronograma/${c.token}`, criado: c.enviado_em ?? c.created_at, aberto: c.ultimo_visto_em, ligado: true, podeDesligar: false,
    });
    for (const r of bruto.ro) if (r.token) out.push({
      chave: `ro:${r.id}`, tipo: "roteiros", id: r.id, titulo: r.title || "Roteiros", cliente: r.client_name || "Cliente",
      url: `${ORIGEM}/roteiros/${r.token}`, criado: r.created_at, aberto: null, ligado: true, podeDesligar: false,
    });
    for (const k of bruto.ca) out.push({
      chave: `ca:${k.id}`, tipo: "captacao", id: k.id, titulo: "Agendar captação", cliente: (k.crm_client_id && crm.get(k.crm_client_id)) || "Cliente",
      url: `${ORIGEM}/agendar/${k.token}`, criado: k.created_at, aberto: null, ligado: !!k.ativo, podeDesligar: false,
    });
    // Ligados primeiro; dentro de cada grupo, o mais novo em cima.
    return out.sort((a, b) => Number(b.ligado) - Number(a.ligado) || (b.criado ?? "").localeCompare(a.criado ?? ""));
  }, [bruto, extClients, crmClients]);

  const alternar = useMutation({
    mutationFn: async (l: Linha) => {
      const { error } = await sbFrom("approval_tokens").update({ active: !l.ligado }).eq("id", l.id);
      if (error) throw error;
      return !l.ligado;
    },
    onSuccess: (ligou) => {
      qc.invalidateQueries({ queryKey: ["links-enviados"] });
      qc.invalidateQueries({ queryKey: ["portal-activity"] });
      toast.success(ligou ? "Link ligado de novo." : "Link desligado. O cliente não consegue mais abrir.");
    },
    onError: () => toast.error("Não consegui mudar o link. Tenta de novo?"),
  });

  const copiar = async (l: Linha) => {
    try { await navigator.clipboard.writeText(l.url); toast.success("Link copiado!"); }
    catch { toast.error("Não consegui copiar. Tenta de novo?"); }
  };

  const contagem = (t: Tipo) => linhas.filter((l) => l.tipo === t).length;
  const visiveis = filtro === "todos" ? linhas : linhas.filter((l) => l.tipo === filtro);
  const temSemChave = visiveis.some((l) => !l.podeDesligar);

  return (
    <div>
      <p className="mb-3 px-1 text-sm font-body text-muted-foreground">
        Todos os links que você mandou pros clientes. Desligar um link de aprovação corta o acesso na hora, sem mexer no cliente.
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["todos", "aprovacao", "cronograma", "roteiros", "captacao"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setFiltro(t)} aria-pressed={filtro === t}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-body font-semibold transition-colors",
              filtro === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
            {t === "todos" ? `Todos (${linhas.length})` : `${NOME_TIPO[t]} (${contagem(t)})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-14 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : visiveis.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-center">
          <p className="text-sm font-display font-bold text-foreground">Nenhum link por aqui ainda</p>
          <p className="mt-1 text-[13px] font-body text-muted-foreground">Quando você mandar um link de aprovação, cronograma ou roteiros, ele aparece nesta lista.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visiveis.map((l) => (
            <div key={l.chave} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-card px-4 py-3.5", !l.ligado && "opacity-55")}>
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", l.ligado ? "bg-emerald-500" : "bg-muted-foreground/40")} aria-hidden />
              <div className="min-w-0 flex-1 basis-[220px]">
                <p className="truncate text-[15px] font-display font-extrabold text-foreground">
                  {l.titulo} <span className="font-body text-[13px] font-medium text-muted-foreground">· {l.cliente}</span>
                </p>
                <p className="text-[12.5px] font-body text-muted-foreground">
                  {NOME_TIPO[l.tipo]}{l.criado ? ` · criado em ${dia(l.criado)}` : ""}
                  {l.tipo === "aprovacao" || l.tipo === "cronograma" ? ` · ${haQuanto(l.aberto)}` : ""}
                  {!l.ligado ? " · desligado" : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {l.ligado && (
                  <button type="button" onClick={() => copiar(l)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-background px-4 text-[13px] font-body font-semibold text-foreground hover:border-primary/40 md:h-9">
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </button>
                )}
                {l.podeDesligar && (
                  <button type="button" onClick={() => alternar.mutate(l)} disabled={alternar.isPending}
                    className={cn("inline-flex h-10 items-center rounded-full px-4 text-[13px] font-body font-bold disabled:opacity-60 md:h-9",
                      l.ligado ? "bg-primary text-primary-foreground" : "border border-border bg-background text-foreground")}>
                    {l.ligado ? "Desligar" : "Ligar de novo"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {temSemChave && !isLoading && (
        <p className="mt-3 px-1 text-[12px] font-body text-muted-foreground">
          Por enquanto só o link de aprovação pode ser desligado por aqui. Cronograma, roteiros e captação entram na próxima etapa.
        </p>
      )}
    </div>
  );
}
