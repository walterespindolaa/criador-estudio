/* A ARTE DA PRÉVIA (1200x630) no estilo do mockup aprovado: fundo creme,
   formas, selo girado, frase grande com a palavra-chave em azul, linha do
   cliente e a pílula preta. Monta a árvore de elementos que o satori
   (@vercel/og) desenha, sem JSX, pra rodar igual na função da Vercel e no
   script que gera a galeria de conferência. */
import type { Previa, Tema } from "./previa-link";

type El = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): El =>
  ({ type, props: { style, ...extra, ...(children !== undefined ? { children } : {}) } });

const CORES: Record<Tema, { fundo: string; forma1: string; forma2: string; selo: string }> = {
  creme: { fundo: "#F4EFE6", forma1: "#E584B0", forma2: "#EBC24A", selo: "#3E9E5E" },
  azul: { fundo: "#EEF3FF", forma1: "#8FB0FF", forma2: "#EBC24A", selo: "#3557E0" },
  verde: { fundo: "#EEF6EE", forma1: "#8FD3A6", forma2: "#EBC24A", selo: "#E2557F" },
  lilas: { fundo: "#F3EEFB", forma1: "#C3A6F2", forma2: "#F2A65A", selo: "#3557E0" },
};
const AZUL = "#3557E0";
const TINTA = "#1B1A18";

/** Divide a frase em palavras; as que fazem parte do destaque saem em azul. */
function palavras(frase: string, destaque: string | null): El[] {
  const alvo = (destaque ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return frase.split(/\s+/).filter(Boolean).map((w) => {
    const limpa = w.toLowerCase();
    const azul = alvo.some((a) => limpa === a || limpa.replace(/[.,!?:]+$/, "") === a.replace(/[.,!?:]+$/, ""));
    return h("span", { color: azul ? AZUL : TINTA, marginRight: 18 }, w);
  });
}

export function arteDaPrevia(p: Previa): El {
  const a = p.arte;
  const c = CORES[a.tema] ?? CORES.creme;
  const tamanho = a.frase.length > 34 ? 66 : a.frase.length > 24 ? 76 : 86;
  const inicial = (a.marca ?? "C").trim().charAt(0).toUpperCase() || "C";

  const topo = a.marca
    ? h("div", { display: "flex", alignItems: "center", gap: 14 }, [
        a.logo
          ? h("img", { width: 56, height: 56, borderRadius: 999, objectFit: "cover", border: `3px solid ${TINTA}` }, undefined, { src: a.logo, width: 56, height: 56 })
          : h("div", { width: 56, height: 56, borderRadius: 999, background: TINTA, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800 }, inicial),
        h("div", { fontSize: 36, fontWeight: 800, color: TINTA }, a.marca),
      ])
    : h("div", { fontSize: 54, fontWeight: 800, color: TINTA, letterSpacing: -1 }, "CRIA");

  return h("div", {
    width: 1200, height: 630, display: "flex", position: "relative", overflow: "hidden",
    background: c.fundo, fontFamily: "Nunito",
  }, [
    h("div", { position: "absolute", left: -90, top: -120, width: 360, height: 360, borderRadius: 999, background: c.forma1 }),
    h("div", { position: "absolute", right: -100, bottom: -150, width: 420, height: 420, borderRadius: 999, background: c.forma2 }),
    h("div", {
      position: "absolute", right: 70, top: 50, width: 150, height: 150, borderRadius: 999, background: c.selo,
      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
      fontSize: 25, fontWeight: 800, lineHeight: 1.05, padding: 18, transform: "rotate(-12deg)",
    }, a.selo),
    h("div", {
      position: "absolute", left: 0, top: 0, width: 1200, height: 630, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "0 190px",
    }, [
      topo,
      h("div", {
        display: "flex", flexWrap: "wrap", justifyContent: "center", marginTop: 18,
        fontSize: tamanho, fontWeight: 800, lineHeight: 1.05, textAlign: "center", maxWidth: 860,
      }, palavras(a.frase, a.destaque)),
      ...(a.linha ? [h("div", { fontSize: 30, fontWeight: 700, color: "#4B4740", marginTop: 20, textAlign: "center" }, a.linha)] : []),
      h("div", {
        display: "flex", marginTop: 26, background: TINTA, color: "#fff", borderRadius: 999,
        padding: "12px 28px", fontSize: 26, fontWeight: 800,
      }, a.pilula),
    ]),
  ]);
}

export const LARGURA = 1200;
export const ALTURA = 630;
