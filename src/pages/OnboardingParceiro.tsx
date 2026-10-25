import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Camera, Check, Copy as CopyIcon, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useMeuCodigoParceiro } from "@/hooks/useTeam";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { supabase } from "@/integrations/supabase/client";
import { validateUpload } from "@/lib/upload-validation";
import { sanitizeText } from "@/lib/sanitize";
import { fireConfetti } from "@/lib/confetti";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import {
  COR, FORMAS, TelaOnb, TopoOnb, TituloOnb, BotaoOnb, MicroOnb, Bicho, SeloPicotado,
  estiloMarcado, campoOnb, rotuloOnb,
} from "@/components/onboarding/Pecas";

/* ═══════════════════════════════════════════════════════════════════════════
   ONBOARDING DO PRESTADOR (25/10/2026, mockup aprovado pelo Walter)

   Designer, editor de vídeo, filmmaker, copy e tráfego: quem produz pras
   agências. Antes não tinha recepção nenhuma: o cadastro jogava direto na tela
   de Demandas vazia. Quatro telas, no mesmo visual dos outros onboardings:

     1. Boas-vindas + a função  → tornar_conta_parceiro(_papel) (vira conta de
                                  parceiro ou troca a função, só pelo servidor)
     2. Quem é você             → profiles: name, avatar_url, phone, cidade e o
                                  portfólio (@ vai pra instagram_handle, link
                                  vai pra media_kit_url)
     3. Chame a sua agência     → o código de parceiro_meu_codigo(), com
                                  "Mandar no WhatsApp"; ou o caminho do convite;
                                  ou "ainda não tenho agência"
     4. Parceiro nº 001         → como o trabalho chega e "Abrir minhas demandas"

   Não marca onboarding_completed: essa flag é do onboarding de CRIADOR, e o
   parceiro que um dia assinar o lado criador ainda precisa passar por ele.
   ═══════════════════════════════════════════════════════════════════════════ */

const TOTAL = 4;

const PAPEIS = [
  { k: "designer", nome: "Design", cor: COR.rosa, cta: "Bora criar arte", selo: "DESIGN" },
  { k: "editor_video", nome: "Edição de vídeo", cor: COR.azul, cta: "Bora editar", selo: "EDIÇÃO" },
  { k: "filmmaker", nome: "Captação", cor: COR.verde, cta: "Bora gravar", selo: "CAPTAÇÃO" },
  { k: "copy", nome: "Copy", cor: COR.amarelo, cta: "Bora escrever", selo: "COPY" },
  { k: "trafego", nome: "Tráfego", cor: COR.laranja, cta: "Bora rodar anúncio", selo: "TRÁFEGO" },
] as const;
type Papel = (typeof PAPEIS)[number]["k"];

const MODOS = ["Já trabalho com uma agência", "Recebi um link de convite", "Ainda não tenho agência"] as const;

const PASSOS = [
  { t: "O card chega pronto", d: "Roteiro, legenda aprovada, cores da marca e a pasta do material. Nada de caçar briefing no WhatsApp.", cor: COR.amarelo },
  { t: "Prazo combinado, visível", d: "Cada card mostra a data de entrega. \"Estou fazendo\" avisa que está na sua mão.", cor: COR.azul },
  { t: "Ajuste dentro do card", d: "Dúvida, versão e pedido de ajuste ficam registrados. Nada de áudio perdido.", cor: COR.rosa },
  { t: "Entrega vira extrato", d: "No fim do mês, o que você entregou por agência sai somado. Cobrança com número.", cor: COR.verde },
];

/** (47) 99999-0000 enquanto digita. Grava só os dígitos. */
const mascararTelefone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const ehPapel = (v: unknown): v is Papel => PAPEIS.some((p) => p.k === v);

