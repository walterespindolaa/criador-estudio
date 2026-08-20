import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Users, Loader2, Link2, Search, Send, Upload, FolderOpen, Download } from "lucide-react";
import { toast } from "sonner";
import { useCrmClients, useCreateCrmClient, useUploadCrmAsset, useImportCriaClients, useClientLimit, useBuyClientPacks, type CrmClient } from "@/hooks/useCrm";
import { clienteInativo } from "@/lib/cliente-status";
import { nomeExibidoCliente } from "@/lib/cliente-nome";
import { useExternalClients, type ExternalClient } from "@/hooks/useCriaPost";
import { useCriaClientProfiles } from "@/hooks/useManagerClientCria";
import { useActiveAccount } from "@/contexts/AccountContext";
import { ClientColorPicker } from "@/components/shared/ClientColorPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const initial = (n?: string | null) => (n ? n.trim().charAt(0).toUpperCase() : "?");
// Situação derivada: encerramento em data FUTURA ainda conta como ativo
// (o cliente é ativo até o dia do encerramento, inclusive). Regra única
// em src/lib/cliente-status.ts.
const isInactive = (c: CrmClient) => clienteInativo(c);
// Texto legível sobre a cor do cliente (amarelo pede texto escuro).
const textOn = (hex: string) => {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? "#1c1c1a" : "#ffffff";
};
const clientColor = (c: CrmClient) => (c as { color?: string | null }).color || null;

