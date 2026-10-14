import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Lock, MapPin, Search, Star } from "lucide-react";
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
import { ESTILOS, FUNCOES, NICHOS, iniciais, limparInstagram, nomeFuncao, precoTexto, slugDe, urlConfiavel, type FuncaoCriakut } from "@/lib/criakut";
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
  preco_minimo_centavos: number | null; seguidores: number; nota: number | null; entregas: number;
};

function Abas({ aba, onTroca }: { aba: string; onTroca: (a: string) => void }) {
  const propostas = useMinhasPropostas();
  const vez = (propostas.data ?? []).filter((p) => p.minha_vez || (p.status === "concluida" && !p.ja_avaliei)).length;
  const itens = [["minha", "Minha página"], ["buscar", "Encontrar gente"], ["mural", "Mural de trabalhos"], ["comunidades", "Comunidades"], ["propostas", "Propostas"]];
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <span className="font-display text-[22px] font-extrabold">Cria<span className="text-primary">kut</span>
        <span className="ml-1.5 -rotate-6 inline-block rounded-md bg-foreground px-1.5 py-0.5 align-middle text-[10px] font-semibold text-background">beta</span></span>
      {/* Quebram linha no celular e no iPad (Walter, teste de 14/10/2026): rolando
          de lado aparecia a barra cinza e a aba ativa ficava cortada. */}
      <div className="flex max-w-full flex-wrap gap-1 rounded-[20px] border border-border bg-card p-1">
        {itens.map(([k, n]) => (
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
  const [cidadeNova, setCidadeNova] = useState("");
  useEffect(() => { if (profile?.name) setNome((n) => n || profile.name || ""); }, [profile?.name]);
  /* Começa marcado pelo tipo de conta (teste de 14/10: criadora vinha como social mídia). */
  const base = useBaseCriakut();
  const [funcao, setFuncao] = useState<FuncaoCriakut>(base === "/app/criakut" ? "criadora" : profile?.account_type === "manager" ? "social_media" : "designer");
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
        <Input className="mt-1 placeholder:text-muted-foreground/50" value={cidadeNova} maxLength={80} placeholder="Ex.: Itajaí" onChange={(e) => setCidadeNova(e.target.value)} />
        <p className="mt-4 text-[13px] font-semibold">O que você faz</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {FUNCOES.map((f) => (
            <button key={f.valor} type="button" onClick={() => setFuncao(f.valor)}
              className={cn("rounded-full border px-3 py-1 text-[12.5px] font-semibold", funcao === f.valor ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>
              {f.nome}
            </button>
          ))}
        </div>
        <Button className="mt-5 w-full rounded-xl h-11" disabled={nome.trim().length < 2 || salvar.isPending}
          onClick={() => salvar.mutate({ nome: nome.trim(), funcao, cidade: cidadeNova.trim() || null, slug: `${slugDe(nome)}-${Math.random().toString(36).slice(2, 5)}`,
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
  const [cidade, setCidade] = useState("");
  const [maisFiltros, setMaisFiltros] = useState(false);
  const minhaPagina = useMeuPerfilCriakut();
  const minhaCidade = minhaPagina.data?.cidade?.trim() || null;
  const { user } = useAuth();
  const args = useMemo(() => ({ _funcao: funcao, _estilos: estilos, _nichos: nichos, _texto: texto.trim() || null, _cidade: cidade.trim() || null }), [funcao, estilos, nichos, texto, cidade]);
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
  const alterna = (l: string[], v: string, set: (x: string[]) => void) => set(l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);
  const chip = (on: boolean) => cn("rounded-full border px-3 py-1 text-[12.5px] font-semibold", on ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground");

  return (
    <div>
      <h1 className="font-display text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.05]">Encontre quem <span className="text-primary">faz junto</span> com você.</h1>
      <div className="mt-4 flex max-w-2xl gap-2 rounded-2xl border-[1.5px] border-foreground bg-card p-1.5 shadow-[4px_4px_0_hsl(var(--foreground))]">
        <Search className="ml-2 mt-2.5 h-4 w-4 text-muted-foreground" />
        <input className="min-w-0 flex-1 bg-transparent px-1 text-[15px] outline-none" placeholder="Nome ou palavra (ex.: carrossel)" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <input className="w-20 border-l border-border bg-transparent px-2 text-[13px] outline-none sm:w-32" placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {/* Perto de mim (Walter, 14/10/2026): conecta gente da mesma cidade. Só acha
            quem deixou a cidade visível. */}
        {minhaCidade && (
          <button type="button" className={cn(chip(cidade.trim().toLowerCase() === minhaCidade.toLowerCase()), "inline-flex items-center gap-1")}
            onClick={() => setCidade(cidade.trim().toLowerCase() === minhaCidade.toLowerCase() ? "" : minhaCidade)}>
            <MapPin className="h-3.5 w-3.5" /> Perto de mim ({minhaCidade})
          </button>
        )}
        {FUNCOES.map((f) => <button key={f.valor} type="button" className={chip(funcao === f.valor)} onClick={() => setFuncao(funcao === f.valor ? null : f.valor)}>{f.nome}</button>)}
      </div>
      {/* No celular, estilo e nicho ficam recolhidos (eram 4 linhas de chips antes
          do primeiro resultado). No computador continuam à vista. */}
      <button type="button" className="mt-2 text-[12.5px] font-semibold text-primary md:hidden" onClick={() => setMaisFiltros((v) => !v)}>
        {maisFiltros ? "Esconder filtros" : `Estilo e nicho${estilos.length + nichos.length ? ` (${estilos.length + nichos.length})` : ""}`}
      </button>
      <div className={cn("mt-2 flex flex-wrap gap-1.5", !maisFiltros && "max-md:hidden")}>
        {ESTILOS.map((e) => <button key={e} type="button" className={chip(estilos.includes(e))} onClick={() => alterna(estilos, e, setEstilos)}>{e}</button>)}
      </div>
      <div className={cn("mt-2 flex flex-wrap gap-1.5", !maisFiltros && "max-md:hidden")}>
        {NICHOS.map((n) => <button key={n} type="button" className={chip(nichos.includes(n))} onClick={() => alterna(nichos, n, setNichos)}>{n}</button>)}
      </div>
      <div className="mt-3 border-b border-dashed border-border" />

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
                    <span className="block text-[12.5px] text-muted-foreground">{[nomeFuncao(p.funcao), p.cidade, p.atende_remoto ? "remoto" : null].filter(Boolean).join(" · ")}</span>
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
