import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, Loader2, Lock, MapPin, Search, Star } from "lucide-react";
import { createPortal } from "react-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CidadeInput } from "@/components/criakut/CidadeInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useAcessoCriakut, useBaseCriakut, useDestaquesIds, useMeuPerfilCriakut, useMinhasPropostas, usePaginaCriakut, useSalvarPerfilCriakut } from "@/hooks/useCriakut";
import { Comunidades } from "@/components/criakut/Comunidades";
import { SeloDestaque } from "@/components/criakut/Pecas";
import { Mural } from "@/components/criakut/Mural";
import { Propostas } from "@/components/criakut/Propostas";
import { PaginaCriakut } from "@/components/criakut/PaginaCriakut";
import { CapaCriakut } from "@/components/criakut/CapaCriakut";
import { EscolherFuncoes } from "@/components/criakut/EscolherFuncoes";
import { ESTILOS, FUNCOES, NICHOS, iniciais, limparInstagram, nomesFuncoes, precoTexto, slugDe, urlConfiavel, type FuncaoCriakut } from "@/lib/criakut";
import { cn } from "@/lib/utils";

/* CRIAKUT (só convidados até abrir: o menu aparece pra quem tem acesso).
   Mora em dois lugares, a mesma tela: /app/criakut (criadora) e
   /socialmidia/criakut (social mídia e prestador).
   {base}                    → a MINHA página (aba padrão, estilo Orkut)
   {base}?aba=buscar         → Encontrar gente
   {base}?aba=mural          → Mural de trabalhos
   {base}?aba=propostas&p=ID → Propostas e a conversa de cada uma
   {base}?aba=comunidades    → Comunidades (&c=slug dentro, &t=id um tópico)
   {base}/:slug              → a página de outra pessoa */

type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

type Achado = {
  user_id: string; slug: string; nome: string; funcao: FuncaoCriakut; cidade: string | null; atende_remoto: boolean;
  foto_url: string | null; status_texto: string | null; estilos: string[]; nichos: string[];
  preco_minimo_centavos: number | null; seguidores: number; nota: number | null; entregas: number; outras_funcoes?: FuncaoCriakut[];
};

/* ABAS DO CRIAKUT. No computador moram na faixa laranja do topo, com o nome
   "Criakut beta" no lugar de "CRIA" (Walter, 14/10/2026: "essas opções ficar
   ali no menu superior"). No celular a faixa não existe, então ficam aqui. */
const ITENS_ABAS: [string, string][] = [["minha", "Minha página"], ["buscar", "Encontrar gente"], ["mural", "Mural de trabalhos"], ["comunidades", "Comunidades"], ["propostas", "Propostas"]];

