import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AtSign, Camera, Check, ChevronDown, Copy, FileText, FolderOpen, ImagePlus, Link2, Loader2, Lock, MessageCircle, X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useCreateCrmClient, useUpdateCrmClient, useUploadCrmAsset } from "@/hooks/useCrm";
import { useCreateClientIntake } from "@/hooks/useClientIntakes";
import { useHasModule } from "@/hooks/useModules";
import { useAbrirModulo } from "@/hooks/useAbrirModulo";
import { BRAND_COLOR_FAMILIES } from "@/lib/brand-palette";
import { BrandbookImport } from "@/components/brandbook/BrandbookImport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   NOVO CLIENTE (Walter, 19/10/2026, mockup aprovado)

   O cadastro era um formulário seco com uma grade de 60 bolinhas ocupando
   metade da janela. Agora:
   1. PRÉVIA AO VIVO no topo: o card como vai aparecer na carteira, pintado
      com a cor escolhida. Tocar na foto envia o logo.
   2. CORES ENXUTAS: uma bolinha por família; escolhida a família, os 5 tons.
   3. "JÁ TEM MATERIAL DELE?": atalhos pra não digitar o que já existe. O
      brandbook em PDF usa o importador que já existe (a IA lê e NADA salva
      sem ela conferir); "Cliente preenche" gera o link de cadastro que também
      já existe (e que só completa o que está vazio).
   4. MAIS DETALHES recolhido: segmento, WhatsApp, mensalidade e dia de
      pagamento (alimentam o Cria Caixa). Tudo opcional.
   5. DEPOIS DE CRIAR, se ela marcou algum atalho, a janela mostra o que ficou
      andando em vez de fechar calada. Sem atalho, abre a ficha como antes.
   ═══════════════════════════════════════════════════════════════════════════ */

const SEGMENTOS_CHIP = [
  "Lifestyle", "Moda", "Beleza & estética", "Saúde", "Fitness", "Gastronomia",
  "Educação", "Finanças", "Imobiliário", "Pet", "Serviços",
];

const URL_OK = /^https?:\/\//i;

/** "1.200,50" ou "1200.5" → 1200.5. Vazio ou lixo → null. */
function valorEmReais(txt: string): number | null {
  const t = txt.replace(/[^\d,.]/g, "");
  if (!t) return null;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

type Atalho = "brandbook" | "link" | "drive" | "logo";

function CartaoAtalho({ ligado, onClick, Icon, fundo, cor, titulo, texto, travadoEm }: {
  ligado: boolean; onClick: () => void; Icon: LucideIcon; fundo: string; cor: string; titulo: string; texto: string;
  /** Nome do módulo que libera o atalho, quando ela não tem (mostra o cadeado). */
  travadoEm?: string | null;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ligado}
      className={cn("relative flex items-start gap-2.5 rounded-2xl border-[1.5px] p-3 text-left transition-all",
        travadoEm ? "border-dashed border-border bg-card/50"
          : ligado ? "border-primary/50 bg-primary/[0.06] shadow-[0_0_0_4px_hsl(var(--primary)/0.07)]" : "border-border bg-card hover:border-primary/30")}>
      {ligado && !travadoEm && (
        <span className="absolute right-2 top-2 grid h-[18px] w-[18px] place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-[11px]", fundo)}>
        <Icon className={cn("h-4 w-4", cor)} />
      </span>
      <span className="min-w-0 pr-4">
        <span className="block text-[13px] font-body font-bold leading-tight text-foreground">{titulo}</span>
        <span className="mt-0.5 block text-[11.5px] font-body leading-snug text-muted-foreground">{texto}</span>
        {/* Selo do módulo embaixo do texto: no canto ele cobria o título. */}
        {travadoEm && (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-pink-100 px-1.5 py-0.5 text-[10px] font-body font-extrabold text-pink-700 dark:bg-pink-500/15 dark:text-pink-300">
            <Lock className="h-2.5 w-2.5" strokeWidth={3} />{travadoEm}
          </span>
        )}
      </span>
    </button>
  );
}

