import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Lock, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAcessoCriakut, useBaseCriakut, useMeuPerfilCriakut, useMinhasPropostas, usePaginaCriakut, useSalvarPerfilCriakut } from "@/hooks/useCriakut";
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
  const itens = [["minha", "Minha página"], ["buscar", "Encontrar gente"], ["mural", "Mural de trabalhos"], ["propostas", "Propostas"]];
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <span className="font-display text-[22px] font-extrabold">Cria<span className="text-primary">kut</span>
        <span className="ml-1.5 -rotate-6 inline-block rounded-md bg-foreground px-1.5 py-0.5 align-middle text-[10px] font-semibold text-background">beta</span></span>
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-card p-1">
        {itens.map(([k, n]) => (
          <button key={k} type="button" onClick={() => onTroca(k)}
            className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
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
  useEffect(() => { if (profile?.name) setNome((n) => n || profile.name || ""); }, [profile?.name]);
  const [funcao, setFuncao] = useState<FuncaoCriakut>("social_media");
  return (
    <div className="mx-auto max-w-xl">
      <CapaCriakut tipo="cria-1" />
      <div className="-mt-8 relative rounded-[22px] border border-border bg-card p-6">
        <h1 className="font-display text-[28px] font-extrabold leading-tight">Crie sua página no Criakut</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">É onde quem procura designer, editor, filmmaker ou social mídia vai te achar. Ela nasce escondida: só aparece na busca quando você quiser.</p>
        <label className="mt-4 block text-[13px] font-semibold">Seu nome</label>
        <Input className="mt-1" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} />
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
          onClick={() => salvar.mutate({ nome: nome.trim(), funcao, slug: `${slugDe(nome)}-${Math.random().toString(36).slice(2, 5)}`,
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
  const args = useMemo(() => ({ _funcao: funcao, _estilos: estilos, _nichos: nichos, _texto: texto.trim() || null, _cidade: cidade.trim() || null }), [funcao, estilos, nichos, texto, cidade]);
  const q = useQuery({
    queryKey: ["criakut-busca", args],
    queryFn: async (): Promise<Achado[]> => {
      const { data, error } = await sbRpc("criakut_procurar", args);
      if (error) throw error;
      return (data ?? []) as Achado[];
    },
  });
  const alterna = (l: string[], v: string, set: (x: string[]) => void) => set(l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);
  const chip = (on: boolean) => cn("rounded-full border px-3 py-1 text-[12.5px] font-semibold", on ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground");

  return (
    <div>
      <h1 className="font-display text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.05]">Encontre quem <span className="text-primary">faz junto</span> com você.</h1>
      <div className="mt-4 flex max-w-2xl gap-2 rounded-2xl border-[1.5px] border-foreground bg-card p-1.5 shadow-[4px_4px_0_hsl(var(--foreground))]">
        <Search className="ml-2 mt-2.5 h-4 w-4 text-muted-foreground" />
        <input className="min-w-0 flex-1 bg-transparent px-1 text-[15px] outline-none" placeholder="Nome ou palavra (ex.: carrossel)" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <input className="w-32 border-l border-border bg-transparent px-2 text-[13px] outline-none" placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {FUNCOES.map((f) => <button key={f.valor} type="button" className={chip(funcao === f.valor)} onClick={() => setFuncao(funcao === f.valor ? null : f.valor)}>{f.nome}</button>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ESTILOS.map((e) => <button key={e} type="button" className={chip(estilos.includes(e))} onClick={() => alterna(estilos, e, setEstilos)}>{e}</button>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 border-b border-dashed border-border pb-4">
        {NICHOS.map((n) => <button key={n} type="button" className={chip(nichos.includes(n))} onClick={() => alterna(nichos, n, setNichos)}>{n}</button>)}
      </div>

      {q.isLoading ? <div className="py-16 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        : (q.data ?? []).length === 0
          ? <p className="py-14 text-center text-[14px] text-muted-foreground">Ninguém com esse filtro ainda. Por enquanto só os convidados aparecem.</p>
          : <div className="mt-5 grid gap-3">
              {(q.data ?? []).map((p) => (
                <button key={p.user_id} type="button" onClick={() => navigate(`${base}/${p.slug}`)}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-[20px] border border-border bg-card p-3.5 text-left hover:border-foreground/40 max-sm:grid-cols-[auto_1fr]">
                  {p.foto_url ? <img src={p.foto_url} alt="" className="h-14 w-14 rounded-full object-cover" />
                    : <span className="grid h-14 w-14 place-items-center rounded-full bg-primary font-display text-lg font-extrabold text-primary-foreground">{iniciais(p.nome)}</span>}
                  <span className="min-w-0">
                    <b className="block font-display text-[17px]">{p.nome}</b>
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
              ))}
            </div>}
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
  const aba = slug ? "outro" : pedida === "buscar" || pedida === "mural" || pedida === "propostas" ? pedida : "minha";
  const meu = useMeuPerfilCriakut();
  const pagina = usePaginaCriakut(slug ?? (aba === "minha" ? meu.data?.slug : null));

  const trocar = (a: string) => navigate(a === "minha" ? base : `${base}?aba=${a}`);

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
