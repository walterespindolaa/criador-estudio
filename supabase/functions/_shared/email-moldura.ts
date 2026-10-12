/* ═══════════════════════════════════════════════════════════════════════════
   A MOLDURA DOS E-MAILS DO CRIA (12/10/2026)

   Walter: "deixa mais bonito, falta a logo do Cria, um sticker, algo
   diferente pra pessoa". Antes cada função montava o próprio HTML (botão
   roxo, fundo cinza, "cria" escrito à mão). Agora TODO e-mail do sistema
   veste a mesma moldura, a mesma dos 6 modelos de login da Supabase
   (CRIA/migracao-emails): logo, faixa colorida com sticker, título na fonte
   do Cria, botão laranja e o selo "da ideia ao post" no rodapé.

   Imagens vêm do próprio app (URL absoluta e pública); width vai como
   atributo porque o Outlook ignora CSS de largura.
   ═══════════════════════════════════════════════════════════════════════════ */

export const REMETENTE_CRIA = "Cria Social Club <noreply@criasocialclub.com.br>";

const BASE = "https://app.criasocialclub.com.br";
const FT = "'Baloo 2','Arial Rounded MT Bold','Arial Black',Arial,sans-serif";
const F = "Arial,Helvetica,sans-serif";

/** Cores e stickers da marca. Cada tipo de e-mail usa um. */
export const TEMAS = {
  verde: { cor: "#3E9152", texto: "#FFFFFF", sticker: "stickers/selo-social-club-amarelo.png" },
  azul: { cor: "#1D5FE0", texto: "#FFFFFF", sticker: "stickers/criatura-lampada.png" },
  rosa: { cor: "#F27EB5", texto: "#1E1A17", sticker: "stickers/selo-social-club-azul.png" },
  amarelo: { cor: "#F2C21E", texto: "#1E1A17", sticker: "stickers/selo-social-club-verde.png" },
  laranja: { cor: "#CE4A1D", texto: "#FFFFFF", sticker: "stickers/selo-sem-formula.png" },
  preto: { cor: "#1E1A17", texto: "#FFFFFF", sticker: "stickers/criatura-lampada.png" },
} as const;
export type TemaCria = keyof typeof TEMAS;

export type MolduraCria = {
  /** Etiqueta branca acima do título ("Convite", "Senha"...). */
  tag: string;
  titulo: string;
  tema?: TemaCria;
  /** Corpo já em HTML (quem chama escapa o que vem de usuário). */
  corpoHtml: string;
  botao?: { texto: string; url: string } | null;
  /** Mostra o link escrito embaixo do botão (pra quando o botão não abre). */
  linkReserva?: boolean;
  /** Linha pequena no fim do cartão. */
  notaHtml?: string | null;
};

export function molduraCria(m: MolduraCria): string {
  const t = TEMAS[m.tema ?? "laranja"];
  const botao = m.botao
    ? `<tr><td style="padding:26px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#CE4A1D" style="background:#CE4A1D;border-radius:999px;"><a href="${m.botao.url}" style="display:inline-block;padding:16px 32px;font-family:${FT};font-size:17px;font-weight:800;color:#FFFFFF;text-decoration:none;">${m.botao.texto} &rarr;</a></td></tr></table></td></tr>`
      + (m.linkReserva
        ? `<tr><td style="padding:16px 36px 0;"><p style="margin:0;font-family:${F};font-size:12px;line-height:1.5;color:#8A7F76;">O botão não abriu? Copie e cole no navegador:<br><a href="${m.botao.url}" style="color:#CE4A1D;word-break:break-all;">${m.botao.url}</a></p></td></tr>`
        : "")
    : "";
  const nota = m.notaHtml
    ? `<tr><td style="padding:22px 36px 32px;"><p style="margin:0;padding-top:16px;border-top:1px solid #EDE5DA;font-family:${F};font-size:13px;line-height:1.5;color:#8A7F76;">${m.notaHtml}</p></td></tr>`
    : `<tr><td style="padding:0 0 30px;"></td></tr>`;
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#F4EFE3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4EFE3" style="background:#F4EFE3;"><tr><td align="center" style="padding:28px 14px 36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;">
<tr><td align="center" style="padding:0 0 22px;"><img src="${BASE}/logo-cria.png" width="112" alt="Cria" style="display:block;width:112px;height:auto;border:0;"></td></tr>
<tr><td style="background:#FFFFFF;border-radius:30px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td bgcolor="${t.cor}" style="background:${t.cor};border-radius:30px 30px 0 0;padding:30px 30px 28px 36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle">
<p style="margin:0 0 10px;"><span style="display:inline-block;background:#FFFFFF;color:#1E1A17;border-radius:999px;padding:5px 14px;font-family:${FT};font-size:13px;font-weight:800;">${m.tag}</span></p>
<h1 style="margin:0;font-family:${FT};font-size:30px;line-height:1.1;font-weight:800;color:${t.texto};">${m.titulo}</h1>
</td>
<td width="118" align="right" valign="middle" style="padding-left:12px;"><img src="${BASE}/${t.sticker}" width="108" alt="" style="display:block;width:108px;height:auto;border:0;"></td>
</tr></table>
</td></tr>
<tr><td style="padding:28px 36px 0;font-family:${F};font-size:16px;line-height:1.6;color:#3A332E;">${m.corpoHtml}</td></tr>
${botao}
${nota}
</table>
</td></tr>
<tr><td align="center" style="padding:26px 10px 0;">
<img src="${BASE}/stickers/selo-da-ideia-ao-post-rosa.png" width="150" alt="Da ideia ao post" style="display:block;width:150px;height:auto;border:0;margin:0 auto 12px;">
<p style="margin:0;font-family:${F};font-size:12px;line-height:1.6;color:#8A7F76;">Cria Social Club · feito pro criador brasileiro<br><a href="https://criasocialclub.com.br" style="color:#8A7F76;">criasocialclub.com.br</a> · <a href="${BASE}/privacidade" style="color:#8A7F76;">privacidade</a></p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}