export function NovoClienteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const createClient = useCreateCrmClient();
  const updateClient = useUpdateCrmClient();
  const uploadAsset = useUploadCrmAsset();
  const criarLink = useCreateClientIntake();
  /* Brandbook e link de cadastro alimentam a aba Brandbook, que é do Cria
     Gestão: sem o módulo, os dois atalhos mostram o cadeado e abrem a vitrine
     (Walter, 19/10/2026: "só libera o cadeado se a pessoa tiver o plano"). */
  const { allowed: temGestao } = useHasModule("crm");
  const abrirModulo = useAbrirModulo();

  const [nome, setNome] = useState("");
  const [ig, setIg] = useState("");
  const [cor, setCor] = useState<string | null>(null);
  const [familia, setFamilia] = useState<number | null>(null);
  const [logo, setLogo] = useState("");
  const [drive, setDrive] = useState("");
  const [atalhos, setAtalhos] = useState<Set<Atalho>>(new Set());
  const [pdf, setPdf] = useState<File | null>(null);
  const [detalhes, setDetalhes] = useState(false);
  const [segmento, setSegmento] = useState("");
  const [segOutro, setSegOutro] = useState(false);
  const [whats, setWhats] = useState("");
  const [mensal, setMensal] = useState("");
  const [diaPag, setDiaPag] = useState("");
  // Depois de criar: o que ficou andando.
  const [criado, setCriado] = useState<{ id: string; nome: string; pdf: File | null; link: string | null } | null>(null);

  const fotoRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const limpar = () => {
    setNome(""); setIg(""); setCor(null); setFamilia(null); setLogo(""); setDrive("");
    setAtalhos(new Set()); setPdf(null); setDetalhes(false); setSegmento(""); setSegOutro(false);
    setWhats(""); setMensal(""); setDiaPag(""); setCriado(null);
  };
  const fechar = () => { onOpenChange(false); limpar(); };

  const alternar = (a: Atalho) => {
    if (a === "brandbook" && !atalhos.has("brandbook")) { pdfRef.current?.click(); return; }
    setAtalhos((s) => {
      const n = new Set(s);
      if (n.has(a)) { n.delete(a); if (a === "brandbook") setPdf(null); } else n.add(a);
      return n;
    });
  };

  const onFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try {
      const url = await uploadAsset.mutateAsync({ clientId: `novo-${crypto.randomUUID()}`, file: f, kind: "avatar" });
      setLogo(url);
    } catch { /* o hook já avisa */ }
  };
  const onPdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setPdf(f);
    setAtalhos((s) => new Set(s).add("brandbook"));
  };

  const handle = ig.trim().replace(/^@+/, "");
  const inicial = nome.trim().charAt(0).toUpperCase();
  const logoOk = URL_OK.test(logo.trim());

  const criar = async () => {
    if (!nome.trim()) return;
    const d = atalhos.has("drive") ? drive.trim() : "";
    if (d && !URL_OK.test(d)) { toast.error("O link do Drive precisa começar com http:// ou https://"); return; }
    const l = logo.trim();
    if (l && !URL_OK.test(l)) { toast.error("O link do logo precisa começar com http:// ou https://"); return; }
    const dia = diaPag.trim() ? Math.floor(Number(diaPag)) : null;
    if (dia !== null && (!Number.isFinite(dia) || dia < 1 || dia > 31)) { toast.error("O dia de pagamento vai de 1 a 31."); return; }

    const c = await createClient.mutateAsync({
      name: nome.trim(),
      instagram: handle ? `@${handle}` : null,
      color: cor,
      logo: l || null,
      // O Drive entra nos links úteis com rótulo "Drive" (a aba Drive funciona de cara).
      useful_links: d ? [{ label: "Drive", url: d }] : [], // coluna NOT NULL (default [])
      segment: segmento.trim() || null,
      whatsapp: whats.trim() || null,
      monthly_value: valorEmReais(mensal),
      payment_day: dia,
    } as never);

    let link: string | null = null;
    if (atalhos.has("link")) {
      try {
        const i = await criarLink.mutateAsync({ crmClientId: c.id });
        link = `${window.location.origin}/cadastro/${i.token}`;
        try { await navigator.clipboard.writeText(link); } catch { /* sem permissão: tem o botão Copiar */ }
      } catch { /* o hook já avisa; o cliente foi criado mesmo assim */ }
    }

    const pdfEscolhido = atalhos.has("brandbook") ? pdf : null;
    if (!pdfEscolhido && !link) {
      toast.success("Cliente criado!");
      fechar();
      navigate(`/socialmidia/clientes/${c.id}/visao-geral`);
      return;
    }
    setCriado({ id: c.id, nome: nome.trim(), pdf: pdfEscolhido, link });
  };

  const fundoPrevia = cor
    ? { background: `linear-gradient(135deg, ${cor}26, ${cor}40)` }
    : undefined;
  const whatsDigitos = whats.replace(/\D/g, "");
  const linkWhats = (url: string) => {
    const txt = encodeURIComponent(`Oi! Pra gente começar seu conteúdo, preenche este cadastro rapidinho: ${url}`);
    const numero = whatsDigitos ? (whatsDigitos.length <= 11 ? `55${whatsDigitos}` : whatsDigitos) : "";
    return `https://wa.me/${numero}?text=${txt}`;
  };
  const ocupado = createClient.isPending || criarLink.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (ocupado) return; if (!o) fechar(); else onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[480px] max-h-[92vh] overflow-hidden rounded-[28px] p-0 sm:p-0 gap-0 flex flex-col [&>button]:hidden">
        <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={onFoto} />
        <input ref={pdfRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onPdf} />

        {criado ? (
          /* ── DEPOIS DE CRIAR ── */
          <>
            <div className="overflow-y-auto px-6 pt-7 pb-2 text-center">
              <span className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full font-display text-2xl font-extrabold text-white"
                style={{ background: cor ?? "hsl(var(--primary))", boxShadow: `0 0 0 6px ${cor ? `${cor}33` : "hsl(var(--primary) / 0.2)"}` }}>
                {criado.nome.charAt(0).toUpperCase()}
              </span>
              <DialogTitle className="font-display text-[22px] font-extrabold">{criado.nome} está na carteira</DialogTitle>
              <DialogDescription className="mt-1 font-body text-[13px]">Já deixei andando o que você marcou:</DialogDescription>
              <div className="mt-4 space-y-2 text-left">
                {criado.pdf && (
                  <BrandbookImport
                    alvo="cliente"
                    compacto
                    atual={{}}
                    arquivosIniciais={[criado.pdf]}
                    titulo="Brandbook do cliente"
                    descricao="A leitura leva uns segundos. Quando terminar, você confere tudo antes de salvar."
                    onSalvar={async (valores) => {
                      await updateClient.mutateAsync({ id: criado.id, brand_core: valores } as never);
                      toast.success("Brandbook do cliente salvo.");
                    }}
                  />
                )}
                {criado.link && (
                  <div className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-border bg-card p-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-emerald-100 dark:bg-emerald-500/15">
                      <Link2 className="h-4 w-4 text-emerald-600" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-body font-bold">Link de cadastro pronto</span>
                      <span className="block truncate text-[11.5px] font-body text-muted-foreground">Copiado. Manda pro cliente preencher.</span>
                    </span>
                    <Button size="sm" variant="outline" className="h-8 rounded-xl px-2.5" aria-label="Copiar link"
                      onClick={() => { void navigator.clipboard.writeText(criado.link!).then(() => toast.success("Link copiado!")).catch(() => toast.error("Não consegui copiar.")); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" className="h-8 rounded-xl px-2.5 gap-1" asChild>
                      <a href={linkWhats(criado.link)} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border bg-card/40 px-6 py-4">
              <span className="max-w-[190px] text-[11.5px] font-body leading-snug text-muted-foreground">
                {criado.pdf ? "Confira o brandbook antes de sair daqui: a leitura para se a janela fechar." : "Tudo que ele mandar entra na ficha sozinho."}
              </span>
              <span className="flex gap-2">
                <Button variant="outline" className="rounded-xl" onClick={fechar}>Fechar</Button>
                <Button className="rounded-xl" onClick={() => { const id = criado.id; fechar(); navigate(`/socialmidia/clientes/${id}/visao-geral`); }}>Abrir a ficha</Button>
              </span>
            </div>
          </>
        ) : (
          <>
            {/* ── PRÉVIA AO VIVO ── */}
            <div className="relative overflow-hidden px-6 pt-5 pb-4 bg-muted/60 transition-colors" style={fundoPrevia}>
              <span aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-white/40" />
              <button type="button" onClick={fechar} aria-label="Fechar" className="absolute right-4 top-3.5 rounded-full p-1 text-muted-foreground hover:bg-black/5">
                <X className="h-4 w-4" />
              </button>
              <p className="relative text-[11px] font-body font-extrabold uppercase tracking-[0.09em] text-muted-foreground">Novo cliente</p>
              <DialogTitle className="relative mt-0.5 mb-3.5 font-display text-[21px] font-extrabold leading-tight">Como ele vai aparecer na sua carteira</DialogTitle>
              <DialogDescription className="sr-only">Cadastro do cliente com prévia do card.</DialogDescription>
              <div className="relative flex items-center gap-3 overflow-hidden rounded-[20px] border border-white/90 bg-card/90 px-3.5 py-3 shadow-[0_8px_20px_-14px_rgba(0,0,0,0.35)]">
                {cor && <span aria-hidden className="absolute inset-x-0 top-0 h-[5px]" style={{ background: cor }} />}
                <button type="button" onClick={() => fotoRef.current?.click()} aria-label="Enviar foto ou logo"
                  className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full font-display text-[22px] font-extrabold text-white"
                  style={{ background: cor ?? "hsl(var(--muted-foreground) / 0.35)" }}>
                  {inicial || "?"}
                  {logoOk && <img src={logo.trim()} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full rounded-full object-cover" />}
                  <span className="absolute -bottom-0.5 -right-0.5 grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-card bg-card text-foreground shadow">
                    {uploadAsset.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                  </span>
                </button>
                <span className="min-w-0">
                  <span className={cn("block truncate font-display text-[17px] font-bold leading-tight", !nome.trim() && "text-muted-foreground/60")}>{nome.trim() || "Nome do cliente"}</span>
                  <span className="block truncate text-[12px] font-body text-muted-foreground">
                    {[handle ? `@${handle}` : "@instagram", segmento.trim() || null].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-body font-extrabold text-muted-foreground">Aprova por link</span>
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-4">
              <label className="mt-4 mb-1.5 block text-[12.5px] font-body font-extrabold">Nome da marca ou cliente</label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Studio Lumen" className="h-11 rounded-[14px]" autoFocus />

              <label className="mt-4 mb-1.5 flex justify-between text-[12.5px] font-body font-extrabold">Instagram <small className="font-semibold text-muted-foreground">opcional</small></label>
              <div className="relative">
                <AtSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input value={handle} onChange={(e) => setIg(e.target.value)} placeholder="cliente" className="h-11 rounded-[14px] pl-9" />
              </div>

              <label className="mt-4 mb-2 flex justify-between text-[12.5px] font-body font-extrabold">
                Cor do cliente
                <small className="font-semibold text-muted-foreground">
                  {familia !== null ? BRAND_COLOR_FAMILIES[familia].nome.toLowerCase() : "opcional"}
                  {cor && <button type="button" onClick={() => { setCor(null); setFamilia(null); }} className="ml-2 underline underline-offset-2">tirar</button>}
                </small>
              </label>
              <div className="flex flex-wrap gap-[7px]">
                {BRAND_COLOR_FAMILIES.map((f, i) => {
                  const base = f.tons[2] ?? f.tons[0];
                  const ativa = familia === i;
                  return (
                    <button key={f.nome} type="button" aria-label={`Família ${f.nome}`} aria-pressed={ativa}
                      onClick={() => { setFamilia(i); if (!cor || !f.tons.includes(cor)) setCor(base); }}
                      className={cn("h-[26px] w-[26px] rounded-full transition-transform", ativa ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "hover:scale-105")}
                      style={{ backgroundColor: base }} />
                  );
                })}
              </div>
              {familia !== null && (
                <div className="mt-2.5 flex items-center gap-1.5 rounded-[14px] bg-muted/70 p-2">
                  {BRAND_COLOR_FAMILIES[familia].tons.map((t) => (
                    <button key={t} type="button" aria-label={`Tom ${t}`} aria-pressed={cor === t} onClick={() => setCor(t)}
                      className={cn("h-[22px] w-[22px] rounded-full", cor === t && "ring-2 ring-foreground ring-offset-2 ring-offset-muted")}
                      style={{ backgroundColor: t }} />
                  ))}
                  <span className="ml-1 text-[11px] font-body text-muted-foreground">tons de {BRAND_COLOR_FAMILIES[familia].nome.toLowerCase()}</span>
                </div>
              )}

              {/* ── JÁ TEM MATERIAL DELE? ── */}
              <label className="mt-5 mb-2 flex justify-between text-[12.5px] font-body font-extrabold">Já tem material dele? <small className="font-semibold text-muted-foreground">pula a digitação</small></label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <CartaoAtalho ligado={atalhos.has("brandbook")} travadoEm={temGestao ? null : "Cria Gestão"}
                  onClick={() => (temGestao ? alternar("brandbook") : abrirModulo("crm"))} Icon={FileText}
                  fundo="bg-orange-100 dark:bg-orange-500/15" cor="text-orange-600" titulo="Tenho o brandbook" texto="Envie o PDF. A IA lê e você confere antes de salvar." />
                <CartaoAtalho ligado={atalhos.has("link")} travadoEm={temGestao ? null : "Cria Gestão"}
                  onClick={() => (temGestao ? alternar("link") : abrirModulo("crm"))} Icon={Link2}
                  fundo="bg-emerald-100 dark:bg-emerald-500/15" cor="text-emerald-600" titulo="Cliente preenche" texto="Gera o link de cadastro: dados, marca e acessos." />
                <CartaoAtalho ligado={atalhos.has("drive")} onClick={() => alternar("drive")} Icon={FolderOpen}
                  fundo="bg-blue-100 dark:bg-blue-500/15" cor="text-blue-600" titulo="Pasta do Drive" texto="Cola o link e a aba Drive já liga." />
                <CartaoAtalho ligado={atalhos.has("logo")} onClick={() => alternar("logo")} Icon={ImagePlus}
                  fundo="bg-amber-100 dark:bg-amber-500/15" cor="text-amber-600" titulo="Logo por link" texto="Ou toque na foto lá em cima." />
              </div>
              {pdf && atalhos.has("brandbook") && (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-card px-3 py-2 text-[12px] font-body">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <b className="truncate">{pdf.name}</b>
                  <span className="shrink-0 text-muted-foreground">· {(pdf.size / 1048576).toFixed(1).replace(".", ",")} MB</span>
                  <button type="button" onClick={() => pdfRef.current?.click()} className="ml-auto shrink-0 text-muted-foreground hover:text-foreground">trocar</button>
                </div>
              )}
              {atalhos.has("drive") && (
                <Input value={drive} onChange={(e) => setDrive(e.target.value)} placeholder="https://drive.google.com/…" className="mt-2 h-11 rounded-[14px]" />
              )}
              {atalhos.has("logo") && (
                <Input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="Link da imagem do logo (https://…)" className="mt-2 h-11 rounded-[14px]" />
              )}

              {/* ── MAIS DETALHES ── */}
              <button type="button" onClick={() => setDetalhes((v) => !v)} aria-expanded={detalhes}
                className="mt-4 flex w-full items-center justify-between border-t border-dashed border-border pt-3 text-[13px] font-body font-bold text-foreground/80">
                Mais detalhes: segmento, WhatsApp, mensalidade
                <ChevronDown className={cn("h-4 w-4 transition-transform", detalhes && "rotate-180")} />
              </button>
              {detalhes && (
                <div>
                  <label className="mt-3 mb-1.5 block text-[12.5px] font-body font-extrabold">Segmento</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SEGMENTOS_CHIP.map((s) => (
                      <button key={s} type="button" onClick={() => { setSegOutro(false); setSegmento(segmento === s ? "" : s); }}
                        className={cn("rounded-full px-3 py-1.5 text-[12px] font-body font-bold transition-colors",
                          segmento === s && !segOutro ? "bg-foreground text-background" : "bg-muted text-foreground/75 hover:bg-muted/80")}>
                        {s}
                      </button>
                    ))}
                    <button type="button" onClick={() => { setSegOutro(true); setSegmento(""); }}
                      className={cn("rounded-full px-3 py-1.5 text-[12px] font-body font-bold", segOutro ? "bg-foreground text-background" : "bg-muted text-foreground/75")}>
                      + outro
                    </button>
                  </div>
                  {segOutro && <Input value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Qual segmento?" className="mt-2 h-10 rounded-[14px]" autoFocus />}

                  <label className="mt-4 mb-1.5 flex justify-between text-[12.5px] font-body font-extrabold">WhatsApp do cliente <small className="font-semibold text-muted-foreground">pra mandar aprovação e o link</small></label>
                  <Input value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="(47) 9 9999-0000" inputMode="tel" className="h-11 rounded-[14px]" />

                  <label className="mt-4 mb-1.5 flex justify-between text-[12.5px] font-body font-extrabold">Mensalidade e dia de pagamento <small className="font-semibold text-muted-foreground">vai pro Cria Caixa</small></label>
                  <div className="grid grid-cols-[1fr_110px] gap-2">
                    <Input value={mensal} onChange={(e) => setMensal(e.target.value)} placeholder="R$ 0,00" inputMode="decimal" className="h-11 rounded-[14px]" />
                    <Input value={diaPag} onChange={(e) => setDiaPag(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="dia" inputMode="numeric" className="h-11 rounded-[14px]" />
                  </div>
                </div>
              )}
            </div>

            {/* ── RODAPÉ FIXO ── */}
            <div className="flex items-center justify-between gap-3 border-t border-border bg-card/40 px-6 py-4">
              <span className="hidden max-w-[180px] text-[11.5px] font-body leading-snug text-muted-foreground sm:block">Posts, cronograma e o resto você monta dentro dele.</span>
              <span className="ml-auto flex gap-2">
                <Button variant="outline" className="rounded-xl" onClick={fechar} disabled={ocupado}>Cancelar</Button>
                <Button className="rounded-xl" onClick={() => void criar()} disabled={ocupado || uploadAsset.isPending || !nome.trim()}>
                  {ocupado && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Criar cliente
                </Button>
              </span>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default NovoClienteDialog;
