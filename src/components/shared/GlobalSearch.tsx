import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Lightbulb, Kanban, Users, ListTodo, ArrowRight, CornerDownLeft,
} from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { useIdeas } from "@/hooks/useIdeas";
import { usePosts } from "@/hooks/usePosts";
import { useCrmClients } from "@/hooks/useCrm";
import { useAuth } from "@/contexts/AuthContext";
import { ehAtalhoSeguro, ehCampoDeTexto } from "@/lib/atalhos";

/* ═══════════════════════════════════════════════════════════════════════════
   BUSCA GLOBAL

   O sistema tem 28 telas do lado do criador, mais o lado da agência, e não havia
   NENHUMA busca. Nem global, nem atalho. Quem tem 30 clientes e 200 posts navegava
   no braço, no menu, tela por tela.

   O `cmdk` já estava instalado no projeto (veio junto com o shadcn) e nunca tinha
   sido usado fora do menu lateral. Aqui ele finalmente vira o que é: Cmd+K acha
   ideia, post e cliente, e leva direto.

   Nada de busca no servidor: os dados que interessam já estão no cache do
   react-query (e agora persistem em IndexedDB). A busca é instantânea porque
   ela não sai do aparelho.
   ═══════════════════════════════════════════════════════════════════════════ */

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  const { ideas = [] } = useIdeas();
  const { posts = [] } = usePosts();
  const { data: clientes = [] } = useCrmClients();

  // Cmd+K (Mac) e Ctrl+K (Windows). "/" também abre, como no Slack e no GitHub,
  // desde que a pessoa não esteja digitando num campo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Repeat e composição nunca são atalho. Sair cedo preserva o seletor de
      // acentos do macOS (segurar a letra) e os dead keys (´ + a = á).
      if (!ehAtalhoSeguro(e)) return;

      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // "/" só vale sem modificador nenhum e fora de campo de texto.
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !ehCampoDeTexto(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const termo = norm(q.trim());

  const achados = useMemo(() => {
    if (termo.length < 2) return { ideias: [], posts: [], clientes: [] };
    const bate = (s?: string | null) => !!s && norm(s).includes(termo);
    return {
      ideias: ideas.filter((i) => bate(i.title) || bate(i.notes)).slice(0, 6),
      posts: posts.filter((p) => bate(p.title) || bate(p.caption) || bate(p.hook)).slice(0, 6),
      clientes: clientes.filter((c) => bate(c.name) || bate(c.instagram)).slice(0, 6),
    };
  }, [termo, ideas, posts, clientes]);

  const ir = (rota: string) => {
    setOpen(false);
    setQ("");
    navigate(rota);
  };

  const vazio = termo.length >= 2 && !achados.ideias.length && !achados.posts.length && !achados.clientes.length;

  if (!user) return null;

  return (
    <>
      {/* O gatilho visível. Atalho sozinho não existe pra quem não sabe que ele existe. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar"
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden md:inline text-sm font-body">Buscar...</span>
        <kbd className="hidden md:inline-flex ml-2 items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-body font-semibold">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar ideia, post ou cliente..."
          value={q}
          onValueChange={setQ}
        />
        <CommandList>
          {termo.length < 2 && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-body text-muted-foreground">
                Digite pelo menos 2 letras.
              </p>
              <p className="text-[12px] font-body text-muted-foreground/70 mt-1">
                Busca nas suas ideias, nos seus posts e nos seus clientes.
              </p>
            </div>
          )}

          {vazio && <CommandEmpty>Nada encontrado para "{q}".</CommandEmpty>}

          {achados.ideias.length > 0 && (
            <CommandGroup heading="Ideias">
              {achados.ideias.map((i) => (
                <CommandItem key={i.id} value={`ideia-${i.id}-${i.title}`} onSelect={() => ir("/app/ideias")}>
                  <Lightbulb className="mr-2 h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">{i.title}</span>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {achados.posts.length > 0 && (
            <CommandGroup heading="Posts">
              {achados.posts.map((p) => (
                <CommandItem key={p.id} value={`post-${p.id}-${p.title}`} onSelect={() => ir(`/app/criando?post=${p.id}`)}>
                  <Kanban className="mr-2 h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">{p.title || "Sem título"}</span>
                  <span className="ml-2 shrink-0 text-[10px] font-body uppercase tracking-wider text-muted-foreground">
                    {p.status}
                  </span>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {achados.clientes.length > 0 && (
            <CommandGroup heading="Clientes">
              {achados.clientes.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`cliente-${c.id}-${c.name}`}
                  onSelect={() => ir(`/socialmidia/clientes/${c.id}/visao-geral`)}
                >
                  <Users className="mr-2 h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">{c.name}</span>
                  {c.instagram && (
                    <span className="ml-2 shrink-0 text-[11px] font-body text-muted-foreground">
                      @{c.instagram.replace(/^@/, "")}
                    </span>
                  )}
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Atalhos de navegação: a busca também serve pra pular pra uma tela. */}
          {termo.length >= 2 && (
            <CommandGroup heading="Ir para">
              <CommandItem value="ir-ideias" onSelect={() => ir("/app/ideias")}>
                <Lightbulb className="mr-2 h-4 w-4 shrink-0" /> Minhas Ideias
              </CommandItem>
              <CommandItem value="ir-criando" onSelect={() => ir("/app/criando")}>
                <Kanban className="mr-2 h-4 w-4 shrink-0" /> Criando
              </CommandItem>
              <CommandItem value="ir-tarefas" onSelect={() => ir("/app/tarefas")}>
                <ListTodo className="mr-2 h-4 w-4 shrink-0" /> Tarefas
              </CommandItem>
              <CommandItem value="ir-clientes" onSelect={() => ir("/socialmidia/clientes")}>
                <Users className="mr-2 h-4 w-4 shrink-0" /> Clientes
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>

        <div className="flex items-center justify-end gap-3 border-t border-border px-3 py-2">
          <span className="flex items-center gap-1 text-[11px] font-body text-muted-foreground">
            <CornerDownLeft className="h-3 w-3" /> abrir
          </span>
          <span className="text-[11px] font-body text-muted-foreground">esc fecha</span>
        </div>
      </CommandDialog>
    </>
  );
}

export default GlobalSearch;