function Abas({ aba, onTroca, naFaixa = false }: { aba: string; onTroca: (a: string) => void; naFaixa?: boolean }) {
  const propostas = useMinhasPropostas();
  const vez = (propostas.data ?? []).filter((p) => p.minha_vez || (p.status === "concluida" && !p.ja_avaliei)).length;
  if (naFaixa) {
    return (
      <nav data-tour="kut-abas" className="mr-auto flex flex-wrap gap-1" aria-label="Criakut">
        {ITENS_ABAS.map(([k, n]) => (
          <button key={k} type="button" onClick={() => onTroca(k)}
            className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              aba === k ? "bg-white text-foreground shadow-sm" : "bg-white/15 text-white backdrop-blur hover:bg-white/25")}>
            {n}{k === "propostas" && vez > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10.5px] text-primary-foreground">{vez}</span>}
          </button>
        ))}
      </nav>
    );
  }
  return (
    <div data-tour="kut-abas-m" className="mb-5 flex flex-wrap items-center gap-3 md:hidden">
      <span className="font-display text-[22px] font-extrabold">Cria<span className="text-primary">kut</span>
        <span className="ml-1.5 -rotate-6 inline-block rounded-md bg-foreground px-1.5 py-0.5 align-middle text-[10px] font-semibold text-background">beta</span></span>
      <div className="flex max-w-full flex-wrap gap-1 rounded-[20px] border border-border bg-card p-1">
        {ITENS_ABAS.map(([k, n]) => (
          <button key={k} type="button" onClick={() => onTroca(k)}
            className={cn("rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors sm:px-3.5 sm:text-[13px]",
              aba === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
            {n}{k === "propostas" && vez > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10.5px] text-primary-foreground">{vez}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function CriarPagina() {
  const { profile } = useProfile();
  const salvar = useSalvarPerfilCriakut();
  const [nome, setNome] = useState(profile?.name ?? "");
  const [cidadeNova, setCidadeNova] = useState<string | null>(null);
  useEffect(() => { if (profile?.name) setNome((n) => n || profile.name || ""); }, [profile?.name]);
  /* Começa marcado pelo tipo de conta (teste de 14/10: criadora vinha como social mídia). */
  const base = useBaseCriakut();
  const [funcao, setFuncao] = useState<FuncaoCriakut>(base === "/app/criakut" ? "criadora" : profile?.account_type === "manager" ? "social_media" : "designer");
  const [outras, setOutras] = useState<FuncaoCriakut[]>([]);
  useEffect(() => {
    if (base !== "/app/criakut" && profile?.account_type === "manager") setFuncao((f) => (f === "designer" ? "social_media" : f));
  }, [base, profile?.account_type]);
  return (
    <div className="mx-auto max-w-xl">
      <CapaCriakut tipo="cria-1" />
      <div className="-mt-8 relative rounded-[22px] border border-border bg-card p-6">
        <h1 className="font-display text-[28px] font-extrabold leading-tight">Crie sua página no Criakut</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">É onde quem procura designer, editor, filmmaker ou social mídia vai te achar. Ela nasce escondida: só aparece na busca quando você quiser.</p>
        <label className="mt-4 block text-[13px] font-semibold">Seu nome</label>
        <Input className="mt-1" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} />
        <label className="mt-4 block text-[13px] font-semibold">Sua cidade <span className="font-normal text-muted-foreground">(pra te acharem por perto; dá pra esconder depois)</span></label>
        <CidadeInput className="mt-1" value={cidadeNova} onChange={setCidadeNova} placeholder="Digite e escolha (ex.: Itajaí)" />
        <p className="mt-4 text-[13px] font-semibold">O que você faz</p>
        <div className="mt-1.5"><EscolherFuncoes principal={funcao} outras={outras} onChange={(p, o) => { setFuncao(p); setOutras(o); }} /></div>
        <Button className="mt-5 w-full rounded-xl h-11" disabled={nome.trim().length < 2 || salvar.isPending}
          onClick={() => salvar.mutate({ nome: nome.trim(), funcao, outras_funcoes: funcao === "criadora" ? [] : outras, cidade: cidadeNova, slug: `${slugDe(nome)}-${Math.random().toString(36).slice(2, 5)}`,
            foto_url: urlConfiavel(profile?.avatar_url), instagram: limparInstagram(profile?.instagram_handle) })}>
          {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar minha página
        </Button>
      </div>
    </div>
  );
}

function Buscar() {
  const navigate = useNavigate();
  const base = useBaseCriakut();
  const [funcao, setFuncao] = useState<FuncaoCriakut | null>(null);
  const [estilos, setEstilos] = useState<string[]>([]);
  const [nichos, setNichos] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [cidade, setCidade] = useState<string | null>(null);
  const minhaPagina = useMeuPerfilCriakut();
  const minhaCidade = minhaPagina.data?.cidade?.trim() || null;
  const { user } = useAuth();
  const args = useMemo(() => ({ _funcao: funcao, _estilos: estilos, _nichos: nichos, _texto: texto.trim() || null, _cidade: cidade }), [funcao, estilos, nichos, texto, cidade]);
  const q = useQuery({
    queryKey: ["criakut-busca", args],
    queryFn: async (): Promise<Achado[]> => {
      const { data, error } = await sbRpc("criakut_procurar", args);
      if (error) throw error;
      return (data ?? []) as Achado[];
    },
  });
  /* DESTAQUE (Fase 3): até 3 no topo, só de quem combina com o filtro, em
     ordem sorteada a cada busca. O resto da lista não muda de ordem. */
  const destaquesQ = useQuery({
    queryKey: ["criakut-busca-destaques", args],
    queryFn: async (): Promise<Achado[]> => {
      const { data, error } = await sbRpc("criakut_destaques_busca", { _funcao: args._funcao, _estilos: args._estilos, _nichos: args._nichos, _cidade: args._cidade, _texto: args._texto });
      if (error) throw error;
      return (data ?? []) as Achado[];
    },
  });
  const destaques = destaquesQ.data ?? [];
  const idsDestaque = useDestaquesIds();
  const resto = (q.data ?? []).filter((p) => !destaques.some((d) => d.user_id === p.user_id));
  const chip = (on: boolean) => cn("rounded-full border px-3 py-1 text-[12.5px] font-semibold", on ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground");

  return (
    <div>
      <h1 className="font-display text-[clamp(24px,3vw,34px)] font-extrabold leading-[1.05]">Encontre quem <span className="text-primary">faz junto</span> com você.</h1>

      {/* BUSCA REDESENHADA (Walter, 14/10/2026: "esses filtros estão estranhos").
          Uma barra limpa (palavra + cidade da lista oficial), especialidade em
          uma linha só, e estilo e nicho em menus, com contador. */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" placeholder="Nome ou palavra (ex.: carrossel)" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <CidadeInput value={cidade} onChange={setCidade} placeholder="Cidade" className="sm:w-60" />
        {minhaCidade && cidade !== minhaCidade && (
          <button type="button" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-border px-3 text-[12.5px] font-semibold text-muted-foreground hover:border-primary hover:text-primary"
            onClick={() => setCidade(minhaCidade)}>
            <MapPin className="h-3.5 w-3.5" /> Perto de mim
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Quem</span>
        {FUNCOES.map((f) => <button key={f.valor} type="button" className={chip(funcao === f.valor)} onClick={() => setFuncao(funcao === f.valor ? null : f.valor)}>{f.nome}</button>)}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <FiltroMenu nome="Estilo" opcoes={ESTILOS} valor={estilos} onChange={setEstilos} />
        <FiltroMenu nome="Nicho" opcoes={NICHOS} valor={nichos} onChange={setNichos} />
        {(funcao || estilos.length || nichos.length || cidade || texto) && (
          <button type="button" className="ml-1 text-[12.5px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => { setFuncao(null); setEstilos([]); setNichos([]); setCidade(null); setTexto(""); }}>
            Limpar filtros
          </button>
        )}
      </div>
      <div className="mt-4 border-b border-dashed border-border" />

      {q.isLoading ? <div className="py-16 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        : (q.data ?? []).length === 0 && destaques.length === 0
          ? <p className="py-14 text-center text-[14px] text-muted-foreground">Ninguém com esse filtro ainda. Por enquanto só os convidados aparecem.</p>
          : <div className="mt-5 grid gap-3">
              {destaques.length > 0 && <Separador texto="Em destaque" />}
              {[...destaques.map((p) => ({ ...p, _dest: true })), ...resto.map((p) => ({ ...p, _dest: false }))].map((p, i) => (
                <div key={p.user_id + (p._dest ? "-d" : "")} className="contents">
                {destaques.length > 0 && i === destaques.length && <Separador texto="Todos" />}
                <button type="button" onClick={() => navigate(`${base}/${p.slug}`)}
                  className={cn("relative grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-[20px] border bg-card p-3.5 text-left hover:border-foreground/40 max-sm:grid-cols-[auto_1fr]",
                    p._dest ? "border-2 border-primary shadow-[0_8px_24px_rgba(234,73,24,0.12)]" : "border-border")}>
                  {p._dest && <SeloDestaque className="absolute -top-2.5 left-4" />}
                  {p.foto_url ? <img src={p.foto_url} alt="" className="h-14 w-14 rounded-full object-cover" />
                    : <span className="grid h-14 w-14 place-items-center rounded-full bg-primary font-display text-lg font-extrabold text-primary-foreground">{iniciais(p.nome)}</span>}
                  <span className="min-w-0">
                    <b className="block font-display text-[17px]">{p.nome}{!p._dest && idsDestaque.has(p.user_id) && <SeloDestaque curto className="ml-1.5" />}
                      {p.user_id === user?.id && <span className="ml-1.5 rounded-md bg-muted px-1.5 py-0.5 align-middle font-body text-[10.5px] font-bold text-muted-foreground">você</span>}</b>
                    <span className="block text-[12.5px] text-muted-foreground">{[nomesFuncoes(p.funcao, p.outras_funcoes), p.cidade, p.atende_remoto ? "remoto" : null].filter(Boolean).join(" · ")}</span>
                    <span className="mt-1.5 flex flex-wrap gap-1">{[...p.estilos, ...p.nichos].slice(0, 5).map((t) => <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-[11px]">{t}</span>)}</span>
                  </span>
                  <span className="text-right max-sm:col-span-2 max-sm:text-left">
                    <span className="block text-[12px] text-muted-foreground">
                      {p.nota != null && <span className="mr-1.5 inline-flex items-center gap-0.5 font-bold text-foreground"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{String(p.nota).replace(".", ",")}</span>}
                      {p.entregas > 0 ? `${p.entregas} entregas no Cria · ` : ""}{p.seguidores} seguidores
                    </span>
                    {p.preco_minimo_centavos != null && <span className="block font-display text-[16px] font-extrabold">a partir de {precoTexto(p.preco_minimo_centavos, "peca").replace("/peça", "")}</span>}
                  </span>
                </button>
                </div>
              ))}
            </div>}
    </div>
  );
}

/** Estilo e nicho num menu (antes eram ~30 chips soltos na tela). */
function FiltroMenu({ nome, opcoes, valor, onChange }: { nome: string; opcoes: string[]; valor: string[]; onChange: (v: string[]) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12.5px] font-semibold",
          valor.length ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
          {nome}{valor.length > 0 && ` (${valor.length})`} <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="flex flex-wrap gap-1.5">
          {opcoes.map((o) => {
            const on = valor.includes(o);
            return (
              <button key={o} type="button" onClick={() => onChange(on ? valor.filter((x) => x !== o) : [...valor, o])}
                className={cn("rounded-full border px-2.5 py-1 text-[12px] font-semibold", on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                {o}
              </button>
            );
          })}
        </div>
        {valor.length > 0 && <button type="button" className="mt-2.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground" onClick={() => onChange([])}>Limpar {nome.toLowerCase()}</button>}
      </PopoverContent>
    </Popover>
  );
}

function Separador({ texto }: { texto: string }) {
  return (
    <div className="mt-2 flex items-center gap-2.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
      {texto}<span className="h-px flex-1 bg-border" />
    </div>
  );
}

export default function Criakut() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const base = useBaseCriakut();
  const { temAcesso, carregando } = useAcessoCriakut();
  const pedida = params.get("aba");
  const aba = slug ? "outro" : pedida === "buscar" || pedida === "mural" || pedida === "propostas" || pedida === "comunidades" ? pedida : "minha";
  const meu = useMeuPerfilCriakut();
  const pagina = usePaginaCriakut(slug ?? (aba === "minha" ? meu.data?.slug : null));

  const trocar = (a: string) => navigate(a === "minha" ? base : `${base}?aba=${a}`);
  /* Vaga na faixa laranja do topo (HeroBand), onde as abas moram no computador. */
  const [vagaFaixa, setVagaFaixa] = useState<HTMLElement | null>(null);
  useEffect(() => { setVagaFaixa(document.getElementById("cria-hero-slot")); }, []);

  /* Volta do Stripe (Destaque): avisa e confere de novo em alguns segundos,
     porque quem liga o Destaque é o webhook, que pode chegar depois. */
  const qc = useQueryClient();
  const voltaStripe = params.get("destaque");
  useEffect(() => {
    if (!voltaStripe) return;
    if (voltaStripe === "ok") toast.success("Pagamento recebido! Seu Destaque liga em instantes.");
    navigate(base, { replace: true });
    /* Sem limpar o timer: o navigate acima tira o parâmetro e reexecuta o
       efeito, e limpar aqui cancelaria a conferida. */
    setTimeout(() => { void qc.invalidateQueries({ queryKey: ["criakut-meu-destaque"] }); void qc.invalidateQueries({ queryKey: ["criakut-pagina"] }); }, 4000);
  }, [voltaStripe, base, navigate, qc]);

  if (carregando) return <div className="py-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!temAcesso) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-3 font-display text-[26px] font-extrabold">O Criakut ainda é só pra convidados</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">É a comunidade do Cria pra achar social mídia, designer, editor e filmmaker. Logo abre pra todo mundo.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-5 md:px-6">
      <Abas aba={aba === "outro" ? "" : aba} onTroca={trocar} />
      {vagaFaixa && createPortal(<Abas aba={aba === "outro" ? "" : aba} onTroca={trocar} naFaixa />, vagaFaixa)}
      {aba === "buscar" && <Buscar />}
      {aba === "mural" && <Mural />}
      {aba === "propostas" && <Propostas />}
      {aba === "comunidades" && <Comunidades />}
      {aba === "outro" && (
        <>
          <button type="button" onClick={() => navigate(-1)} className="mb-3 inline-flex items-center gap-1 text-[13px] font-bold"><ArrowLeft className="h-4 w-4" /> voltar</button>
          {pagina.isLoading ? <div className="py-20 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
            : pagina.data ? <PaginaCriakut dados={pagina.data} />
            : <p className="py-16 text-center text-muted-foreground">Essa página não existe ou está escondida.</p>}
        </>
      )}
      {aba === "minha" && (
        meu.isLoading || (meu.data && pagina.isLoading)
          ? <div className="py-20 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
          : !meu.data ? <CriarPagina />
          : pagina.data ? <PaginaCriakut dados={pagina.data} />
          : <p className="py-16 text-center text-muted-foreground">Não consegui abrir sua página. Recarregue.</p>
      )}
    </div>
  );
}
