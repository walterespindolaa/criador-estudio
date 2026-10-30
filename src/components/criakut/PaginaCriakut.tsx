import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Copy, Eye, EyeOff, Instagram, Loader2, Palette, Pencil, Play, Plus, Send, Star, UserCheck, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { compressImage } from "@/lib/image-compress";
import {
  registrarVisitaCriakut, subirImagemCriakut, useAdicionarPortfolio, useBaseCriakut, useRecados, useRemoverPortfolio, useSalvarPerfilCriakut, useSeguir,
} from "@/hooks/useCriakut";
import { ehContratante, faixaTexto, iniciais, nomeFuncao, nomesFuncoes, numeroCurto, precoTexto, type PaginaCriakutDados } from "@/lib/criakut";
import { CapaCriakut } from "./CapaCriakut";
import { EscolherCapa } from "./EscolherCapa";
import { EditarPerfil } from "./EditarPerfil";
import { PedirOrcamento } from "./PedirOrcamento";
import { CartaoDestaque, ComunidadesDaPagina, QuemVisitou, Recados } from "./BlocosPagina";
import { Avatar, SeloDestaque } from "./Pecas";
import { PecasDoCriaDialog } from "./PecasDoCriaDialog";
import { usePortfolioPublico } from "@/hooks/usePortfolioCria";
import { cn } from "@/lib/utils";

/* A PÁGINA (mockup v3 aprovado em 14/10/2026; reenquadrada no mesmo dia a
   pedido do Walter: "tudo aparecendo na mesma tela sem precisar de scroll").
   Capa baixa em faixa, com os botões em cima dela. Três colunas do Orkut:
   esquerda = foto, nome, ações, estilo e nichos; centro = "Oi, eu sou", números
   e UM cartão com abas (Serviços, Portfólio, Recados, Depoimentos) em vez de
   quatro cartões empilhados; direita = blocos compactos (o que falta, visitas,
   quem segue, comunidades). A MESMA tela serve pra minha página e pra de outra
   pessoa: muda só o que os botões fazem. */

const card = "rounded-[20px] border border-border bg-card p-4";
const titulo = "mb-2.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.08em] text-primary";
type Aba = "servicos" | "portfolio" | "instagram" | "busco" | "recados" | "depoimentos";

