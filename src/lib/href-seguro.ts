/* LINK QUE VEIO DE OUTRA PESSOA SÓ VIRA HREF SE FOR http(s) (28/09/2026).
   Pasta e links úteis são escritos pela agência e abertos pelo parceiro (e
   vice-versa). O React ainda executa `javascript:` num href (só avisa no
   console), então quem gravasse isso direto pela API rodaria script na sessão
   de outra conta. Aqui o que não for http(s) simplesmente não vira link. */
export function hrefSeguro(url: string | null | undefined): string | undefined {
  const u = (url ?? "").trim();
  return /^https?:\/\//i.test(u) ? u : undefined;
}
