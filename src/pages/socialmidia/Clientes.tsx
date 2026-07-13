import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Users, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useCrmClients, useCreateCrmClient, type CrmClient } from "@/hooks/useCrm";
import { useExternalClients, type ExternalClient } from "@/hooks/useCriaPost";
import { useCriaClientProfiles } from "@/hooks/useManagerClientCria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const initial = (n?: string | null) => (n ? n.trim().charAt(0).toUpperCase() : "?");
// "Inativo" cobre tanto o status do CRM quanto a flag antiga.
const isInactive = (c: CrmClient) => c.status === "inativo" || c.active === false;

export default function Clientes() {
  const navigate = useNavigate();
  const { data: clients = [], isLoading } = useCrmClients();
  const { clients: ext, pending, copyLink } = useExternalClients();
  const createClient = useCreateCrmClient();
  // Foto da conta CRIA do cliente sempre atual: avatar do profile → logo manual → inicial.
  const { data: criaProfiles } = useCriaClientProfiles();
  const avatarOf = (c: CrmClient) => {
    const criaAvatar = c.cria_owner_id ? criaProfiles?.[c.cria_owner_id]?.avatar_url : null;
    return criaAvatar ?? c.logo;
  };

  const [filter, setFilter] = useState<"todos" | "cria" | "link">("todos");
  // Filtro Ativos/Inativos: clicar de novo no chip selecionado limpa o filtro.
  const [statusF, setStatusF] = useState<"" | "ativos" | "inativos">("");
  const [newOpen, setNewOpen] = useState(false);
  const [nName, setNName] = useState("");
  const [nIg, setNIg] = useState("");

  // "aguardando" por cliente central: soma dos posts pendentes do external vinculado.
  const pendingByCrm = useMemo(() => {
    const m: Record<string, number> = {};
    ext.forEach((e) => { if (e.crm_client_id && pending[e.id]) m[e.crm_client_id] = (m[e.crm_client_id] ?? 0) + pending[e.id]; });
    return m;
  }, [ext, pending]);

  // Cliente externo (Cria Post) vinculado a cada cliente central: habilita o atalho do link.
  const extByCrm = useMemo(() => {
    const m: Record<string, ExternalClient> = {};
    ext.forEach((e) => { if (e.crm_client_id) m[e.crm_client_id] = e; });
    return m;
  }, [ext]);

  const shown = useMemo(() => clients.filter((c) => {
    if (filter === "cria" && !c.cria_owner_id) return false;
    if (filter === "link" && c.cria_owner_id) return false;
    if (statusF === "ativos" && isInactive(c)) return false;
    if (statusF === "inativos" && !isInactive(c)) return false;
    return true;
  }), [clients, filter, statusF]);

  const open = (id: string) => navigate(`/socialmidia/clientes/${id}/visao-geral`);

  const doCreate = async () => {
    if (!nName.trim()) return;
    const c = await createClient.mutateAsync({ name: nName.trim(), instagram: nIg.trim() || null });
    setNewOpen(false); setNName(""); setNIg("");
    toast.success("Cliente criado!");
    open(c.id);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Clientes</h1>
          <p className="text-muted-foreground font-body text-sm mt-0.5">Todos os seus clientes num lugar só, usem o Cria ou aprovem por link.</p>
        </div>
        <Button data-tour="cli-novo" onClick={() => setNewOpen(true)} className="shrink-0"><Plus className="h-4 w-4 mr-1.5" /> Novo cliente</Button>
      </div>

      <div data-tour="cli-filtros" className="flex items-center gap-2 my-4 flex-wrap">
        {([["todos", "Todos"], ["cria", "Usam o Cria"], ["link", "Aprovam por link"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === k ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
        <span className="h-4 w-px bg-border mx-0.5" aria-hidden />
        {([["ativos", "Ativos"], ["inativos", "Inativos"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setStatusF(statusF === k ? "" : k)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${statusF === k ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-48 rounded-3xl bg-muted animate-pulse" />)}</div>
      ) : shown.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 grid place-items-center mx-auto mb-4"><Users className="h-7 w-7 text-primary" /></div>
          <p className="text-base font-display font-bold text-foreground">Sua vitrine de clientes começa aqui</p>
          <p className="text-sm text-muted-foreground font-body mt-1.5 max-w-sm mx-auto">Crie o primeiro cliente e organize posts, aprovações, cronograma e relatório num lugar só.</p>
          <Button onClick={() => setNewOpen(true)} className="mt-5"><Plus className="h-4 w-4 mr-1.5" /> Criar primeiro cliente</Button>
        </div>
      ) : (
        <div data-tour="cli-grid" className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {shown.map((c) => {
            const aguardando = pendingByCrm[c.id] ?? 0;
            const extc = extByCrm[c.id] ?? null;
            const inactive = isInactive(c);
            return (
              <div key={c.id} role="button" tabIndex={0} onClick={() => open(c.id)}
                onKeyDown={(e) => { if (e.key === "Enter") open(c.id); }}
                className={`group flex flex-col items-center text-center bg-card border border-border rounded-3xl p-4 sm:p-5 cursor-pointer transition-all hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 ${inactive ? "opacity-70" : ""}`}>
                <span className="relative w-16 h-16 rounded-full grid place-items-center text-white text-xl font-display font-bold overflow-hidden mb-3 ring-2 ring-border/60 group-hover:ring-primary/30 transition-all" style={{ background: "linear-gradient(135deg,#0F6E56,#1d9e75)" }}>
                  {initial(c.name)}
                  {avatarOf(c) && <img src={avatarOf(c)!} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 w-full h-full object-cover" />}
                </span>
                <p className="font-display font-bold text-foreground truncate w-full">{c.name || "Sem nome"}</p>
                {c.instagram && <p className="text-xs text-muted-foreground font-body truncate w-full">@{c.instagram.replace(/^@/, "")}</p>}
                <p className={`text-[11px] font-body mt-1 truncate w-full ${aguardando > 0 ? "text-amber-600 font-semibold" : "text-muted-foreground/80"}`}>
                  {aguardando > 0 ? `${aguardando} ${aguardando > 1 ? "posts aguardando" : "post aguardando"}` : extc ? "Aprovações em dia" : c.segment || "Sem posts na fila"}
                </p>
                <div className="flex gap-1.5 mt-2 flex-wrap justify-center">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${c.cria_owner_id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{c.cria_owner_id ? "Usa o Cria" : "Aprova por link"}</span>
                  {inactive && <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inativo</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-3">
                  <Button size="sm" className="h-8 rounded-xl px-3 text-xs" onClick={(e) => { e.stopPropagation(); open(c.id); }}>Abrir ficha</Button>
                  {extc && (
                    <Button size="sm" variant="outline" className="h-8 w-8 rounded-xl p-0" title="Copiar link de aprovação" aria-label="Copiar link de aprovação"
                      onClick={(e) => { e.stopPropagation(); void copyLink(extc.id); }}>
                      <Link2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={(o) => !createClient.isPending && setNewOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Novo cliente</DialogTitle>
            <DialogDescription className="font-body text-sm">Cria a ficha do cliente. Você adiciona posts, cronograma e o resto dentro dele.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="font-body text-xs">Nome</Label>
              <Input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Nome da marca/cliente" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs">Instagram (opcional)</Label>
              <Input value={nIg} onChange={(e) => setNIg(e.target.value)} placeholder="@cliente" className="rounded-xl" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={createClient.isPending}>Cancelar</Button>
            <Button onClick={doCreate} disabled={createClient.isPending || !nName.trim()}>{createClient.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Criar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
