// Helpers de exportação de CSV compartilhados (Link na bio, Cria Caixa, etc.).
//
// SEGURANÇA: injeção de fórmula (CSV / Formula Injection). Quando o arquivo é
// aberto no Excel/Google Sheets, uma célula que começa com "=", "+", "-", "@",
// TAB ou CR é interpretada como FÓRMULA, e um valor vindo de um lead/cliente
// (ex.: =HYPERLINK("http://evil"...), =cmd|...) pode disparar ação na máquina de
// quem abre o relatório. O prefixo com aspa simples neutraliza isso: a planilha
// passa a tratar a célula como texto puro.
export function escapeCsvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  // Prefixo anti-fórmula: cobre = + - @ e os controles TAB (\t) e CR (\r).
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  // Escapa aspas internas (duplicando) e envolve o valor em aspas: assim o
  // separador (vírgula ou ponto e vírgula) dentro do texto nunca quebra a coluna.
  return `"${s.replace(/"/g, '""')}"`;
}
