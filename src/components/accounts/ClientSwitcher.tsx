import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCrmClients } from "@/hooks/useCrm";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Contact } from "lucide-react";

// Troca rápida de contexto: de qualquer tela do painel do gestor, pula direto pro
// hub do cliente (/socialmidia/clientes/:id). O último cliente visitado fica salvo
// e vira o atalho "Continuar em {cliente}" no dashboard.

const LAST_CLIENT_KEY = "cria.ultimo-cliente";

export function saveLastClient(id: string, name: string) {
  try { localStorage.setItem(LAST_CLIENT_KEY, JSON.stringify({ id, name })); } catch { /* segue */ }
}
export function readLastClient(): { id: string; name: string } | null {
  try {
    const raw = localStorage.getItem(LAST_CLIENT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { id?: string; name?: string };
    return v?.id && v?.name ? { id: v.id, name: v.name } : null;
  } catch { return null; }
}

const initial = (n?: string | null) => (n ? n.trim().charAt(0).toUpperCase() : "?");

export function ClientSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: clients = [] } = useCrmClients();
  const [open, setOpen] = useState(false);

  const currentId = useMemo(() => {
    const m = location.pathname.match(/^\/socialmidia\/clientes\/([^/]+)/);
    return m?.[1] ?? null;
  }, [location.pathname]);
  const current = useMemo(() => clients.find((c) => c.id === currentId) ?? null, [clients, currentId]);

  if (clients.length === 0) return null;

  const pick = (id: string) => {
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    saveLastClient(c.id, c.name);
    setOpen(false);
    navigate(`/socialmidia/clientes/${c.id}/visao-geral`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Trocar de cliente"
          className="flex max-w-[220px] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-body font-medium text-white hover:bg-white/20 transition-colors">
          <Contact className="h-4 w-4 shrink-0" />
          <span className="hidden truncate lg:inline">{current ? current.name : "Ir pro cliente"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0 rounded-2xl overflow-hidden">
        <Command>
          <CommandInput placeholder="Buscar cliente..." />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup heading="Seus clientes">
              {clients.map((c) => (
                <CommandItem key={c.id} value={`${c.name} ${c.id}`} onSelect={() => pick(c.id)} className="gap-2.5">
                  <span className="relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-display font-bold text-white"
                    style={{ background: "linear-gradient(135deg,#0F6E56,#1d9e75)" }}>
                    {initial(c.name)}
                    {c.logo && <img src={c.logo} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-body font-medium">{c.name}</span>
                    {c.instagram && <span className="block truncate text-[11px] font-body text-muted-foreground">@{c.instagram.replace(/^@/, "")}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
