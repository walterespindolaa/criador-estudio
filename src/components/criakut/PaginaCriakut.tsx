import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Eye, EyeOff, Instagram, Loader2, Palette, Pencil, Plus, Send, Star, UserCheck, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { compressImage } from "@/lib/image-compress";
import {
  registrarVisitaCriakut, subirImagemCriakut, useAdicionarPortfolio, useBaseCriakut, useRemoverPortfolio, useSalvarPerfilCriakut, useSeguir,
} from "@/hooks/useCriakut";
import { iniciais, nomeFuncao, precoTexto, type PaginaCriakutDados } from "@/lib/criakut";
import { CapaCriakut } from "./CapaCriakut";
import { EscolherCapa } from "./EscolherCapa";
import { EditarPerfil } from "./EditarPerfil";
import { PedirOrcamento } from "./PedirOrcamento";
import { CartaoDestaque, ComunidadesDaPagina, QuemVisitou, Recados } from "./BlocosPagina";
import { SeloDestaque } from "./Pecas";
import { cn } from "@/lib/utils";

/* A PÁGINA (mockup v3 aprovado em 14/10/2026): capa em cima, e as três
   colunas do Orkut. Esquerda: foto, nome, status e ações. Centro: "Oi, eu sou
   a…", números, recado do dia, serviços, portfólio, depoimentos. Direita: quem
   segue, estilos e nichos, e (só na minha) o que falta pra página ficar pronta.
   A MESMA tela serve pra minha página e pra de outra pessoa: muda só o que os
   botões fazem. */

