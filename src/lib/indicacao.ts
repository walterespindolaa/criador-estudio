/* ═══════════════════════════════════════════════════════════════════════════
   O CÓDIGO DA PARCEIRA, GUARDADO ENTRE TELAS  (Walter, 22/09/2026)

   Até aqui a parceira só tinha um TEXTO pra falar. A pessoa precisava lembrar
   do código, achar o site, chegar na tela de assinatura e digitar certo. Numa
   mecânica de story, onde a decisão dura vinte segundos, isso derruba a
   atribuição pela metade. E o pior efeito não é perder a venda: é a parceira
   achar que não converteu, quando converteu e ninguém contou.

   Agora ela compartilha criasocialclub.com.br/p/GABRIELA, e o código fica aqui.

   Por que localStorage e não só o parâmetro da URL: entre clicar no link e
   assinar tem cadastro, confirmação de e-mail e às vezes um dia de intervalo.
   O parâmetro morre no primeiro redirecionamento; o registro local atravessa a
   jornada inteira. A validade de 45 dias existe porque atribuição eterna vira
   briga: seis meses depois ninguém sabe mais de quem foi a indicação.
   ═══════════════════════════════════════════════════════════════════════════ */
const CHAVE = "cria.indicacao";
const VALIDADE_DIAS = 45;

type Guardada = { codigo: string; em: number };

export function guardarIndicacao(codigo: string) {
  try {
    const limpo = codigo.trim().toUpperCase().slice(0, 40);
    if (!limpo) return;
    localStorage.setItem(CHAVE, JSON.stringify({ codigo: limpo, em: Date.now() }));
  } catch { /* navegador sem storage: segue sem atribuição, não quebra a venda */ }
}

/** O código guardado, se ainda estiver dentro da validade. */
export function lerIndicacao(): string | null {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return null;
    const d = JSON.parse(cru) as Guardada;
    if (!d?.codigo) return null;
    const dias = (Date.now() - (d.em ?? 0)) / 86_400_000;
    if (dias > VALIDADE_DIAS) { localStorage.removeItem(CHAVE); return null; }
    return d.codigo;
  } catch { return null; }
}

export function limparIndicacao() {
  try { localStorage.removeItem(CHAVE); } catch { /* noop */ }
}
