/* ARTE DO "COMPARTILHAR MINHA SEMANA" (Walter, 11/11/2026; três modelos).
   Desenha um story 1080x1920 no visual dos boards do Cria, direto num canvas.
   É desenho na mão (e não foto da tela com html2canvas) de propósito: no teste
   o html2canvas entortou as formas e sumiu com sombra e nuvem.
   Só entram NÚMEROS: nome de cliente nunca aparece na imagem. */

export type ModeloSemana = 1 | 2 | 3;
export type DadosSemana = { aprovados: number; clientes: number; periodo: string };

const C = { creme: "#F5F3E7", laranja: "#EB4918", rosa: "#FF77B9", azul: "#0061EE", azul2: "#1A70F0", amarelo: "#FFCF03", verde: "#00A652", preto: "#0A0A0A" };
const BALOO = "'Baloo 2', sans-serif", SCRIPT = "'Grand Hotel', cursive", ROBOTO = "Roboto, sans-serif";
const ESTRELA = "M50 0l9 28 29-12-17 26 29 10-30 8 13 28-26-16-7 30-8-30-26 16 13-28L0 52l29-10L12 16l29 12z";
const BLOB1 = "M48 6c20-8 44 2 50 22 6 18-6 30 2 46 8 18-10 30-30 26-16-3-22 4-38-2C12 92 0 78 4 62c3-12-4-22 2-36C12 12 30 13 48 6z";
const BLOB2 = "M20 10c12-14 30 2 42-6 14-9 34 4 34 22 0 14 10 22 2 36-7 12-22 8-30 20-9 12-28 14-38 2C20 72 2 72 2 54c0-14 10-18 6-30-2-6 6-10 12-14z";
const NUVEM = "M14 46c-10-2-14-16-4-22 2-12 18-16 26-8 6-12 26-12 30 0 12-6 28 2 26 16 10 4 10 20-2 22-2 12-18 14-26 6-8 10-26 10-32 0-10 6-24-2-18-14z";
const VASO = "M38 0h24c2 14-2 22 6 32 14 16 22 30 22 52 0 18-8 26-8 46 0 18 10 26 10 44v26H8v-26c0-18 10-26 10-44 0-20-8-28-8-46 0-22 8-36 22-52 8-10 4-18 6-32z";

const imgs = new Map<string, Promise<HTMLImageElement>>();
const img = (src: string) => {
  if (!imgs.has(src)) imgs.set(src, new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = src; }));
  return imgs.get(src)!;
};
const pl = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

