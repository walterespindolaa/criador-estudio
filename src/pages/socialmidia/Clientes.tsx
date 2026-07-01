import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, ChevronRight, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCrmClients, useCreateCrmClient } from "@/hooks/useCrm";
import { useExternalClients } from "@/hooks/useCriaPost";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const initial = (n?: string | null) => (n ? n.trim().charAt(0).toUpperCase() : "?");

export default function Clientes() {
  const navigate = useNavigate();
  const { data: clients = [], isLoading } = useCrmClients();
  const { clients: ext, pending } = useExternalClients();
  const createClient = useCreateCrmClient();

  const [filter, setFilter] = useState<"todos" | "cria" | "link">("todos");
  const [newOpen, setNewOpen] = useState(false);
  const [nName, setNName] = useState("");
  const [nIg, setNIg] = useState("");

  // "aguardando" por cliente central: soma dos posts pendentes do external vinculado.
  const pendingByCrm = useMemo(() => {
    const m: Record<string, number> = {};
    ext.forEach((e) => { if (e.crm_client_id && pending[e.id]) m[e.crm_client_id] = (m[e.crm_client_id] ?? 0) + pending[e.id]; });
    return m;
  }, [ext, pending]);

  const shown = useMemo(() => clients.filter((c) => {
    if (filter === "cria") return !!c.cria_owner_id;
    if (filter === "link") return !c.cria_owner_id;
    return true;
  }), [clients, filter]);

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
          <p className="text-muted-foreground font-body text-sm mt-0.5">Todos os seus clientes num lugar só — usem o Cria ou aprovem por link.</p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="shrink-0"><Plus className="h-4 w-4 mr-1.5" /> Novo cliente</Button>
      </div>

      <div className="flex gap-2 my-4">
        {([["todos", "Todos"], ["cria", "Usam o Cria"], ["link", "Aprovam por link"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === k ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[0, 1].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-3"><Users className="h-5 w-5 text-muted-foreground" /></div>
          <p className="text-sm font-body text-foreground font-medium">Nenhum cliente ainda</p>
          <p className="text-xs text-muted-foreground font-body mt-1">Adicione seu primeiro cliente pra começar.</p>
          <Button onClick={() => setNewOpen(true)} className="mt-4"><Plus className="h-4 w-4 mr-1.5" /> Novo cliente</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {shown.map((c) => {
            const aguardando = pendingByCrm[c.id] ?? 0;
            return (
              <button key={c.id} onClick={() => open(c.id)} className="text-left bg-card border border-border rounded-2xl p-4 hover:border-primary/40 hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-full grid place-items-center text-white font-display font-bold shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg,#0F6E56,#1d9e75)" }}>
                    {c.logo ? <img src={c.logo} alt="" className="w-full h-full object-cover" /> : initial(c.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold text-foreground truncate">{c.name || "Sem nome"}</p>
                    {c.instagram && <p className="text-xs text-muted-foreground font-body truncate">@{c.instagram.replace(/^@/, "")}</p>}
                    {c.segment && <p className="text-[11px] text-muted-foreground/80 font-body truncate">{c.segment}</p>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                </div>
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${c.cria_owner_id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{c.cria_owner_id ? "Usa o Cria" : "Aprova por link"}</span>
                  {aguardando > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{aguardando} aguardando</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={(o) => !createClient.isPending && setNewOpen(o)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
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
