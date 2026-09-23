/* ═══════════════════════════════════════════════════════════════════════════
   PRONTIDÃO DE UMA GRAVAÇÃO (Captação v4, ciclo 1 · 23/09/2026)

   Entre "marcar" e "gravar" existe uma escada que o sistema sempre soube medir
   e nunca mostrou. Uma captação era só "pendente" ou "concluída", então a
   social mídia abria card por card pra descobrir se amanhã estava pronto. Foi
   assim que ela mandou pro cliente um link com roteiro de outro dia: a
   informação existia, mas em nenhum lugar ela via o estado antes de clicar.

   A escada, do chão pro topo:

     marcada      → tem dia, não tem roteiro
     com_roteiro  → tem roteiro escrito (e talvez um link aberto com o cliente)
     revisada     → o cliente devolveu a revisão de TODOS os roteiros do dia
     gravada      → a captação foi concluída (ou todo roteiro está marcado gravado)
     virou_post   → todo roteiro gravado já virou post no Cria Post

   "Guia enviado" ficou de fora de propósito: baixar o PDF não deixa rastro no
   banco, e degrau que não dá pra medir vira chute na tela.

   Este arquivo é puro: recebe listas, devolve um objeto. Sem hook, sem React,
   sem Supabase. É o que permite testar a lógica com node e reaproveitar o
   mesmo cálculo no módulo, na ficha do cliente e na home.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Degrau = "cancelada" | "marcada" | "com_roteiro" | "revisada" | "gravada" | "virou_post";

/** O mínimo que a escada precisa saber de cada coisa. Aceita os tipos reais
    (Capture, CaptureScript, ScriptApproval) porque eles têm esses campos. */
export type CapturaMin = { id: string; status: string; capture_date: string };
export type RoteiroMin = { id: string; capture_id?: string | null; done: boolean; source_post_id: string | null };
export type AprovacaoMin = { status: "aberto" | "enviado" | "aplicado"; itens?: { script_id: string | null }[] };

export type Prontidao = {
  degrau: Degrau;
  /** 0 = cancelada, 1 = marcada ... 5 = virou post. Serve pra ordenar e pintar. */
  nivel: 0 | 1 | 2 | 3 | 4 | 5;
  /** Curto, pra caber num selo: "Sem roteiro", "Cliente revisou"... */
  rotulo: string;
  /** Uma linha a mais quando ajuda: "2 de 5 gravados", "aguardando o cliente". */
  detalhe: string | null;
  /** O que a social mídia faz agora pra subir um degrau. Alimenta a lista
      "Falta pra ficar pronto" da home. Null quando não há nada a fazer. */
  proximoPasso: string | null;
  /** Cor da mensagem: atenção (falta algo dela), espera (falta de outro),
      ok (está bem), neutro (encerrada). */
  tom: "atencao" | "espera" | "ok" | "neutro";
  roteiros: number;
  gravados: number;
  viraramPost: number;
  aguardandoCliente: boolean;
};

const ORDEM: Record<Degrau, Prontidao["nivel"]> = {
  cancelada: 0, marcada: 1, com_roteiro: 2, revisada: 3, gravada: 4, virou_post: 5,
};

/**
 * Calcula em que degrau uma gravação está.
 *
 * `roteiros` pode ser a lista inteira do mês: o filtro por `capture_id` é
 * feito aqui, pra quem chama não ter que lembrar. `aprovacoes` idem: qualquer
 * envio que inclua os roteiros deste dia conta, seja do dia ou do mês inteiro.
 */
export function prontidaoDa(cap: CapturaMin, roteiros: RoteiroMin[], aprovacoes: AprovacaoMin[] = []): Prontidao {
  const meus = roteiros.filter((r) => r.capture_id === cap.id);
  const total = meus.length;
  const gravados = meus.filter((r) => r.done).length;
  const viraramPost = meus.filter((r) => !!r.source_post_id).length;

  if (cap.status === "cancelada") {
    return base("cancelada", "Cancelada", null, null, "neutro", total, gravados, viraramPost, false);
  }

  /* Quais dos meus roteiros já passaram por um envio que o cliente devolveu
     (status "enviado" ou "aplicado"), e quais estão num link ainda aberto.
     Um roteiro escrito DEPOIS do envio não está em nenhum dos dois: por isso
     "revisada" exige que TODOS os roteiros do dia tenham sido devolvidos, não
     só algum. Senão ela adiciona um sexto vídeo e o card continua verde. */
  const devolvidos = new Set<string>();
  const emAberto = new Set<string>();
  for (const a of aprovacoes) {
    for (const it of a.itens ?? []) {
      if (!it.script_id) continue;
      if (a.status === "aberto") emAberto.add(it.script_id);
      else devolvidos.add(it.script_id);
    }
  }
  const revisados = meus.filter((r) => devolvidos.has(r.id)).length;
  const aguardandoCliente = meus.some((r) => emAberto.has(r.id) && !devolvidos.has(r.id));

  const concluida = cap.status === "concluida" || (total > 0 && gravados === total);

  if (concluida) {
    if (total > 0 && viraramPost === total) {
      return base("virou_post", "Virou post", `${total} ${total === 1 ? "post" : "posts"}`, null, "ok", total, gravados, viraramPost, false);
    }
    const faltam = total - viraramPost;
    return base(
      "gravada", "Gravada",
      total === 0 ? "sem roteiro registrado" : `${faltam} ${faltam === 1 ? "roteiro" : "roteiros"} sem virar post`,
      total === 0 ? null : "Virar post",
      total === 0 ? "neutro" : "atencao",
      total, gravados, viraramPost, false,
    );
  }

  if (total === 0) {
    return base("marcada", "Sem roteiro", null, "Escrever roteiro", "atencao", 0, 0, 0, false);
  }

  if (revisados === total) {
    return base(
      "revisada", "Cliente revisou",
      gravados > 0 ? `${gravados} de ${total} gravados` : "pronta pra gravar",
      "Gravar", "ok", total, gravados, viraramPost, false,
    );
  }

  // Tem roteiro, mas o cliente ainda não devolveu tudo.
  if (aguardandoCliente) {
    return base(
      "com_roteiro", "Com roteiro",
      revisados > 0 ? `${revisados} de ${total} revisados, o resto aguarda o cliente` : "aguardando o cliente",
      "Esperar o cliente", "espera", total, gravados, viraramPost, true,
    );
  }
  return base(
    "com_roteiro", "Com roteiro",
    revisados > 0 ? `${total - revisados} ${total - revisados === 1 ? "novo" : "novos"} sem enviar` : "cliente ainda não revisou",
    "Enviar pro cliente", "atencao", total, gravados, viraramPost, false,
  );
}

function base(
  degrau: Degrau, rotulo: string, detalhe: string | null, proximoPasso: string | null, tom: Prontidao["tom"],
  roteiros: number, gravados: number, viraramPost: number, aguardandoCliente: boolean,
): Prontidao {
  return { degrau, nivel: ORDEM[degrau], rotulo, detalhe, proximoPasso, tom, roteiros, gravados, viraramPost, aguardandoCliente };
}

/** Os cinco degraus em ordem, pra desenhar a escada (sem a cancelada). */
export const DEGRAUS: { degrau: Exclude<Degrau, "cancelada">; rotulo: string }[] = [
  { degrau: "marcada", rotulo: "Marcada" },
  { degrau: "com_roteiro", rotulo: "Com roteiro" },
  { degrau: "revisada", rotulo: "Cliente revisou" },
  { degrau: "gravada", rotulo: "Gravada" },
  { degrau: "virou_post", rotulo: "Virou post" },
];
