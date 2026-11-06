import { describe, it, expect } from "vitest";
import { htmlDaFolha, textoDaFolha, grifosDaFolha } from "./FolhaDaIdeia";

describe("folha da ideia", () => {
  it("anotação antiga em texto vira parágrafos escapados", () => {
    const h = htmlDaFolha("linha 1\n<script>x</script>");
    expect(h).toContain("<div>linha 1</div>");
    expect(h).not.toContain("<script>");
    expect(h).toContain("&lt;script&gt;");
  });
  it("limpa HTML perigoso e mantém só o grifo", () => {
    const h = htmlDaFolha('<ul><li>a <span style="background-color: rgb(255, 227, 107); position:fixed">grifo</span></li></ul><img src=x onerror=alert(1)><a href="javascript:alert(1)">l</a>');
    expect(h).not.toMatch(/img|onerror|javascript|position/);
    expect(h).toContain("background-color: rgb(255, 227, 107)");
  });
  it("texto puro e grifos", () => {
    const n = '<h4>Título</h4><ul><li>um <span style="background-color: #FFE36B">importante</span></li><li>dois</li></ul>';
    expect(textoDaFolha(n)).toContain("• um importante");
    expect(textoDaFolha(n)).toContain("• dois");
    expect(grifosDaFolha(n)).toEqual(["importante"]);
  });
});
