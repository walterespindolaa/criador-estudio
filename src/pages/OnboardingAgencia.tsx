import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Check, FolderOpen, Loader2, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useCrmClients, useCreateCrmClient } from "@/hooks/useCrm";
import { connectInstagram } from "@/hooks/useSocialInsights";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { validateUpload } from "@/lib/upload-validation";
import { ConviteInstagramCliente } from "@/components/accounts/ConviteInstagramCliente";
import {
  COR, FORMAS, TelaOnb, TopoOnb, TituloOnb, BotaoOnb, MicroOnb, Bicho, SeloPicotado,
  estiloMarcado, campoOnb, rotuloOnb,
} from "@/components/onboarding/Pecas";

/* ═══════════════════════════════════════════════════════════════════════════
   ONBOARDING DA SOCIAL MÍDIA / AGÊNCIA v3 (24/10/2026, mockup aprovado)

   Cinco telas no visual da LP (antes eram quatro, sem boas-vindas):
     1. Boas-vindas ("Seus clientes numa aba só", grátis pra sempre)
     2. Sua marca        → profiles.name e profiles.brand_logo_url (white-label
                           das páginas que o cliente abre), com prévia ao vivo
     3. Primeiro cliente → crm_clients: name, instagram, color
     4. Instagram dele   → conecta aqui (OAuth) ou gera o link pro cliente
                           conectar do celular (ConviteInstagramCliente)
     5. Cliente nº 001   → escolhe por onde começar e marca onboarding_completed

   Substitui, na prática, a decisão de 04/06/2026 (nome, @, tema e quantos
   clientes atende + tela de módulos): o fluxo já tinha mudado em 23/09 e
   esta versão segue o mockup aprovado em 24/10.
   ═══════════════════════════════════════════════════════════════════════════ */

const TOTAL = 5;
const PERGUNTAS = 3; // telas 2, 3 e 4

const CORES_CLIENTE = [
  { hex: COR.amarelo, nome: "Amarelo", tinta: COR.tinta },
  { hex: COR.rosa, nome: "Rosa", tinta: COR.tinta },
  { hex: COR.azul, nome: "Azul", tinta: COR.papel },
  { hex: COR.verde, nome: "Verde", tinta: COR.tinta },
  { hex: COR.laranja, nome: "Laranja", tinta: COR.tinta },
];