export default function Clientes() {
  const navigate = useNavigate();
  const { data: clients = [], isLoading } = useCrmClients();
  const { clients: ext, pending, copyLink } = useExternalClients();
  const createClient = useCreateCrmClient();
  const uploadAsset = useUploadCrmAsset();
  // Mesma importação do Cria Gestão: puxa as contas Cria vinculadas pra cá,
  // sem duplicar (o hook ignora quem já tem cria_owner_id no CRM).
  const importCria = useImportCriaClients();
  const { managedAccounts } = useActiveAccount();
  // Foto da conta CRIA do cliente sempre atual: avatar do profile → logo manual → inicial.
  const { data: criaProfiles } = useCriaClientProfiles();
  const avatarOf = (c: CrmClient) => {
    const criaAvatar = c.cria_owner_id ? criaProfiles?.[c.cria_owner_id]?.avatar_url : null;
    return criaAvatar ?? c.logo;
  };
  // Nome exibido pro gestor: apelido (display_name) > nome AO VIVO do Cria > name do CRM.
  // Mesma regra do cockpit e da agenda (src/lib/cliente-nome.ts). O apelido é só do
  // gestor; sem ele, cai no nome ao vivo do profile do cliente.
  const nameOf = (c: CrmClient) => {
    const live = c.cria_owner_id ? criaProfiles?.[c.cria_owner_id]?.name?.trim() : null;
    return nomeExibidoCliente(c, live) || null;
  };

  const [filter, setFilter] = useState<"todos" | "cria" | "link">("todos");
  // Filtro Ativos/Inativos: clicar de novo no chip selecionado limpa o filtro.
  const [statusF, setStatusF] = useState<"" | "ativos" | "inativos">("");
  const [q, setQ] = useState("");
  const [onlyPend, setOnlyPend] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  // Carteira: teto atual e compra de pacotes (+10 clientes por R$19,90/mês).
  const { data: lim } = useClientLimit();
  const buyPacks = useBuyClientPacks();
  const [packOpen, setPackOpen] = useState(false);
  const [packs, setPacks] = useState(1);
  const carteiraCheia = !!lim && lim.usados >= lim.teto;
  // Quantos pacotes PAGOS a pessoa teria ao todo se comprar o que está no stepper.
  const abrirAmpliar = () => { setPacks(1); setPackOpen(true); };
  const [nName, setNName] = useState("");
  const [nIg, setNIg] = useState("");
  // Campos novos do cadastro: cor, logo (upload ou URL) e link do Drive.
  const [nColor, setNColor] = useState<string | null>(null);
  const [nLogo, setNLogo] = useState("");
  const [nDrive, setNDrive] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Sobe a imagem no mesmo bucket dos outros uploads (crm) usando uma pasta
  // temporária: o cliente ainda não existe, então guardamos só a URL assinada.
  const onPickLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try {
      const url = await uploadAsset.mutateAsync({ clientId: `novo-${crypto.randomUUID()}`, file, kind: "avatar" });
      setNLogo(url);
    } catch { /* o hook já avisa */ }
  };

  const resetNew = () => { setNName(""); setNIg(""); setNColor(null); setNLogo(""); setNDrive(""); };

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
    if (onlyPend && !((pendingByCrm[c.id] ?? 0) > 0)) return false;
    const term = q.trim().toLowerCase();
    if (term) {
      const hay = `${nameOf(c) ?? ""} ${c.instagram ?? ""} ${c.segment ?? ""}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  }), [clients, filter, statusF, onlyPend, q, pendingByCrm, criaProfiles]);

  const open = (id: string) => navigate(`/socialmidia/clientes/${id}/visao-geral`);

  const doCreate = async () => {
    if (!nName.trim()) return;
    const drive = nDrive.trim();
    if (drive && !/^https?:\/\//i.test(drive)) { toast.error("O link do Drive precisa começar com http:// ou https://"); return; }
    const logo = nLogo.trim();
    if (logo && !/^https?:\/\//i.test(logo)) { toast.error("A URL da imagem precisa começar com http:// ou https://"); return; }
    // O link do Drive já entra nos links úteis com rótulo "Drive" (a aba Drive
    // funciona de cara).
    const useful_links = drive ? [{ label: "Drive", url: drive }] : null;
    const c = await createClient.mutateAsync({
      name: nName.trim(),
      instagram: nIg.trim() || null,
      color: nColor,
      logo: logo || null,
      useful_links,
    });
    setNewOpen(false); resetNew();
    toast.success("Cliente criado!");
    open(c.id);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Clientes</h1>
          <p className="text-muted-foreground font-body text-sm mt-0.5">Todos os seus clientes num lugar só, usem o Cria ou aprovem por link.</p>
          {lim && (
            <button onClick={abrirAmpliar} title="Ampliar carteira"
              className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-body transition-colors ${carteiraCheia ? "border-amber-500/50 bg-amber-500/10 text-amber-700" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>
              <span className="font-semibold">{lim.usados} de {lim.teto}</span> clientes na carteira
              {carteiraCheia ? <span className="font-semibold">· ampliar</span> : <span className="opacity-70">· +10 por R$19,90/mês</span>}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => importCria.mutate()} disabled={importCria.isPending || managedAccounts.length === 0} className="shrink-0" title="Importar clientes do Cria">
            {importCria.isPending ? <Loader2 className="h-4 w-4 sm:mr-1.5 animate-spin" /> : <Download className="h-4 w-4 sm:mr-1.5" />}
            <span className="hidden sm:inline">Importar do Cria</span>
          </Button>
          <Button data-tour="cli-novo" onClick={() => (carteiraCheia ? abrirAmpliar() : setNewOpen(true))} className="shrink-0"><Plus className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Novo cliente</span><span className="sm:hidden">Novo</span></Button>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 mb-3 flex-wrap">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 flex-1 min-w-[220px] max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente ou @…"
            className="w-full bg-transparent outline-none text-sm font-body placeholder:text-muted-foreground/70" />
        </div>
      </div>

      <div data-tour="cli-filtros" className="flex items-center gap-2 mb-4 flex-wrap">
        {([["todos", "Todos"], ["cria", "Usam o Cria"], ["link", "Aprovam por link"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === k ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
        <button onClick={() => setOnlyPend((v) => !v)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${onlyPend ? "bg-amber-500 text-white border-amber-500" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>Com pendências</button>
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
            const cor = clientColor(c);                       // cor escolhida na ficha
            const accent = cor ?? "#0F6E56";                  // fallback: verde padrão de hoje
            return (
              <div key={c.id} role="button" tabIndex={0} onClick={() => open(c.id)}
                onKeyDown={(e) => { if (e.key === "Enter") open(c.id); }}
                className={`group relative flex flex-col items-center text-center bg-card border border-border rounded-3xl p-4 sm:p-5 pt-6 cursor-pointer overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 ${inactive ? "opacity-70" : ""}`}>
                {/* Acento na cor do cliente: barra no topo + brilho suave. */}
                <span aria-hidden className="absolute top-0 inset-x-0 h-1.5" style={{ background: accent }} />
                <span aria-hidden className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-xl opacity-10 pointer-events-none" style={{ background: accent }} />
                <span className="relative w-16 h-16 rounded-full grid place-items-center text-xl font-display font-bold overflow-hidden mb-3 ring-2 ring-white shadow-md transition-all"
                  style={{ background: cor ? accent : "linear-gradient(135deg,#0F6E56,#1d9e75)", color: cor ? textOn(accent) : "#fff" }}>
                  {initial(nameOf(c))}
                  {avatarOf(c) && <img src={avatarOf(c)!} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 w-full h-full object-cover" />}
                </span>
                <p className="font-display font-bold text-foreground truncate w-full">{nameOf(c) || "Sem nome"}</p>
                {c.instagram && <p className="text-xs text-muted-foreground font-body truncate w-full">@{c.instagram.replace(/^@/, "")}</p>}
                <p className={`text-[11px] font-body mt-1 truncate w-full ${aguardando > 0 ? "text-amber-600 font-semibold" : "text-muted-foreground/80"}`}>
                  {aguardando > 0 ? `${aguardando} ${aguardando > 1 ? "posts aguardando" : "post aguardando"}` : extc ? "Aprovações em dia" : c.segment || "Sem posts na fila"}
                </p>
                <div className="flex gap-1.5 mt-2 flex-wrap justify-center">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${c.cria_owner_id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{c.cria_owner_id ? "Usa o Cria" : "Aprova por link"}</span>
                  {inactive && <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inativo</span>}
                </div>
                <div className="flex items-center justify-center flex-wrap gap-1.5 mt-3">
                  <Button size="sm" className="h-8 rounded-xl px-3 text-xs" onClick={(e) => { e.stopPropagation(); open(c.id); }}>Abrir ficha</Button>
                  {extc && (
                    <>
                      <Button size="sm" variant="outline" className="h-8 w-8 rounded-xl p-0" title="Copiar link de aprovação" aria-label="Copiar link de aprovação"
                        onClick={(e) => { e.stopPropagation(); void copyLink(extc.id); }}>
                        <Link2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 w-8 rounded-xl p-0" title="Ir para os posts" aria-label="Ir para os posts"
                        onClick={(e) => { e.stopPropagation(); navigate(`/socialmidia/clientes/${c.id}/posts`); }}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={packOpen} onOpenChange={setPackOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Ampliar carteira de clientes</DialogTitle>
            <DialogDescription className="font-body">
              {carteiraCheia
                ? `Você está usando ${lim?.usados ?? 0} de ${lim?.teto ?? 3} clientes. Pra cadastrar mais, adicione pacotes de +10.`
                : `Sua carteira comporta ${lim?.teto ?? 3} clientes hoje. Cada pacote adiciona +10 por R$19,90/mês, sem fidelidade.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-4 py-2">
            <Button variant="outline" size="icon" onClick={() => setPacks((v) => Math.max(1, v - 1))} disabled={packs <= 1}>−</Button>
            <div className="text-center min-w-[130px]">
              <p className="text-2xl font-display font-extrabold text-foreground">+{packs * 10} clientes</p>
              <p className="text-xs text-muted-foreground font-body">{packs} pacote(s) · R$ {(packs * 19.9).toFixed(2).replace(".", ",")}/mês</p>
            </div>
            <Button variant="outline" size="icon" onClick={() => setPacks((v) => Math.min(10, v + 1))}>+</Button>
          </div>
          <p className="text-[11px] text-muted-foreground font-body text-center -mt-1">
            O valor é somado à sua assinatura de pacotes (pró-rata). Cancela quando quiser, dentro do app.
          </p>
          <Button onClick={() => buyPacks.mutate(packs)} disabled={buyPacks.isPending} className="w-full">
            {buyPacks.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
            Ampliar por R$ {(packs * 19.9).toFixed(2).replace(".", ",")}/mês
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={newOpen} onOpenChange={(o) => { if (createClient.isPending) return; setNewOpen(o); if (!o) resetNew(); }}>
        <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Novo cliente</DialogTitle>
            <DialogDescription className="font-body text-sm">Cria a ficha do cliente. Você adiciona posts, cronograma e o resto dentro dele.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Foto/logo + nome, lado a lado no desktop, empilhados no mobile. */}
            <div className="flex items-start gap-3">
              <button type="button" onClick={() => logoInputRef.current?.click()} title="Enviar foto ou logo"
                aria-label="Enviar foto ou logo"
                className="relative w-16 h-16 rounded-full grid place-items-center text-white text-xl font-display font-bold shrink-0 overflow-hidden ring-2 ring-border/60 hover:ring-primary/40 transition-all"
                style={{ background: nColor || "linear-gradient(135deg,#0F6E56,#1d9e75)" }}>
                {nName.trim() ? nName.trim().charAt(0).toUpperCase() : <Upload className="h-5 w-5" />}
                {nLogo.trim() && <img src={nLogo.trim()} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 w-full h-full object-cover" />}
              </button>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={onPickLogo} />
              <div className="flex-1 space-y-1.5 min-w-0">
                <Label className="font-body text-xs">Nome</Label>
                <Input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Nome da marca/cliente" className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-body text-xs">Instagram (opcional)</Label>
              <Input value={nIg} onChange={(e) => setNIg(e.target.value)} placeholder="@cliente" className="rounded-xl" />
            </div>

            {/* FOTO/LOGO: enviar do dispositivo (botão acima) ou colar uma URL. */}
            <div className="space-y-1.5">
              <Label className="font-body text-xs">Foto ou logo (opcional)</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="rounded-xl h-9 gap-1.5 shrink-0" onClick={() => logoInputRef.current?.click()} disabled={uploadAsset.isPending}>
                  {uploadAsset.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Enviar
                </Button>
                <Input value={nLogo} onChange={(e) => setNLogo(e.target.value)} placeholder="ou cole uma URL de imagem" className="rounded-xl h-9 text-sm flex-1 min-w-0" />
              </div>
            </div>

            {/* LINK DO DRIVE: já entra nos links úteis com rótulo "Drive". */}
            <div className="space-y-1.5">
              <Label className="font-body text-xs flex items-center gap-1.5"><FolderOpen className="h-3.5 w-3.5 text-muted-foreground" /> Link do Drive (opcional)</Label>
              <Input value={nDrive} onChange={(e) => setNDrive(e.target.value)} placeholder="https://drive.google.com/…" className="rounded-xl" />
              <p className="text-[11px] font-body text-muted-foreground">Entra nos links úteis do cliente e já ativa a aba Drive.</p>
            </div>

            {/* COR DO CLIENTE: mesma paleta da ficha (pinta o card na lista e o link público). */}
            <div className="space-y-1.5">
              <Label className="font-body text-xs">Cor do cliente (opcional)</Label>
              <div className="rounded-xl border border-border p-2.5">
                <ClientColorPicker value={nColor} onChange={(hex) => setNColor(hex)} onClear={() => setNColor(null)} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => { setNewOpen(false); resetNew(); }} disabled={createClient.isPending}>Cancelar</Button>
            <Button onClick={doCreate} disabled={createClient.isPending || uploadAsset.isPending || !nName.trim()}>{createClient.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Criar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