export function PaginaCriakut({ dados }: { dados: PaginaCriakutDados }) {
  const navigate = useNavigate();
  const base = useBaseCriakut();
  const { user } = useAuth();
  const [pedindo, setPedindo] = useState(false);
  const { updateProfile } = useProfile();
  const salvar = useSalvarPerfilCriakut();
  const seguir = useSeguir();
  const addPort = useAdicionarPortfolio();
  const remPort = useRemoverPortfolio();
  const [comoOutros, setComoOutros] = useState(false);
  const meu = dados.eh_meu && !comoOutros;
  const [editando, setEditando] = useState(false);
  const [capaAberta, setCapaAberta] = useState(false);
  const [fotoBruta, setFotoBruta] = useState<string | null>(null);
  const [subindo, setSubindo] = useState(false);
  const fotoInput = useRef<HTMLInputElement>(null);
  const portInput = useRef<HTMLInputElement>(null);
  /* Peças entregues pelo Cria e liberadas pelo dono da marca (30/10/2026). */
  const pecasCria = usePortfolioPublico(dados.slug).data ?? [];
  const [escolhendoCria, setEscolhendoCria] = useState(false);
  const totalPortfolio = dados.portfolio.length + pecasCria.length;
  const primeiroNome = dados.nome.trim().split(/\s+/)[0];
  const recadosQ = useRecados(dados.slug, 5);
  const totalRecados = recadosQ.data?.total ?? 0;
  const totalDep = dados.reputacao?.depoimentos.length ?? 0;
  /* PERFIL POR FUNÇÃO (Walter, 14/10/2026): criadora de conteúdo contrata, não
     vende. A página dela mostra os últimos posts do Instagram e o que ela
     procura; a de designer, editor e filmmaker mostra serviços e portfólio.
     Social mídia faz os dois (vende e contrata). */
  const contratante = ehContratante(dados.funcao);
  const busco = dados.busco ?? [];
  const posts = dados.instagram_posts ?? [];
  const pedidosAbertos = dados.pedidos_abertos ?? [];
  const temBusca = contratante || busco.length > 0 || !!dados.busco_texto || pedidosAbertos.length > 0;
  /* Aba que abre: na minha página, a primeira coisa que falta preencher; na de
     outra pessoa, o que ela tem de mais útil pra quem visita. */
  const abaInicial: Aba = contratante
    ? (dados.eh_meu ? (busco.length === 0 ? "busco" : posts.length ? "instagram" : "recados") : (temBusca ? "busco" : posts.length ? "instagram" : "recados"))
    : dados.eh_meu
      ? (dados.servicos.length === 0 ? "servicos" : totalPortfolio < 3 ? "portfolio" : "recados")
      : (dados.servicos.length ? "servicos" : totalPortfolio ? "portfolio" : "recados");
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [sobreAberto, setSobreAberto] = useState(false);

  /* Quem visitou (Fase 3): conta a visita uma vez por página aberta. O banco
     ignora a própria página e limita por minuto. */
  useEffect(() => {
    if (!dados.eh_meu && dados.slug) void registrarVisitaCriakut(dados.slug).catch(() => undefined);
  }, [dados.eh_meu, dados.slug]);

  /* A foto é a MESMA do perfil do Cria (uma fonte só): troca aqui, troca lá. */
  const aoRecortarFoto = async (blob: Blob) => {
    if (!user?.id) return;
    setSubindo(true);
    try {
      const path = `${user.id}/avatar.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      const url = `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?t=${Date.now()}`;
      await updateProfile.mutateAsync({ avatar_url: url });
      await salvar.mutateAsync({ foto_url: url });
      toast.success("Foto atualizada!");
    } catch { toast.error("Não consegui trocar a foto."); }
    finally { setSubindo(false); setFotoBruta(null); }
  };

  const aoEscolherPortfolio = async (files: FileList | null) => {
    if (!files?.length || !user?.id) return;
    setSubindo(true);
    try {
      let ordem = dados.portfolio.length;
      for (const f of Array.from(files).slice(0, 12)) {
        if (!f.type.startsWith("image/")) continue;
        const url = await subirImagemCriakut(user.id, await compressImage(f), "portfolio");
        await addPort.mutateAsync({ url, ordem: ordem++ });
      }
      toast.success("Portfólio atualizado!");
    } catch { toast.error("Alguma imagem não subiu. Tente de novo."); }
    finally { setSubindo(false); }
  };

  const pronto = contratante ? [
    { ok: !!dados.foto_url, txt: "Foto" },
    { ok: (dados.sobre ?? "").length >= 40, txt: "Sobre você" },
    { ok: busco.length > 0, txt: "O que você procura" },
    { ok: !!dados.cidade, txt: "Sua cidade" },
    { ok: dados.capa_tipo !== "cria-1", txt: "Escolher a sua capa" },
    { ok: dados.publicado, txt: "Mostrar na busca" },
  ] : [
    { ok: !!dados.foto_url, txt: "Foto" },
    { ok: (dados.sobre ?? "").length >= 40, txt: "Sobre você" },
    { ok: dados.servicos.length > 0, txt: "Serviços e preços" },
    { ok: totalPortfolio >= 3, txt: "3 peças no portfólio" },
    { ok: dados.capa_tipo !== "cria-1", txt: "Escolher a sua capa" },
    { ok: dados.publicado, txt: "Mostrar na busca" },
  ];
  const pct = Math.round((pronto.filter((x) => x.ok).length / pronto.length) * 100);

  const pendentes = pronto.filter((x) => !x.ok);
  const abrirPendente = (txt: string) => {
    if (txt === "Foto") fotoInput.current?.click();
    else if (txt === "Escolher a sua capa") setCapaAberta(true);
    else if (txt === "3 peças no portfólio") { setAba("portfolio"); portInput.current?.click(); }
    else if (txt === "O que você procura") { setAba("busco"); setEditando(true); }
    else setEditando(true);
  };
  const sobreLongo = (dados.sobre ?? "").length > 220;

  const abas: { k: Aba; nome: string; n: number }[] = contratante ? [
    { k: "busco", nome: "O que procuro", n: pedidosAbertos.length },
    { k: "instagram", nome: "Instagram", n: posts.length },
    { k: "recados", nome: "Recados", n: totalRecados },
    { k: "depoimentos", nome: "Depoimentos", n: totalDep },
  ] : [
    { k: "servicos", nome: "Serviços", n: dados.servicos.length },
    { k: "portfolio", nome: "Portfólio", n: totalPortfolio },
    ...(temBusca ? [{ k: "busco" as Aba, nome: "O que procuro", n: pedidosAbertos.length }] : []),
    ...(posts.length ? [{ k: "instagram" as Aba, nome: "Instagram", n: posts.length }] : []),
    { k: "recados", nome: "Recados", n: totalRecados },
    { k: "depoimentos", nome: "Depoimentos", n: totalDep },
  ];
  const numeros: [string | number, string][] = contratante ? [
    [dados.instagram_seguidores != null ? numeroCurto(dados.instagram_seguidores) : "–", "seguidores no Instagram"],
    [dados.contratacoes ?? 0, "trabalhos contratados"],
    [dados.seguidores, "seguem no Criakut"],
    [dados.reputacao?.nota_contratante != null ? `★ ${String(dados.reputacao.nota_contratante).replace(".", ",")}` : "novo", "nota como contratante"],
  ] : [
    [dados.reputacao?.nota != null ? `★ ${String(dados.reputacao.nota).replace(".", ",")}` : "novo", dados.reputacao?.avaliacoes ? `${dados.reputacao.avaliacoes} ${dados.reputacao.avaliacoes === 1 ? "avaliação" : "avaliações"}` : "sem nota ainda"],
    [dados.entregas_no_cria ?? 0, "entregas no Cria"],
    [dados.seguidores, "seguidores"],
    [totalPortfolio, "no portfólio"],
  ];

  return (
    <div className="pb-10">
      {/* CAPA: faixa baixa (o desenho 4 por 1 é cortado mostrando a parte de cima),
          com status e botões por cima, pra não gastar uma linha só com eles. */}
      <div className="relative">
        <CapaCriakut tipo={dados.capa_tipo} url={dados.capa_url} topo className="aspect-auto h-[104px] sm:h-[130px] lg:h-[140px]" />
        {dados.eh_meu && (
          <div className="absolute inset-x-3 top-3 flex flex-wrap items-start gap-1.5">
            <span className={cn("rounded-full px-2.5 py-1 text-[11.5px] font-bold shadow-sm", dados.publicado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900")}>
              {dados.publicado ? "Aparece na busca" : "Escondida: só você vê"}
            </span>
            <span className="ml-auto flex flex-wrap justify-end gap-1.5">
              <button type="button" onClick={() => setComoOutros((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11.5px] font-bold text-foreground shadow-sm">
                {comoOutros ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <span className="max-sm:hidden">{comoOutros ? "Voltar a editar" : "Ver como os outros veem"}</span>
              </button>
              {meu && (
                <button type="button" onClick={() => setCapaAberta(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11.5px] font-bold text-foreground shadow-sm">
                  <Palette className="h-3.5 w-3.5" /> <span className="max-sm:hidden">Personalizar capa</span><span className="sm:hidden">Capa</span>
                </button>
              )}
            </span>
          </div>
        )}
      </div>

      <div className="relative z-[1] mt-3 grid gap-3.5 md:-mt-12 md:grid-cols-[220px_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:items-start lg:grid-cols-[230px_minmax(0,1fr)_260px] lg:grid-rows-none">
        {/* ESQUERDA: quem é */}
        <aside className={cn(card, "md:sticky md:top-4")}>
          {/* No celular a foto fica pequena ao lado do nome (era um quadrado de meia tela). */}
          <div className="max-md:flex max-md:items-center max-md:gap-3">
          <div className="relative mx-auto aspect-square w-full max-w-[180px] shrink-0 overflow-hidden rounded-[18px] border-4 border-card shadow-lg max-md:mx-0 max-md:w-[88px] max-md:rounded-2xl max-md:border-2">
            {dados.foto_url
              ? <img src={dados.foto_url} alt={dados.nome} className="h-full w-full object-cover" />
              : <div className="grid h-full w-full place-items-center bg-gradient-to-br from-primary to-foreground font-display text-5xl font-extrabold text-white">{iniciais(dados.nome)}</div>}
            {meu && (
              <button type="button" onClick={() => fotoInput.current?.click()} disabled={subindo} aria-label="Trocar foto"
                className="absolute bottom-1.5 right-1.5 grid h-8 w-8 place-items-center rounded-full bg-white text-foreground shadow max-md:bottom-1 max-md:right-1 max-md:h-6 max-md:w-6">
                {subindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
          <input ref={fotoInput} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setFotoBruta(URL.createObjectURL(f)); e.target.value = ""; }} />
          <div className="min-w-0 max-md:flex-1">
          <h2 className="mt-2.5 font-display text-[19px] font-bold leading-tight max-md:mt-0">{dados.nome} {dados.destaque && <SeloDestaque className="ml-0.5" />}</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {[nomesFuncoes(dados.funcao, dados.outras_funcoes), dados.cidade, !contratante && dados.atende_remoto ? "atende remoto" : null].filter(Boolean).join(" · ")}
          </p>
          {dados.status_texto && (
            <div className="mt-2 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-[11.5px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">🟢 {dados.status_texto}</div>
          )}
          </div>
          </div>
          <div className="mt-2.5 grid gap-1.5">
            {meu ? (
              <Button size="sm" className="h-9 rounded-xl" onClick={() => setEditando(true)}><Pencil className="mr-1.5 h-4 w-4" /> Editar minha página</Button>
            ) : (
              <>
                {contratante
                  ? <Button size="sm" className="h-9 rounded-xl" onClick={() => setAba(temBusca ? "busco" : "recados")}>
                      <Send className="mr-1.5 h-4 w-4" /> {temBusca ? "Ver o que procura" : "Deixar um recado"}
                    </Button>
                  : <Button size="sm" className="h-9 rounded-xl" disabled={dados.eh_meu} onClick={() => setPedindo(true)}>
                      <Send className="mr-1.5 h-4 w-4" /> Pedir orçamento
                    </Button>}
                {!dados.eh_meu && (
                  <Button size="sm" variant="outline" className="h-9 rounded-xl" disabled={seguir.isPending}
                    onClick={() => seguir.mutate({ alvo: dados.user_id, seguir: !dados.eu_sigo })}>
                    {dados.eu_sigo ? <><UserCheck className="mr-1.5 h-4 w-4" /> Seguindo</> : <><UserPlus className="mr-1.5 h-4 w-4" /> Seguir</>}
                  </Button>
                )}
              </>
            )}
            {dados.instagram && (
              <a href={`https://instagram.com/${dados.instagram}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 py-0.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
                <Instagram className="h-3.5 w-3.5" /> @{dados.instagram}
              </a>
            )}
          </div>
          {(dados.estilos.length > 0 || dados.nichos.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-1 border-t border-dashed border-border pt-3">
              {dados.estilos.map((e) => <span key={e} className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[11px] text-violet-800 dark:bg-violet-950/50 dark:text-violet-300">{e}</span>)}
              {dados.nichos.map((n) => <span key={n} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]">{n}</span>)}
            </div>
          )}
        </aside>

        {/* CENTRO: quem eu sou + o que eu ofereço (abas) */}
        <div className="min-w-0 space-y-3.5 md:row-span-2 lg:row-span-1">
          <div className={card}>
            <h1 className="font-display text-[clamp(24px,2.6vw,32px)] font-bold leading-[1.05]">Oi, eu sou {primeiroNome} 👋</h1>
            {dados.sobre
              ? <p className={cn("mt-2 whitespace-pre-wrap text-[14.5px] leading-relaxed text-foreground/85", sobreLongo && !sobreAberto && "line-clamp-3")}>{dados.sobre}</p>
              : <p className="mt-2 text-[13.5px] text-muted-foreground">{meu ? "Conte quem você é em \"Editar minha página\"." : "Ainda sem descrição."}</p>}
            {sobreLongo && <button type="button" className="mt-0.5 text-[12px] font-semibold text-primary" onClick={() => setSobreAberto((v) => !v)}>{sobreAberto ? "ler menos" : "ler mais"}</button>}
            {busco.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-1 text-[12.5px]">
                <b className="mr-0.5 text-muted-foreground">Procuro:</b>
                {busco.map((b) => <span key={b} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11.5px] font-semibold text-primary">{nomeFuncao(b)}</span>)}
              </p>
            )}
            {dados.recado_do_dia && (
              <p className="mt-2.5 rounded-lg bg-amber-50 px-3 py-2 text-[13px] dark:bg-amber-950/40">
                <b className="mr-1.5 text-[10.5px] uppercase tracking-[0.08em] text-amber-800 dark:text-amber-300">Recado do dia</b>
                <span className="font-display italic">{dados.recado_do_dia}</span>
              </p>
            )}
            <div className="mt-3 grid grid-cols-4 gap-2 border-t border-dashed border-border pt-3">
              {numeros.map(([n, l]) => (
                <div key={String(l)} className="min-w-0 text-[11px] leading-tight text-muted-foreground">
                  <b className="block font-display text-[19px] font-extrabold text-foreground">{n}</b>{l}
                </div>
              ))}
            </div>
          </div>

          <div className={cn(card, "p-0")}>
            <div className="flex gap-1 overflow-x-auto border-b border-border px-2.5 pt-2.5 [scrollbar-width:none]">
              {abas.map((a) => (
                <button key={a.k} type="button" onClick={() => setAba(a.k)}
                  className={cn("-mb-px shrink-0 border-b-2 px-2.5 pb-2 pt-1 text-[13px] font-semibold transition-colors",
                    aba === a.k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {a.nome}{a.n > 0 && <span className="ml-1 text-[11px] text-muted-foreground">{a.n}</span>}
                </button>
              ))}
              {meu && aba === "portfolio" && (
                <button type="button" className="ml-auto inline-flex shrink-0 items-center gap-1 pb-2 pr-1.5 text-[12px] font-semibold text-primary hover:underline"
                  onClick={() => setEscolhendoCria(true)}>
                  <Star className="h-3 w-3" /> peças do Cria
                </button>
              )}
              {meu && (aba === "servicos" || aba === "portfolio") && (
                <button type="button" className={cn("inline-flex shrink-0 items-center gap-1 pb-2 pr-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground", aba !== "portfolio" && "ml-auto")}
                  disabled={subindo} onClick={() => (aba === "servicos" ? setEditando(true) : portInput.current?.click())}>
                  {aba === "servicos" ? <><Pencil className="h-3 w-3" /> editar</> : subindo ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Plus className="h-3 w-3" /> adicionar</>}
                </button>
              )}
            </div>
            <PecasDoCriaDialog aberto={escolhendoCria} onClose={() => setEscolhendoCria(false)} />
            <input ref={portInput} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { void aoEscolherPortfolio(e.target.files); e.target.value = ""; }} />
            {/* Altura limitada no computador: a página cabe na tela e a aba rola por dentro. */}
            <div className={cn("p-4", aba !== "instagram" && "lg:max-h-[264px] lg:overflow-y-auto")}>
              {aba === "servicos" && (
                dados.servicos.length === 0
                  ? <p className="text-[13px] text-muted-foreground">{meu ? "Adicione o que você faz e quanto cobra." : "Sem serviços cadastrados."}</p>
                  : <table className="w-full border-collapse text-[14px]">
                      <tbody>
                        {dados.servicos.map((s, i) => (
                          <tr key={s.id ?? i} className="border-b border-dashed border-border last:border-0">
                            <td className="py-2 pr-3">{s.titulo}{s.detalhe && <small className="block text-[11.5px] text-muted-foreground">{s.detalhe}</small>}</td>
                            <td className="whitespace-nowrap py-2 text-right font-display text-[15px] font-extrabold">{precoTexto(s.preco_centavos, s.unidade)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
              )}
              {aba === "portfolio" && (
                totalPortfolio === 0
                  ? <p className="text-[13px] text-muted-foreground">{meu ? "Suba as peças que mais representam seu trabalho (até 12 por vez), ou escolha em \"peças do Cria\" as que você entregou por aqui." : "Sem peças ainda."}</p>
                  : <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-6">
                      {pecasCria.map((p) => (
                        <div key={p.post_id} className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted" title={p.rotulo}>
                          <img src={p.capa} alt={p.rotulo} loading="lazy" className="h-full w-full object-cover" />
                          <span className="absolute inset-x-1 bottom-1 truncate rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">Feita no Cria · {p.rotulo}</span>
                        </div>
                      ))}
                      {dados.portfolio.map((p) => (
                        <div key={p.id} className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
                          <img src={p.media_url} alt={p.legenda ?? ""} loading="lazy" className="h-full w-full object-cover" />
                          {meu && (
                            <button type="button" aria-label="Remover peça" onClick={() => remPort.mutate(p.id)}
                              className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
              )}
              {aba === "instagram" && (
                posts.length === 0
                  ? <p className="text-[13px] text-muted-foreground">{meu
                      ? (dados.mostrar_instagram === false ? "Você escondeu seus posts em Editar minha página." : "Conecte seu Instagram no Cria (Configurações) e seus últimos posts aparecem aqui sozinhos.")
                      : "Sem posts pra mostrar."}</p>
                  : <div>
                      {/* Cara de perfil do Instagram (Walter, 14/10/2026): cabeçalho com o @ e
                          os seguidores, grade colada de 3 por linha no celular e uma faixa de 6
                          no computador (sem barra de rolagem dentro da aba). */}
                      <div className="mb-3 flex items-center gap-2.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] p-[2px]">
                          <span className="grid h-full w-full place-items-center rounded-full bg-card"><Instagram className="h-4 w-4" /></span>
                        </span>
                        <span className="min-w-0 flex-1 leading-tight">
                          <b className="block truncate text-[13.5px]">{dados.instagram ? `@${dados.instagram}` : "Instagram"}</b>
                          <span className="text-[11.5px] text-muted-foreground">
                            {dados.instagram_seguidores != null ? `${numeroCurto(dados.instagram_seguidores)} seguidores · ` : ""}últimos posts
                          </span>
                        </span>
                        {dados.instagram && (
                          <a href={`https://instagram.com/${dados.instagram}`} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 rounded-full border border-border px-3 py-1 text-[12px] font-semibold hover:border-foreground/40">Ver perfil</a>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-[3px] overflow-hidden rounded-xl sm:grid-cols-6 sm:[&>*:nth-child(n+7)]:hidden">
                        {posts.slice(0, 9).map((p) => (
                          <a key={p.link} href={p.link} target="_blank" rel="noopener noreferrer" className="group relative block aspect-[4/5] overflow-hidden bg-muted">
                            <img src={p.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                            <span className="absolute inset-0 grid place-items-center bg-black/0 text-[11px] font-bold text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">Ver post</span>
                            {(p.tipo === "REELS" || p.tipo === "VIDEO") && <Play className="absolute right-1.5 top-1.5 h-3.5 w-3.5 fill-white text-white drop-shadow" />}
                            {p.tipo === "CAROUSEL_ALBUM" && <Copy className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-white drop-shadow" />}
                          </a>
                        ))}
                      </div>
                    </div>
              )}
              {aba === "busco" && (
                <div className="space-y-3">
                  {busco.length === 0 && !dados.busco_texto && pedidosAbertos.length === 0 && (
                    <p className="text-[13px] text-muted-foreground">{meu ? "Diga quem você procura (designer, editor, social mídia...) em Editar minha página. É o que aparece pra quem presta serviço." : "Ainda não disse o que procura. Deixe um recado!"}</p>
                  )}
                  {busco.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">{busco.map((b) => <span key={b} className="rounded-full bg-primary/10 px-3 py-1 text-[12.5px] font-semibold text-primary">{nomeFuncao(b)}</span>)}</div>
                  )}
                  {dados.busco_texto && <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{dados.busco_texto}</p>}
                  {pedidosAbertos.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Trabalhos abertos no mural</p>
                      <div className="grid gap-2">
                        {pedidosAbertos.map((d) => (
                          <button key={d.id} type="button" onClick={() => navigate(`${base}?aba=mural`)}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-left hover:border-foreground/40">
                            <span className="min-w-0"><b className="block truncate text-[13.5px]">{d.titulo}</b>
                              <span className="text-[11.5px] text-muted-foreground">{nomeFuncao(d.funcao)} · {d.tipo === "recorrente" ? "todo mês" : "avulso"}</span></span>
                            <span className="shrink-0 font-display text-[13.5px] font-extrabold">{faixaTexto(d.valor_min_centavos, d.valor_max_centavos, d.unidade)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {aba === "recados" && <Recados dados={dados} modoDono={meu} embutido />}
              {aba === "depoimentos" && (
                <>
                  {dados.reputacao && dados.reputacao.nota != null && (
                    <div className="mb-3 flex flex-wrap gap-2 text-[12px]">
                      {([["no_prazo", "No prazo"], ["criatividade", "Criatividade"], ["comunicacao", "Comunicação"]] as const).map(([k, n]) => dados.reputacao![k] != null && (
                        <span key={k} className="rounded-lg bg-muted px-2.5 py-1"><b>{n}</b> {Number(dados.reputacao![k]) >= 2.5 ? "ótimo" : Number(dados.reputacao![k]) >= 1.75 ? "ok" : "abaixo"}</span>
                      ))}
                    </div>
                  )}
                  {totalDep === 0
                    ? <p className="flex items-start gap-2 text-[13px] text-muted-foreground"><Star className="mt-0.5 h-4 w-4 shrink-0" />
                        Ainda sem depoimentos. Só deixa depoimento quem fechou e concluiu um trabalho pelo Criakut, com entrega registrada.</p>
                    : <div className="grid gap-2.5">
                        {dados.reputacao!.depoimentos.map((d, i) => (
                          <div key={i} className="rounded-2xl bg-muted/60 p-3">
                            <div className="flex items-center gap-2">
                              <Avatar nome={d.autor_nome ?? "?"} foto={d.autor_foto} className="h-8 w-8 text-[11px]" />
                              <span className="min-w-0 text-[12px] leading-tight">
                                {d.autor_slug ? <button type="button" className="font-bold hover:underline" onClick={() => navigate(`${base}/${d.autor_slug}`)}>{d.autor_nome}</button> : <b>{d.autor_nome ?? "Alguém"}</b>}
                                <span className="block truncate text-muted-foreground">{d.papel === "contratado" ? "contratou" : "foi contratada(o)"} · {d.trabalho}</span>
                              </span>
                              <span className="ml-auto text-[13px] text-amber-500">{"★".repeat(d.nota)}<span className="text-muted-foreground/40">{"★".repeat(5 - d.nota)}</span></span>
                            </div>
                            <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed">{d.depoimento}</p>
                          </div>
                        ))}
                      </div>}
                </>
              )}
            </div>
          </div>
        </div>

        {/* DIREITA: blocos compactos (no iPad desce pra baixo da coluna da foto) */}
        <aside className="space-y-3.5 md:col-start-1 md:row-start-2 lg:col-start-3 lg:row-start-1">
          {meu && <CartaoDestaque />}
          {meu && pendentes.length > 0 && (
            <div className={card}>
              <p className={titulo}>Sua página está {pct}% pronta</p>
              <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} /></div>
              <div className="flex flex-wrap gap-1.5">
                {pendentes.map((x) => (
                  <button key={x.txt} type="button" onClick={() => abrirPendente(x.txt)}
                    className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:border-primary hover:text-primary">
                    + {x.txt}
                  </button>
                ))}
              </div>
            </div>
          )}
          {meu && <QuemVisitou dados={dados} />}
          <div className={card}>
            <p className={titulo}>Quem segue <span className="font-semibold normal-case tracking-normal text-muted-foreground">{dados.seguidores}</span></p>
            {dados.quem_segue.length === 0
              ? <p className="text-[12px] text-muted-foreground">Ninguém ainda.</p>
              : <div className="flex flex-wrap gap-1.5">
                  {dados.quem_segue.map((q) => (
                    <button key={q.slug} type="button" title={q.nome} onClick={() => navigate(`${base}/${q.slug}`)}>
                      <Avatar nome={q.nome} foto={q.foto_url} className="h-9 w-9 rounded-xl text-[11px]" />
                    </button>
                  ))}
                </div>}
          </div>
          <ComunidadesDaPagina dados={dados} />
        </aside>
      </div>

      {!dados.eh_meu && (
        <PedirOrcamento open={pedindo} onOpenChange={setPedindo} contratadoId={dados.user_id} nome={dados.nome} servicos={dados.servicos} />
      )}
      {dados.eh_meu && (
        <>
          <EditarPerfil open={editando} onOpenChange={setEditando} perfil={dados} servicos={dados.servicos} />
          <EscolherCapa open={capaAberta} onOpenChange={setCapaAberta} atual={dados.capa_tipo} urlAtual={dados.capa_url} />
          {fotoBruta && (
            <ImageCropModal open={!!fotoBruta} onOpenChange={(o) => { if (!o) setFotoBruta(null); }}
              imageSrc={fotoBruta} onCropComplete={(b) => void aoRecortarFoto(b)} aspectRatio={1} cropShape="rect" />
          )}
        </>
      )}
    </div>
  );
}
