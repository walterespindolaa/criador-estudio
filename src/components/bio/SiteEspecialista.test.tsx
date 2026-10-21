import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SiteBio } from "@/components/bio/SiteBio";
import { EditorAssinatura } from "@/components/bio/EditorAssinatura";

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;

// jsdom não tem PointerEvent: sem isto o clientX do toque chega vazio.
if (!("PointerEvent" in window)) {
  class PE extends MouseEvent { pointerId: number; constructor(t: string, p: PointerEventInit = {}) { super(t, p); this.pointerId = p.pointerId ?? 1; } }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PE;
}

const marca = { nome: "Lívia Moraes", cor: "#B4532A", corTexto: "#FFFFFF" };
const visual = { radius: "rounded-xl", isOutline: false } as never;
const guid = "510b2d9e-f289-4e64-8183-722968cc6df8";

function montar(blocos: { kind: string; data: Record<string, unknown> }[]) {
  return render(
    <SiteBio blocos={blocos.map((b, i) => ({ id: `b${i}`, position: i, ...b }))} marca={marca} produtos={[]} posts={[]}
      visual={visual} aoAbrirProduto={() => {}} aoAbrirPost={() => {}} />,
  );
}

describe("página de especialista", () => {
  it("capa imersiva: sem menu no topo, assinatura, números e botão fixo", () => {
    const { container } = montar([
      { kind: "apresentacao", data: { midia: "imagem", imagem: "https://x/foto.jpg", profissao: "Nutrição esportiva",
        assinatura: { modo: "fonte", fonte: "allura", x: 10, y: 60, escala: 70 } } },
      { kind: "numeros", data: { itens: [{ valor: "12", rotulo: "anos" }, { valor: "", rotulo: "vazio" }], local: "Clínica X", registro: "CRN 1" } },
      { kind: "acao_fixa", data: { texto: "Agendar consulta", destino: "whatsapp", telefone: "(47) 99999-0000", mensagem: "Oi" } },
    ]);
    expect(container.querySelector("header")).toBeNull();
    expect(screen.getAllByText("Lívia Moraes").length).toBeGreaterThan(0);
    expect(screen.getByText("Nutrição esportiva")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.queryByText("vazio")).toBeNull();
    const botao = screen.getByRole("link", { name: /Agendar consulta/ });
    expect(botao.getAttribute("href")).toContain("phone=5547999990000");
    expect(document.getElementById("fonte-ass-allura")).toBeTruthy();
  });

  it("vídeo: toca o MP4 do Bunny e cai pra foto quando pediram menos movimento", () => {
    const { container, unmount } = montar([{ kind: "apresentacao", data: { midia: "video", video_guid: guid } }]);
    const v = container.querySelector("video");
    expect(v).toBeTruthy();
    expect(v!.querySelector("source")!.getAttribute("src")).toContain(`${guid}/play_720p.mp4`);
    unmount();

    const mm = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} })) as never;
    const r2 = montar([{ kind: "apresentacao", data: { midia: "video", video_guid: guid } }]);
    expect(r2.container.querySelector("video")).toBeNull();
    expect(r2.container.querySelector("img")!.getAttribute("src")).toContain("thumbnail.jpg");
    window.matchMedia = mm;
  });

  it("sem capa de especialista o menu continua", () => {
    const { container } = montar([{ kind: "capa", data: { titulo: "Oi" } }]);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("botão fixo com endereço perigoso não aparece", () => {
    montar([{ kind: "acao_fixa", data: { texto: "Ir", destino: "link", url: "javascript:alert(1)" } }]);
    expect(screen.queryByRole("link", { name: /Ir/ })).toBeNull();
  });
});

describe("editor de assinatura", () => {
  it("desenha, usa na capa, apaga e salva", () => {
    const salvar = vi.fn();
    render(<EditorAssinatura aberto aoFechar={() => {}} nomePadrao="Lívia" aoSalvar={salvar}
      dados={{ midia: "imagem", assinatura: { modo: "fonte" } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Desenhar à mão" }));
    const folha = screen.getByText("Assine aqui").parentElement!;
    folha.getBoundingClientRect = () => ({ left: 0, top: 0, width: 440, height: 200, right: 440, bottom: 200, x: 0, y: 0, toJSON() {} });
    fireEvent.pointerDown(folha, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(folha, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(folha, { pointerId: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Usar na capa" }));
    // Selecionada depois de usar: aparece o Apagar.
    fireEvent.click(screen.getByRole("button", { name: /Apagar/ }));
    expect(screen.getByText("A capa está sem assinatura.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Recolocar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar assinatura" }));
    const [ass] = salvar.mock.calls[0];
    expect(ass.modo).toBe("desenho");
    expect(ass.d).toMatch(/^M10\.0 10\.0 L100\.0 50\.0$/);
  });

  it("troca a letra cursiva entre as 5", () => {
    const salvar = vi.fn();
    render(<EditorAssinatura aberto aoFechar={() => {}} nomePadrao="Lívia" aoSalvar={salvar} dados={{ assinatura: {} }} />);
    fireEvent.click(screen.getByText("Clássica").closest("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Salvar assinatura" }));
    expect(salvar.mock.calls[0][0]).toMatchObject({ modo: "fonte", fonte: "great-vibes" });
  });
});