export async function desenharSemana(canvas: HTMLCanvasElement, modelo: ModeloSemana, d: DadosSemana, base = ""): Promise<void> {
  await Promise.all([
    document.fonts.load(`800 100px ${BALOO}`), document.fonts.load(`400 100px ${SCRIPT}`),
    document.fonts.load(`700 40px ${ROBOTO}`), document.fonts.load(`400 40px ${ROBOTO}`),
  ]);
  const [logoBranca, logoCor] = await Promise.all([img(`${base}/logo-cria-white.png`), img(`${base}/logo-cria.png`)]);
  canvas.width = 1080; canvas.height = 1920;
  const x = canvas.getContext("2d")!;
  const n = d.aprovados, k = d.clientes;
  const posts = pl(n, "post", "posts"), aprov = pl(n, "aprovado", "aprovados"), cli = `${k} ${pl(k, "cliente", "clientes")}`;

  const fundo = (cor: string) => { x.fillStyle = cor; x.fillRect(0, 0, 1080, 1920); };
  const forma = (p: string, cor: string, px: number, py: number, w: number, h: number, vw = 100, vh = 100) => {
    x.save(); x.translate(px, py); x.scale(w / vw, h / vh); x.fillStyle = cor; x.fill(new Path2D(p)); x.restore();
  };
  const fonte = (tam: number, fam: string, peso: number | string = 800) => { x.font = `${peso} ${tam}px ${fam}`; };
  // Texto na linha de base (px, py). rot gira em volta do próprio ponto.
  const txt = (s: string, px: number, py: number, tam: number, fam: string, cor: string, o: { al?: CanvasTextAlign; rot?: number; peso?: number | string } = {}) => {
    x.save(); x.translate(px, py); if (o.rot) x.rotate((o.rot * Math.PI) / 180);
    fonte(tam, fam, o.peso ?? (fam === BALOO ? 800 : 400)); x.fillStyle = cor; x.textAlign = o.al ?? "left"; x.textBaseline = "alphabetic"; x.fillText(s, 0, 0); x.restore();
  };
  const caixa = (px: number, py: number, w: number, h: number, r: number) => { x.beginPath(); x.roundRect(px, py, w, h, Math.min(r, h / 2)); };
  // Etiqueta: texto dentro de uma caixa arredondada. Devolve a largura.
  const etq = (s: string, px: number, py: number, tam: number, o: { bg: string; fg: string; pad?: number; rot?: number; borda?: number; raio?: number; sombra?: string }) => {
    fonte(tam, BALOO); const pad = o.pad ?? 46; const w = x.measureText(s).width + pad * 2; const h = tam * 1.28;
    x.save(); x.translate(px + w / 2, py + h / 2); if (o.rot) x.rotate((o.rot * Math.PI) / 180); x.translate(-w / 2, -h / 2);
    const r = o.raio ?? 999;
    if (o.sombra) { caixa(7, 7, w, h, r); x.fillStyle = o.sombra; x.fill(); }
    if (o.borda) { caixa(-o.borda, -o.borda, w + o.borda * 2, h + o.borda * 2, r + o.borda); x.fillStyle = C.creme; x.fill(); }
    caixa(0, 0, w, h, r); x.fillStyle = o.bg; x.fill();
    x.fillStyle = o.fg; x.textAlign = "left"; x.textBaseline = "alphabetic"; x.fillText(s, pad, h * 0.76);
    x.restore(); return w;
  };
  const logo = (i: HTMLImageElement, px: number, py: number, w: number) => x.drawImage(i, px, py, w, (w * i.height) / i.width);

  if (modelo === 1) {
    fundo(C.rosa);
    forma(ESTRELA, C.laranja, -300, -260, 900, 1100); forma(ESTRELA, C.laranja, 560, 1250, 800, 950);
    etq("minha semana", 110, 330, 92, { bg: C.azul, fg: C.amarelo });
    if (n > 9) {
      txt(String(n), 100, 850, 430, BALOO, C.creme);
      const w = etq(posts, 110, 900, 96, { bg: C.laranja, fg: C.amarelo, rot: -3, borda: 8 });
      txt(aprov, 110 + w + 34, 992, 92, BALOO, C.amarelo);
    } else {
      txt(String(n), 100, 1010, 600, BALOO, C.creme);
      etq(posts, 470, 640, 96, { bg: C.laranja, fg: C.amarelo, rot: 5, borda: 8 });
      txt(aprov, 480, 900, 92, BALOO, C.amarelo);
    }
    forma(NUVEM, C.azul, 330, 1060, 680, 290, 100, 70);
    txt("que semana!", 670, 1262, 170, SCRIPT, C.creme, { al: "center" });
    etq(cli, 100, 1380, 64, { bg: C.verde, fg: C.creme, pad: 34, rot: -8, borda: 10, raio: 30 });
    logo(logoBranca, 110, 1590, 220);
    txt("ORGANIZADO NO CRIA", 352, 1668, 32, ROBOTO, C.preto, { peso: 700 });
  } else if (modelo === 2) {
    fundo(C.azul);
    forma(BLOB2, C.azul2, -120, 500, 1300, 1500); forma(BLOB1, C.amarelo, 270, -200, 560, 430);
    etq(d.periodo, 90, 350, 50, { bg: C.verde, fg: C.creme, pad: 30, rot: -9, borda: 10, raio: 30 });
    txt("SEMANA", 110, 770, 190, BALOO, C.amarelo);
    fonte(190, BALOO); const wf = x.measureText("FECHADA").width;
    x.fillStyle = C.laranja; x.fillRect(86, 800, wf + 48, 176);
    txt("FECHADA", 110, 950, 190, BALOO, C.amarelo);
    txt("e aprovada", 150, 1200, 240, SCRIPT, C.creme, { rot: -4 });
    forma(ESTRELA, C.rosa, 70, 1250, 380, 340);
    txt(String(n), 262, 1452, 130, BALOO, C.creme, { al: "center", rot: -6 });
    txt(aprov, 268, 1496, 36, BALOO, C.creme, { al: "center", rot: -6 });
    etq(cli, 520, 1340, 64, { bg: C.creme, fg: C.rosa, pad: 32, rot: 7, raio: 30, sombra: C.laranja });
    logo(logoBranca, 110, 1600, 220);
    txt("ORGANIZADO NO CRIA", 352, 1678, 32, ROBOTO, C.creme, { peso: 700 });
  } else {
    fundo(C.verde);
    forma(VASO, C.rosa, 230, -40, 700, 2000, 100, 200); forma(VASO, C.amarelo, 205, -40, 700, 2000, 100, 200); forma(VASO, C.creme, 180, -40, 700, 2000, 100, 200);
    txt("MINHA SEMANA", 530, 470, 42, ROBOTO, C.verde, { al: "center" });
    txt("EM NÚMEROS", 530, 526, 42, ROBOTO, C.verde, { al: "center", peso: "italic 700" });
    txt(String(n), 530, 800, 250, BALOO, C.azul, { al: "center" });
    txt(`${posts} ${aprov}`.toUpperCase(), 530, 876, 58, BALOO, C.azul, { al: "center" });
    txt(String(k), 530, 1130, 250, BALOO, C.laranja, { al: "center" });
    txt(pl(k, "cliente", "clientes").toUpperCase(), 530, 1206, 58, BALOO, C.laranja, { al: "center" });
    txt("ufa!", 530, 1430, 200, SCRIPT, C.rosa, { al: "center", rot: -5 });
    logo(logoCor, 430, 1540, 200);
  }
}