export default function OnboardingAgencia() {
  useForceLightTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, isLoading, updateProfile } = useProfile();
  const { data: clients = [], isLoading: clientesCarregando } = useCrmClients();
  const qc = useQueryClient();
  const criarCliente = useCreateCrmClient();
  const [searchParams] = useSearchParams();

  const stepDaUrl = Number(searchParams.get("step") ?? 0);
  const [step, setStep] = useState(stepDaUrl >= 1 && stepDaUrl <= TOTAL ? stepDaUrl : 1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [nomeAgencia, setNomeAgencia] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [subindoLogo, setSubindoLogo] = useState(false);
  const [nomeCliente, setNomeCliente] = useState("");
  const [igCliente, setIgCliente] = useState("");
  const [corCliente, setCorCliente] = useState(0);
  const [clienteId, setClienteId] = useState<string | null>(searchParams.get("cliente"));
  const [salvando, setSalvando] = useState(false);
  const [modoIg, setModoIg] = useState<"eu" | "cliente" | null>(null);
  const [acao, setAcao] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const voltouDoInstagram = searchParams.get("ig") === "connected";

  useEffect(() => {
    if (isLoading || !profile) return;
    if (!nomeAgencia && profile.name) setNomeAgencia(profile.name);
    if (!logoUrl && profile.brand_logo_url) setLogoUrl(profile.brand_logo_url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, profile?.id]);

  // Quem chega aqui pediu conta de agência no cadastro ou clicou "Sou social
  // mídia" no onboarding de criador. A conta vira gestora na tela 2, pela RPC
  // security definer (account_type é campo travado pra UPDATE direto).
  const garantirConta = async (): Promise<boolean> => {
    if (profile?.account_type === "manager" || (profile?.seat_limit ?? 0) > 0) return true;
    const { error } = await (supabase.rpc as unknown as (fn: string) => Promise<{ error: unknown }>)("tornar_conta_manager");
    if (error) {
      console.error("[onboarding-agencia] tornar_conta_manager:", error);
      toast.error("Não consegui abrir sua conta de agência agora. Tenta de novo.");
      return false;
    }
    await qc.invalidateQueries({ queryKey: ["profile"] });
    return true;
  };

  // Já tem cliente: usa o primeiro (não cria outro por engano).
  useEffect(() => {
    if (clientesCarregando) return;
    if (clients.length > 0 && !clienteId) {
      setClienteId(clients[0].id);
      setNomeCliente(clients[0].name);
      setIgCliente(clients[0].instagram ?? "");
      const k = CORES_CLIENTE.findIndex((c) => c.hex.toLowerCase() === (clients[0].color ?? "").toLowerCase());
      if (k >= 0) setCorCliente(k);
    } else if (clienteId && !nomeCliente) {
      const c = clients.find((x) => x.id === clienteId);
      if (c) setNomeCliente(c.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientesCarregando]);

  useEffect(() => {
    if (voltouDoInstagram) toast.success("Instagram do cliente conectado.");
    else if (searchParams.get("ig") === "error") toast.error("O Instagram não conectou. Dá pra tentar de novo pela ficha do cliente.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const irPara = (n: number) => {
    setDirection(n > step ? 1 : -1);
    setStep(Math.max(1, Math.min(TOTAL, n)));
    window.scrollTo({ top: 0 });
  };

  const subirLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    const v = validateUpload(file, "managerAvatar");
    if (!v.ok) { toast.error(v.reason); return; }
    setSubindoLogo(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/brand-logo.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setLogoUrl(`${data.publicUrl}?t=${Date.now()}`);
    } catch { toast.error("Não consegui enviar a logo. Dá pra fazer depois em Configurações."); }
    finally { setSubindoLogo(false); }
  };

  const salvarAgencia = async () => {
    setSalvando(true);
    try {
      if (!(await garantirConta())) return;
      await updateProfile.mutateAsync({
        ...(nomeAgencia.trim() ? { name: nomeAgencia.trim() } : {}),
        ...(logoUrl ? { brand_logo_url: logoUrl } : {}),
      });
      irPara(3);
    } catch { toast.error("Não consegui salvar. Tenta de novo?"); }
    finally { setSalvando(false); }
  };

  const salvarCliente = async () => {
    if (clienteId) { irPara(4); return; }
    if (!nomeCliente.trim()) { toast.error("Só o nome do cliente já basta."); return; }
    setSalvando(true);
    try {
      const c = await criarCliente.mutateAsync({
        name: nomeCliente.trim(),
        instagram: igCliente.trim().replace(/^@/, "") || null,
        color: CORES_CLIENTE[corCliente].hex,
      });
      setClienteId(c.id);
      irPara(4);
    } catch { /* o hook já mostra o toast (inclusive o limite da carteira) */ }
    finally { setSalvando(false); }
  };

  const conectarIgDoCliente = () => {
    if (!clienteId) return;
    void connectInstagram(clienteId, `/comecar-agencia?step=4&cliente=${clienteId}`);
  };

  const concluir = async (destino: string) => {
    try { await updateProfile.mutateAsync({ onboarding_completed: true }); } catch { /* segue */ }
    try { sessionStorage.setItem("cria.tour-adiado", "1"); } catch { /* ok */ }
    navigate(destino, { replace: true });
  };

  // Pular a tela da marca também abre a conta de agência: sem isso a pessoa
  // criava cliente e caía no app como criadora.
  const pular = async () => {
    if (step === 2 && !(await garantirConta())) return;
    irPara(step + 1);
  };

  const nomeAg = nomeAgencia.trim();
  const inicialAg = (nomeAg.charAt(0) || "A").toUpperCase();
  const nomeCli = nomeCliente.trim();
  const cor = CORES_CLIENTE[corCliente];
  const arroba = igCliente.trim() ? (igCliente.trim().startsWith("@") ? igCliente.trim() : `@${igCliente.trim()}`) : "sem Instagram ainda";
  const ehCriadoraVirando = !!profile && profile.account_type !== "manager" && (profile.seat_limit ?? 0) === 0;

  const ACOES = [
    { titulo: "Mandar um post pra aprovar", desc: "O cliente recebe um link, abre no celular e aprova. Sem print no WhatsApp.", modulo: "Cria Post", cor: COR.verde, Icone: Send, cta: "Montar o primeiro post", destino: clienteId ? `/socialmidia/clientes/${clienteId}/posts` : "/socialmidia/clientes" },
    { titulo: "Agendar uma captação", desc: "Dia, hora e a lista de roteiros pra gravar, tudo numa folha.", modulo: "Cria Captação", cor: COR.rosa, Icone: CalendarClock, cta: "Agendar a captação", destino: clienteId ? `/socialmidia/clientes/${clienteId}/captacao` : "/socialmidia/captacao" },
    { titulo: "Completar a ficha do cliente", desc: "Contrato, mensalidade, contatos e acessos num lugar só.", modulo: "Grátis", cor: COR.azul, Icone: FolderOpen, cta: "Abrir a ficha", destino: clienteId ? `/socialmidia/clientes/${clienteId}` : "/socialmidia/clientes" },
  ];

  const slide = {
    enter: (d: 1 | -1) => ({ opacity: 0, x: d * 32 }),
    center: { opacity: 1, x: 0 },
    exit: (d: 1 | -1) => ({ opacity: 0, x: d * -32 }),
  };
  const anim = { custom: direction, variants: slide, initial: "enter", animate: "center", exit: "exit", transition: { duration: 0.22 } } as const;

  const rodape = (() => {
    switch (step) {
      case 1: return (
        <>
          <BotaoOnb onClick={() => irPara(2)}>Montar minha agência</BotaoOnb>
          {ehCriadoraVirando && (
            <p className="m-0 text-center text-[13px]" style={{ color: COR.apagado }}>
              Cria conteúdo pra você mesma? <Link to="/onboarding" className="font-bold underline underline-offset-2" style={{ color: COR.tinta }}>Sou criadora</Link>
            </p>
          )}
        </>
      );
      case 2: return (<><BotaoOnb onClick={() => void salvarAgencia()} disabled={salvando || subindoLogo}>{salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continuar"}</BotaoOnb><MicroOnb>Logo é opcional. PNG sem fundo fica melhor.</MicroOnb></>);
      case 3: return (<><BotaoOnb onClick={() => void salvarCliente()} disabled={salvando || (!clienteId && !nomeCli)}>{salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : clienteId ? "Continuar" : "Criar a pasta"}</BotaoOnb><MicroOnb>Os outros clientes você adiciona na carteira.</MicroOnb></>);
      case 4: return (<><BotaoOnb onClick={() => irPara(5)}>Continuar</BotaoOnb><MicroOnb>Precisa ser conta profissional do Instagram.</MicroOnb></>);
      case 5: return (<><BotaoOnb onClick={() => void concluir(ACOES[acao].destino)}>{ACOES[acao].cta}</BotaoOnb><MicroOnb>Carteira, ficha, aprovações e agenda são grátis pra sempre.</MicroOnb></>);
      default: return null;
    }
  })();

  return (
    <TelaOnb rodape={rodape}>
      {step >= 2 && step <= 4 && (
        <TopoOnb passo={step - 1} total={PERGUNTAS} onVoltar={() => irPara(step - 1)} onPular={() => void pular()} />
      )}
      <AnimatePresence mode="wait" custom={direction}>

        {/* ─── 1. Boas-vindas ─── */}
        {step === 1 && (
          <motion.div key="a1" {...anim} className="relative flex flex-1 flex-col">
            {/* Colagem numa área com altura própria (mesmo conserto da tela 1
                do criador): em celular baixo o título subia por cima dela. */}
            <img src="/stickers/selo-social-club-verde.png" alt="" className="absolute right-3 top-0 z-10 w-[70px] -rotate-[10deg]" />
            <div className="relative font-display text-[34px] font-extrabold tracking-[-1px]">cria<span style={{ color: COR.laranja }}>.</span></div>
            <div aria-hidden="true" className="relative mt-1 h-[clamp(240px,44dvh,370px)] w-full">
              <span className="absolute left-1/2 top-1/2 h-[80%] w-[300px] -translate-x-1/2 -translate-y-1/2" style={{ background: "#BCD3F7", borderRadius: "58% 42% 37% 63% / 40% 55% 45% 60%" }} />
              {[
                { n: "Padaria Trigo Fino", c: COR.amarelo, cls: "-left-1.5 top-[6%] -rotate-6" },
                { n: "Studio Luma", c: COR.rosa, cls: "-right-3 top-[34%] rotate-[5deg]" },
                { n: "Verde Vivo Pet", c: COR.verde, cls: "left-2 bottom-[8%] rotate-[4deg]" },
              ].map((x) => (
                <div key={x.n} className={`absolute flex items-center gap-2.5 rounded-[18px] py-2.5 pl-2.5 pr-3.5 font-display text-sm font-bold shadow-[0_6px_14px_rgba(10,10,10,0.12)] ${x.cls}`} style={{ background: COR.papel }}>
                  <span className="grid h-[34px] w-[34px] place-items-center rounded-full font-display text-[15px] font-extrabold" style={{ background: x.c }}>{x.n.charAt(0)}</span>
                  {x.n}
                </div>
              ))}
              <div className="absolute -right-1.5 bottom-[22%] w-[120px] -rotate-[7deg] p-3 shadow-[0_6px_14px_rgba(10,10,10,0.12)]" style={{ background: COR.amarelo, fontFamily: "'Grand Hotel', cursive", fontSize: 20, lineHeight: 1.05 }}>
                <span className="absolute -top-1.5 left-[52px] h-3.5 w-3.5 rounded-full" style={{ background: COR.laranja }} />
                Captação quinta, 9h
              </div>
            </div>
            <div className="relative mt-auto flex flex-col items-center gap-3 pb-2 pt-4 text-center">
              <span className="-rotate-3 rounded-full px-3 py-1 text-xs font-bold tracking-[1px]" style={{ background: COR.verde }}>GRÁTIS PRA SEMPRE</span>
              <h1 className="m-0 font-display text-[34px] font-extrabold leading-[1.02] tracking-[-0.5px]">Seus clientes numa <span style={{ color: COR.laranja }}>aba só.</span></h1>
            </div>
          </motion.div>
        )}

        {/* ─── 2. Sua marca ─── */}
        {step === 2 && (
          <motion.div key="a2" {...anim}>
            <TituloOnb antes="A sua marca" destaque="na frente." sub="Nome e logo aparecem em tudo que seu cliente abre: aprovação, cronograma, relatório." />
            <div className="mt-5 flex items-center gap-3.5">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={subindoLogo} aria-label="Enviar logo"
                className="grid h-[84px] w-[84px] shrink-0 place-items-center overflow-hidden rounded-3xl border-2 border-dashed"
                style={{ borderColor: logoUrl ? "transparent" : "#C9C2AC", background: logoUrl ? COR.papel : "#F0EBDD" }}>
                {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                  : subindoLogo ? <Loader2 className="h-6 w-6 animate-spin" style={{ color: COR.apagado }} />
                  : <Upload className="h-6 w-6" style={{ color: COR.apagado }} />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={subirLogo} />
              <div className="min-w-0 flex-1">
                <label className={rotuloOnb} htmlFor="ag-nome">Nome da agência ou o seu</label>
                <input id="ag-nome" className={campoOnb} value={nomeAgencia} onChange={(e) => setNomeAgencia(e.target.value)} placeholder="Ex.: Gabi · Social Media" maxLength={80} />
              </div>
            </div>

            <p className="mb-2 ml-1 mt-6 text-[11px] font-bold tracking-[1.4px]" style={{ color: "#4A463D" }}>É ASSIM QUE SEU CLIENTE VÊ</p>
            <div className="overflow-hidden rounded-[26px] border-2" style={{ background: COR.papel, borderColor: COR.borda }}>
              <div className="flex items-center gap-2.5 border-b-2 px-3.5 py-3" style={{ borderColor: "#F0EBDD" }}>
                <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[10px] font-display text-[15px] font-extrabold" style={{ background: logoUrl ? COR.papel : COR.amarelo }}>
                  {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-contain" /> : inicialAg}
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-[15px] font-bold">{nomeAg || "Sua agência"}</span>
                <span className="text-[11px]" style={{ color: COR.apagado }}>pra seu cliente</span>
              </div>
              <div className="flex gap-3 p-3.5">
                <div aria-hidden="true" className="flex h-[120px] w-24 shrink-0 items-end rounded-[14px] p-2 font-display text-sm font-extrabold leading-none" style={{ background: COR.amarelo }}>Pão de fermentação natural</div>
                <div className="flex flex-1 flex-col gap-2">
                  <p className="m-0 font-display text-sm font-bold">Post de sexta · Reels</p>
                  <p className="m-0 text-xs leading-snug" style={{ color: "#4A463D" }}>48 horas de fermentação pra uma casca assim. Passa aqui no sábado.</p>
                  <div className="mt-auto flex gap-1.5" aria-hidden="true">
                    <span className="grid h-[34px] flex-1 place-items-center rounded-full text-[12.5px] font-bold" style={{ background: COR.verde }}>Aprovar</span>
                    <span className="grid h-[34px] flex-1 place-items-center rounded-full border-2 text-[12.5px] font-bold" style={{ borderColor: COR.tinta }}>Ajustar</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── 3. Primeiro cliente ─── */}
        {step === 3 && (
          <motion.div key="a3" {...anim}>
            <TituloOnb antes="Seu primeiro" destaque="cliente." sub="Só o básico. Contrato, mensalidade e brandbook ficam na ficha, pra quando quiser." />
            <div className="relative mx-auto mt-6 w-[250px]">
              <span aria-hidden="true" className="absolute -top-3.5 left-[18px] h-[30px] w-24 rounded-t-xl" style={{ background: cor.hex }} />
              <div className="relative flex -rotate-2 items-center gap-3 rounded-[8px_24px_24px_24px] p-4" style={{ background: cor.hex }}>
                <span className="grid h-[52px] w-14 shrink-0 place-items-center font-display text-2xl font-extrabold" style={{ background: COR.papel, borderRadius: FORMAS[0] }}>{(nomeCli.charAt(0) || "C").toUpperCase()}</span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-lg font-extrabold leading-tight" style={{ color: cor.tinta }}>{nomeCli || "Seu cliente"}</span>
                  <span className="mt-0.5 block text-[12.5px] font-medium" style={{ color: cor.tinta }}>{arroba}</span>
                </span>
              </div>
            </div>

            {clienteId ? (
              <div className="mt-6 flex items-center gap-3 rounded-[20px] border-2 p-4" style={{ background: COR.papel, borderColor: COR.verde }}>
                <Check className="h-5 w-5" style={{ color: COR.verde }} strokeWidth={3} />
                <p className="m-0 text-sm"><strong>{nomeCli || "Cliente"}</strong> já está na sua carteira.</p>
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-3.5">
                <div>
                  <label className={rotuloOnb} htmlFor="cli-nome">Nome do cliente</label>
                  <input id="cli-nome" className={campoOnb} value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} placeholder="Ex.: Padaria Trigo Fino" maxLength={100} />
                </div>
                <div>
                  <label className={rotuloOnb} htmlFor="cli-ig">Instagram (opcional)</label>
                  <input id="cli-ig" className={campoOnb} value={igCliente} onChange={(e) => setIgCliente(e.target.value)} placeholder="@padariatrigofino" maxLength={60} autoCapitalize="none" />
                </div>
                <div>
                  <span className={rotuloOnb}>Cor da pasta</span>
                  <div role="group" aria-label="Cor da pasta" className="flex gap-2.5">
                    {CORES_CLIENTE.map((c, k) => (
                      <button key={c.hex} type="button" onClick={() => setCorCliente(k)} aria-label={c.nome} aria-pressed={k === corCliente}
                        className="h-12 w-12 rounded-full border-[3px]"
                        style={{ background: c.hex, borderColor: k === corCliente ? COR.tinta : "transparent", boxShadow: k === corCliente ? `inset 0 0 0 3px ${COR.creme}` : undefined }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── 4. Instagram do cliente ─── */}
        {step === 4 && (
          <motion.div key="a4" {...anim}>
            <TituloOnb antes="Traz os números" destaque="dele pra cá." sub="Conectado, o Instagram do cliente alimenta o relatório e a Cria IA aprende o que já funciona no perfil." />
            <div aria-hidden="true" className="relative mt-4 h-[140px]">
              <span className="absolute left-10 top-6">
                <Bicho cor={cor.hex} forma={FORMAS[0]} giro={-8} tamanho={92} />
              </span>
              <svg width="120" height="40" viewBox="0 0 120 40" className="absolute left-[132px] top-12" fill="none" stroke={COR.tinta} strokeWidth="2.4" strokeLinecap="round" strokeDasharray={voltouDoInstagram ? "0" : "6 8"}><path d="M4 30c30-30 80-30 112-6" /></svg>
              <span className="absolute right-10 top-5 grid h-24 w-24 rotate-[7deg] place-items-center rounded-[28px]" style={{ background: COR.rosa }}>
                <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke={COR.tinta} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill={COR.tinta} /></svg>
              </span>
              {voltouDoInstagram && <span className="absolute left-[166px] top-1 -rotate-[4deg] rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: COR.verde }}>conectado</span>}
            </div>

            <div className="mt-1 flex flex-col gap-2.5">
              <div className="flex items-center gap-3 rounded-[22px] border-2 p-3.5" style={{ background: COR.papel, borderColor: voltouDoInstagram ? COR.verde : COR.borda }}>
                <div className="flex-1">
                  <p className="m-0 font-display text-[15.5px] font-bold">Eu tenho o acesso</p>
                  <p className="m-0 mt-0.5 text-[12.5px] leading-snug" style={{ color: COR.apagado }}>{voltouDoInstagram ? "Conectado. Os números aparecem na ficha em alguns minutos." : "Abre o Instagram, você autoriza e volta pra cá."}</p>
                </div>
                {voltouDoInstagram
                  ? <span className="grid h-11 w-11 place-items-center rounded-full" style={{ background: COR.verde }}><Check className="h-5 w-5" strokeWidth={3} /></span>
                  : <button type="button" onClick={conectarIgDoCliente} disabled={!clienteId} className="h-11 shrink-0 rounded-full px-4 font-display text-sm font-bold disabled:opacity-40" style={{ background: COR.tinta, color: COR.papel }}>Conectar</button>}
              </div>
              {!voltouDoInstagram && (
                <div className="rounded-[22px] border-2 p-3.5" style={{ background: COR.papel, borderColor: modoIg === "cliente" ? COR.tinta : COR.borda }}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="m-0 font-display text-[15.5px] font-bold">O cliente conecta</p>
                      <p className="m-0 mt-0.5 text-[12.5px] leading-snug" style={{ color: COR.apagado }}>Você manda um link no WhatsApp e ele autoriza do celular dele.</p>
                    </div>
                    {modoIg !== "cliente" && (
                      <button type="button" onClick={() => setModoIg("cliente")} disabled={!clienteId} className="h-11 shrink-0 rounded-full border-2 px-4 font-display text-sm font-bold disabled:opacity-40" style={{ borderColor: COR.tinta }}>Gerar link</button>
                    )}
                  </div>
                  {modoIg === "cliente" && clienteId && (
                    <div className="mt-3"><ConviteInstagramCliente crmClientId={clienteId} nomeCliente={nomeCli || null} /></div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ─── 5. Cliente nº 001 ─── */}
        {step === 5 && (
          <motion.div key="a5" {...anim} className="pt-4">
            <div className="flex items-center gap-4">
              <SeloPicotado giro={-5} className="shrink-0 p-2.5">
                <span className="flex h-[140px] w-[118px] flex-col p-2.5" style={{ background: cor.hex }}>
                  <span className="text-[8px] font-bold tracking-[1.4px]" style={{ color: cor.tinta }}>CARTEIRA · Nº 001</span>
                  <img src="/stickers/selo-social-club-azul.png" alt="" className="m-auto w-[76px]" />
                  <span className="truncate font-display text-xs font-extrabold leading-none" style={{ color: cor.tinta }}>{(nomeCli || "Seu cliente").toUpperCase()}</span>
                </span>
              </SeloPicotado>
              <div>
                <h1 className="m-0 font-display text-[30px] font-extrabold leading-[1.02] tracking-[-0.5px]">Cliente nº 001 <span style={{ color: COR.laranja }}>na casa.</span></h1>
                <p className="m-0 mt-1.5 text-sm leading-snug" style={{ color: "#4A463D" }}>Agora o trabalho de verdade. Por onde quer começar?</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              {ACOES.map((a, k) => {
                const on = k === acao;
                return (
                  <button key={a.titulo} type="button" onClick={() => setAcao(k)} aria-pressed={on}
                    className="flex min-h-[80px] w-full items-center gap-3.5 rounded-[22px] border-2 py-3 pl-3 pr-4 text-left" style={estiloMarcado(on)}>
                    <span className="grid h-[50px] w-[50px] shrink-0 place-items-center" style={{ background: a.cor, borderRadius: FORMAS[k % FORMAS.length] }}>
                      <a.Icone className="h-[22px] w-[22px]" style={{ color: COR.tinta }} strokeWidth={2} />
                    </span>
                    <span className="flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-display text-base font-bold leading-tight">{a.titulo}</span>
                      </span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug opacity-80">{a.desc}</span>
                      <span className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-[0.6px]"
                        style={{ background: on ? "rgba(253,251,245,0.16)" : "#F0EBDD" }}>{a.modulo === "Grátis" ? "GRÁTIS" : `MÓDULO ${a.modulo.toUpperCase()}`}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </TelaOnb>
  );
}
