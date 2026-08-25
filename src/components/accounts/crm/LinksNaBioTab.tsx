import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, ExternalLink, Eye, Link2, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCrmClients, type CrmClient } from "@/hooks/useCrm";
import { useBioPages, useBioPageLeadCounts, useBiosDasContas } from "@/hooks/useBioPages";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   TODAS AS PÁGINAS DE LINK NA BIO NUM LUGAR SÓ

   A gestora não quer abrir cliente por cliente pra lembrar quais já têm página
   e quais estão paradas sem endereço. Aqui ela vê a carteira inteira, com o
   endereço pronto pra copiar, quantas visitas e quantos leads cada uma trouxe.
   ═══════════════════════════════════════════════════════════════════════════ */

const nomeDe = (c: CrmClient) => (c.display_name || c.name || "Sem nome").trim();

export function LinksNaBioTab() {
  const { data: clientes = [], isLoading } = useCrmClients();
  const { data: paginas = [] } = useBioPages();
  const { data: leadsPorPagina = {} } = useBioPageLeadCounts();
  // Cliente com conta Cria tem a bio na conta dele: o endereço e as visitas vêm de lá.
  const { data: biosDasContas = {} } = useBiosDasContas();
  const [busca, setBusca] = useState("");

  const porCliente = useMemo(
    () => new Map(paginas.map((p) => [p.crm_client_id, p] as const)),
    [paginas],
  );

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return clientes
      .filter((c) => !q || `${nomeDe(c)} ${c.instagram ?? ""}`.toLowerCase().includes(q))
      .map((c) => {
        const pagina = porCliente.get(c.id) ?? null;
        const naConta = c.cria_owner_id ? biosDasContas[c.cria_owner_id] : null;
        return {
          cliente: c,
          pagina,
          slug: c.cria_owner_id ? (naConta?.slug ?? null) : (pagina?.slug ?? null),
          visitas: c.cria_owner_id ? (naConta?.views ?? 0) : (pagina?.views ?? 0),
          leads: pagina ? (leadsPorPagina[pagina.id] ?? 0) : 0,
          naConta: !!c.cria_owner_id,
        };
      })
      .sort((a, b) => Number(!!b.slug) - Number(!!a.slug) || nomeDe(a.cliente).localeCompare(nomeDe(b.cliente), "pt-BR"));
  }, [clientes, porCliente, biosDasContas, leadsPorPagina, busca]);

  const copiar = async (slug: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/bio/${slug}`);
    toast.success("Link copiado!");
  };

  const comEndereco = lista.filter((l) => l.slug).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente" className="rounded-xl pl-9" />
        </div>
        <p className="text-xs font-body text-muted-foreground shrink-0">
          {comEndereco} de {lista.length} {lista.length === 1 ? "cliente" : "clientes"} com página no ar
        </p>
      </div>

      {isLoading && <p className="text-sm font-body text-muted-foreground py-8 text-center">Carregando...</p>}

      {!isLoading && lista.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-body text-foreground font-medium">Nenhum cliente na carteira ainda</p>
          <p className="text-xs text-muted-foreground font-body mt-1">
            Cadastre um cliente e a página de link na bio dele aparece aqui.
          </p>
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {lista.map(({ cliente, slug, visitas, leads, naConta, pagina }) => (
          <div key={cliente.id}
            className="rounded-2xl border border-border bg-card p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-muted shrink-0 overflow-hidden grid place-items-center"
                style={cliente.color ? { backgroundColor: `${cliente.color}22` } : undefined}>
                {cliente.logo
                  ? <img src={cliente.logo} alt="" className="w-full h-full object-cover" />
                  : <span className="text-xs font-display font-bold text-muted-foreground">{nomeDe(cliente).slice(0, 1).toUpperCase()}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-body font-semibold text-foreground truncate">{nomeDe(cliente)}</p>
                <p className={cn("text-[11px] font-body truncate", slug ? "text-primary" : "text-muted-foreground")}>
                  {slug ? `/bio/${slug}` : "sem página ainda"}
                </p>
              </div>
            </div>

            {slug && (
              <div className="flex items-center gap-3 text-[11px] font-body text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {visitas} {visitas === 1 ? "visita" : "visitas"}</span>
                {!naConta && <span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" /> {leads} {leads === 1 ? "lead" : "leads"}</span>}
                {naConta && <span className="text-[10px] uppercase tracking-wider font-semibold text-primary/70">na conta dele</span>}
              </div>
            )}

            <div className="flex items-center gap-1.5 mt-auto pt-0.5">
              <Button size="sm" variant="outline" asChild className="flex-1">
                <Link to={`/socialmidia/clientes/${cliente.id}/link-bio`}>
                  <Link2 className="h-3.5 w-3.5 mr-1" /> {slug || pagina ? "Editar" : "Montar"}
                </Link>
              </Button>
              {slug && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => copiar(slug)} aria-label="Copiar link">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" asChild aria-label="Abrir página">
                    <a href={`/bio/${slug}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
