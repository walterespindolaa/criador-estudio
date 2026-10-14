import type { LucideIcon } from "lucide-react";
import {
  Camera, Clapperboard, Coins, Dumbbell, GraduationCap, Handshake, HeartPulse, House, Lightbulb, MapPin,
  Megaphone, MessagesSquare, Mic, Palette, PawPrint, Plane, Shirt, Sparkles, UtensilsCrossed, Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* CAPAS DAS COMUNIDADES (Walter, 14/10/2026: "fazer várias capas personalizadas
   do Cria pra cada nicho, tipo as de capa pro perfil", no lugar dos emojis).
   Desenhadas em código como as capas da página: cores da LP, bolhas do Cria,
   um adesivo recortado com o ícone do nicho no meio e um selo do Cria no canto.
   O banco guarda só a chave do tema no campo "emoji" (até 8 letras); emoji
   antigo cai no tema equivalente e o que não reconhecer vira "papo". */

const LARANJA = "#CE4A1D", AZUL = "#2A4BDF", AMARELO = "#F2C21E", VERDE = "#3E9152", ROSA = "#F27EB5";

type Tema = { tema: string; nome: string; Icone: LucideIcon; fundo: string; cor: string; acento: string; selo: string; fundoTipo: 0 | 1 | 2 | 3 };

const SELOS = [
  "/stickers/selo-sem-formula.png", "/stickers/selo-social-club-azul.png", "/stickers/selo-da-ideia-ao-post-rosa.png",
  "/stickers/selo-social-club-amarelo.png", "/stickers/selo-da-ideia-ao-post-amarelo.png", "/stickers/selo-social-club-verde.png",
];

export const TEMAS_COMUNIDADE: Tema[] = [
  { tema: "papo", nome: "Bate-papo", Icone: MessagesSquare, fundo: "#FBE3D8", cor: LARANJA, acento: AMARELO, selo: SELOS[0], fundoTipo: 0 },
  { tema: "ideia", nome: "Ideias e pauta", Icone: Lightbulb, fundo: "#FFF4CF", cor: AMARELO, acento: LARANJA, selo: "/stickers/criatura-lampada.png", fundoTipo: 2 },
  { tema: "video", nome: "Vídeo e reels", Icone: Clapperboard, fundo: "#FFF3D6", cor: LARANJA, acento: AZUL, selo: SELOS[4], fundoTipo: 1 },
  { tema: "foto", nome: "Fotografia", Icone: Camera, fundo: "#E3E8FC", cor: AZUL, acento: ROSA, selo: SELOS[1], fundoTipo: 0 },
  { tema: "design", nome: "Design", Icone: Palette, fundo: "#EEE9FF", cor: AZUL, acento: AMARELO, selo: SELOS[2], fundoTipo: 2 },
  { tema: "grana", nome: "Preço e grana", Icone: Coins, fundo: "#E0F1E4", cor: VERDE, acento: AMARELO, selo: SELOS[5], fundoTipo: 3 },
  { tema: "cliente", nome: "Clientes", Icone: Handshake, fundo: "#FDE7E4", cor: LARANJA, acento: AZUL, selo: SELOS[0], fundoTipo: 3 },
  { tema: "marca", nome: "Publi e marcas", Icone: Megaphone, fundo: "#FFF3D6", cor: AZUL, acento: AMARELO, selo: SELOS[3], fundoTipo: 1 },
  { tema: "mic", nome: "Criadoras", Icone: Mic, fundo: "#FDE6F1", cor: ROSA, acento: LARANJA, selo: SELOS[2], fundoTipo: 2 },
  { tema: "saude", nome: "Saúde", Icone: HeartPulse, fundo: "#E0F1E4", cor: VERDE, acento: ROSA, selo: SELOS[5], fundoTipo: 0 },
  { tema: "beleza", nome: "Beleza e estética", Icone: Sparkles, fundo: "#FDE6F1", cor: ROSA, acento: AMARELO, selo: SELOS[2], fundoTipo: 3 },
  { tema: "moda", nome: "Moda", Icone: Shirt, fundo: "#FBE3D8", cor: ROSA, acento: AZUL, selo: SELOS[0], fundoTipo: 1 },
  { tema: "comida", nome: "Comida", Icone: UtensilsCrossed, fundo: "#FFF4CF", cor: LARANJA, acento: VERDE, selo: SELOS[4], fundoTipo: 0 },
  { tema: "fitness", nome: "Fitness", Icone: Dumbbell, fundo: "#E3E8FC", cor: VERDE, acento: AMARELO, selo: SELOS[1], fundoTipo: 3 },
  { tema: "praia", nome: "Litoral e região", Icone: Waves, fundo: "#E3F2F8", cor: AZUL, acento: AMARELO, selo: SELOS[1], fundoTipo: 1 },
  { tema: "cidade", nome: "Cidade", Icone: MapPin, fundo: "#FDE7E4", cor: LARANJA, acento: VERDE, selo: SELOS[0], fundoTipo: 2 },
  { tema: "pet", nome: "Pets", Icone: PawPrint, fundo: "#FFF3D6", cor: VERDE, acento: LARANJA, selo: SELOS[5], fundoTipo: 0 },
  { tema: "casa", nome: "Casa e decor", Icone: House, fundo: "#E0F1E4", cor: AMARELO, acento: VERDE, selo: SELOS[3], fundoTipo: 2 },
  { tema: "viagem", nome: "Viagem", Icone: Plane, fundo: "#E3E8FC", cor: AZUL, acento: LARANJA, selo: SELOS[1], fundoTipo: 3 },
  { tema: "edu", nome: "Educação", Icone: GraduationCap, fundo: "#EEE9FF", cor: VERDE, acento: ROSA, selo: SELOS[5], fundoTipo: 1 },
];

const POR_CHAVE = new Map(TEMAS_COMUNIDADE.map((t) => [t.tema, t]));
const DE_EMOJI: Record<string, string> = {
  "🩺": "saude", "🎨": "design", "🌊": "praia", "🎬": "video", "💸": "grana", "🤝": "cliente", "🎤": "mic", "💼": "marca", "💬": "papo",
};

export function temaComunidade(chave: string | null | undefined): Tema {
  const k = (chave ?? "").trim();
  return POR_CHAVE.get(k) ?? POR_CHAVE.get(DE_EMOJI[k] ?? "") ?? TEMAS_COMUNIDADE[0];
}

/* Palpite de tema pelo nome, pra já vir marcado quando a pessoa sugere. */
const PALPITES: [RegExp, string][] = [
  [/reels|video|vídeo|edic|ediç|film|tiktok|youtube/, "video"], [/foto/, "foto"], [/design|arte|identidade|logo/, "design"],
  [/cobr|preco|preço|grana|dinheiro|financ|orcament|orçament/, "grana"], [/client|freela|prospec/, "cliente"],
  [/publi|marca|parceria|ugc|midia kit|mídia kit/, "marca"], [/criador|criadora|influ|podcast/, "mic"],
  [/saude|saúde|medic|nutri|psico|odonto|fisio/, "saude"], [/estetic|estétic|beleza|make|cabelo|unha|skin/, "beleza"],
  [/moda|look|roupa|estilo/, "moda"], [/comida|gastro|receita|restaurante|food|confeit|doce/, "comida"],
  [/fitness|treino|academia|esporte|corrida|yoga|pilates/, "fitness"], [/praia|litoral|surf|mar\b|sc\b|santa catarina/, "praia"],
  [/cidade|local|bairro|regiao|região/, "cidade"], [/pet|cachorro|gato|vet/, "pet"], [/casa|decor|arquitet|interior|imovel|imóvel/, "casa"],
  [/viag|turismo|hotel/, "viagem"], [/educa|curso|professor|aula|mentoria|estud/, "edu"], [/ideia|pauta|roteiro|bloqueio|criativ/, "ideia"],
];
export function palpiteTema(nome: string): string {
  const n = nome.toLowerCase();
  return PALPITES.find(([re]) => re.test(n))?.[1] ?? "papo";
}

const BLOB = "M0.5 0C0.78 0 1 0.2 1 0.48C1 0.78 0.76 1 0.46 1C0.18 1 0 0.8 0 0.52C0 0.22 0.22 0 0.5 0Z";
const blob = (x: number, y: number, w: number, h: number, cor: string, rot = 0, op = 1) => (
  <path d={BLOB} fill={cor} opacity={op} transform={`translate(${x} ${y}) rotate(${rot}) scale(${w} ${h})`} />
);

function Fundo({ t, i }: { t: Tema; i: number }) {
  switch (t.fundoTipo) {
    case 0: return (<>
      {blob(-60, -40, 200, 170, t.cor, 10, 0.8)}
      {blob(330, 120, 190, 160, t.acento, -14, 0.6)}
      {blob(150, 150, 70, 60, t.cor, 0, 0.25)}
    </>);
    case 1: return (<>
      {Array.from({ length: 13 }, (_, k) => <circle key={k} cx={20 + ((k * 97) % 460)} cy={20 + ((k * 53) % 170)} r={k % 3 ? 4 : 7} fill={k % 2 ? t.cor : t.acento} opacity="0.55" />)}
      {blob(340, -70, 200, 170, t.cor, 20, 0.75)}
      {blob(-50, 120, 170, 140, t.acento, 0, 0.6)}
    </>);
    case 2: return (<>
      {Array.from({ length: 13 }, (_, k) => <line key={`v${k}`} x1={k * 40} x2={k * 40} y1="0" y2="200" stroke={AZUL} strokeOpacity="0.08" />)}
      {Array.from({ length: 6 }, (_, k) => <line key={`h${k}`} x1="0" x2="480" y1={k * 40} y2={k * 40} stroke={AZUL} strokeOpacity="0.08" />)}
      <rect x="40" y="58" width="110" height="28" fill={t.acento} opacity="0.55" transform="rotate(-8 95 72)" />
      {blob(350, 90, 170, 150, t.cor, 12, 0.7)}
    </>);
    default: return (<>
      {Array.from({ length: 18 }, (_, k) => {
        const x = 10 + ((k * 137 + i * 31) % 460), y = 10 + ((k * 71) % 180), r = (k * 47) % 180;
        return k % 3 === 0
          ? <circle key={k} cx={x} cy={y} r="5" fill={k % 2 ? t.cor : t.acento} opacity="0.75" />
          : <rect key={k} x={x} y={y} width={k % 2 ? 16 : 9} height="6" rx="2" fill={k % 2 ? t.acento : t.cor} opacity="0.75" transform={`rotate(${r} ${x} ${y})`} />;
      })}
      {blob(-40, -50, 160, 140, t.cor, 0, 0.45)}
    </>);
  }
}

/* O adesivo: borda branca grossa recortada, sombra deslocada, ícone do nicho. */
function Adesivo({ t, rot }: { t: Tema; rot: number }) {
  const { Icone } = t;
  return (
    <g transform={`rotate(${rot} 240 100)`}>
      <rect x="192" y="56" width="104" height="96" rx="30" fill="#000" opacity="0.13" />
      <rect x="186" y="48" width="108" height="104" rx="32" fill="#fff" />
      <rect x="194" y="56" width="92" height="88" rx="25" fill={t.cor} />
      <Icone x={216} y={76} width={48} height={48} color="#fff" strokeWidth={2.2} />
      <path d="M0 -9 L2.6 -2.6 L9 0 L2.6 2.6 L0 9 L-2.6 2.6 L-9 0 L-2.6 -2.6Z" fill={t.acento} stroke="#fff" strokeWidth="2" transform="translate(292 54) scale(1.3)" />
    </g>
  );
}

/** forma: "faixa" (card da lista), "bloco" (dentro da comunidade) ou "mini" (quadradinho). */
export function CapaComunidade({ tema, forma = "faixa", className }: { tema: string | null | undefined; forma?: "faixa" | "bloco" | "mini"; className?: string }) {
  const t = temaComunidade(tema);
  const i = TEMAS_COMUNIDADE.indexOf(t);
  const rot = [-7, 5, -4, 8, -9, 3][i % 6];
  const mini = forma === "mini";
  return (
    <svg viewBox={mini ? "166 26 148 148" : "0 0 480 200"} preserveAspectRatio="xMidYMid slice" className={cn("block", className)} role="img" aria-label={t.nome}>
      <rect x="0" y="0" width="480" height="200" fill={t.fundo} />
      <Fundo t={t} i={i} />
      {!mini && <image href={t.selo} x="372" y="52" width="72" height="72" preserveAspectRatio="xMidYMid meet" transform={`rotate(${rot * -1.4} 408 88)`} />}
      <Adesivo t={t} rot={rot} />
    </svg>
  );
}

/* Escolher a capa: grade de quadradinhos, a escolhida com contorno. */
export function EscolherTemaComunidade({ valor, onChange }: { valor: string; onChange: (tema: string) => void }) {
  const atual = temaComunidade(valor);
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-semibold">Capa <span className="font-normal text-muted-foreground">· {atual.nome}</span></p>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
        {TEMAS_COMUNIDADE.map((t) => (
          <button key={t.tema} type="button" title={t.nome} aria-label={t.nome} aria-pressed={atual.tema === t.tema} onClick={() => onChange(t.tema)}
            className={cn("overflow-hidden rounded-xl border-2 transition-transform hover:scale-105", atual.tema === t.tema ? "border-primary" : "border-transparent")}>
            <CapaComunidade tema={t.tema} forma="mini" className="aspect-square w-full" />
          </button>
        ))}
      </div>
    </div>
  );
}
