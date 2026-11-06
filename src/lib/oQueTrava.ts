import { parseDateOnly, toISODateBR } from "@/lib/date-br";

/* ═══════════════════════════════════════════════════════════════════════════
   O QUE TRAVA (Início do criador, 06/11/2026, mockup aprovado)

   A mesma conta que o mural do Criando vai usar: três motivos pra um post
   parar no meio do caminho. Só conta, sem banco novo.
     · atrasado: a data marcada já passou e ele não saiu;
     · esperando aprovação: o cliente ou a social mídia ainda não aprovou;
     · sem mídia: está pronto, agendado ou sai até amanhã e não tem arquivo.
   Status do quadro: ideia, roteiro (Planejamento), gravando (Produzindo),
   editando (Pronto), agendado, publicado.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PostTrava = {
  id: string;
  status: string | null;
  scheduled_date: string | null;
  approval_status?: string | null;
  publish_status?: string | null;
  cover_url?: string | null;
};

export const saiu = (p: PostTrava) => p.status === "publicado" || p.publish_status === "publicado";

export function somarDias(iso: string, dias: number): string {
  const d = parseDateOnly(iso);
  d.setDate(d.getDate() + dias);
  return toISODateBR(d);
}

export function atrasado(p: PostTrava, hoje: string): boolean {
  return !!p.scheduled_date && p.scheduled_date.slice(0, 10) < hoje && !saiu(p);
}

export function esperandoAprovacao(p: PostTrava): boolean {
  return p.approval_status === "pendente" && !saiu(p);
}

/** temMidia: o post tem pelo menos um arquivo (ou capa). */
export function semMidia(p: PostTrava, temMidia: boolean, hoje: string): boolean {
  if (temMidia || p.cover_url || saiu(p)) return false;
  if (p.status === "editando" || p.status === "agendado") return true;
  return !!p.scheduled_date && p.scheduled_date.slice(0, 10) <= somarDias(hoje, 1) && p.status === "gravando";
}

export type Trava = "atrasado" | "aprovacao" | "semmidia";

export function travasDoPost(p: PostTrava, temMidia: boolean, hoje: string): Trava[] {
  const t: Trava[] = [];
  if (atrasado(p, hoje)) t.push("atrasado");
  if (esperandoAprovacao(p)) t.push("aprovacao");
  if (semMidia(p, temMidia, hoje)) t.push("semmidia");
  return t;
}

export function contarTravas(posts: PostTrava[], comMidia: Set<string>, hoje: string): Record<Trava, number> {
  const c: Record<Trava, number> = { atrasado: 0, aprovacao: 0, semmidia: 0 };
  for (const p of posts) for (const t of travasDoPost(p, comMidia.has(p.id), hoje)) c[t] += 1;
  return c;
}