const card = "rounded-[22px] border border-border bg-card p-[18px]";
const titulo = "mb-3 flex items-center justify-between text-[11.5px] font-bold uppercase tracking-[0.08em] text-primary";

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
  const primeiroNome = dados.nome.trim().split(/\s+/)[0];

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

  const pronto = [
    { ok: !!dados.foto_url, txt: "Foto" },
    { ok: (dados.sobre ?? "").length >= 40, txt: "Sobre você" },
    { ok: dados.servicos.length > 0, txt: "Serviços e preços" },
    { ok: dados.portfolio.length >= 3, txt: "3 peças no portfólio" },
    { ok: dados.capa_tipo !== "cria-1", txt: "Escolher a sua capa" },
    { ok: dados.publicado, txt: "Mostrar na busca" },
  ];
  const pct = Math.round((pronto.filter((x) => x.ok).length / pronto.length) * 100);

  return (
    <div className="pb-16">
      {dados.eh_meu && (
        <div className="mb-3 flex items-center gap-2 text-[12.5px]">
          <span className={cn("rounded-full px-2.5 py-0.5 font-bold", dados.publicado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900")}>
            {dados.publicado ? "Aparece na busca" : "Escondida: só você vê"}
          </span>
          <button type="button" className="ml-auto inline-flex items-center gap-1.5 font-semibold text-muted-foreground hover:text-foreground"
            onClick={() => setComoOutros((v) => !v)}>
            {comoOutros ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {comoOutros ? "Voltar a editar" : "Ver como os outros veem"}
          </button>
        </div>
      )}

      <div className="relative">
        <CapaCriakut tipo={dados.capa_tipo} url={dados.capa_url} className="min-h-[110px]" />
        {meu && (
          <button type="button" onClick={() => setCapaAberta(true)}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-white/95 px-3 py-1.5 text-[12px] font-bold text-foreground shadow-sm">
            <Palette className="h-3.5 w-3.5" /> Personalizar capa
          </button>
        )}
      </div>

      <div className="relative z-[1] -mt-10 grid gap-4 lg:grid-cols-[250px_1fr_270px] lg:-mt-14">
        {/* ESQUERDA */}
        <aside className="space-y-4">
          <div className={card}>
            <div className="relative mx-auto aspect-square w-full max-w-[200px] overflow-hidden rounded-[18px] border-4 border-card shadow-lg lg:max-w-none">
              {dados.foto_url
                ? <img src={dados.foto_url} alt={dados.nome} className="h-full w-full object-cover" />
                : <div className="grid h-full w-full place-items-center bg-gradient-to-br from-primary to-foreground font-display text-6xl font-extrabold text-white">{iniciais(dados.nome)}</div>}
              {meu && (
                <button type="button" onClick={() => fotoInput.current?.click()} disabled={subindo}
                  className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-foreground shadow">
                  {subindo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />} trocar foto
                </button>
              )}
            </div>
            <input ref={fotoInput} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setFotoBruta(URL.createObjectURL(f)); e.target.value = ""; }} />
            <h2 className="mt-3 font-display text-[21px] font-bold leading-tight">{dados.nome} {dados.destaque && <SeloDestaque className="ml-0.5" />}</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {[nomeFuncao(dados.funcao), dados.cidade, dados.atende_remoto ? "atende remoto" : null].filter(Boolean).join(" · ")}
            </p>
            {dados.status_texto && (
              <div className="mt-2.5 rounded-xl bg-emerald-50 px-2.5 py-2 text-[12px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">🟢 {dados.status_texto}</div>
            )}
            <div className="mt-3 grid gap-1.5">
              {meu ? (
                <Button className="rounded-xl" onClick={() => setEditando(true)}><Pencil className="h-4 w-4 mr-1.5" /> Editar minha página</Button>
              ) : (
                <>
                  <Button className="rounded-xl" disabled={dados.eh_meu} onClick={() => setPedindo(true)}>
                    <Send className="h-4 w-4 mr-1.5" /> Pedir orçamento
                  </Button>
                  {!dados.eh_meu && (
                    <Button variant="outline" className="rounded-xl" disabled={seguir.isPending}
                      onClick={() => seguir.mutate({ alvo: dados.user_id, seguir: !dados.eu_sigo })}>
                      {dados.eu_sigo ? <><UserCheck className="h-4 w-4 mr-1.5" /> Seguindo</> : <><UserPlus className="h-4 w-4 mr-1.5" /> Seguir</>}
                    </Button>
                  )}
                </>
              )}
              {dados.instagram && (
                <a href={`https://instagram.com/${dados.instagram}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 py-1 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">
                  <Instagram className="h-3.5 w-3.5" /> @{dados.instagram}
                </a>
              )}
            </div>
          </div>
        </aside>

        {/* CENTRO */}
        <div className="space-y-4 min-w-0">
          <div className={card}>
            <h1 className="font-display text-[clamp(26px,3.2vw,38px)] font-bold leading-[1.05]">Oi, eu sou {primeiroNome} 👋</h1>
            {dados.sobre
              ? <p className="mt-2.5 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/85">{dados.sobre}</p>
              : <p className="mt-2.5 text-[14px] text-muted-foreground">{meu ? "Conte quem você é em \"Editar minha página\"." : "Ainda sem descrição."}</p>}
            <div className="mt-4 flex flex-wrap gap-y-3 border-t border-dashed border-border pt-3.5">
              {[
                [dados.reputacao?.nota != null ? `★ ${String(dados.reputacao.nota).replace(".", ",")}` : "novo", dados.reputacao?.avaliacoes ? `nota (${dados.reputacao.avaliacoes} ${dados.reputacao.avaliacoes === 1 ? "avaliação" : "avaliações"})` : "sem avaliação ainda"],
                [dados.entregas_no_cria ?? 0, "entregas no Cria"],
                [dados.seguidores, "seguidores"],
                [dados.portfolio.length, "peças no portfólio"],
              ].map(([n, l]) => (
                <div key={String(l)} className="min-w-[110px] flex-1 text-[11.5px] text-muted-foreground">
                  <b className="block font-display text-[22px] font-extrabold text-foreground">{n}</b>{l}
                </div>
              ))}
            </div>
          </div>

          {dados.recado_do_dia && (
            <div className="relative -rotate-[0.6deg] rounded-md bg-amber-50 px-4 pb-3.5 pt-4 shadow-md dark:bg-amber-950/40">
              <span className="absolute -top-2 left-1/2 h-5 w-16 -translate-x-1/2 -rotate-3 rounded-sm bg-amber-300/60" />
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-amber-800 dark:text-amber-300">Recado do dia</span>
              <p className="mt-1 font-display text-[20px] font-semibold italic leading-snug">{dados.recado_do_dia}</p>
            </div>
          )}

          <div className={card} id="servicos">
            <p className={titulo}>Serviços e preços {meu && <button type="button" className="normal-case tracking-normal text-muted-foreground font-semibold" onClick={() => setEditando(true)}>✎ editar</button>}</p>
            {dados.servicos.length === 0 && <p className="text-[13px] text-muted-foreground">{meu ? "Adicione o que você faz e quanto cobra." : "Sem serviços cadastrados."}</p>}
            <table className="w-full border-collapse">
              <tbody>
                {dados.servicos.map((s, i) => (
                  <tr key={s.id ?? i} className="border-b border-dashed border-border last:border-0">
                    <td className="py-2.5 pr-3">{s.titulo}{s.detalhe && <small className="block text-[11.5px] text-muted-foreground">{s.detalhe}</small>}</td>
                    <td className="py-2.5 text-right font-display text-[16px] font-extrabold whitespace-nowrap">{precoTexto(s.preco_centavos, s.unidade)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={card} id="portfolio">
            <p className={titulo}>Portfólio {meu && (
              <button type="button" className="normal-case tracking-normal text-muted-foreground font-semibold inline-flex items-center gap-1" disabled={subindo} onClick={() => portInput.current?.click()}>
                {subindo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} adicionar
              </button>)}
            </p>
            <input ref={portInput} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { void aoEscolherPortfolio(e.target.files); e.target.value = ""; }} />
            {dados.portfolio.length === 0
              ? <p className="text-[13px] text-muted-foreground">{meu ? "Suba as peças que mais representam seu trabalho (até 12 por vez)." : "Sem peças ainda."}</p>
              : <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
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
                </div>}
          </div>

          <Recados dados={dados} modoDono={meu} />

          <div className={card} id="depoimentos">
            <p className={titulo}>Depoimentos {(dados.reputacao?.depoimentos.length ?? 0) > 0 && <span className="normal-case tracking-normal text-muted-foreground font-semibold">{dados.reputacao!.depoimentos.length}</span>}</p>
            {dados.reputacao && dados.reputacao.nota != null && (
              <div className="mb-3 flex flex-wrap gap-2 text-[12px]">
                {([["no_prazo", "No prazo"], ["criatividade", "Criatividade"], ["comunicacao", "Comunicação"]] as const).map(([k, n]) => dados.reputacao![k] != null && (
                  <span key={k} className="rounded-lg bg-muted px-2.5 py-1"><b>{n}</b> {Number(dados.reputacao![k]) >= 2.5 ? "ótimo" : Number(dados.reputacao![k]) >= 1.75 ? "ok" : "abaixo"}</span>
                ))}
              </div>
            )}
            {(dados.reputacao?.depoimentos.length ?? 0) === 0
              ? <p className="text-[13px] text-muted-foreground flex items-start gap-2"><Star className="h-4 w-4 shrink-0 mt-0.5" />
                  Ainda sem depoimentos. Só deixa depoimento quem fechou e concluiu um trabalho pelo Criakut, com entrega registrada.</p>
              : <div className="grid gap-3">
                  {dados.reputacao!.depoimentos.map((d, i) => (
                    <div key={i} className="rounded-2xl bg-muted/60 p-3.5">
                      <div className="flex items-center gap-2">
                        {d.autor_foto ? <img src={d.autor_foto} alt="" className="h-8 w-8 rounded-full object-cover" />
                          : <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-[11px] font-extrabold text-primary-foreground">{iniciais(d.autor_nome ?? "?")}</span>}
                        <span className="min-w-0 text-[12px] leading-tight">
                          {d.autor_slug ? <button type="button" className="font-bold hover:underline" onClick={() => navigate(`${base}/${d.autor_slug}`)}>{d.autor_nome}</button> : <b>{d.autor_nome ?? "Alguém"}</b>}
                          <span className="block truncate text-muted-foreground">{d.papel === "contratado" ? "contratou" : "foi contratada(o)"} · {d.trabalho}</span>
                        </span>
                        <span className="ml-auto text-[13px] text-amber-500">{"★".repeat(d.nota)}<span className="text-muted-foreground/40">{"★".repeat(5 - d.nota)}</span></span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed">{d.depoimento}</p>
                    </div>
                  ))}
                </div>}
          </div>
        </div>

        {/* DIREITA */}
        <aside className="space-y-4">
          {meu && <CartaoDestaque />}
          {meu && <QuemVisitou dados={dados} />}
          <div className={card}>
            <p className={titulo}>Quem segue ({dados.seguidores})</p>
            {dados.quem_segue.length === 0
              ? <p className="text-[12.5px] text-muted-foreground">Ninguém ainda.</p>
              : <div className="grid grid-cols-3 gap-2.5">
                  {dados.quem_segue.map((q) => (
                    <button key={q.slug} type="button" onClick={() => navigate(`${base}/${q.slug}`)} className="text-center text-[11.5px] font-semibold">
                      {q.foto_url
                        ? <img src={q.foto_url} alt="" className="mb-1 aspect-square w-full rounded-2xl object-cover" />
                        : <span className="mb-1 grid aspect-square w-full place-items-center rounded-2xl bg-primary font-display text-lg font-extrabold text-primary-foreground">{iniciais(q.nome)}</span>}
                      {q.nome.split(" ")[0]}
                    </button>
                  ))}
                </div>}
          </div>

          <ComunidadesDaPagina dados={dados} />

          {(dados.estilos.length > 0 || dados.nichos.length > 0) && (
            <div className={card}>
              {dados.estilos.length > 0 && <><p className={titulo}>Estilo</p>
                <div className="mb-3 flex flex-wrap gap-1.5">{dados.estilos.map((e) => <span key={e} className="rounded-lg bg-violet-100 px-2 py-0.5 text-[11.5px] text-violet-800 dark:bg-violet-950/50 dark:text-violet-300">{e}</span>)}</div></>}
              {dados.nichos.length > 0 && <><p className={titulo}>Nichos</p>
                <div className="flex flex-wrap gap-1.5">{dados.nichos.map((n) => <span key={n} className="rounded-lg bg-muted px-2 py-0.5 text-[11.5px]">{n}</span>)}</div></>}
            </div>
          )}

          {meu && (
            <div className={card}>
              <p className={titulo}>Sua página está {pct}% pronta</p>
              <div className="mb-2.5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} /></div>
              {pronto.map((x) => (
                <div key={x.txt} className={cn("py-1 text-[12.5px]", x.ok && "text-muted-foreground line-through")}>{x.ok ? "✅" : "⬜"} {x.txt}</div>
              ))}
            </div>
          )}
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