type RpcSolto = (fn: string, args?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;

const OnboardingParceiro = () => {
  useForceLightTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const chave = `cria.onb-parceiro.${user?.id ?? "anon"}`;

  /* Rascunho no aparelho: fechar o app no meio não joga nada fora. */
  const [rascunho] = useState<Record<string, unknown> | null>(() => {
    try { return JSON.parse(localStorage.getItem(chave) ?? "null") as Record<string, unknown> | null; } catch { return null; }
  });

  const [step, setStep] = useState<number>(() => {
    const s = Number(rascunho?.step ?? 1);
    return s >= 1 && s <= 3 ? s : 1;
  });
  const [direcao, setDirecao] = useState<1 | -1>(1);

  const papelInicial = ((): Papel => {
    const r = rascunho?.papel;
    if (ehPapel(r)) return r;
    const doPerfil = (profile as { parceiro_role?: string | null } | null)?.parceiro_role;
    if (ehPapel(doPerfil)) return doPerfil;
    const doCadastro = (user?.user_metadata as { parceiro_role?: string } | undefined)?.parceiro_role;
    return ehPapel(doCadastro) ? doCadastro : "designer";
  })();
  const [papel, setPapel] = useState<Papel>(papelInicial);
  const papelEscolhidoRef = useRef(ehPapel(rascunho?.papel));
  // O perfil chega depois do primeiro render: adota a função dele se a pessoa ainda não escolheu.
  useEffect(() => {
    if (papelEscolhidoRef.current) return;
    const doPerfil = (profile as { parceiro_role?: string | null } | null)?.parceiro_role;
    if (ehPapel(doPerfil)) setPapel(doPerfil);
  }, [profile]);

  const [nome, setNome] = useState((rascunho?.nome as string) ?? "");
  const [telefone, setTelefone] = useState((rascunho?.telefone as string) ?? "");
  const [portfolio, setPortfolio] = useState((rascunho?.portfolio as string) ?? "");
  const [cidade, setCidade] = useState((rascunho?.cidade as string) ?? "");
  const [modo, setModo] = useState<number>(Number(rascunho?.modo ?? 0) || 0);
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Nome já veio do cadastro.
  useEffect(() => {
    if (nome.trim()) return;
    const doCadastro = profile?.name?.trim() || (user?.user_metadata?.name as string | undefined)?.trim();
    if (doCadastro) setNome(doCadastro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.name, user?.id]);

  useEffect(() => {
    if (!user || step > 3) return;
    try { localStorage.setItem(chave, JSON.stringify({ step, papel, nome, telefone, portfolio, cidade, modo })); } catch { /* modo privado */ }
  }, [chave, user, step, papel, nome, telefone, portfolio, cidade, modo]);

  const { data: codigo, isLoading: codigoCarregando } = useMeuCodigoParceiro(step >= 3);

  useEffect(() => { if (step === TOTAL) fireConfetti(); }, [step]);

  const ir = (n: number) => {
    setDirecao(n > step ? 1 : -1);
    setStep(Math.max(1, Math.min(TOTAL, n)));
    window.scrollTo({ top: 0 });
  };

  const p = PAPEIS.find((x) => x.k === papel) ?? PAPEIS[0];
  const primeiroNome = nome.trim().split(" ")[0] ?? "";

  /* 1 → 2: vira conta de parceiro (ou troca a função). account_type e
     parceiro_role são colunas de controle: só mudam pelo servidor. */
  const confirmarPapel = async () => {
    setSalvando(true);
    const { error } = await (supabase.rpc as unknown as RpcSolto)("tornar_conta_parceiro", { _papel: papel });
    setSalvando(false);
    if (error) {
      console.error("[onboarding-parceiro] tornar_conta_parceiro:", error.message);
      toast.error(/agência|parceiro por aqui/i.test(error.message)
        ? "Esta conta é de agência ou tem plano ativo, então não vira conta de parceiro. Crie outra conta pra produzir."
        : "Não consegui salvar sua função agora. Tenta de novo?");
      return;
    }
    await qc.invalidateQueries();
    ir(2);
  };

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const v = validateUpload(file, "avatar");
    if (!v.ok) { toast.error(v.reason); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setRawImageSrc((ev.target?.result as string) ?? null); setCropOpen(true); };
    reader.readAsDataURL(file);
  };
  const handleCropped = (blob: Blob) => {
    setAvatarFile(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    setAvatarPreview((prev) => { if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
    setRawImageSrc(null);
  };

  /* 2 → 3: grava o cartão de visita. */
  const salvarPerfil = async () => {
    if (!user) return;
    setSalvando(true);
    try {
      const patch: Record<string, unknown> = {};
      const n = sanitizeText(nome.trim()).slice(0, 60);
      if (n) patch.name = n;
      const tel = telefone.replace(/\D/g, "");
      if (tel.length >= 10) patch.phone = tel;
      const cid = sanitizeText(cidade.trim()).slice(0, 80);
      if (cid) patch.cidade = cid;
      // Portfólio: "@ana.design" vira o @ do Instagram; qualquer outra coisa é link.
      const port = sanitizeText(portfolio.trim()).slice(0, 200);
      if (port) {
        const ehArroba = port.startsWith("@") || !/[./]/.test(port);
        if (ehArroba) {
          patch.instagram_handle = port.replace(/^@/, "").replace(/\s+/g, "").slice(0, 30);
        } else {
          patch.media_kit_url = /^https?:\/\//i.test(port) ? port : `https://${port}`;
        }
      }
      if (avatarFile) {
        const caminho = `${user.id}/avatar.jpg`;
        const { error: eUp } = await supabase.storage.from("avatars").upload(caminho, avatarFile, { upsert: true });
        if (!eUp) patch.avatar_url = `${supabase.storage.from("avatars").getPublicUrl(caminho).data.publicUrl}?t=${Date.now()}`;
        else console.warn("[onboarding-parceiro] avatar:", eUp.message);
      }
      if (Object.keys(patch).length) await updateProfile.mutateAsync(patch);
      ir(3);
    } catch (e) {
      console.error("[onboarding-parceiro] perfil:", e);
      toast.error("Não consegui salvar agora. Tenta de novo?");
    } finally {
      setSalvando(false);
    }
  };

  const mensagem = codigo
    ? `Oi! Já estou no Cria. Me adiciona na sua equipe de produção com o meu código: ${codigo} (é só colar em Equipe > Código do parceiro).`
    : "";
  const copiar = async () => {
    if (!codigo) return;
    try { await navigator.clipboard.writeText(mensagem); setCopiado(true); toast.success("Mensagem copiada."); }
    catch { toast.error(`Não consegui copiar. O código é ${codigo}`); }
  };

  const abrirDemandas = () => {
    try { localStorage.removeItem(chave); } catch { /* ok */ }
    navigate("/socialmidia/demandas", { replace: true });
  };

  const variantes = {
    enter: (d: 1 | -1) => ({ opacity: 0, x: d * 32 }),
    center: { opacity: 1, x: 0 },
    exit: (d: 1 | -1) => ({ opacity: 0, x: d * -32 }),
  };
  const anim = { custom: direcao, variants: variantes, initial: "enter", animate: "center", exit: "exit", transition: { duration: 0.22 } } as const;

  const rodape = (() => {
    switch (step) {
      case 1: return (<><BotaoOnb onClick={() => void confirmarPapel()} disabled={salvando}>{salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : p.cta}</BotaoOnb><MicroOnb>Sem mensalidade. Quem paga o Cria é a agência.</MicroOnb></>);
      case 2: return (<><BotaoOnb onClick={() => void salvarPerfil()} disabled={salvando || !nome.trim()}>{salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continuar"}</BotaoOnb><MicroOnb>Nome e função já vêm do cadastro. Dá pra mudar depois.</MicroOnb></>);
      case 3: return (<><BotaoOnb onClick={() => ir(4)}>{modo === 2 ? "Continuar sem agência" : "Continuar"}</BotaoOnb><MicroOnb>Pode atender mais de uma agência na mesma conta.</MicroOnb></>);
      case 4: return (<><BotaoOnb onClick={abrirDemandas}>Abrir minhas demandas</BotaoOnb><MicroOnb>Demanda nova chega com aviso no seu celular.</MicroOnb></>);
      default: return null;
    }
  })();

  return (
    <TelaOnb rodape={rodape}>
      {step >= 2 && step <= 3 && <TopoOnb passo={step - 1} total={3} onVoltar={() => ir(step - 1)} />}
      {step === 4 && <TopoOnb passo={3} total={3} onVoltar={() => ir(3)} />}
      <AnimatePresence mode="wait" custom={direcao}>

        {/* ─── 1. Boas-vindas + função ─── */}
        {step === 1 && (
          <motion.div key="p1" {...anim} className="relative flex flex-1 flex-col">
            <img src="/stickers/selo-social-club-verde.png" alt="" className="absolute right-1 top-0 z-10 w-[70px] -rotate-[10deg]" />
            <div className="relative font-display text-[34px] font-extrabold tracking-[-1px]">cria<span style={{ color: COR.laranja }}>.</span></div>
            <div aria-hidden="true" className="relative mt-1 h-[clamp(220px,38dvh,300px)] w-full">
              <span className="absolute left-1/2 top-1/2 h-[82%] w-[280px] -translate-x-1/2 -translate-y-1/2" style={{ background: "#FFD9EA", borderRadius: "58% 42% 37% 63% / 40% 55% 45% 60%" }} />
              <div className="absolute left-2 top-[10%] w-[226px] -rotate-[4deg] rounded-[18px] px-3.5 py-3 shadow-[0_8px_18px_rgba(10,10,10,0.12)]" style={{ background: COR.papel }}>
                <div className="flex items-center gap-2">
                  <span className="grid h-[26px] w-[26px] place-items-center rounded-full font-display text-[13px] font-extrabold" style={{ background: COR.amarelo }}>T</span>
                  <span className="font-display text-[13px] font-bold">Padaria Trigo Fino</span>
                </div>
                <p className="m-0 mt-2 font-display text-[15px] font-bold leading-tight">Carrossel · 5 páginas</p>
                <p className="m-0 mt-0.5 text-xs" style={{ color: "#4A463D" }}>Roteiro, legenda e cores já no card</p>
                <div className="mt-2 flex gap-1.5">
                  <span className="rounded-full px-2 py-1 text-[11px] font-bold" style={{ background: COR.tinta, color: COR.papel }}>entrega qui</span>
                  <span className="rounded-full px-2 py-1 text-[11px] font-bold" style={{ background: "#F0EBDD" }}>pasta do material</span>
                </div>
              </div>
              <div className="absolute -right-2 top-[48%] w-[124px] rotate-[6deg] p-3 shadow-[0_6px_14px_rgba(10,10,10,0.12)]" style={{ background: COR.amarelo, fontFamily: "'Grand Hotel', cursive", fontSize: 20, lineHeight: 1.05 }}>
                <span className="absolute -top-1.5 left-[54px] h-3.5 w-3.5 rounded-full" style={{ background: COR.laranja }} />
                Arte final até as 18h
              </div>
              <div className="absolute bottom-[2%] left-6 flex -rotate-[3deg] items-center gap-2 rounded-2xl px-3 py-2 text-[13px] font-semibold shadow-[0_6px_14px_rgba(10,10,10,0.12)]" style={{ background: COR.papel }}>
                <span className="grid h-[22px] w-[22px] place-items-center rounded-full" style={{ background: COR.verde }}><Check className="h-3 w-3 text-white" strokeWidth={4} /></span>
                Ajuste aprovado
              </div>
            </div>
            <div className="relative mt-auto pt-3 text-center">
              <h1 className="m-0 font-display text-[30px] font-extrabold leading-[1.02] tracking-[-0.5px]">Você produz. <span style={{ color: COR.laranja }}>A gente organiza o resto.</span></h1>
              <p className="mx-auto mt-2 max-w-[330px] text-[14px] leading-snug" style={{ color: "#4A463D" }}>Briefing, prazo, ajuste e o que receber, num lugar só. O que você faz pras agências?</p>
              <div role="group" aria-label="O que você faz" className="mt-3.5 flex flex-wrap justify-center gap-2">
                {PAPEIS.map((x) => (
                  <button key={x.k} type="button" aria-pressed={papel === x.k}
                    onClick={() => { papelEscolhidoRef.current = true; setPapel(x.k); }}
                    className="flex min-h-11 items-center gap-1.5 rounded-full border-2 pl-2.5 pr-3.5 text-[14.5px] font-semibold"
                    style={estiloMarcado(papel === x.k)}>
                    <span aria-hidden="true" className="h-3.5 w-4" style={{ background: x.cor, borderRadius: FORMAS[0] }} />
                    {x.nome}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── 2. Quem é você ─── */}
        {step === 2 && (
          <motion.div key="p2" {...anim}>
            <div className="mt-2 flex flex-col items-center">
              <button type="button" onClick={() => fileRef.current?.click()} aria-label="Adicionar foto"
                className="relative grid h-[96px] w-[96px] place-items-center font-display text-[40px] font-extrabold"
                style={{ background: p.cor, borderRadius: FORMAS[0] }}>
                {avatarPreview ? <img src={avatarPreview} alt="" className="h-full w-full object-cover" style={{ borderRadius: FORMAS[0] }} /> : (nome.trim().charAt(0).toUpperCase() || "C")}
                <span className="absolute bottom-0.5 right-0 grid h-[34px] w-[34px] place-items-center rounded-full" style={{ background: COR.tinta }}>
                  <Camera className="h-4 w-4" style={{ color: COR.papel }} />
                </span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
              <TituloOnb antes={primeiroNome ? `Prazer, ${primeiroNome}!` : "Prazer, eu sou o Cria."} sub="É o seu cartão de visita no Cria. Leva um minuto." />
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <div>
                <label className={rotuloOnb} htmlFor="pp-nome">Como a gente te chama?</label>
                <input id="pp-nome" className={campoOnb} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome ou apelido" maxLength={60} autoComplete="given-name" />
              </div>
              <div>
                <label className={rotuloOnb} htmlFor="pp-zap">WhatsApp</label>
                <input id="pp-zap" className={campoOnb} value={telefone} onChange={(e) => setTelefone(mascararTelefone(e.target.value))} inputMode="tel" placeholder="(47) 99999-0000" maxLength={16} autoComplete="tel" />
              </div>
              <div>
                <label className={rotuloOnb} htmlFor="pp-port">Portfólio ou Instagram de trabalho</label>
                <input id="pp-port" className={campoOnb} value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="behance.net/ana ou @ana.design" maxLength={200} autoCapitalize="none" />
              </div>
              <div>
                <label className={rotuloOnb} htmlFor="pp-cid">Cidade <span className="font-normal" style={{ color: COR.apagado }}>(opcional)</span></label>
                <input id="pp-cid" className={campoOnb} value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Itajaí, SC" maxLength={80} />
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── 3. Chame a sua agência ─── */}
        {step === 3 && (
          <motion.div key="p3" {...anim}>
            <TituloOnb antes="Chama a sua" destaque="agência." sub="As demandas só chegam depois que uma social mídia te coloca na equipe dela." />
            <div role="group" aria-label="Como você chega na agência" className="mt-4 flex flex-col gap-2">
              {MODOS.map((m, k) => (
                <button key={m} type="button" aria-pressed={modo === k} onClick={() => setModo(k)}
                  className="flex min-h-[52px] w-full items-center gap-3 rounded-[18px] border-2 px-4 text-left font-display text-[15px] font-bold"
                  style={estiloMarcado(modo === k)}>
                  <span aria-hidden="true" className="h-[18px] w-[18px] shrink-0 rounded-full"
                    style={modo === k ? { border: `5px solid ${COR.amarelo}`, background: COR.tinta } : { border: "2px solid #C9C2AC" }} />
                  {m}
                </button>
              ))}
            </div>

            {modo === 0 && (
              <div className="mt-4 flex flex-col items-center">
                <SeloPicotado giro={-2}>
                  <span className="block px-5 py-3 text-center" style={{ background: COR.amarelo }}>
                    <span className="block text-[9px] font-bold tracking-[1.6px]">SEU CÓDIGO DE PARCEIRO</span>
                    <span className="mt-1 block font-display text-[36px] font-extrabold leading-none tracking-[6px]">
                      {codigoCarregando ? <Loader2 className="mx-auto h-7 w-7 animate-spin" /> : (codigo || "......")}
                    </span>
                  </span>
                </SeloPicotado>
                <p className="m-0 mt-3 max-w-[310px] text-center text-[13px] leading-snug" style={{ color: "#4A463D" }}>
                  Ela cola esse código em <b style={{ color: COR.tinta }}>Equipe</b>, dentro do Cria dela, e você entra na hora.
                </p>
                <div className="mt-3 flex w-full gap-2">
                  <button type="button" onClick={() => void copiar()} disabled={!codigo}
                    className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full border-2 font-display text-[14.5px] font-bold disabled:opacity-50"
                    style={{ borderColor: COR.tinta, background: COR.papel }}>
                    {copiado ? <Check className="h-4 w-4" strokeWidth={3} /> : <CopyIcon className="h-4 w-4" />} {copiado ? "Copiado" : "Copiar"}
                  </button>
                  <a href={codigo ? `https://wa.me/?text=${encodeURIComponent(mensagem)}` : undefined} target="_blank" rel="noopener noreferrer"
                    aria-disabled={!codigo}
                    className="flex h-12 flex-[1.4] items-center justify-center rounded-full font-display text-[14.5px] font-bold"
                    style={{ background: COR.verde, color: COR.tinta, opacity: codigo ? 1 : 0.5, pointerEvents: codigo ? "auto" : "none" }}>
                    Mandar no WhatsApp
                  </a>
                </div>
              </div>
            )}
            {modo === 1 && (
              <div className="mt-4 rounded-[20px] border-2 p-4" style={{ background: COR.papel, borderColor: COR.borda }}>
                <p className="m-0 font-display text-base font-bold">Abre o link do convite com esta conta</p>
                <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "#4A463D" }}>
                  A social mídia te mandou um link no WhatsApp ou no e-mail. Abre ele aqui no celular, já logado, e você entra direto na equipe. Não achou? Pede pra ela reenviar em Equipe.
                </p>
              </div>
            )}
            {modo === 2 && (
              <div className="mt-4 rounded-[20px] border-2 p-4" style={{ background: COR.papel, borderColor: COR.borda }}>
                <p className="m-0 font-display text-base font-bold">Sem problema, seu perfil fica pronto</p>
                <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "#4A463D" }}>
                  Quando fechar com uma agência, é só mandar o código. Ele fica sempre à mão na sua tela de <b style={{ color: COR.tinta }}>Demandas</b>.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── 4. Parceiro nº 001 ─── */}
        {step === 4 && (
          <motion.div key="p4" {...anim}>
            <div className="mt-1 flex items-center gap-4">
              <motion.div initial={{ scale: 1.4, rotate: -25, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}>
                <SeloPicotado giro={-5}>
                  <span className="flex h-[136px] w-[112px] flex-col p-2.5 text-left" style={{ background: p.cor }}>
                    <span className="text-[8px] font-bold tracking-[1.4px]" style={{ color: p.k === "editor_video" ? COR.papel : COR.tinta }}>PARCEIRO · Nº 001</span>
                    <span className="m-auto"><Bicho cor={COR.tinta} tamanho={60} boca="M4 4c8 12 24 12 32 0" /></span>
                    <span className="font-display text-[13px] font-extrabold leading-none" style={{ color: p.k === "editor_video" ? COR.papel : COR.tinta }}>{p.selo}</span>
                  </span>
                </SeloPicotado>
              </motion.div>
              <div>
                <h1 className="m-0 font-display text-[28px] font-extrabold leading-[1.02] tracking-[-0.5px]">
                  {primeiroNome ? `Pronto, ${primeiroNome}.` : "Pronto."} <span style={{ color: COR.laranja }}>Seu perfil está no ar.</span>
                </h1>
                <p className="m-0 mt-1.5 text-[13.5px]" style={{ color: "#4A463D" }}>É assim que o trabalho chega pra você:</p>
              </div>
            </div>
            <ol className="m-0 mt-5 flex list-none flex-col gap-2 p-0">
              {PASSOS.map((s, i) => (
                <li key={s.t} className="flex items-center gap-3 rounded-[18px] border-2 py-2.5 pl-2.5 pr-3.5" style={{ background: COR.papel, borderColor: COR.borda }}>
                  <span aria-hidden="true" className="grid h-[38px] w-10 shrink-0 place-items-center font-display text-[17px] font-extrabold"
                    style={{ background: s.cor, borderRadius: FORMAS[i % FORMAS.length], color: s.cor === COR.azul ? COR.papel : COR.tinta }}>{i + 1}</span>
                  <span className="flex-1">
                    <span className="block font-display text-[15px] font-bold leading-tight">{s.t}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug" style={{ color: "#4A463D" }}>{s.d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>

      {rawImageSrc && (
        <ImageCropModal open={cropOpen} onOpenChange={setCropOpen} imageSrc={rawImageSrc} onCropComplete={handleCropped} />
      )}
    </TelaOnb>
  );
};

export default OnboardingParceiro;
