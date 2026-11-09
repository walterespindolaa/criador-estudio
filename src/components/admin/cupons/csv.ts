/* CSV com ; e BOM: abre certo no Excel em português. */
export function baixarCsv(nome: string, linhas: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const texto = "﻿" + linhas.map((l) => l.map(esc).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
