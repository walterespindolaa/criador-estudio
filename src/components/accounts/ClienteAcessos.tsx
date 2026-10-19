import { useEffect, useRef, useState } from "react";
import { Copy, Eye, EyeOff, KeyRound, Link2, Loader2, Lock, Pencil, Plus, Trash2, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { confirmar } from "@/components/shared/Confirm";
import { ModuleUpsell } from "@/components/accounts/ModuleUpsell";
import {
  useCofreStatus, useCofreAcessos, useCofreHistorico, useCofreQuemVe, useCofreSalvar, useCofreApagar, useCofreCriarLink,
  cofreRevelar, cofreErro, diasDesde, COFRE_PLATAFORMAS, COFRE_CODIGO_VIA, type CofreAcesso, type CofreLog,
} from "@/hooks/useCofre";
import { PreviaWhatsApp } from "@/components/shared/PreviaWhatsApp";

/* ═══════════════════════════════════════════════════════════════════════════
   ABA "ACESSOS" DA FICHA DO CLIENTE (Walter, 14/10/2026)

   Mockup aprovado no canvas "Cofre de Acessos do Cria". Cada acesso num cartão:
   plataforma, login, senha escondida. O olho mostra a senha por 20 segundos e
   ela some sozinha; copiar a senha também fica registrado. A lateral mostra
   quem pode ver e o histórico de quem viu.
   ═══════════════════════════════════════════════════════════════════════════ */

const SEGUNDOS_VISIVEL = 20;
const DIAS_SENHA_VELHA = 90;

const COR_PLATAFORMA: Record<string, string> = {
  instagram: "#C13584", facebook: "#1877F2", meta: "#1877F2", google: "#1E7A3C", tiktok: "#1B1A18",
  youtube: "#C4302B", linkedin: "#0A66C2", site: "#5A4FCF", canva: "#00A3A3",
};
function corDa(plataforma: string) {
  const p = plataforma.toLowerCase();
  const chave = Object.keys(COR_PLATAFORMA).find((k) => p.includes(k));
  return chave ? COR_PLATAFORMA[chave] : "#6B665D";
}
function sigla(plataforma: string) {
  const partes = plataforma.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "?") + (partes[1]?.[0] ?? partes[0]?.[1] ?? "")).toUpperCase();
}

function quando(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === hoje.toDateString()) return `hoje, ${hora}`;
  if (d.toDateString() === ontem.toDateString()) return `ontem, ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${hora}`;
}

function frase(l: CofreLog) {
  const quem = l.autor_nome ?? "Alguém";
  const p = l.plataforma ?? "";
  switch (l.acao) {
    case "revelou": return `${quem} viu a senha do ${p}`;
    case "copiou_senha": return `${quem} copiou a senha do ${p}`;
    case "criou": return `${quem} cadastrou ${p}`;
    case "editou": return `${quem} editou ${p}`;
    case "apagou": return `${quem} apagou ${p}`;
    case "cliente_enviou": return `O cliente mandou ${p} pelo link`;
    case "link_criado": return `${quem} gerou um link pro cliente mandar acessos`;
    default: return `${quem}: ${l.acao}`;
  }
}

async function copiarTexto(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true; } catch { return false; }
}

