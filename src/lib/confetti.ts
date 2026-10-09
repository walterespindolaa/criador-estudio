import confetti from "canvas-confetti";
import { hojeBR } from "@/lib/date-br";

/* ═══════════════════════════════════════════════════════════════════════════
   SÓ A PRIMEIRA DA SEMANA (Gabriela, 09/10/2026)

   "Esses confete e o que aparece depois de DA IDEIA AO POST deixa muito lento.
   Deixa pra aparecer isso só no primeiro publicado da semana."

   Quem publica em lote (a social mídia fecha a semana de vários clientes)
   esperava confete + selo a cada post. Agora a festa é uma vez por semana
   (segunda a domingo, fuso BR), por pessoa. O toast "Conteúdo publicado!"
   continua sempre: é ele que confirma que salvou.

   Guardado no aparelho (localStorage): em outro aparelho a primeira da semana
   comemora de novo, uma vez. Se o navegador não deixar gravar, não comemora:
   melhor faltar festa do que voltar a lentidão.
   ═══════════════════════════════════════════════════════════════════════════ */
function segundaDaSemanaBR(): string {
  const [a, m, d] = hojeBR().split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d));
  const desde = (dia.getUTCDay() + 6) % 7; // segunda = 0
  dia.setUTCDate(dia.getUTCDate() - desde);
  return dia.toISOString().slice(0, 10);
}

/** true só na primeira publicação da semana desta pessoa (e já marca). */
export function primeiraPublicacaoDaSemana(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const chave = `cria_festa_publicado:${userId}`;
  const semana = segundaDaSemanaBR();
  try {
    if (localStorage.getItem(chave) === semana) return false;
    localStorage.setItem(chave, semana);
    return true;
  } catch {
    return false;
  }
}

export function fireConfetti() {
  const duration = 2000;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ["#C4622D", "#5C7A6B", "#D4956A", "#8B6F4E"],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ["#C4622D", "#5C7A6B", "#D4956A", "#8B6F4E"],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();
}