export function ClienteAcessosTab({ crmClientId, clientName }: { crmClientId: string; clientName: string }) {
  const status = useCofreStatus(crmClientId);
  const pode = !!status.data?.pode;
  const acessos = useCofreAcessos(crmClientId, pode);
  const historico = useCofreHistorico(crmClientId, pode);
  const quemVe = useCofreQuemVe(crmClientId, pode);
  const apagar = useCofreApagar(crmClientId);
  const criarLink = useCofreCriarLink(crmClientId);

  // Senha aberta: só uma por vez, só na memória, some sozinha.
  const [aberta, setAberta] = useState<{ id: string; senha: string | null; observacao: string | null } | null>(null);
  const [segundos, setSegundos] = useState(SEGUNDOS_VISIVEL);
  const [carregandoId, setCarregandoId] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [editando, setEditando] = useState<CofreAcesso | "novo" | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);
  // Saiu da aba ou trocou de cliente: a senha não fica na tela.
  useEffect(() => { setAberta(null); setLink(null); }, [crmClientId]);

  const fechar = () => { if (timer.current) window.clearInterval(timer.current); timer.current = null; setAberta(null); };
  const abrirPor20s = (v: { id: string; senha: string | null; observacao: string | null }) => {
    if (timer.current) window.clearInterval(timer.current);
    setAberta(v); setSegundos(SEGUNDOS_VISIVEL);
    timer.current = window.setInterval(() => {
      setSegundos((s) => { if (s <= 1) { fechar(); return SEGUNDOS_VISIVEL; } return s - 1; });
    }, 1000);
  };

  const marcarCopiado = (chave: string) => { setCopiado(chave); window.setTimeout(() => setCopiado((c) => (c === chave ? null : c)), 1500); };

  const alternar = async (a: CofreAcesso) => {
    if (aberta?.id === a.id) { fechar(); return; }
    setCarregandoId(a.id);
    try {
      const r = await cofreRevelar(a.id, "revelou");
      abrirPor20s({ id: a.id, ...r });
      historico.refetch();
    } catch (e) { toast.error(cofreErro(e, "Mostrar a senha")); }
    finally { setCarregandoId(null); }
  };

  const copiarSenha = async (a: CofreAcesso) => {
    // Já aberta: copia na hora, ainda dentro do clique (o Safari exige isso).
    if (aberta?.id === a.id && aberta.senha) {
      if (await copiarTexto(aberta.senha)) marcarCopiado(`${a.id}:s`);
      return;
    }
    setCarregandoId(a.id);
    try {
      const r = await cofreRevelar(a.id, "copiou_senha");
      historico.refetch();
      if (r.senha && (await copiarTexto(r.senha))) { marcarCopiado(`${a.id}:s`); return; }
      // O navegador barrou a cópia depois da espera: mostra pra copiar à mão.
      abrirPor20s({ id: a.id, ...r });
      toast.message("A senha está à mostra por 20 segundos. Selecione e copie.");
    } catch (e) { toast.error(cofreErro(e, "Copiar a senha")); }
    finally { setCarregandoId(null); }
  };

  const remover = async (a: CofreAcesso) => {
    const ok = await confirmar({ titulo: `Apagar o acesso do ${a.plataforma}?`, descricao: "O login e a senha somem do cofre. O histórico continua registrado.", acao: "Apagar" });
    if (!ok) return;
    apagar.mutate(a.id, { onSuccess: () => toast.success("Acesso apagado."), onError: (e) => toast.error(cofreErro(e, "Apagar")) });
  };

  const gerarLink = () => criarLink.mutate(undefined, {
    onSuccess: (r) => setLink(`${window.location.origin}/acessos/${r.token}`),
    onError: (e) => toast.error(cofreErro(e, "Gerar o link")),
  });

  if (status.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (status.isError) {
    return <p className="text-sm font-body text-muted-foreground py-10 text-center">{cofreErro(status.error, "Abrir o cofre")}</p>;
  }
  if (!status.data?.tem_modulo) return <ModuleUpsell code="crm" clientName={clientName} />;
  if (!pode) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-3"><Lock className="h-5 w-5 text-primary" /></div>
        <p className="text-sm font-body text-foreground font-medium">Os acessos deste cliente estão fechados pra você</p>
        <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">
          Quem libera é a dona da conta, em Equipe, na chave "Ver o cofre de acessos".
        </p>
      </div>
    );
  }

  const lista = acessos.data ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl space-y-1.5">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-extrabold text-2xl text-foreground">Acessos</h2>
            <span className="text-[11px] font-body font-bold px-2.5 py-0.5 rounded-full bg-pink-100 text-pink-800">Cria Gestão</span>
          </div>
          <p className="text-sm font-body text-muted-foreground leading-relaxed">
            Os logins de {clientName || "este cliente"} num lugar só. As senhas ficam criptografadas e só aparecem quando alguém com permissão pede pra ver. Cada vez fica registrada.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={gerarLink} disabled={criarLink.isPending} className="min-h-[44px] rounded-xl">
            {criarLink.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
            Pedir acessos ao cliente
          </Button>
          <Button onClick={() => setEditando("novo")} className="min-h-[44px] rounded-xl">
            <Plus className="h-4 w-4 mr-2" /> Novo acesso
          </Button>
        </div>
      </header>

      {link && (
        <div className="rounded-2xl border border-dashed border-primary/50 bg-card p-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px]">
            <p className="text-sm font-body font-bold text-foreground">Link pro cliente mandar os acessos</p>
            <p className="text-[12.5px] font-body text-muted-foreground">Ele abre no celular, preenche e as senhas chegam criptografadas aqui. Vale por 7 dias.</p>
          </div>
          <code className="text-[12.5px] bg-muted rounded-lg px-3 py-2 max-w-full overflow-x-auto select-all">{link}</code>
          <Button size="sm" className="min-h-[40px] rounded-xl" onClick={async () => { if (await copiarTexto(link)) { marcarCopiado("link"); toast.success("Link copiado."); } }}>
            {copiado === "link" ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />} Copiar link
          </Button>
          <PreviaWhatsApp url={link} className="min-h-[40px]" />
        </div>
      )}

      <div className="flex flex-wrap gap-5 items-start">
        <section aria-label="Lista de acessos" className="flex-[999_1_520px] min-w-0 space-y-3">
          {acessos.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : acessos.isError ? (
            <p className="text-sm font-body text-muted-foreground">{cofreErro(acessos.error, "Carregar os acessos")}</p>
          ) : lista.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-3"><KeyRound className="h-5 w-5 text-primary" /></div>
              <p className="text-sm font-body font-medium text-foreground">Nenhum acesso guardado ainda</p>
              <p className="text-xs font-body text-muted-foreground mt-1 max-w-sm mx-auto">Cadastre você mesma ou mande o link pro cliente preencher do celular dele.</p>
            </div>
          ) : (
            lista.map((a) => {
              const abertaAqui = aberta?.id === a.id;
              const dias = diasDesde(a.senha_alterada_em);
              const velha = a.tem_senha && dias !== null && dias >= DIAS_SENHA_VELHA;
              return (
                <article key={a.id} className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-4 items-center">
                  <div className="w-11 h-11 rounded-xl grid place-items-center text-white font-display font-extrabold shrink-0" style={{ backgroundColor: corDa(a.plataforma) }} aria-hidden="true">
                    {sigla(a.plataforma)}
                  </div>
                  <div className="flex-[1_1_170px] min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-body font-bold text-[15px] text-foreground">{a.plataforma}</span>
                      {velha && <span className="text-[11px] font-body font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Trocar senha ({dias} dias)</span>}
                      {a.enviado_pelo_cliente && <span className="text-[11px] font-body font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Enviado pelo cliente</span>}
                    </div>
                    <p className="text-[12.5px] font-body text-muted-foreground">
                      {a.codigo_via ? `Código de verificação: ${a.codigo_via}` : "Sem código de verificação informado"}
                    </p>
                    {a.url && (
                      <a href={/^https?:\/\//i.test(a.url) ? a.url : `https://${a.url}`} target="_blank" rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-[12.5px] font-body text-primary hover:underline max-w-full truncate">
                        <ExternalLink className="h-3 w-3 shrink-0" /> {a.url}
                      </a>
                    )}
                  </div>
                  <div className="flex-[1_1_220px] min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] font-body font-bold text-muted-foreground w-11">LOGIN</span>
                      <span className="text-[13.5px] font-body truncate min-w-0">{a.login || "sem login"}</span>
                      {a.login && (
                        <button type="button" aria-label={`Copiar login do ${a.plataforma}`}
                          onClick={async () => { if (await copiarTexto(a.login!)) marcarCopiado(`${a.id}:l`); }}
                          className="ml-auto h-8 min-w-[44px] px-2 rounded-lg border border-border bg-background text-[11.5px] font-body font-bold hover:bg-muted">
                          {copiado === `${a.id}:l` ? "Copiado" : "Copiar"}
                        </button>
                      )}
                    </div>
                    {a.tem_senha ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10.5px] font-body font-bold text-muted-foreground w-11">SENHA</span>
                        <span className="text-[13.5px] font-mono tracking-wide truncate min-w-0 select-all">{abertaAqui ? aberta?.senha ?? "" : "••••••••••"}</span>
                        {abertaAqui && <span className="text-[11px] font-body text-amber-700 whitespace-nowrap">some em {segundos}s</span>}
                        <div className="ml-auto flex gap-1.5">
                          <button type="button" aria-label={abertaAqui ? "Esconder senha" : "Ver senha"} onClick={() => alternar(a)} disabled={carregandoId === a.id}
                            className="h-8 w-11 grid place-items-center rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-60">
                            {carregandoId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : abertaAqui ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <button type="button" aria-label={`Copiar senha do ${a.plataforma}`} onClick={() => copiarSenha(a)} disabled={carregandoId === a.id}
                            className="h-8 min-w-[44px] px-2 rounded-lg border border-border bg-background text-[11.5px] font-body font-bold hover:bg-muted disabled:opacity-60">
                            {copiado === `${a.id}:s` ? "Copiado" : "Copiar"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[12.5px] font-body text-muted-foreground">Sem senha guardada (acesso por convite ou login social).</p>
                    )}
                    {abertaAqui && aberta?.observacao && (
                      <p className="text-[12.5px] font-body text-foreground bg-muted/60 rounded-lg px-2.5 py-1.5">{aberta.observacao}</p>
                    )}
                  </div>
                  <div className="flex gap-1 basis-full sm:basis-auto justify-end">
                    <button type="button" aria-label={`Editar ${a.plataforma}`} onClick={() => { fechar(); setEditando(a); }}
                      className="h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Apagar ${a.plataforma}`} onClick={() => remover(a)}
                      className="h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </article>
              );
            })
          )}
        </section>

        <aside aria-label="Permissões e histórico" className="flex-[1_1_280px] min-w-0 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="font-display font-extrabold text-[17px] text-foreground">Quem vê as senhas</p>
            {(quemVe.data ?? []).map((q, i) => (
              <div key={i} className="flex items-center gap-2.5 text-[13.5px] font-body">
                <span className="w-8 h-8 rounded-full bg-primary/10 text-primary grid place-items-center font-bold text-xs shrink-0">{q.nome.charAt(0).toUpperCase()}</span>
                <span className="flex-1 min-w-0 truncate">{q.nome}{q.papel === "parceiro" ? " · parceiro" : q.papel === "colaboradora" ? " · colaboradora" : ""}</span>
                <span className={`text-[12px] font-bold ${q.pode ? "text-emerald-700" : "text-red-700"}`}>
                  {q.papel === "dona" ? "Sempre" : q.papel === "parceiro" ? "Nunca" : q.pode ? "Pode ver" : "Não vê"}
                </span>
              </div>
            ))}
            <p className="text-[12px] font-body text-muted-foreground leading-relaxed">
              Parceiros nunca veem. O cliente também não vê esta aba no portal de aprovação.
              {status.data?.sou_dono ? " Pra liberar uma colaboradora, ligue a chave dela em Equipe." : ""}
            </p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2.5">
            <p className="font-display font-extrabold text-[17px] text-foreground">Histórico</p>
            {(historico.data ?? []).length === 0 ? (
              <p className="text-[12.5px] font-body text-muted-foreground">Nada por aqui ainda.</p>
            ) : (
              (historico.data ?? []).slice(0, 12).map((l, i) => (
                <div key={i} className="flex gap-2.5 text-[13px] font-body leading-snug">
                  <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0"><p>{frase(l)}</p><p className="text-[11.5px] text-muted-foreground">{quando(l.created_at)}</p></div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {editando && (
        <AcessoDialog crmClientId={crmClientId} acesso={editando === "novo" ? null : editando} onClose={() => setEditando(null)} />
      )}
    </div>
  );
}

function AcessoDialog({ crmClientId, acesso, onClose }: { crmClientId: string; acesso: CofreAcesso | null; onClose: () => void }) {
  const salvar = useCofreSalvar(crmClientId);
  const [plataforma, setPlataforma] = useState(acesso?.plataforma ?? "Instagram");
  const [login, setLogin] = useState(acesso?.login ?? "");
  const [url, setUrl] = useState(acesso?.url ?? "");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [codigoVia, setCodigoVia] = useState(acesso?.codigo_via ?? "");
  const [observacao, setObservacao] = useState("");
  const editando = !!acesso;

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    salvar.mutate({
      id: acesso?.id ?? null, crmClientId, plataforma, login, url,
      // Editando com o campo vazio: mantém a senha que já está guardada.
      senha: editando && senha === "" ? null : senha,
      codigoVia,
      observacao: editando && observacao === "" ? null : observacao,
    }, {
      onSuccess: () => { toast.success(editando ? "Acesso atualizado." : "Acesso guardado no cofre."); onClose(); },
      onError: (err) => toast.error(cofreErro(err, "Salvar o acesso")),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editando ? `Editar ${acesso?.plataforma}` : "Novo acesso"}</DialogTitle></DialogHeader>
        <form onSubmit={enviar} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="cofre-plataforma" className="text-[13px] font-body font-bold">Conta</label>
            <Input id="cofre-plataforma" list="cofre-plataformas" value={plataforma} onChange={(e) => setPlataforma(e.target.value)} maxLength={60} required className="rounded-xl h-11" />
            <datalist id="cofre-plataformas">{COFRE_PLATAFORMAS.map((p) => <option key={p} value={p} />)}</datalist>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cofre-login" className="text-[13px] font-body font-bold">Login (e-mail, usuário ou @)</label>
            <Input id="cofre-login" value={login} onChange={(e) => setLogin(e.target.value)} maxLength={200} autoComplete="off" className="rounded-xl h-11" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cofre-senha" className="text-[13px] font-body font-bold">Senha</label>
            <div className="flex gap-2">
              <Input id="cofre-senha" type={verSenha ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} maxLength={500}
                autoComplete="new-password" placeholder={editando ? (acesso?.tem_senha ? "Deixe em branco pra manter a atual" : "Sem senha guardada") : ""} className="rounded-xl h-11" />
              <button type="button" onClick={() => setVerSenha((v) => !v)} aria-label={verSenha ? "Esconder senha" : "Ver senha"}
                className="h-11 w-11 shrink-0 grid place-items-center rounded-xl border border-border hover:bg-muted">
                {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-[13px] font-body font-bold mb-1.5">Quando pede código de verificação, chega por onde?</legend>
            <div className="flex flex-wrap gap-1.5">
              {COFRE_CODIGO_VIA.map((c) => (
                <button key={c} type="button" aria-pressed={codigoVia === c} onClick={() => setCodigoVia(codigoVia === c ? "" : c)}
                  className={`min-h-[36px] px-3 rounded-full border text-[12.5px] font-body font-bold transition-colors ${codigoVia === c ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-foreground hover:bg-muted"}`}>
                  {c}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <label htmlFor="cofre-url" className="text-[13px] font-body font-bold">Endereço de login (opcional)</label>
            <Input id="cofre-url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder="ex.: site.com.br/painel" className="rounded-xl h-11" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cofre-obs" className="text-[13px] font-body font-bold">Recado (opcional, também fica criptografado)</label>
            <textarea id="cofre-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={1000} rows={2}
              placeholder={editando && acesso?.tem_observacao ? "Deixe em branco pra manter o recado atual" : "ex.: o código chega no celular da dona"}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-body" />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={salvar.isPending || !plataforma.trim()}>
              {salvar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
              {editando ? "Salvar" : "Guardar no cofre"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
